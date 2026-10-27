-- M1 foundation. No official election rows or candidate positions are seeded.
begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table private.admin_users (
  user_id uuid primary key references auth.users(id),
  created_at timestamptz not null default now()
);
alter table private.admin_users enable row level security;
revoke all on private.admin_users from public, anon, authenticated;
grant select on private.admin_users to authenticated;
create policy read_own_admin_membership on private.admin_users for select to authenticated
  using (user_id = (select auth.uid()));

create table public.source_documents (
  id uuid primary key default gen_random_uuid(),
  authority text not null check (length(trim(authority)) > 0),
  source_kind text not null check (source_kind in ('official','candidate','legislative','media','fixture')),
  url text,
  archive_reference text,
  retrieved_at timestamptz not null,
  published_at timestamptz,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  checksum_scope text not null check (checksum_scope in ('document_bytes','reference_metadata')),
  media_type text not null,
  check (nullif(trim(url),'') is not null or nullif(trim(archive_reference),'') is not null),
  unique (authority, sha256, checksum_scope)
);

create table public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_document_id uuid not null references public.source_documents(id),
  adapter text not null,
  adapter_version text not null,
  status text not null default 'pending' check (status in ('pending','parsed','needs_review','approved','failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  reference_ballot_checked boolean not null default false,
  unresolved_count integer not null default 0 check (unresolved_count >= 0),
  reviewed_by uuid references auth.users(id),
  validation_schema_version integer check (validation_schema_version > 0),
  check (finished_at is null or finished_at >= started_at),
  check (status <> 'approved' or (reference_ballot_checked and unresolved_count = 0 and reviewed_by is not null and finished_at is not null and validation_schema_version is not null)),
  unique (source_document_id, adapter, adapter_version),
  unique (id, source_document_id)
);

create table public.provenance_records (
  id uuid primary key default gen_random_uuid(),
  ingestion_run_id uuid not null,
  source_document_id uuid not null,
  source_record_key text not null check (length(trim(source_record_key)) > 0),
  record_version integer not null check (record_version > 0),
  foreign key (ingestion_run_id, source_document_id) references public.ingestion_runs(id, source_document_id),
  unique (ingestion_run_id, source_record_key, record_version)
);

create table public.jurisdictions (
  id uuid primary key default gen_random_uuid(),
  official_key text not null unique,
  name text not null,
  kind text not null check (kind in ('federal','state','county','city','school','special')),
  parent_id uuid references public.jurisdictions(id),
  provenance_id uuid not null references public.provenance_records(id),
  check (parent_id is distinct from id)
);
-- City and county relationships are many-to-many. Parent is organizational only.
create table public.jurisdiction_overlaps (
  jurisdiction_id uuid not null references public.jurisdictions(id),
  overlapping_jurisdiction_id uuid not null references public.jurisdictions(id),
  provenance_id uuid not null references public.provenance_records(id),
  primary key (jurisdiction_id, overlapping_jurisdiction_id),
  check (jurisdiction_id <> overlapping_jurisdiction_id)
);
create table public.districts (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_id uuid not null references public.jurisdictions(id),
  official_key text not null,
  name text not null,
  provenance_id uuid not null references public.provenance_records(id),
  unique (jurisdiction_id, official_key),
  unique (id, jurisdiction_id)
);
create table public.district_boundaries (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.districts(id),
  version integer not null check (version > 0),
  valid_from date not null,
  valid_to date,
  geometry_geojson jsonb not null check (jsonb_typeof(geometry_geojson) = 'object' and geometry_geojson->>'type' in ('Polygon','MultiPolygon') and jsonb_typeof(geometry_geojson->'coordinates') = 'array'),
  coordinate_reference text not null default 'EPSG:4326' check (coordinate_reference = 'EPSG:4326'),
  provenance_id uuid not null references public.provenance_records(id),
  check (valid_to is null or valid_to > valid_from),
  unique (district_id, version)
);
create table public.elections (
  id uuid primary key default gen_random_uuid(),
  official_key text not null unique,
  name text not null,
  election_date date not null,
  provenance_id uuid not null references public.provenance_records(id)
);
create table public.ballot_styles (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id),
  jurisdiction_id uuid not null references public.jurisdictions(id),
  code text not null,
  verification text not null default 'unverified' check (verification in ('fixture','unverified','officially_verified')),
  completeness text not null default 'unknown' check (completeness in ('unknown','partial','complete')),
  reference_source_id uuid references public.source_documents(id),
  provenance_id uuid not null references public.provenance_records(id),
  check (verification <> 'officially_verified' or reference_source_id is not null),
  check (verification <> 'fixture' or completeness = 'unknown'),
  unique (election_id, jurisdiction_id, code),
  unique (id, election_id)
);
create table public.contests (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id),
  jurisdiction_id uuid not null references public.jurisdictions(id),
  district_id uuid,
  official_key text not null,
  title text not null,
  office_type text not null check (office_type in ('federal','statewide','state_legislative','judicial','county','city','school_board','appraisal_district','special_district','proposition')),
  kind text not null check (kind in ('candidate','measure')),
  election_type text not null check (election_type in ('general','special','runoff')),
  seats integer not null default 1 check (seats > 0),
  research_status text not null default 'not_started' check (research_status in ('not_started','in_review','reviewed')),
  provenance_id uuid not null references public.provenance_records(id),
  foreign key (district_id, jurisdiction_id) references public.districts(id, jurisdiction_id),
  check ((kind = 'measure') = (office_type = 'proposition')),
  unique (election_id, jurisdiction_id, official_key),
  unique (id, election_id),
  unique (id, kind)
);
create table public.contest_ballot_styles (
  contest_id uuid not null,
  ballot_style_id uuid not null,
  election_id uuid not null,
  ballot_order integer not null check (ballot_order > 0),
  provenance_id uuid not null references public.provenance_records(id),
  primary key (contest_id, ballot_style_id),
  foreign key (contest_id, election_id) references public.contests(id, election_id),
  foreign key (ballot_style_id, election_id) references public.ballot_styles(id, election_id),
  unique (ballot_style_id, ballot_order)
);
create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  normalized_name text not null,
  -- Names are not unique person identifiers. Identity ambiguity requires review.
  external_identity_key text unique,
  provenance_id uuid not null references public.provenance_records(id)
);
create table public.candidate_contest_entries (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id),
  contest_id uuid not null,
  contest_kind text not null default 'candidate' check (contest_kind = 'candidate'),
  printed_name text not null check (length(trim(printed_name)) > 0),
  ballot_order integer not null check (ballot_order > 0),
  entry_type text not null check (entry_type in ('printed','qualified_write_in')),
  status text not null default 'active' check (status in ('active','withdrawn','disqualified')),
  provenance_id uuid not null references public.provenance_records(id),
  foreign key (contest_id, contest_kind) references public.contests(id, kind),
  unique (contest_id, candidate_id),
  unique (contest_id, ballot_order)
);
create table public.ballot_measures (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null unique,
  contest_kind text not null default 'measure' check (contest_kind = 'measure'),
  printed_title text not null,
  exact_wording text not null check (length(trim(exact_wording)) > 0),
  response_options text[] not null check (cardinality(response_options) >= 2),
  provenance_id uuid not null references public.provenance_records(id),
  foreign key (contest_id, contest_kind) references public.contests(id, kind)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  stable_key text not null unique,
  provenance_id uuid not null references public.provenance_records(id)
);
create table public.question_jurisdictions (
  question_id uuid not null references public.questions(id),
  jurisdiction_id uuid not null references public.jurisdictions(id),
  primary key (question_id, jurisdiction_id)
);
create table public.question_office_types (
  question_id uuid not null references public.questions(id),
  office_type text not null check (office_type in ('federal','statewide','state_legislative','county','city','school_board','appraisal_district','special_district')),
  primary key (question_id, office_type)
);
create table public.question_versions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id),
  revision integer not null check (revision > 0),
  statement text not null,
  effective_from timestamptz not null,
  provenance_id uuid not null references public.provenance_records(id),
  unique (question_id, revision)
);
create table public.question_response_options (
  question_version_id uuid not null references public.question_versions(id),
  value smallint not null check (value between 1 and 5),
  label text not null,
  primary key (question_version_id, value)
);
create table public.scoring_method_versions (
  id uuid primary key default gen_random_uuid(),
  method_key text not null,
  version integer not null check (version > 0),
  formula text not null,
  default_importance_weight numeric not null check (default_importance_weight > 0),
  minimum_answered integer not null check (minimum_answered > 0),
  minimum_comparable integer not null check (minimum_comparable > 0),
  minimum_coverage numeric not null check (minimum_coverage between 0 and 1),
  conflict_rule text not null check (conflict_rule = 'exclude_unresolved'),
  created_at timestamptz not null default now(),
  unique (method_key, version)
);
create table public.importance_response_options (
  scoring_method_version_id uuid not null references public.scoring_method_versions(id),
  value smallint not null check (value between 1 and 5),
  label text not null,
  weight numeric not null check (weight > 0),
  primary key (scoring_method_version_id, value)
);
-- Reserved opt-in sync models. M1 does not write political responses to a server.
create table public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  scoring_method_version_id uuid not null references public.scoring_method_versions(id),
  consented_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (id, scoring_method_version_id)
);
create table public.user_quiz_responses (
  session_id uuid not null,
  user_id uuid not null,
  question_version_id uuid not null references public.question_versions(id),
  state text not null check (state in ('answered','skipped','unanswered')),
  value smallint,
  updated_at timestamptz not null default now(),
  primary key (session_id, question_version_id),
  foreign key (session_id, user_id) references public.user_sessions(id, user_id) on delete cascade,
  foreign key (question_version_id, value) references public.question_response_options(question_version_id, value),
  check ((state = 'answered' and value is not null and value between 1 and 5) or (state in ('skipped','unanswered') and value is null))
);
create table public.user_importance_responses (
  session_id uuid not null,
  user_id uuid not null,
  question_version_id uuid not null references public.question_versions(id),
  scoring_method_version_id uuid not null,
  value smallint check (value between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (session_id, question_version_id),
  foreign key (session_id, user_id) references public.user_sessions(id, user_id) on delete cascade,
  foreign key (session_id, scoring_method_version_id) references public.user_sessions(id, scoring_method_version_id),
  foreign key (scoring_method_version_id, value) references public.importance_response_options(scoring_method_version_id, value)
);

create table public.evidence_records (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id),
  question_version_id uuid not null references public.question_versions(id),
  source_document_id uuid not null references public.source_documents(id),
  source_type text not null check (source_type in ('recorded_vote','public_statement','interpretation','judicial_record')),
  excerpt text not null check (length(trim(excerpt)) > 0),
  event_date date,
  interpretation text,
  supersedes_evidence_id uuid references public.evidence_records(id),
  provenance_id uuid not null references public.provenance_records(id),
  check (source_type <> 'interpretation' or nullif(trim(interpretation),'') is not null),
  check (supersedes_evidence_id is distinct from id),
  unique (id, candidate_id, question_version_id)
);
create table public.evidence_conflicts (
  evidence_id uuid not null references public.evidence_records(id),
  conflicting_evidence_id uuid not null references public.evidence_records(id),
  explanation text not null,
  primary key (evidence_id, conflicting_evidence_id),
  check (evidence_id <> conflicting_evidence_id)
);
create table public.research_reviews (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null,
  candidate_id uuid not null,
  question_version_id uuid not null,
  reviewer_id uuid not null references auth.users(id),
  decision text not null check (decision in ('approved','rejected','needs_revision')),
  reason text not null check (length(trim(reason)) > 0),
  reviewed_at timestamptz not null default now(),
  foreign key (evidence_id, candidate_id, question_version_id) references public.evidence_records(id, candidate_id, question_version_id),
  unique (id, candidate_id, question_version_id, decision)
);
create table public.candidate_positions (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id),
  question_version_id uuid not null references public.question_versions(id),
  stance smallint not null check (stance between 1 and 5),
  conflict_status text not null check (conflict_status in ('none','resolved','time_dependent','ambiguous','unresolved')),
  explanation text not null check (length(trim(explanation)) > 0),
  review_id uuid not null,
  review_decision text not null default 'approved' check (review_decision = 'approved'),
  provenance_id uuid not null references public.provenance_records(id),
  foreign key (review_id, candidate_id, question_version_id, review_decision) references public.research_reviews(id, candidate_id, question_version_id, decision),
  foreign key (question_version_id, stance) references public.question_response_options(question_version_id, value),
  unique (candidate_id, question_version_id),
  unique (id, candidate_id, question_version_id)
);
create table public.position_evidence (
  position_id uuid not null,
  evidence_id uuid not null,
  candidate_id uuid not null,
  question_version_id uuid not null,
  primary key (position_id, evidence_id),
  foreign key (position_id, candidate_id, question_version_id) references public.candidate_positions(id, candidate_id, question_version_id),
  foreign key (evidence_id, candidate_id, question_version_id) references public.evidence_records(id, candidate_id, question_version_id)
);
create table public.ingestion_diffs (
  id uuid primary key default gen_random_uuid(),
  ingestion_run_id uuid not null references public.ingestion_runs(id),
  entity_type text not null,
  source_record_key text not null,
  change text not null check (change in ('added','changed','removed','conflict','parse_error')),
  before_record jsonb,
  after_record jsonb,
  review_required boolean not null default true,
  reviewed_by uuid references auth.users(id),
  resolution text,
  check (change not in ('removed','conflict','parse_error') or review_required),
  check (reviewed_by is null or nullif(trim(resolution),'') is not null),
  unique (ingestion_run_id, entity_type, source_record_key)
);
create table public.publication_snapshots (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id),
  ingestion_run_id uuid not null references public.ingestion_runs(id),
  version integer not null check (version > 0),
  schema_version integer not null check (schema_version > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  published_at timestamptz not null default now(),
  unique (election_id, version),
  unique (election_id, sha256)
);
create table public.corrections (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.publication_snapshots(id),
  replacement_snapshot_id uuid references public.publication_snapshots(id),
  description text not null,
  status text not null check (status in ('open','accepted','rejected','published')),
  source_document_id uuid not null references public.source_documents(id),
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (replacement_snapshot_id is distinct from snapshot_id),
  check (status <> 'published' or (replacement_snapshot_id is not null and reviewed_by is not null))
);

-- Referencing-column indexes support relationship joins and RLS ownership checks.
do $$
declare item record;
begin
  for item in
    select distinct cls.relname as table_name, att.attname as column_name
    from pg_constraint con
    join pg_class cls on cls.oid = con.conrelid
    join pg_namespace ns on ns.oid = cls.relnamespace
    cross join lateral unnest(con.conkey) as key(attnum)
    join pg_attribute att on att.attrelid = cls.oid and att.attnum = key.attnum
    where con.contype = 'f' and ns.nspname = 'public'
      and cls.relname in ('source_documents','ingestion_runs','provenance_records','jurisdictions','jurisdiction_overlaps','districts','district_boundaries','elections','ballot_styles','contests','contest_ballot_styles','candidates','candidate_contest_entries','ballot_measures','questions','question_jurisdictions','question_office_types','question_versions','question_response_options','scoring_method_versions','importance_response_options','user_sessions','user_quiz_responses','user_importance_responses','evidence_records','evidence_conflicts','research_reviews','candidate_positions','position_evidence','ingestion_diffs','publication_snapshots','corrections')
      and not exists (select 1 from pg_index idx where idx.indrelid = cls.oid and idx.indisvalid and idx.indkey[0] = att.attnum)
  loop
    execute format('create index on public.%I (%I)', item.table_name, item.column_name);
  end loop;
end $$;

create function private.reject_mutation() returns trigger language plpgsql
set search_path = '' as $$
begin
  raise exception 'Immutable record: create a new version instead';
end $$;

create function private.validate_snapshot() returns trigger language plpgsql
set search_path = '' as $$
begin
  new.sha256 := encode(sha256(convert_to(new.payload::text, 'UTF8')), 'hex');
  if not exists (
    select 1 from public.ingestion_runs r
    join public.source_documents s on s.id = r.source_document_id
    where r.id = new.ingestion_run_id and r.status = 'approved'
      and r.reference_ballot_checked and r.unresolved_count = 0
      and s.source_kind = 'official'
  ) then raise exception 'Snapshot requires an approved official import'; end if;
  if exists (select 1 from public.ingestion_diffs d where d.ingestion_run_id = new.ingestion_run_id and d.review_required and d.reviewed_by is null)
    then raise exception 'Snapshot has unresolved import changes'; end if;
  return new;
end $$;
create trigger validate_snapshot before insert on public.publication_snapshots
for each row execute function private.validate_snapshot();

do $$
declare table_name text;
begin
  foreach table_name in array array['source_documents','provenance_records','question_versions','question_response_options','scoring_method_versions','importance_response_options','evidence_records','research_reviews','publication_snapshots'] loop
    execute format('create trigger immutable_record before update or delete on public.%I for each row execute function private.reject_mutation()', table_name);
  end loop;
end $$;

-- Internal working records: no anon access. Admins are provisioned through a
-- trusted database connection, never user-editable metadata or an API insert.
do $$
declare table_name text;
begin
  foreach table_name in array array['source_documents','ingestion_runs','provenance_records','jurisdictions','jurisdiction_overlaps','districts','district_boundaries','elections','ballot_styles','contests','contest_ballot_styles','candidates','candidate_contest_entries','ballot_measures','questions','question_jurisdictions','question_office_types','question_versions','question_response_options','scoring_method_versions','importance_response_options','user_sessions','user_quiz_responses','user_importance_responses','evidence_records','evidence_conflicts','research_reviews','candidate_positions','position_evidence','ingestion_diffs','publication_snapshots','corrections'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from public, anon, authenticated', table_name);
    if table_name not in ('user_sessions','user_quiz_responses','user_importance_responses','publication_snapshots') then
      execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
      execute format('create policy admin_working_records on public.%I for all to authenticated using (exists (select 1 from private.admin_users a where a.user_id = (select auth.uid()))) with check (exists (select 1 from private.admin_users a where a.user_id = (select auth.uid())))', table_name);
    end if;
  end loop;
  foreach table_name in array array['user_sessions','user_quiz_responses','user_importance_responses'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format('create policy own_opt_in_records on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', table_name);
  end loop;
end $$;
-- Only an immutable publication payload can be exposed to visitors. Clients
-- cannot publish. A reviewed server-side publisher is deferred to M2.
grant select on public.publication_snapshots to anon, authenticated;
create policy read_public_snapshots on public.publication_snapshots for select to anon, authenticated using (true);
revoke all on function private.reject_mutation() from public, anon, authenticated;
revoke all on function private.validate_snapshot() from public, anon, authenticated;

commit;
