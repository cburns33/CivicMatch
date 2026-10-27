import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

// Synthetic source records and trusted-operator attestations. No official
// qualification, source review, or style verification is asserted by these tests.
const actor = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const source = "a".repeat(64), cert = "d".repeat(64), run = "b".repeat(64);
const packet = (runId = run) => ({
  schemaVersion: 2, runId, county: "travis", electionDate: "2026-11-03", status: "needs_review", parseScope: "all_master_pages_and_supplements",
  documents: [source, cert].map((sha256, i) => ({ source: { sha256, county: "travis", kind: i ? "write_ins" : "master_ballot", mediaType: "application/pdf", title: "TEST ONLY", url: "https://votetravis.gov/test-only.pdf" }, pages: [{page: 1}], issues: [] })),
  records: [
    { id: "race", sourceSha256: source, sourcePage: 1, sourceColumn: 1, kind: "candidate_contest", printedTitle: "TEST Directors", voteInstruction: "Vote for two", writeInSlot: true,
      candidates: [1, 2].map((ballotOrder) => ({ printedName: "TEST Same Name", printedParty: null, partyCode: null, ballotOrder })),
      declaredWriteIns: [{ printedName: "TEST Write-in", sourceSha256: cert, sourcePage: 1, sourceSheet: "TEST sheet", sourceRow: 5 }] },
    { id: "measure", sourceSha256: source, sourcePage: 1, sourceColumn: 2, kind: "measure", printedTitle: "TEST Proposition A", voteInstruction: null, writeInSlot: false,
      wordingByLanguage: { en: "THIS IS A TAX INCREASE\nIssue $120?", es: "TEXTO DE PRUEBA" }, responseOptions: ["For / A favor", "Against / En contra"], electorateScope: "annexation_territory", candidates: [], declaredWriteIns: [] },
    { id: "declared", sourceSha256: source, sourcePage: 1, sourceColumn: 3, kind: "declaration", printedTitle: "TEST Declared elected", declarationText: "TEST Declared elected, no vote.", candidates: [], declaredWriteIns: [] },
  ], diff: [], reconciliation: { writeIns: [], cancellations: [], issues: [] },
});
const mapping = (runId = run) => ({
  schemaVersion: 1, runId,
  jurisdictions: [{ key: "test-special", name: "TEST Special District", kind: "special", sourceRecordId: "race" }],
  districts: [{ key: "test-district", jurisdictionKey: "test-special", name: "TEST District", sourceRecordId: "race" }],
  records: [
    { recordId: "race", jurisdictionKey: "test-special", districtKey: "test-district", officeType: "special_district", electionType: "general", seats: 2, voteLimit: 2 },
    { recordId: "measure", jurisdictionKey: "test-special", districtKey: null, officeType: "proposition", electionType: "special", seats: 1, voteLimit: 1 },
    { recordId: "declared", jurisdictionKey: "test-special", districtKey: null },
  ],
  styles: [{ code: "TEST-1", language: "en-es", jurisdictionKey: "test-special", referenceSha256: "f".repeat(64), recordIds: ["race", "measure", "declared"] }],
});
let db: PGlite;
async function asReviewer(id = actor) { await db.exec(`set local role authenticated; select set_config('request.jwt.claim.sub','${id}',true)`); }
async function stage(input = mapping()) {
  const result = await db.query<{ sha: string }>("select stage_composition_mapping($1,$2) as sha", [input.runId, JSON.stringify(input)]);
  return result.rows[0].sha;
}
async function report(sha: string) { return (await db.query<{ report: { blockers: string[]; ready: boolean } }>("select composition_publication_status($1) as report", [sha])).rows[0].report; }
async function acceptSourceTasks() {
  const tasks = await db.query<{ id: string; payload: { sourceSha256?: string; sha256?: string } }>("select id,payload from composition_review_tasks where run_sha256=$1", [run]);
  for (const task of tasks.rows) await db.query("select decide_composition_task($1,'accepted','TEST reviewed source record',$2::text[])", [task.id, [task.payload.sourceSha256 || task.payload.sha256 || source]]);
}
async function acceptMapping(sha: string) { await db.query("select review_composition_mapping($1,'accepted','TEST explicit mapping reviewed')", [sha]); }
async function attest(sha: string) {
  await db.exec("reset role");
  await db.query(`insert into private.composition_archive_attestations(draft_sha256,source_manifest,receipt_sha256,checked_by)
    select sha256,payload->'normalized'->'sources',repeat('e',64),$2 from composition_mapping_drafts where sha256=$1`, [sha, actor]);
  await db.query(`insert into private.composition_style_attestations(draft_sha256,style_code,language,reference_sha256,comparison_sha256,membership,reviewer_id)
    select d.sha256,s->>'code',s->>'language',s->>'referenceSha256',repeat('c',64),s->'recordIds',$2 from composition_mapping_drafts d,
      jsonb_array_elements(d.payload->'mapping'->'styles') s where d.sha256=$1`, [sha, actor]);
  await asReviewer();
}
async function publish(sha: string, expected: string | null = null) {
  await db.exec("reset role");
  return (await db.query<{ id: string }>("select private.publish_composition($1,$2) as id", [sha, expected])).rows[0].id;
}
async function ready() { const sha = await stage(); await acceptSourceTasks(); await acceptMapping(sha); await attest(sha); return sha; }

describe("normalized composition mapping and trusted publication", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
    for (const file of readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort()) await db.exec(readFileSync(join("supabase/migrations", file), "utf8"));
  });
  afterAll(async () => { await db?.close(); });
  beforeEach(async () => {
    await db.exec(`begin; insert into auth.users values('${actor}'),('${other}'); insert into private.admin_users(user_id) values('${actor}');`);
    await asReviewer(); await db.query("select stage_composition_batch($1)", [JSON.stringify(packet())]);
  });
  afterEach(async () => { await db.exec("rollback"); });

  it("normalizes source occurrences without name merging or invented write-in ballot order", async () => {
    const sha = await stage(); expect(await stage()).toBe(sha);
    const result = await db.query<{ payload: any }>("select payload from composition_mapping_drafts where sha256=$1", [sha]);
    const { normalized: n, issues } = result.rows[0].payload;
    expect(issues).toEqual([]); expect(n.contests).toHaveLength(2); expect(n.candidates).toHaveLength(3);
    expect(new Set(n.candidates.map((c: any) => c.id)).size).toBe(3);
    expect(n.entries[2]).toMatchObject({ entryType: "qualified_write_in", ballotOrder: null, certificationOrder: 1, provenance: { sourceSha256: cert, sheet: "TEST sheet", row: 5 } });
    expect(n.measures[0].wordingByLanguage).toEqual(packet().records[1].wordingByLanguage);
    expect(n.declarations[0].exactText).toBe(packet().records[2].declarationText);
    expect(n.memberships.map((m: any) => m.ballotOrder)).toEqual([1,2,3]); expect(n.addressEligibilityVerified).toBe(false);
  });
  it("preserves unresolved mapping drafts and refuses their approval", async () => {
    const template = (await db.query<{ value: any }>("select composition_mapping_template($1) as value", [run])).rows[0].value;
    const sha = await stage(template);
    await expect(acceptMapping(sha)).rejects.toThrow(/Incomplete mapping/);
  });
  it("uses source text even if mapping input supplies replacement names", async () => {
    const input = { ...mapping(), normalized: { entries: [{ printedName: "WRONG" }] } };
    const sha = await stage(input);
    const result = await db.query<{ payload: any }>("select payload->'normalized' as payload from composition_mapping_drafts where sha256=$1", [sha]);
    expect(result.rows[0].payload.entries[0].printedName).toBe("TEST Same Name");
  });
  it.each(["district", "office", "seats", "voteLimit"])("blocks invalid explicit %s assignments", async (field) => {
    const input = mapping();
    if (field === "district") input.records[0].districtKey = "missing";
    if (field === "office") input.records[0].officeType = "proposition";
    if (field === "seats") input.records[0].seats = 0;
    if (field === "voteLimit") input.records[0].voteLimit = 3;
    const sha = await stage(input); await expect(acceptMapping(sha)).rejects.toThrow(/Incomplete mapping/);
  });
  it("rejects unknown records, duplicate style members, and wrong source runs", async () => {
    const input = mapping(); input.styles[0].recordIds.push("race");
    await expect(stage(input)).rejects.toThrow(/duplicate style/);
  });
  it("requires all reviews, archive verification, and trusted official style evidence", async () => {
    const sha = await stage();
    expect((await report(sha)).blockers).toEqual(expect.arrayContaining(["source_reviews_or_blockers_open", "mapping_review_missing", "archive_verification_missing", "official_style_evidence_missing"]));
    await expect(publish(sha)).rejects.toThrow(/publication blocked/);
  });
  it("publishes atomically with an immutable payload, checksum, active pointer, and idempotent retry", async () => {
    const sha = await ready(); expect((await report(sha)).ready).toBe(true);
    const id = await publish(sha); expect(await publish(sha)).toBe(id);
    await db.exec("set local role anon");
    const result = await db.query<{ id: string; correct: boolean }>("select id,sha256=encode(sha256(convert_to(payload::text,'UTF8')),'hex') as correct from composition_publications");
    expect(result.rows).toEqual([{ id, correct: true }]);
    expect((await db.query("select snapshot_id from active_composition_publications")).rows).toEqual([{ snapshot_id: id }]);
  });
  it("rejects a stale active-pointer expectation without writing a snapshot", async () => {
    const sha = await ready();
    await expect(publish(sha, other)).rejects.toThrow(/Active publication changed/);
  });
  it("withdraws the active pointer when an accepted mapping review is reopened", async () => {
    const sha = await ready(); await publish(sha); await asReviewer();
    await db.query("select review_composition_mapping($1,'needs_source','TEST mapping evidence reopened')", [sha]);
    expect((await db.query("select * from active_composition_publications")).rows).toEqual([]);
    expect((await db.query("select id from composition_publications")).rows).toHaveLength(1);
  });
  it("withdraws on source review rejection while preserving the immutable snapshot", async () => {
    const sha = await ready(); await publish(sha); await asReviewer();
    const task = (await db.query<{ id: string }>("select id from composition_review_tasks where kind='record' limit 1")).rows[0];
    await db.query("select decide_composition_task($1,'needs_source','TEST source review reopened',$2::text[])", [task.id, [source]]);
    expect((await db.query("select * from active_composition_publications")).rows).toEqual([]);
  });
  it("blocks stale imports and missing contest coverage", async () => {
    const input = mapping(); input.styles[0].recordIds = ["measure"];
    const sha = await stage(input); expect((await report(sha)).blockers).toContain("contest_style_coverage_incomplete");
    await db.query("select stage_composition_batch($1)", [JSON.stringify(packet("c".repeat(64)))]);
    expect((await report(sha)).blockers).toContain("newer_source_import_exists");
  });
  it("hides drafts and denies publisher, pointer, and attestation writes to reviewers", async () => {
    const sha = await stage();
    await expect(db.query("select private.publish_composition($1,null)", [sha])).rejects.toThrow(/permission denied/);
  });
  it("hides drafts from ordinary accounts and denies anonymous mapping access", async () => {
    await stage(); await asReviewer(other);
    expect((await db.query("select * from composition_mapping_drafts")).rows).toEqual([]);
    expect((await db.query("select composition_mapping_template($1) as value", [run])).rows[0]).toEqual({ value: null });
    await db.exec("set local role anon");
    await expect(db.query("select composition_mapping_template($1)", [run])).rejects.toThrow(/permission denied/);
  });
  it("rejects mutation even through the owner connection", async () => {
    const sha = await ready(); await publish(sha);
    await expect(db.exec("update composition_publications set payload='{}'")).rejects.toThrow(/Immutable/);
  });
  it("binds replacement approval to the last published semantic diff", async () => {
    const first = await ready(); const firstSnapshot = await publish(first); await asReviewer();
    const changed = mapping(); changed.jurisdictions[0].name = "TEST Renamed District";
    const second = await stage(changed);
    const diff = (await db.query<{ value: any }>("select composition_mapping_diff($1) as value", [second])).rows[0].value;
    expect(diff.baselineSnapshotId).toBe(firstSnapshot);
    expect(diff.changes).toHaveLength(1);
    expect(diff.changes[0].key).toBe("jurisdiction:test-special");
    await expect(acceptMapping(second)).rejects.toThrow(/baseline changed/);
  });
  it("activates a reviewed replacement and rejects another draft reviewed against the older baseline", async () => {
    const first = await ready(); const firstSnapshot = await publish(first); await asReviewer();
    const drafts: string[] = [];
    for (const name of ["TEST Version Two", "TEST Version Three"]) {
      const changed = mapping(); changed.jurisdictions[0].name = name;
      const sha = await stage(changed); drafts.push(sha);
      await db.query("select review_composition_mapping_against($1,'accepted','TEST compared approved baseline',$2)", [sha, firstSnapshot]);
      await attest(sha);
    }
    const secondSnapshot = await publish(drafts[0], firstSnapshot); await asReviewer();
    expect((await report(drafts[1])).blockers).toContain("publication_baseline_changed");
    await expect(publish(drafts[1], secondSnapshot)).rejects.toThrow(/publication_baseline_changed/);
  });
  it.each(["composition_publications", "active_composition_publications", "composition_mapping_drafts"])("denies direct reviewer writes to %s", async (table) => {
    await expect(db.exec(`insert into ${table} default values`)).rejects.toThrow(/permission denied/);
  });
  it("denies reviewer-supplied trusted attestations", async () => {
    await expect(db.exec("insert into private.composition_style_attestations default values")).rejects.toThrow(/permission denied/);
  });
  it("blocks malformed write-in provenance even with otherwise complete approvals", async () => {
    const altered = packet("c".repeat(64)); altered.records[0].declaredWriteIns![0].sourceSha256 = "e".repeat(64);
    await db.query("select stage_composition_batch($1)", [JSON.stringify(altered)]);
    const sha = await stage(mapping(altered.runId));
    expect((await report(sha)).blockers).toContain("entry_provenance_invalid");
  });
  it("rejects non-string names and keys instead of publishing malformed normalized entities", async () => {
    const input = mapping(); input.jurisdictions[0].name = { invalid: true } as unknown as string;
    await expect(stage(input)).rejects.toThrow(/Invalid mapping field types/);
  });
  it("rejects non-string style membership even when it could be coerced to text", async () => {
    const input = mapping(); input.styles[0].recordIds = [1] as unknown as string[];
    await expect(stage(input)).rejects.toThrow(/Invalid style membership types/);
  });
});
