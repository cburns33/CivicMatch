import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const target = "rsmwpzzypdbpffdeolal";
const packet = JSON.parse(await readFile("data/official/governor-research/proposed.json", "utf8"));
if (packet.version !== "tx-governor-2026-10-27-v1" || packet.review.status !== "pending" || packet.review.reviewer !== null || packet.review.reviewedAt !== null) throw new Error("Only the pending first-race draft can be staged.");
if (JSON.stringify(packet).includes("$$")) throw new Error("Unexpected SQL delimiter in draft.");
for (const source of packet.sources) {
  if (!/^[a-f0-9]{64}$/.test(source.sha256)) throw new Error("Invalid source hash.");
  const bytes = await readFile(`data/official/governor-research/${source.sha256}.html`);
  if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error("Source archive checksum mismatch.");
}
const literal = "'" + JSON.stringify(packet).replaceAll("'", "''") + "'::jsonb";
const sql = `begin;
insert into public.race_guide_drafts(version,payload) values ('tx-governor-2026-10-27-v1',${literal}) on conflict(version) do nothing;
do $$ begin if not exists(select 1 from public.race_guide_drafts where version='tx-governor-2026-10-27-v1' and payload=${literal}) then raise exception 'Immutable draft differs'; end if; end $$;
commit;
select version,sha256 from public.race_guide_drafts where version='tx-governor-2026-10-27-v1';`;
await mkdir("output/governor", { recursive: true });
await writeFile("output/governor/stage-draft.sql", sql);
const cli = "node_modules/supabase/dist/supabase.js";
// Capture CLI output so candidate drafts never enter public logs.
let result;
try { result = execFileSync(process.execPath, [cli, "db", "query", "--linked", "--project-ref", target, "--file", "output/governor/stage-draft.sql", "--output", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
catch { throw new Error("Private draft staging failed; CLI output withheld."); }
await writeFile("output/governor/stage-result.json", result);
console.log(JSON.stringify({ project: target, draft: packet.version, sourcesVerified: packet.sources.length, humanReviews: 0, publications: 0 }));
