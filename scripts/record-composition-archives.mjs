// Trusted operator step for automated byte checks only. It cannot approve a
// mapping, attest a human style review, or publish a composition.
import { createClient } from "@supabase/supabase-js";
import { execFileSync, execSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
const sha = process.argv[2];
if (!/^[a-f0-9]{64}$/.test(sha || "")) throw new Error("Supply a mapping draft SHA-256");
const project = "rsmwpzzypdbpffdeolal";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (url !== `https://${project}.supabase.co` || !key?.startsWith("sb_publishable_")) throw new Error("Unexpected composition target");
const verified = JSON.parse(execFileSync(process.execPath, ["scripts/verify-composition-archives.mjs", sha], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
const receipt = JSON.parse(await readFile(`output/composition/${sha}-archives.json`, "utf8"));
if (verified.draftSha256 !== sha || !/^[a-f0-9]{64}$/.test(verified.receiptSha256) || !receipt.sourceBytesVerified || receipt.humanReviewPerformed) throw new Error("Unexpected archive receipt");
const client = createClient(url, key, { auth: { persistSession: false, detectSessionInUrl: false, autoRefreshToken: false } });
try {
  const login = await client.auth.signInWithPassword({ email: process.env.CIVICMATCH_REVIEWER_EMAIL, password: process.env.CIVICMATCH_REVIEWER_PASSWORD });
  const actor = login.data.user?.id;
  if (login.error || !/^[a-f0-9-]{36}$/.test(actor || "") || (await client.rpc("is_composition_reviewer")).data !== true) throw new Error("Provisioned operator sign-in required");
  const sqlPath = `output/composition/${sha}-archive.sql`;
  const manifest = JSON.stringify(receipt.sourceManifest).replaceAll("'", "''");
  await writeFile(sqlPath, `insert into private.composition_archive_attestations(draft_sha256,source_manifest,receipt_sha256,checked_by)
    select d.sha256,d.payload->'normalized'->'sources','${verified.receiptSha256}','${actor}' from public.composition_mapping_drafts d
    where d.sha256='${sha}' and d.payload->'normalized'->'sources'='${manifest}'::jsonb
      and exists(select 1 from private.admin_users where user_id='${actor}') on conflict(draft_sha256) do nothing;`);
  try { execSync(`npx supabase db query --linked --project-ref ${project} --file ${sqlPath} --output json`, { stdio: ["ignore", "pipe", "pipe"] }); }
  catch { throw new Error("Trusted archive registration failed; captured database output withheld"); }
  const status = await client.rpc("composition_publication_status", { p_draft: sha });
  if (status.error || status.data.blockers.includes("archive_verification_missing")) throw new Error("Archive registration was not verified");
  console.log(JSON.stringify({ draftSha256: sha, sourcesChecked: verified.sourcesChecked, archiveVerificationRecorded: true, humanReviewPerformed: false, publicationPerformed: false }));
} finally { await client.auth.signOut({ scope: "local" }); }
