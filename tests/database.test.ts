import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let db: PGlite;
const seed = `
insert into auth.users(id) values ('${id(1)}'), ('${id(2)}');
insert into private.admin_users(user_id) values ('${id(1)}');
insert into source_documents(id,authority,source_kind,archive_reference,retrieved_at,sha256,checksum_scope,media_type)
values ('${id(1)}','TEST ONLY','official','synthetic-test-metadata',now(),repeat('a',64),'reference_metadata','text/plain');
insert into ingestion_runs(id,source_document_id,adapter,adapter_version,status,reference_ballot_checked,reviewed_by,finished_at,validation_schema_version)
values ('${id(1)}','${id(1)}','test','1','approved',true,'${id(1)}',now(),1);
insert into provenance_records(id,ingestion_run_id,source_document_id,source_record_key,record_version) values ('${id(1)}','${id(1)}','${id(1)}','test',1);
insert into jurisdictions(id,official_key,name,kind,provenance_id) values ('${id(1)}','test-city','TEST ONLY','city','${id(1)}');
insert into districts(id,jurisdiction_id,official_key,name,provenance_id) values ('${id(1)}','${id(1)}','test-district','TEST ONLY','${id(1)}');
insert into elections(id,official_key,name,election_date,provenance_id) values ('${id(1)}','test-election','TEST ONLY','2026-11-03','${id(1)}'), ('${id(2)}','test-election-2','TEST ONLY','2027-05-01','${id(1)}');
insert into ballot_styles(id,election_id,jurisdiction_id,code,provenance_id) values ('${id(1)}','${id(1)}','${id(1)}','TEST','${id(1)}'), ('${id(2)}','${id(2)}','${id(1)}','TEST','${id(1)}');
insert into contests(id,election_id,jurisdiction_id,official_key,title,office_type,kind,election_type,provenance_id) values ('${id(1)}','${id(1)}','${id(1)}','test-contest','TEST ONLY','city','candidate','general','${id(1)}');
insert into candidates(id,normalized_name,provenance_id) values ('${id(1)}','test person','${id(1)}');
insert into candidate_contest_entries(id,candidate_id,contest_id,printed_name,ballot_order,entry_type,provenance_id) values ('${id(1)}','${id(1)}','${id(1)}','TEST Person',1,'printed','${id(1)}');
insert into contest_ballot_styles(contest_id,ballot_style_id,election_id,ballot_order,provenance_id) values ('${id(1)}','${id(1)}','${id(1)}',1,'${id(1)}');
insert into questions(id,stable_key,provenance_id) values ('${id(1)}','test-question','${id(1)}');
insert into question_versions(id,question_id,revision,statement,effective_from,provenance_id) values ('${id(1)}','${id(1)}',1,'TEST ONLY',now(),'${id(1)}');
insert into question_response_options(question_version_id,value,label) select '${id(1)}',n,'test option' from generate_series(1,5) n;
insert into scoring_method_versions(id,method_key,version,formula,default_importance_weight,minimum_answered,minimum_comparable,minimum_coverage,conflict_rule) values ('${id(1)}','test',1,'test',1,5,5,0.6,'exclude_unresolved');
insert into importance_response_options(scoring_method_version_id,value,label,weight) select '${id(1)}',n,'test option',1 from generate_series(1,5) n;
insert into user_sessions(id,user_id,scoring_method_version_id,consented_at) values ('${id(1)}','${id(1)}','${id(1)}',now()), ('${id(2)}','${id(2)}','${id(1)}',now());
`;
async function asUser(user: number) {
  await db.exec(
    `set local role authenticated; select set_config('request.jwt.claim.sub','${id(user)}',true)`,
  );
}

describe("PostgreSQL migration, constraints, and access rules", () => {
  beforeAll(async () => {
    db = new PGlite();
    // Supabase provides these roles and auth objects. This shim tests Postgres
    // rules, not the Supabase JWT gateway or production configuration.
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;`);
    for (const file of readdirSync("supabase/migrations")
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      await db.exec(readFileSync(join("supabase/migrations", file), "utf8"));
    }
  });
  afterAll(async () => {
    await db?.close();
  });
  beforeEach(async () => {
    await db.exec("begin");
    await db.exec(seed);
  });
  afterEach(async () => {
    await db.exec("rollback");
  });

  it("enables RLS on every application table", async () => {
    const result = await db.query<{ count: number }>(
      "select count(*)::int as count from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity",
    );
    expect(result.rows[0].count).toBe(0);
  });
  it("accepts a valid ballot relation and preserves exact printed names", async () => {
    const result = await db.query<{ printed_name: string }>(
      "select printed_name from candidate_contest_entries",
    );
    expect(result.rows[0].printed_name).toBe("TEST Person");
  });
  it.each([
    [
      "duplicate candidate entry",
      `insert into candidate_contest_entries(candidate_id,contest_id,printed_name,ballot_order,entry_type,provenance_id) values ('${id(1)}','${id(1)}','Another spelling',2,'printed','${id(1)}')`,
    ],
    [
      "duplicate ballot link",
      `insert into contest_ballot_styles(contest_id,ballot_style_id,election_id,ballot_order,provenance_id) values ('${id(1)}','${id(1)}','${id(1)}',2,'${id(1)}')`,
    ],
    [
      "cross-election assignment",
      `insert into contest_ballot_styles(contest_id,ballot_style_id,election_id,ballot_order,provenance_id) values ('${id(1)}','${id(2)}','${id(2)}',1,'${id(1)}')`,
    ],
    [
      "unknown candidate",
      `update candidate_contest_entries set candidate_id='${id(99)}'`,
    ],
    [
      "duplicate import",
      `insert into ingestion_runs(source_document_id,adapter,adapter_version) values ('${id(1)}','test','1')`,
    ],
    [
      "measure attached to candidate contest",
      `insert into ballot_measures(contest_id,printed_title,exact_wording,response_options,provenance_id) values ('${id(1)}','test','test',array['For','Against'],'${id(1)}')`,
    ],
    [
      "skipped neutral answer",
      `insert into user_quiz_responses(session_id,user_id,question_version_id,state,value) values ('${id(1)}','${id(1)}','${id(1)}','skipped',3)`,
    ],
    [
      "null answered value",
      `insert into user_quiz_responses(session_id,user_id,question_version_id,state,value) values ('${id(1)}','${id(1)}','${id(1)}','answered',null)`,
    ],
    [
      "response owned by another session user",
      `insert into user_quiz_responses(session_id,user_id,question_version_id,state,value) values ('${id(1)}','${id(2)}','${id(1)}','answered',3)`,
    ],
    [
      "approval without reference ballot validation",
      `update ingestion_runs set reference_ballot_checked=false`,
    ],
  ])("rejects %s", async (_, sql) => {
    await expect(db.exec(sql)).rejects.toThrow();
  });

  it("stores neutral answers and null importance independently", async () => {
    await db.exec(`insert into user_quiz_responses(session_id,user_id,question_version_id,state,value) values ('${id(1)}','${id(1)}','${id(1)}','answered',3);
      insert into user_importance_responses(session_id,user_id,question_version_id,scoring_method_version_id,value) values ('${id(1)}','${id(1)}','${id(1)}','${id(1)}',null)`);
    expect(
      (
        await db.query<{ value: number }>(
          "select value from user_quiz_responses",
        )
      ).rows[0].value,
    ).toBe(3);
    expect(
      (
        await db.query<{ value: null }>(
          "select value from user_importance_responses",
        )
      ).rows[0].value,
    ).toBeNull();
  });
  it("blocks anonymous access to draft candidates", async () => {
    await db.exec("set local role anon");
    await expect(db.query("select * from candidates")).rejects.toThrow(
      /permission denied/,
    );
  });
  it("hides working records from non-admin authenticated users", async () => {
    await asUser(2);
    expect((await db.query("select id from candidates")).rows).toEqual([]);
  });
  it("blocks draft writes by non-admins", async () => {
    await asUser(2);
    await expect(
      db.exec(
        `insert into candidates(normalized_name,provenance_id) values ('test','${id(1)}')`,
      ),
    ).rejects.toThrow(/row-level security/);
  });
  it.each([
    "update candidates set normalized_name='changed'",
    "delete from candidates",
  ])("non-admin cannot mutate existing drafts: %s", async (sql) => {
    await asUser(2);
    await db.exec(sql);
    await db.exec("reset role");
    expect(
      (
        await db.query<{ normalized_name: string }>(
          "select normalized_name from candidates",
        )
      ).rows,
    ).toEqual([{ normalized_name: "test person" }]);
  });
  it("allows a provisioned admin to read and insert working records", async () => {
    await asUser(1);
    expect((await db.query("select id from candidates")).rows).toHaveLength(1);
    await db.exec(
      `insert into candidates(normalized_name,provenance_id) values ('another test','${id(1)}')`,
    );
  });
  it("prevents self-provisioning admin privileges", async () => {
    await asUser(2);
    await expect(
      db.exec(`insert into private.admin_users(user_id) values ('${id(2)}')`),
    ).rejects.toThrow(/permission denied/);
  });
  it("exposes only a user's own opted-in sessions", async () => {
    await asUser(2);
    expect((await db.query("select id from user_sessions")).rows).toEqual([
      { id: id(2) },
    ]);
  });
  it("prevents reassignment of session ownership", async () => {
    await asUser(2);
    await expect(
      db.exec(
        `update user_sessions set user_id='${id(1)}' where id='${id(2)}'`,
      ),
    ).rejects.toThrow(/row-level security/);
  });
  it("makes question revisions immutable", async () => {
    await expect(
      db.exec("update question_versions set statement='changed'"),
    ).rejects.toThrow(/Immutable/);
  });
  it("allows reviewed official snapshots and computes a 64-character checksum", async () => {
    await db.exec(
      `insert into publication_snapshots(election_id,ingestion_run_id,version,schema_version,payload) values ('${id(1)}','${id(1)}',1,1,'{"testOnly":true}')`,
    );
    await db.exec("set local role anon");
    const result = await db.query<{ sha256: string }>(
      "select sha256 from publication_snapshots",
    );
    expect(result.rows[0].sha256).toMatch(/^[a-f0-9]{64}$/);
  });
  it("prevents authenticated clients from publishing", async () => {
    await asUser(1);
    await expect(
      db.exec(
        `insert into publication_snapshots(election_id,ingestion_run_id,version,schema_version,payload) values ('${id(1)}','${id(1)}',1,1,'{}')`,
      ),
    ).rejects.toThrow(/permission denied/);
  });
  it("rejects publication with unresolved diffs", async () => {
    await db.exec(
      `insert into ingestion_diffs(ingestion_run_id,entity_type,source_record_key,change) values ('${id(1)}','contest','missing','removed')`,
    );
    await expect(
      db.exec(
        `insert into publication_snapshots(election_id,ingestion_run_id,version,schema_version,payload) values ('${id(1)}','${id(1)}',1,1,'{}')`,
      ),
    ).rejects.toThrow(/unresolved/);
  });
  it("prevents changing a published snapshot", async () => {
    await db.exec(
      `insert into publication_snapshots(election_id,ingestion_run_id,version,schema_version,payload) values ('${id(1)}','${id(1)}',1,1,'{}')`,
    );
    await expect(
      db.exec("update publication_snapshots set payload='{}'"),
    ).rejects.toThrow(/Immutable/);
  });
  it("requires approved evidence for candidate positions", async () => {
    await db.exec(`insert into evidence_records(id,candidate_id,question_version_id,source_document_id,source_type,excerpt,provenance_id) values ('${id(1)}','${id(1)}','${id(1)}','${id(1)}','public_statement','TEST ONLY','${id(1)}');
      insert into research_reviews(id,evidence_id,candidate_id,question_version_id,reviewer_id,decision,reason) values ('${id(1)}','${id(1)}','${id(1)}','${id(1)}','${id(1)}','rejected','TEST ONLY');`);
    await expect(
      db.exec(
        `insert into candidate_positions(candidate_id,question_version_id,stance,conflict_status,explanation,review_id,provenance_id) values ('${id(1)}','${id(1)}',3,'none','TEST ONLY','${id(1)}','${id(1)}')`,
      ),
    ).rejects.toThrow(/foreign key/);
  });
  it("rejects snapshots from a fixture source even when the run is approved", async () => {
    await db.exec(`insert into source_documents(id,authority,source_kind,archive_reference,retrieved_at,sha256,checksum_scope,media_type) values ('${id(2)}','TEST FIXTURE','fixture','test-reference',now(),repeat('b',64),'reference_metadata','text/plain');
      insert into ingestion_runs(id,source_document_id,adapter,adapter_version,status,reference_ballot_checked,reviewed_by,finished_at,validation_schema_version) values ('${id(2)}','${id(2)}','test','1','approved',true,'${id(1)}',now(),1);`);
    await expect(
      db.exec(
        `insert into publication_snapshots(election_id,ingestion_run_id,version,schema_version,payload) values ('${id(1)}','${id(2)}',1,1,'{}')`,
      ),
    ).rejects.toThrow(/approved official import/);
  });
  it("rejects duplicate snapshot content despite JSON key order", async () => {
    await db.exec(
      `insert into publication_snapshots(election_id,ingestion_run_id,version,schema_version,payload) values ('${id(1)}','${id(1)}',1,1,'{"a":1,"b":2}')`,
    );
    await expect(
      db.exec(
        `insert into publication_snapshots(election_id,ingestion_run_id,version,schema_version,payload) values ('${id(1)}','${id(1)}',2,1,'{"b":2,"a":1}')`,
      ),
    ).rejects.toThrow(/unique constraint/);
  });
  it("prevents deleting a published snapshot", async () => {
    await db.exec(
      `insert into publication_snapshots(election_id,ingestion_run_id,version,schema_version,payload) values ('${id(1)}','${id(1)}',1,1,'{}')`,
    );
    await expect(db.exec("delete from publication_snapshots")).rejects.toThrow(
      /Immutable/,
    );
  });
});
