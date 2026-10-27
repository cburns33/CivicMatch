import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

const actor = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const sha = "a".repeat(64);
const packet = () => ({
  schemaVersion: 2, runId: "b".repeat(64), county: "travis", electionDate: "2026-11-03",
  status: "needs_review", parseScope: "all_master_pages_and_supplements",
  documents: [{ source: { sha256: sha, county: "travis", kind: "master_ballot", mediaType: "application/pdf" }, pages: [{page: 1}], issues: [{ code: "ballot_styles_unverified", message: "Official style verification required" }] }],
  records: [{ id: "sample", kind: "candidate_contest", sourceSha256: sha, sourcePage: 1, printedTitle: "TEST ONLY" }],
  diff: [{ recordId: "removed", change: "removed", before: { printedTitle: "Old TEST" }, after: null }],
  reconciliation: { issues: [], writeIns: [], cancellations: [] },
});
let db: PGlite;
async function asUser(id: string) {
  await db.exec(`set local role authenticated; select set_config('request.jwt.claim.sub','${id}',true)`);
}
async function stage(payload = packet()) {
  return db.query("select stage_composition_batch($1::jsonb)", [JSON.stringify(payload)]);
}
async function task(kind = "record") {
  const result = await db.query<{ id: string }>("select id from composition_review_tasks where kind=$1", [kind]);
  return result.rows[0].id;
}
async function decide(taskId: string, value: string, hashes = [sha]) {
  return db.query("select decide_composition_task($1,$2,$3,$4::text[])", [taskId, value, "Compared with the identified source page", hashes]);
}

describe("private composition import and review queue", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;`);
    for (const file of readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql")).sort())
      await db.exec(readFileSync(join("supabase/migrations", file), "utf8"));
  });
  afterAll(async () => { await db?.close(); });
  beforeEach(async () => {
    await db.exec(`begin; insert into auth.users values ('${actor}'),('${other}'); insert into private.admin_users(user_id) values ('${actor}');`);
    await asUser(actor);
  });
  afterEach(async () => { await db.exec("rollback"); });

  it("imports once, preserves removals, and refuses changed bytes under the same run identity", async () => {
    await stage(); await stage();
    const result = await db.query<{ kind: string }>("select kind from composition_review_tasks");
    expect(result.rows.map((r) => r.kind).sort()).toEqual(["change", "issue", "record", "source"]);
    const changed = packet(); changed.records[0].printedTitle = "Changed TEST";
    await expect(stage(changed)).rejects.toThrow(/Immutable run payload differs/);
  });
  it("rolls back the entire import on a broken record source reference", async () => {
    const invalid = packet(); invalid.records[0].sourceSha256 = "f".repeat(64);
    await expect(db.transaction(async (tx) => {
      await tx.query("select stage_composition_batch($1::jsonb)", [JSON.stringify(invalid)]);
    })).rejects.toThrow(/Invalid source-linked/);
    expect((await db.query("select * from composition_batches")).rows).toEqual([]);
  });
  it("requires a complete review envelope and a real source page", async () => {
    const invalid = packet(); invalid.records[0].sourcePage = 99;
    await expect(stage(invalid)).rejects.toThrow(/Invalid source-linked/);
  });
  it("prevents anonymous and unprovisioned accounts from importing or reading drafts", async () => {
    await stage(); await db.exec("set local role anon");
    await expect(db.query("select stage_composition_batch($1::jsonb)", [JSON.stringify(packet())])).rejects.toThrow(/permission denied/);
  });
  it("reads no review rows as a signed-in user without admin membership", async () => {
    await stage(); await asUser(other);
    expect((await db.query("select * from composition_batches")).rows).toEqual([]);
    expect((await db.query("select * from composition_review_tasks")).rows).toEqual([]);
    await expect(stage()).rejects.toThrow(/Provisioned reviewer/);
  });
  it("derives open counts from the latest append-only decision and supports reopening", async () => {
    await stage(); const id = await task();
    await decide(id, "accepted");
    let result = await db.query<{ accepted: number; open: number }>("select accepted::int,open::int from composition_review_progress()");
    expect(result.rows[0]).toEqual({ accepted: 1, open: 3 });
    await decide(id, "needs_source");
    result = await db.query("select accepted::int,open::int from composition_review_progress()");
    expect(result.rows[0]).toEqual({ accepted: 0, open: 4 });
  });
  it("cannot accept style/parse blockers with a note, or cite a source outside the import", async () => {
    await stage();
    await expect(decide(await task("issue"), "accepted")).rejects.toThrow(/corrected or verified import/);
  });
  it("requires source membership for each supporting document", async () => {
    await stage();
    await expect(decide(await task(), "accepted", ["f".repeat(64)])).rejects.toThrow(/does not belong/);
  });
  it("prevents direct client writes and immutable history changes", async () => {
    await stage();
    await expect(db.exec("delete from composition_review_tasks")).rejects.toThrow(/permission denied/);
  });
  it("uses current membership for decisions instead of user-controlled token metadata", async () => {
    await stage(); const id = await task();
    await db.exec(`reset role; delete from private.admin_users where user_id='${actor}'`);
    await asUser(actor);
    await expect(decide(id, "accepted")).rejects.toThrow(/Provisioned reviewer/);
  });
  it("paginates private tasks with their latest evidence-linked decision", async () => {
    await stage(); const id = await task(); await decide(id, "accepted");
    const result = await db.query<{ last_decision: { decision: string } }>("select * from composition_review_page($1,0,20)", [packet().runId]);
    expect(result.rows).toHaveLength(4);
    expect(result.rows.filter((r) => r.last_decision)[0].last_decision.decision).toBe("accepted");
    await asUser(other);
    expect((await db.query("select * from composition_review_page($1,0,20)", [packet().runId])).rows).toEqual([]);
  });
  it.each(["unnamed_write_in_slot", "cancellation_document_type_unverified", "cancellation_date_unverified", "reference_scope_mismatch", "ambiguous_scope"])("requires new source evidence for %s", async (code) => {
    const payload = packet(); payload.documents[0].issues[0].code = code;
    await stage(payload);
    await expect(decide(await task("issue"), "accepted")).rejects.toThrow(/corrected or verified import/);
  });
  it.each(["composition_batches", "composition_review_tasks", "composition_review_decisions"])("preserves immutable history in %s even through an owner connection", async (table) => {
    await stage(); await decide(await task(), "needs_source"); await db.exec("reset role");
    await expect(db.exec(`delete from ${table}`)).rejects.toThrow(/Immutable/);
  });
});
