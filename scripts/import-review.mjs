// Import verified local archive bytes into a private review store. No decisions
// or publication are produced by this command.
import { PGlite } from "@electric-sql/pglite";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFile, readdir, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";

const root = resolve(import.meta.dirname, "..");
const store = join(root, "data", "official");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const hosted = process.argv.includes("--hosted");
const packets = [];
for (const county of ["travis", "harris"]) {
  const packet = JSON.parse(await readFile(join(store, "latest", `${county}.json`), "utf8"));
  for (const { source } of packet.documents) {
    if (!/^[a-f0-9]{64}$/.test(source.sha256) || source.archivePath !== `documents/${source.sha256}.pdf`)
      throw new Error("Invalid content-addressed source reference");
    if (hash(await readFile(join(store, source.archivePath))) !== source.sha256)
      throw new Error("Archived source checksum mismatch");
  }
  packets.push(packet);
}

if (hosted) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const email = process.env.CIVICMATCH_REVIEWER_EMAIL;
  const password = process.env.CIVICMATCH_REVIEWER_PASSWORD;
  if (!url || !key || !email || !password) throw new Error("A confirmed project and provisioned reviewer credentials are required");
  const client = createClient(url, key, { auth: { persistSession: false, detectSessionInUrl: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error("Reviewer sign-in failed");
  try {
    for (const packet of packets) {
      const { error } = await client.rpc("stage_composition_batch", { p_payload: packet });
      if (error) throw new Error(`Review import failed for ${packet.county}: ${error.message}`);
      console.log(JSON.stringify({ county: packet.county, run: packet.runId, environment: "hosted", status: "staged_only" }));
    }
  } finally { await client.auth.signOut({scope: "local"}); }
} else {
  const directory = join(root, "data", "review-db");
  await mkdir(directory, { recursive: true });
  const db = new PGlite(directory);
  try {
    await db.exec(`do $$ begin
      if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
      if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
    end $$;
    create schema if not exists auth; create table if not exists auth.users(id uuid primary key);
    create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
    create schema if not exists private;
    create table if not exists private.local_review_migrations(name text primary key, sha256 text not null);`);
    for (const file of (await readdir(join(root, "supabase", "migrations"))).filter((f) => f.endsWith(".sql")).sort()) {
      const sql = await readFile(join(root, "supabase", "migrations", file), "utf8");
      const existing = await db.query("select sha256 from private.local_review_migrations where name=$1", [file]);
      if (existing.rows.length) {
        if (existing.rows[0].sha256 !== hash(sql)) throw new Error("Applied migration changed; use a new migration");
        continue;
      }
      await db.transaction(async (tx) => {
        await tx.exec(sql.replace(/^begin;\s*$/m, "").replace(/commit;\s*$/, ""));
        await tx.query("insert into private.local_review_migrations values($1,$2)", [file, hash(sql)]);
      });
    }
    const localActor = "00000000-0000-4000-8000-000000000001";
    // This is an explicit local Auth shim, never a named human reviewer.
    await db.query("insert into auth.users(id) values($1) on conflict do nothing", [localActor]);
    await db.query("insert into private.admin_users(user_id) values($1) on conflict do nothing", [localActor]);
    await db.transaction(async (tx) => {
      await tx.exec("set local role authenticated");
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [localActor]);
      for (const packet of packets) await tx.query("select stage_composition_batch($1::jsonb)", [JSON.stringify(packet)]);
      const result = await tx.query("select county,run_sha256,total::int,accepted::int,open::int,requires_new_import::int from composition_review_progress()");
      console.log(JSON.stringify({ environment: "local_auth_shim", imports: result.rows, publication: "blocked" }));
    });
  } finally { await db.close(); }
}
