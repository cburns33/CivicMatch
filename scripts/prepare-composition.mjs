// Build immutable private mapping drafts. Never accepts a review or publishes.
import { createClient } from "@supabase/supabase-js";
import { PGlite } from "@electric-sql/pglite";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";

const root = resolve(import.meta.dirname, "..");
const store = join(root, "data", "official");
const hosted = process.argv.includes("--hosted");
let client, db;
if (hosted) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (url !== "https://rsmwpzzypdbpffdeolal.supabase.co" || !key?.startsWith("sb_publishable_")) throw new Error("Unexpected composition project or key type");
  client = createClient(url, key, { auth: { persistSession: false, detectSessionInUrl: false, autoRefreshToken: false } });
  const login = await client.auth.signInWithPassword({ email: process.env.CIVICMATCH_REVIEWER_EMAIL, password: process.env.CIVICMATCH_REVIEWER_PASSWORD });
  if (login.error) throw new Error("Provisioned reviewer sign-in required");
} else {
  execFileSync(process.execPath, [join(root, "scripts/import-review.mjs")], { cwd: root, stdio: "pipe" });
  db = new PGlite(join(root, "data", "review-db"));
}
async function rpc(name, args) {
  if (client) {
    const { data, error } = await client.rpc(name, args);
    if (error) throw new Error(`Composition operation failed: ${name}`);
    return data;
  }
  return db.transaction(async (tx) => {
    await tx.exec("set local role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true)");
    const parameters = Object.values(args);
    return (await tx.query(`select public.${name}(${parameters.map((_, i) => `$${i + 1}`).join(",")}) as value`, parameters.map((v) => typeof v === "object" ? JSON.stringify(v) : v))).rows[0].value;
  });
}
async function immutableFile(path, value) {
  try { await writeFile(path, JSON.stringify(value, null, 2), { flag: "wx" }); }
  catch (error) { if (error.code !== "EEXIST") throw error; }
}
try {
  await mkdir(join(store, "mappings"), { recursive: true });
  await mkdir(join(store, "normalized"), { recursive: true });
  const report = [];
  for (const county of ["travis", "harris"]) {
    const current = JSON.parse(await readFile(join(store, "latest", `${county}.json`), "utf8"));
    const mappingPath = join(store, "mappings", `${county}-${current.runId}.json`);
    const template = await rpc("composition_mapping_template", { p_run: current.runId });
    if (!template) throw new Error("Current source import is unavailable");
    await immutableFile(mappingPath, template);
    const mapping = JSON.parse(await readFile(mappingPath, "utf8"));
    const draft = await rpc("stage_composition_mapping", { p_run: current.runId, p_mapping: mapping });
    const artifact = await rpc("preview_composition_mapping", { p_run: current.runId, p_mapping: mapping });
    const preflight = await rpc("composition_publication_status", { p_draft: draft });
    await immutableFile(join(store, "normalized", `${draft}.json`), artifact);
    report.push({ county, draftSha256: draft, contests: artifact.normalized.contests.length, entries: artifact.normalized.entries.length,
      measures: artifact.normalized.measures.length, declarations: artifact.normalized.declarations.length,
      mappingIssues: artifact.issues.length, publication: preflight.ready ? "ready_for_trusted_operator" : "blocked", blockers: preflight.blockers });
  }
  await mkdir(join(root, "output", "composition"), { recursive: true });
  await writeFile(join(root, "output", "composition", `${hosted ? "hosted" : "local"}-preflight.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ environment: hosted ? "hosted" : "local_auth_shim", drafts: report, decisionsCreated: 0, publicationsCreated: 0 }));
} finally {
  if (client) await client.auth.signOut({ scope: "local" });
  if (db) await db.close();
}
