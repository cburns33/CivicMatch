// Read-only operator report. No review decisions, approvals, or publication.
import { createClient } from "@supabase/supabase-js";
import { readFile, mkdir, writeFile } from "node:fs/promises";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (url !== "https://rsmwpzzypdbpffdeolal.supabase.co" || !key?.startsWith("sb_publishable_")) throw new Error("Unexpected review project or key type");
const client = createClient(url, key, { auth: { persistSession: false, detectSessionInUrl: false, autoRefreshToken: false } });
try {
  const login = await client.auth.signInWithPassword({ email: process.env.CIVICMATCH_REVIEWER_EMAIL, password: process.env.CIVICMATCH_REVIEWER_PASSWORD });
  if (login.error || (await client.rpc("is_composition_reviewer")).data !== true) throw new Error("Provisioned reviewer sign-in required");
  const counties = await Promise.all(["travis", "harris"].map(async (county) => {
    const current = JSON.parse(await readFile(`data/official/latest/${county}.json`, "utf8"));
    const { data, error } = await client.rpc("composition_review_readiness", { p_run: current.runId });
    if (error || !data || data.runId !== current.runId || data.county !== county || data.publicationEnabled !== false ||
      data.total !== data.open + data.accepted || data.open !== data.reviewableOpen + data.blocked) throw new Error("Readiness report failed consistency checks");
    return data;
  }));
  await mkdir("output/readiness", { recursive: true });
  await writeFile("output/readiness/current.json", JSON.stringify({ checkedAt: new Date().toISOString(), counties }, null, 2));
  console.log(JSON.stringify({ counties: counties.map(({ county, total, accepted, reviewableOpen, blocked }) => ({ county, total, accepted, reviewableOpen, blocked })), publication: "unavailable" }));
  process.exitCode = 2;
} finally { await client.auth.signOut({ scope: "local" }); }
