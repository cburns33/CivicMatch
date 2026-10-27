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
  for (const row of progress.data) {
    const summary = await reviewer.rpc("composition_review_readiness", { p_run: row.run_sha256 });
    verify(!summary.error && summary.data?.runId === row.run_sha256 && summary.data.total === row.total && summary.data.accepted === 0 &&
      summary.data.reviewableOpen + summary.data.blocked === row.open && summary.data.publicationEnabled === false, `${row.county}_readiness_matches_current_import`);
    const reviewable = await reviewer.rpc("composition_review_search", { p_run: row.run_sha256, p_state: "reviewable", p_limit: 1 });
    verify(!reviewable.error && reviewable.data.length === 1 && !reviewable.data[0].requires_new_import && Number(reviewable.data[0].matched_total) === summary.data.reviewableOpen,
      `${row.county}_reviewable_filter_excludes_hard_blockers`);
    const blocked = await reviewer.rpc("composition_review_search", { p_run: row.run_sha256, p_state: "blocked", p_limit: 1 });
    verify(!blocked.error && blocked.data.length === 1 && blocked.data[0].requires_new_import && Number(blocked.data[0].matched_total) === summary.data.blocked,
      `${row.county}_blocked_filter_matches_readiness`);
    const mapping = await reviewer.from("composition_mapping_drafts").select("sha256").eq("run_sha256", row.run_sha256).order("created_at", { ascending: false }).limit(1);
    verify(!mapping.error && mapping.data.length === 1, `${row.county}_normalized_draft_visible`);
    const draftSha = mapping.data[0].sha256;
    const preflight = await reviewer.rpc("composition_publication_status", { p_draft: draftSha });
    verify(!preflight.error && !preflight.data.ready && preflight.data.blockers.includes("mapping_incomplete") && preflight.data.blockers.includes("source_reviews_or_blockers_open"), `${row.county}_publication_preflight_blocks_pending_evidence`);
    if (!/^[a-f0-9]{64}$/.test(draftSha) || !/^[a-f0-9-]{36}$/.test(ownerLogin.data.user.id)) throw new Error("Unexpected verification identity");
    const guardPath = `output/hosted-setup/${row.county}-publisher-guard.sql`;
    await writeFile(guardPath, `do $verify$ declare message text; begin
      perform set_config('request.jwt.claim.sub','${ownerLogin.data.user.id}',true);
      begin
        perform private.publish_composition('${draftSha}',null);
        raise exception 'Unexpected publication success';
      exception when raise_exception then
        get stacked diagnostics message=message_text;
        if message not like 'Composition publication blocked:%' then raise exception 'Publisher guard verification failed'; end if;
      end;
    end $verify$;`);
    run(`npx supabase db query --linked --project-ref ${project} --file ${guardPath} --output json`);
    checks[`${row.county}_trusted_publisher_rejects_pending_draft_without_commit`] = true;
  }
  const queue = await reviewer.rpc("composition_review_page", { p_run: first.run_sha256, p_offset: 0, p_limit: 1 });
  verify(!queue.error && queue.data.length === 1, "reviewer_can_read_bounded_queue");
  const source = await reviewer.from("composition_review_tasks").select("payload").eq("run_sha256", first.run_sha256).eq("kind", "source").limit(1);
  const blocker = await reviewer.from("composition_review_tasks").select("id").eq("run_sha256", first.run_sha256).eq("requires_new_import", true).limit(1);
  const decision = await reviewer.rpc("decide_composition_task", { p_task_id: blocker.data[0].id, p_decision: "accepted", p_note: "Verification only: this request must be rejected.", p_source_hashes: [source.data[0].payload.sha256] });
  verify(decision.error?.code === "P0001" && /requires/.test(decision.error.message), "hard_blocker_cannot_be_accepted");
  const publicDraft = await visitor.from("composition_batches").select("run_sha256").limit(1);
  verify(publicDraft.error?.code === "42501", "anonymous_draft_read_denied");
  verify(Boolean((await visitor.rpc("composition_review_progress")).error), "anonymous_review_rpc_denied");
  verify(Boolean((await visitor.rpc("composition_review_readiness", { p_run: first.run_sha256 })).error), "anonymous_readiness_denied");
  verify(Boolean((await visitor.rpc("composition_review_search", { p_run: first.run_sha256, p_limit: 1 })).error), "anonymous_search_denied");
  verify(Boolean((await visitor.rpc("composition_mapping_template", { p_run: first.run_sha256 })).error), "anonymous_mapping_denied");
  const publishedComposition = await visitor.from("composition_publications").select("id").limit(1);
  const activeComposition = await visitor.from("active_composition_publications").select("snapshot_id").limit(1);
  verify(!publishedComposition.error && !activeComposition.error && publishedComposition.data.length === 0 && activeComposition.data.length === 0, "no_official_composition_or_active_pointer_published");
  const publicSnapshot = await visitor.from("publication_snapshots").select("id").limit(1);
  verify(!publicSnapshot.error && publicSnapshot.data.length === 0, "no_official_snapshot_published");
  const directWrite = await reviewer.from("composition_review_tasks").insert({});
  verify(directWrite.error?.code === "42501", "reviewer_direct_draft_write_denied");
  const publicationWrite = await reviewer.from("publication_snapshots").insert({});
  verify(publicationWrite.error?.code === "42501", "reviewer_direct_publication_denied");
  verify((await reviewer.from("composition_publications").insert({})).error?.code === "42501", "reviewer_composition_publication_denied");
  verify((await reviewer.from("active_composition_publications").insert({})).error?.code === "42501", "reviewer_active_pointer_write_denied");
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
  const ordinaryMappings = await ordinary.from("composition_mapping_drafts").select("sha256").limit(1);
  verify(!ordinaryMappings.error && ordinaryMappings.data.length === 0, "ordinary_user_normalized_drafts_hidden");
  const hiddenReadiness = await ordinary.rpc("composition_review_readiness", { p_run: first.run_sha256 });
  const hiddenSearch = await ordinary.rpc("composition_review_search", { p_run: first.run_sha256, p_limit: 1 });
  verify(!hiddenReadiness.error && hiddenReadiness.data === null && !hiddenSearch.error && hiddenSearch.data.length === 0, "ordinary_user_readiness_and_search_hidden");
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
  const revokedReadiness = await ordinary.rpc("composition_review_readiness", { p_run: first.run_sha256 });
  verify(!revokedReadiness.error && revokedReadiness.data === null, "readiness_hidden_after_same_jwt_revocation");
  const decisions = await reviewer.from("composition_review_decisions").select("sequence", { count: "exact", head: true });
  verify(!decisions.error && decisions.count === 0, "verification_left_no_review_decisions");
  const mappingDecisions = await reviewer.from("composition_mapping_reviews").select("sequence", { count: "exact", head: true });
  verify(!mappingDecisions.error && mappingDecisions.count === 0, "verification_left_no_mapping_approvals");
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
