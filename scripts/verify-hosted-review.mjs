// Live Auth/Data API checks. Creates and removes one synthetic non-reviewer.
// Does not create decisions, approve imports, or change ballot records.
import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";

const project = "rsmwpzzypdbpffdeolal";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (url !== `https://${project}.supabase.co` || !key?.startsWith("sb_publishable_")) throw new Error("Unexpected hosted verification target or key type");
const run = (command) => {
  try { return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
  catch { throw new Error("Supabase CLI operation failed; captured output withheld"); }
};
const serverKey = JSON.parse(run(`npx supabase projects api-keys --project-ref ${project} --reveal --output json`)).find((row) => row.type === "secret")?.api_key;
if (!serverKey?.startsWith("sb_secret_")) throw new Error("Server-only verification key unavailable");
const client = (apiKey = key) => createClient(url, apiKey, { auth: { persistSession: false, detectSessionInUrl: false, autoRefreshToken: false } });
const admin = client(serverKey), reviewer = client(), ordinary = client(), visitor = client();
const checks = {};
const verify = (condition, label) => { if (!condition) throw new Error(`Hosted check failed: ${label}`); checks[label] = true; };
let testId;
await mkdir("output/hosted-setup", { recursive: true });
try {
  const ownerLogin = await reviewer.auth.signInWithPassword({ email: process.env.CIVICMATCH_REVIEWER_EMAIL, password: process.env.CIVICMATCH_REVIEWER_PASSWORD });
  verify(!ownerLogin.error, "reviewer_password_sign_in");
  verify((await reviewer.rpc("is_composition_reviewer")).data === true, "reviewer_membership");
  const currentRuns = await Promise.all(["travis", "harris"].map(async (county) => JSON.parse(await readFile(`data/official/latest/${county}.json`, "utf8")).runId));
  const progress = await reviewer.rpc("composition_review_progress").in("run_sha256", currentRuns);
  verify(!progress.error && progress.data.length === 2, "both_county_imports_visible_to_reviewer");
  verify(progress.data.every((row) => row.accepted === 0 && row.open === row.total), "no_fabricated_approvals");
  const first = progress.data[0];
  const queue = await reviewer.rpc("composition_review_page", { p_run: first.run_sha256, p_offset: 0, p_limit: 1 });
  verify(!queue.error && queue.data.length === 1, "reviewer_can_read_bounded_queue");
  const source = await reviewer.from("composition_review_tasks").select("payload").eq("run_sha256", first.run_sha256).eq("kind", "source").limit(1);
  const blocker = await reviewer.from("composition_review_tasks").select("id").eq("run_sha256", first.run_sha256).eq("requires_new_import", true).limit(1);
  const decision = await reviewer.rpc("decide_composition_task", { p_task_id: blocker.data[0].id, p_decision: "accepted", p_note: "Verification only: this request must be rejected.", p_source_hashes: [source.data[0].payload.sha256] });
  verify(decision.error?.code === "P0001" && /requires/.test(decision.error.message), "hard_blocker_cannot_be_accepted");
  const publicDraft = await visitor.from("composition_batches").select("run_sha256").limit(1);
  verify(publicDraft.error?.code === "42501", "anonymous_draft_read_denied");
  verify(Boolean((await visitor.rpc("composition_review_progress")).error), "anonymous_review_rpc_denied");
  const publicSnapshot = await visitor.from("publication_snapshots").select("id").limit(1);
  verify(!publicSnapshot.error && publicSnapshot.data.length === 0, "no_official_snapshot_published");
  const directWrite = await reviewer.from("composition_review_tasks").insert({});
  verify(directWrite.error?.code === "42501", "reviewer_direct_draft_write_denied");
  const publicationWrite = await reviewer.from("publication_snapshots").insert({});
  verify(publicationWrite.error?.code === "42501", "reviewer_direct_publication_denied");
  const privateApi = await reviewer.schema("private").from("admin_users").select("user_id").limit(1);
  verify(privateApi.error?.code === "PGRST106", "private_schema_is_not_exposed_by_api");

  const email = `civicmatch-security-${randomUUID()}@example.invalid`;
  const password = randomBytes(28).toString("base64url") + "-Aa1";
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { admin: true, role: "admin" } });
  verify(!created.error, "synthetic_nonreviewer_created_without_email");
  testId = created.data.user.id;
  const login = await ordinary.auth.signInWithPassword({ email, password });
  verify(!login.error, "ordinary_user_real_jwt");
  verify((await ordinary.rpc("is_composition_reviewer")).data === false, "user_metadata_does_not_grant_access");
  const ordinaryRows = await ordinary.from("composition_review_tasks").select("id").limit(1);
  verify(!ordinaryRows.error && ordinaryRows.data.length === 0, "ordinary_user_draft_rows_hidden");
  verify(Boolean((await ordinary.rpc("stage_composition_batch", { p_payload: {} })).error), "ordinary_user_import_denied");

  const parts = login.data.session.access_token.split(".");
  const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  claims.sub = ownerLogin.data.user.id;
  parts[1] = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const forged = await fetch(`${url}/rest/v1/rpc/is_composition_reviewer`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${parts.join(".")}`, "Content-Type": "application/json" }, body: "{}" });
  verify(forged.status === 401, "forged_jwt_rejected_by_gateway");

  const sqlPath = "output/hosted-setup/test-membership.sql";
  await writeFile(sqlPath, `insert into private.admin_users(user_id) values ('${testId}');`);
  run(`npx supabase db query --linked --project-ref ${project} --file ${sqlPath} --output json`);
  verify((await ordinary.rpc("is_composition_reviewer")).data === true, "live_membership_grant_observed");
  await writeFile(sqlPath, `delete from private.admin_users where user_id='${testId}';`);
  run(`npx supabase db query --linked --project-ref ${project} --file ${sqlPath} --output json`);
  verify((await ordinary.rpc("is_composition_reviewer")).data === false, "membership_revocation_effective_with_same_jwt");
  const decisions = await reviewer.from("composition_review_decisions").select("sequence", { count: "exact", head: true });
  verify(!decisions.error && decisions.count === 0, "verification_left_no_review_decisions");
} finally {
  if (testId) {
    const path = "output/hosted-setup/remove-test-membership.sql";
    await writeFile(path, `delete from private.admin_users where user_id='${testId}';`);
    run(`npx supabase db query --linked --project-ref ${project} --file ${path} --output json`);
    await ordinary.auth.signOut({ scope: "local" });
    const removed = await admin.auth.admin.deleteUser(testId);
    if (removed.error) throw new Error("Synthetic verification account cleanup failed");
    checks.synthetic_account_removed = true;
  }
  await reviewer.auth.signOut({ scope: "local" });
  await writeFile("output/hosted-setup/auth-api-verification.json", JSON.stringify({ project, checkedAt: new Date().toISOString(), checks, reviewDecisionsCreated: 0 }, null, 2));
}
console.log(JSON.stringify({ project, checksPassed: Object.keys(checks).length, allPassed: Object.values(checks).every(Boolean), reviewDecisionsCreated: 0 }));
