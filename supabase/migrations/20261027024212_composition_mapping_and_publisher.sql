begin;

-- M2 composition artifacts are separate from the M1 generic research snapshots.
create table public.composition_mapping_drafts (
  sha256 text primary key check (sha256 ~ '^[a-f0-9]{64}$'),
  run_sha256 text not null references public.composition_batches(run_sha256),
  payload jsonb not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.composition_mapping_reviews (
  sequence bigint generated always as identity primary key,
  draft_sha256 text not null references public.composition_mapping_drafts(sha256),
  reviewer_id uuid not null references auth.users(id),
  decision text not null check (decision in ('accepted','rejected','needs_source')),
  note text not null check (length(trim(note))>=10),
  reviewed_at timestamptz not null default now()
);
create index on public.composition_mapping_drafts(run_sha256);
create index on public.composition_mapping_drafts(created_by);
create index on public.composition_mapping_reviews(draft_sha256,sequence desc);
create index on public.composition_mapping_reviews(reviewer_id);

-- Only a trusted database operator can register independently checked style
-- evidence. A browser-supplied passed flag is never publication evidence.
create table private.composition_style_attestations (
  draft_sha256 text not null references public.composition_mapping_drafts(sha256),
  style_code text not null,
  language text not null,
  reference_sha256 text not null check (reference_sha256 ~ '^[a-f0-9]{64}$'),
  comparison_sha256 text not null check (comparison_sha256 ~ '^[a-f0-9]{64}$'),
  membership jsonb not null check (jsonb_typeof(membership)='array'),
  reviewer_id uuid not null references auth.users(id),
  reviewed_at timestamptz not null default now(),
  primary key(draft_sha256,style_code,language)
);
create index on private.composition_style_attestations(reviewer_id);
create table public.composition_publications (
  id uuid primary key default gen_random_uuid(),
  draft_sha256 text not null unique references public.composition_mapping_drafts(sha256),
  county text not null check (county in ('travis','harris')),
  election_date date not null,
  version integer not null check (version>0),
  payload jsonb not null,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  published_by uuid not null references auth.users(id),
  published_at timestamptz not null default now(),
  unique(county,election_date,version), unique(id,county,election_date)
);
create index on public.composition_publications(published_by);
create table public.active_composition_publications (
  county text not null,
  election_date date not null,
  snapshot_id uuid not null,
  primary key(county,election_date),
  foreign key(snapshot_id,county,election_date) references public.composition_publications(id,county,election_date)
);
create index on public.active_composition_publications(snapshot_id);
create table private.composition_publication_events (
  sequence bigint generated always as identity primary key,
  snapshot_id uuid not null references public.composition_publications(id),
  previous_snapshot_id uuid references public.composition_publications(id),
  action text not null check (action in ('activated','withdrawn')),
  actor_id uuid not null references auth.users(id),
  occurred_at timestamptz not null default now()
);
create index on private.composition_publication_events(snapshot_id);
create index on private.composition_publication_events(previous_snapshot_id);
create index on private.composition_publication_events(actor_id);

create function public.composition_mapping_template(p_run text) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('schemaVersion',1,'runId',b.run_sha256,'jurisdictions','[]'::jsonb,'districts','[]'::jsonb,'styles','[]'::jsonb,
    'records',(select jsonb_agg(jsonb_build_object('recordId',r->>'id','printedTitle',r->>'printedTitle',
      'jurisdictionKey',null,'districtKey',null,'officeType',null,'electionType',null,'seats',null,'voteLimit',null) order by n)
      from jsonb_array_elements(b.payload->'records') with ordinality x(r,n)))
  from public.composition_batches b where b.run_sha256=p_run;
$$;

create function private.mapping_integer(v jsonb) returns integer
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(v)='number' and v::text ~ '^[1-9][0-9]{0,8}$' then (v::text)::integer else null end;
$$;

create function private.build_composition_mapping(p_run text,p_mapping jsonb) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  b jsonb; r jsonb; m jsonb; j jsonb; d jsonb; s jsonb; c jsonb; item jsonb; rid text; occurrence text;
  issues jsonb := '[]'; contests jsonb := '[]'; people jsonb := '[]'; entries jsonb := '[]'; measures jsonb := '[]'; declarations jsonb := '[]'; memberships jsonb := '[]';
  prov jsonb; i integer; ord integer; seats integer; vote_limit integer;
begin
  select payload into b from public.composition_batches where run_sha256=p_run;
  if b is null then return null; end if;
  if p_mapping->>'schemaVersion' is distinct from '1' or p_mapping->>'runId' is distinct from p_run then raise exception 'Mapping must identify its exact source run'; end if;
  foreach rid in array array['jurisdictions','districts','records','styles'] loop
    if jsonb_typeof(p_mapping->rid) is distinct from 'array' then raise exception 'Mapping collections must be arrays'; end if;
  end loop;
  if (select count(*)<>count(distinct x->>'recordId') from jsonb_array_elements(p_mapping->'records') x) or
     (select count(*)<>count(distinct x->>'key') from jsonb_array_elements(p_mapping->'jurisdictions') x) or
     (select count(*)<>count(distinct x->>'key') from jsonb_array_elements(p_mapping->'districts') x) or
     (select count(*)<>count(distinct (x->>'code',x->>'language')) from jsonb_array_elements(p_mapping->'styles') x) then raise exception 'Duplicate or missing mapping keys'; end if;
  for m in select value from jsonb_array_elements(p_mapping->'records') loop
    if not exists(select 1 from jsonb_array_elements(b->'records') x where x->>'id'=m->>'recordId') then raise exception 'Mapping references an unknown source record'; end if;
  end loop;
  for j in select value from jsonb_array_elements(p_mapping->'jurisdictions') loop
    if nullif(trim(j->>'key'),'') is null or nullif(trim(j->>'name'),'') is null or
       coalesce(j->>'kind' not in ('federal','state','county','city','school','special'),true) or
       not exists(select 1 from jsonb_array_elements(b->'records') x where x->>'id'=j->>'sourceRecordId') then
      issues := issues || jsonb_build_object('code','jurisdiction_mapping_incomplete','key',j->>'key');
    end if;
  end loop;
  for d in select value from jsonb_array_elements(p_mapping->'districts') loop
    if nullif(trim(d->>'key'),'') is null or nullif(trim(d->>'name'),'') is null or
       not exists(select 1 from jsonb_array_elements(p_mapping->'jurisdictions') x where x->>'key'=d->>'jurisdictionKey') or
       not exists(select 1 from jsonb_array_elements(b->'records') x where x->>'id'=d->>'sourceRecordId') then
      issues := issues || jsonb_build_object('code','district_mapping_incomplete','key',d->>'key');
    end if;
  end loop;
  for r in select value from jsonb_array_elements(b->'records') loop
    select value into m from jsonb_array_elements(p_mapping->'records') where value->>'recordId'=r->>'id';
    prov := jsonb_build_object('runId',p_run,'sourceSha256',r->>'sourceSha256','recordId',r->>'id','page',r->'sourcePage','column',r->'sourceColumn','bounds',r->'sourceBounds','spans',r->'sourceSpans');
    if m is null or not exists(select 1 from jsonb_array_elements(p_mapping->'jurisdictions') x where x->>'key'=m->>'jurisdictionKey') or
       (m->>'districtKey' is not null and not exists(select 1 from jsonb_array_elements(p_mapping->'districts') x where x->>'key'=m->>'districtKey' and x->>'jurisdictionKey'=m->>'jurisdictionKey')) then
      issues := issues || jsonb_build_object('code','record_scope_mapping_incomplete','recordId',r->>'id');
    end if;
    if r->>'kind'='declaration' then
      declarations := declarations || jsonb_build_object('id',r->>'id','jurisdictionKey',m->'jurisdictionKey','title',r->>'printedTitle','sourceSection',r->'sourceSection','exactText',r->>'declarationText','provenance',prov);
      continue;
    end if;
    seats := private.mapping_integer(m->'seats'); vote_limit := private.mapping_integer(m->'voteLimit');
    if coalesce(m->>'officeType' not in ('federal','statewide','state_legislative','judicial','county','city','school_board','appraisal_district','special_district','proposition'),true) or
       coalesce(m->>'electionType' not in ('general','special','runoff'),true) or seats is null or vote_limit is null or vote_limit>seats or
       ((r->>'kind'='measure') is distinct from (m->>'officeType'='proposition')) then
      issues := issues || jsonb_build_object('code','office_mapping_incomplete','recordId',r->>'id');
    end if;
    contests := contests || jsonb_build_object('id',r->>'id','kind',r->>'kind','title',r->>'printedTitle','sourceSection',r->'sourceSection','jurisdictionKey',m->'jurisdictionKey','districtKey',m->'districtKey',
      'officeType',m->'officeType','electionType',m->'electionType','seats',seats,'voteLimit',vote_limit,'voteInstruction',r->'voteInstruction',
      'writeInSlot',r->'writeInSlot','electorateScope',r->'electorateScope','provenance',prov);
    if r->>'kind'='measure' then
      measures := measures || jsonb_build_object('contestId',r->>'id','wordingByLanguage',r->'wordingByLanguage','responseOptions',r->'responseOptions','provenance',prov);
    elsif r->>'kind'='candidate_contest' then
      i := 0;
      for c in select value from jsonb_array_elements(r->'candidates') loop
        i := i+1; occurrence := p_run||':'||(r->>'id')||':printed:'||i;
        people := people || jsonb_build_object('id',occurrence,'normalizedName',lower(regexp_replace(c->>'printedName','\s+',' ','g')),'identityScope','source_occurrence','provenance',prov);
        entries := entries || jsonb_build_object('id',occurrence,'candidateId',occurrence,'contestId',r->>'id','entryType','printed','printedName',c->>'printedName',
          'printedParty',c->'printedParty','partyCode',c->'partyCode','ballotOrder',c->'ballotOrder','provenance',prov);
      end loop;
      i := 0;
      for c in select value from jsonb_array_elements(r->'declaredWriteIns') loop
        i := i+1; occurrence := p_run||':'||(r->>'id')||':write_in:'||i;
        item := jsonb_build_object('runId',p_run,'sourceSha256',c->>'sourceSha256','recordId',r->>'id','page',c->'sourcePage','sheet',c->'sourceSheet','row',c->'sourceRow');
        people := people || jsonb_build_object('id',occurrence,'normalizedName',lower(c->>'printedName'),'identityScope','source_occurrence','provenance',item);
        entries := entries || jsonb_build_object('id',occurrence,'candidateId',occurrence,'contestId',r->>'id','entryType','qualified_write_in','printedName',c->>'printedName',
          'printedParty',null,'partyCode',null,'ballotOrder',null,'certificationOrder',i,'provenance',item);
      end loop;
    else raise exception 'Unknown record kind cannot be normalized'; end if;
  end loop;
  for s in select value from jsonb_array_elements(p_mapping->'styles') loop
    if nullif(trim(s->>'code'),'') is null or nullif(trim(s->>'language'),'') is null or
       coalesce(s->>'referenceSha256' !~ '^[a-f0-9]{64}$',true) or jsonb_typeof(s->'recordIds') is distinct from 'array' or
       not exists(select 1 from jsonb_array_elements(p_mapping->'jurisdictions') x where x->>'key'=s->>'jurisdictionKey') then raise exception 'Invalid style mapping'; end if;
    if jsonb_array_length(s->'recordIds')=0 or (select count(*)<>count(distinct value) from jsonb_array_elements_text(s->'recordIds')) then raise exception 'Empty or duplicate style membership'; end if;
    ord := 0;
    for rid in select value from jsonb_array_elements_text(s->'recordIds') loop
      select value into r from jsonb_array_elements(b->'records') where value->>'id'=rid;
      if r is null then raise exception 'Unknown style member'; end if;
      ord := ord+1;
      memberships := memberships || jsonb_build_object('styleCode',s->>'code','language',s->>'language','recordId',rid,'itemKind',case when r->>'kind'='declaration' then 'declaration' else 'contest' end,'ballotOrder',ord);
    end loop;
  end loop;
  return jsonb_build_object('mapping',p_mapping,'issues',issues,'normalized',jsonb_build_object('schemaVersion',1,'normalizerVersion','composition-normalization-v1','runId',p_run,'county',b->>'county','electionDate',b->>'electionDate',
    'jurisdictions',coalesce((select jsonb_agg(jsonb_build_object('key',x->'key','name',x->'name','kind',x->'kind','sourceRecordId',x->'sourceRecordId')) from jsonb_array_elements(p_mapping->'jurisdictions') x),'[]'::jsonb),
    'districts',coalesce((select jsonb_agg(jsonb_build_object('key',x->'key','jurisdictionKey',x->'jurisdictionKey','name',x->'name','sourceRecordId',x->'sourceRecordId')) from jsonb_array_elements(p_mapping->'districts') x),'[]'::jsonb),
    'styles',coalesce((select jsonb_agg(jsonb_build_object('code',x->'code','language',x->'language','jurisdictionKey',x->'jurisdictionKey','referenceSha256',x->'referenceSha256')) from jsonb_array_elements(p_mapping->'styles') x),'[]'::jsonb),
    'contests',contests,'candidates',people,'entries',entries,
    'measures',measures,'declarations',declarations,'memberships',memberships,'cancellations',b->'reconciliation'->'cancellations',
    'sources',(select jsonb_agg(jsonb_build_object('sha256',x->'source'->'sha256','kind',x->'source'->'kind','title',x->'source'->'title','url',x->'source'->'url',
      'discoveryUrl',x->'source'->'discoveryUrl','retrievedAt',x->'source'->'retrievedAt','bytes',x->'source'->'bytes','mediaType',x->'source'->'mediaType','checksumScope',x->'source'->'checksumScope')) from jsonb_array_elements(b->'documents') x),'addressEligibilityVerified',false));
end $$;

create function public.preview_composition_mapping(p_run text,p_mapping jsonb) returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.build_composition_mapping(p_run,p_mapping); $$;

create function private.stage_composition_mapping(p_run text,p_mapping jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare artifact jsonb; sha text;
begin
  if not public.is_composition_reviewer() then raise exception 'Provisioned reviewer required' using errcode='42501'; end if;
  artifact := private.build_composition_mapping(p_run,p_mapping);
  if artifact is null then raise exception 'Unknown source run'; end if;
  sha := encode(sha256(convert_to(artifact::text,'UTF8')),'hex');
  insert into public.composition_mapping_drafts values(sha,p_run,artifact,auth.uid(),now()) on conflict(sha256) do nothing;
  return sha;
end $$;
create function public.stage_composition_mapping(p_run text,p_mapping jsonb) returns text
language sql security invoker set search_path = '' as $$ select private.stage_composition_mapping(p_run,p_mapping); $$;

create function private.review_composition_mapping(p_draft text,p_decision text,p_note text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare artifact jsonb; result bigint;
begin
  if not public.is_composition_reviewer() then raise exception 'Provisioned reviewer required' using errcode='42501'; end if;
  select payload into artifact from public.composition_mapping_drafts where sha256=p_draft;
  if artifact is null then raise exception 'Unknown mapping draft'; end if;
  if p_decision='accepted' and jsonb_array_length(artifact->'issues')>0 then raise exception 'Incomplete mapping cannot be accepted'; end if;
  insert into public.composition_mapping_reviews(draft_sha256,reviewer_id,decision,note) values(p_draft,auth.uid(),p_decision,p_note) returning sequence into result;
  return result;
end $$;
create function public.review_composition_mapping(p_draft text,p_decision text,p_note text) returns bigint
language sql security invoker set search_path = '' as $$ select private.review_composition_mapping(p_draft,p_decision,p_note); $$;

create table private.composition_archive_attestations (
  draft_sha256 text primary key references public.composition_mapping_drafts(sha256),
  source_manifest jsonb not null check (jsonb_typeof(source_manifest)='array'),
  receipt_sha256 text not null check (receipt_sha256 ~ '^[a-f0-9]{64}$'),
  checked_by uuid not null references auth.users(id),
  checked_at timestamptz not null default now()
);
create index on private.composition_archive_attestations(checked_by);

create function private.composition_publication_blockers(p_draft text) returns text[]
language plpgsql stable security invoker set search_path = '' as $$
declare d public.composition_mapping_drafts; b public.composition_batches; blockers text[] := '{}'; s jsonb; expected jsonb;
begin
  select * into d from public.composition_mapping_drafts where sha256=p_draft;
  if not found then return array['mapping_draft_missing']; end if;
  select * into b from public.composition_batches where run_sha256=d.run_sha256;
  if b.payload->>'status' is distinct from 'needs_review' then blockers := array_append(blockers,'failed_source_import'); end if;
  if b.run_sha256 is distinct from (select run_sha256 from public.composition_batches where county=b.county and election_date=b.election_date order by imported_at desc,run_sha256 desc limit 1) then
    blockers := array_append(blockers,'newer_source_import_exists');
  end if;
  if not exists(select 1 from public.composition_review_tasks where run_sha256=b.run_sha256) or exists(
    select 1 from public.composition_review_tasks t left join lateral(select decision from public.composition_review_decisions where task_id=t.id order by sequence desc limit 1) latest on true
    where t.run_sha256=b.run_sha256 and (t.requires_new_import or latest.decision is distinct from 'accepted')) then
    blockers := array_append(blockers,'source_reviews_or_blockers_open');
  end if;
  if jsonb_array_length(d.payload->'issues')>0 then blockers := array_append(blockers,'mapping_incomplete'); end if;
  if (select decision from public.composition_mapping_reviews where draft_sha256=p_draft order by sequence desc limit 1) is distinct from 'accepted' then
    blockers := array_append(blockers,'mapping_review_missing');
  end if;
  if d.payload is distinct from private.build_composition_mapping(d.run_sha256,d.payload->'mapping') then blockers := array_append(blockers,'mapping_payload_mismatch'); end if;
  if not exists(select 1 from private.composition_archive_attestations a join private.admin_users u on u.user_id=a.checked_by
    where a.draft_sha256=p_draft and a.source_manifest=d.payload->'normalized'->'sources') then
    blockers := array_append(blockers,'archive_verification_missing');
  end if;
  if jsonb_array_length(d.payload->'normalized'->'styles')=0 then blockers := array_append(blockers,'official_style_evidence_missing'); end if;
  for s in select value from jsonb_array_elements(d.payload->'normalized'->'styles') loop
    select jsonb_agg(x->'recordId' order by (x->>'ballotOrder')::integer) into expected from jsonb_array_elements(d.payload->'normalized'->'memberships') x
      where x->>'styleCode'=s->>'code' and x->>'language'=s->>'language';
    if not exists(select 1 from private.composition_style_attestations a join private.admin_users u on u.user_id=a.reviewer_id
      where a.draft_sha256=p_draft and a.style_code=s->>'code' and a.language=s->>'language' and
        a.reference_sha256=s->>'referenceSha256' and a.membership=expected) then
      blockers := array_append(blockers,'official_style_evidence_missing');
    end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(d.payload->'normalized'->'contests') c where not exists(
    select 1 from jsonb_array_elements(d.payload->'normalized'->'memberships') m where m->>'recordId'=c->>'id')) then
    blockers := array_append(blockers,'contest_style_coverage_incomplete');
  end if;
  if exists(select 1 from jsonb_array_elements(d.payload->'normalized'->'entries') e where not exists(
    select 1 from jsonb_array_elements(d.payload->'normalized'->'sources') src(value) where src.value->>'sha256'=e->'provenance'->>'sourceSha256')) then
    blockers := array_append(blockers,'entry_provenance_invalid');
  end if;
  return array(select distinct x from unnest(blockers) x order by x);
end $$;

create function private.composition_publication_status(p_draft text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare codes text[];
begin
  if not public.is_composition_reviewer() then raise exception 'Provisioned reviewer required' using errcode='42501'; end if;
  codes := private.composition_publication_blockers(p_draft);
  return jsonb_build_object('draftSha256',p_draft,'blockers',codes,'ready',cardinality(codes)=0,'publicationPerformed',false);
end $$;
create function public.composition_publication_status(p_draft text) returns jsonb
language sql security invoker set search_path = '' as $$ select private.composition_publication_status(p_draft); $$;

-- Imports, review changes, and publication share a county/election lock. New
-- imports preserve the last approved snapshot until a replacement is published.
create function private.lock_composition_scope() returns trigger
language plpgsql set search_path = '' as $$
declare c text; e date;
begin
  if tg_table_name='composition_batches' then c:=new.county; e:=new.election_date;
  elsif tg_table_name='composition_review_decisions' then
    select b.county,b.election_date into c,e from public.composition_batches b join public.composition_review_tasks t on t.run_sha256=b.run_sha256 where t.id=new.task_id;
  else
    select b.county,b.election_date into c,e from public.composition_batches b join public.composition_mapping_drafts d on d.run_sha256=b.run_sha256 where d.sha256=new.draft_sha256;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('composition:'||c||':'||e::text,0));
  return new;
end $$;
create trigger scope_lock before insert on public.composition_batches for each row execute function private.lock_composition_scope();
create trigger scope_lock before insert on public.composition_review_decisions for each row execute function private.lock_composition_scope();
create trigger scope_lock before insert on public.composition_mapping_reviews for each row execute function private.lock_composition_scope();
create trigger scope_lock before insert on private.composition_style_attestations for each row execute function private.lock_composition_scope();
create trigger scope_lock before insert on private.composition_archive_attestations for each row execute function private.lock_composition_scope();

create function private.validate_composition_publication() returns trigger
language plpgsql set search_path = '' as $$
declare d public.composition_mapping_drafts; b public.composition_batches; codes text[];
begin
  if not public.is_composition_reviewer() then raise exception 'Provisioned reviewer required' using errcode='42501'; end if;
  if tg_table_name='active_composition_publications' then
    select m.* into d from public.composition_mapping_drafts m join public.composition_publications s on s.draft_sha256=m.sha256 where s.id=new.snapshot_id;
  else select * into d from public.composition_mapping_drafts where sha256=new.draft_sha256; end if;
  select * into b from public.composition_batches where run_sha256=d.run_sha256;
  perform pg_advisory_xact_lock(hashtextextended('composition:'||b.county||':'||b.election_date::text,0));
  codes := private.composition_publication_blockers(d.sha256);
  if cardinality(codes)>0 then raise exception 'Composition publication blocked: %',array_to_string(codes,', '); end if;
  if tg_table_name='composition_publications' then
    if new.payload is distinct from d.payload->'normalized' or new.county is distinct from b.county or new.election_date is distinct from b.election_date then raise exception 'Publication payload or election mismatch'; end if;
    new.sha256 := encode(sha256(convert_to(new.payload::text,'UTF8')),'hex');
  end if;
  return new;
end $$;
create trigger publication_guard before insert on public.composition_publications for each row execute function private.validate_composition_publication();
create trigger active_guard before insert or update on public.active_composition_publications for each row execute function private.validate_composition_publication();

-- Deliberately unexposed and owner-only. The operator sets an authenticated
-- reviewer identity on its trusted database transaction. No browser RPC exists.
create function private.publish_composition(p_draft text,p_expected_active uuid) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare d public.composition_mapping_drafts; b public.composition_batches; active uuid; snapshot uuid; codes text[];
begin
  if not public.is_composition_reviewer() then raise exception 'Provisioned reviewer required' using errcode='42501'; end if;
  select * into d from public.composition_mapping_drafts where sha256=p_draft;
  if not found then raise exception 'Unknown mapping draft'; end if;
  select * into b from public.composition_batches where run_sha256=d.run_sha256;
  perform pg_advisory_xact_lock(hashtextextended('composition:'||b.county||':'||b.election_date::text,0));
  select snapshot_id into active from public.active_composition_publications where county=b.county and election_date=b.election_date;
  select id into snapshot from public.composition_publications where draft_sha256=p_draft;
  if snapshot is not null and active=snapshot then return snapshot; end if;
  if active is distinct from p_expected_active then raise exception 'Active publication changed; reload before publishing'; end if;
  codes := private.composition_publication_blockers(p_draft);
  if cardinality(codes)>0 then raise exception 'Composition publication blocked: %',array_to_string(codes,', '); end if;
  if snapshot is null then
    insert into public.composition_publications(draft_sha256,county,election_date,version,payload,sha256,published_by)
    values(p_draft,b.county,b.election_date,(select coalesce(max(version),0)+1 from public.composition_publications where county=b.county and election_date=b.election_date),d.payload->'normalized',repeat('0',64),auth.uid()) returning id into snapshot;
  end if;
  insert into public.active_composition_publications values(b.county,b.election_date,snapshot)
    on conflict(county,election_date) do update set snapshot_id=excluded.snapshot_id;
  insert into private.composition_publication_events(snapshot_id,previous_snapshot_id,action,actor_id) values(snapshot,active,'activated',auth.uid());
  return snapshot;
end $$;

create function private.withdraw_composition_after_review() returns trigger
language plpgsql set search_path = '' as $$
declare prior public.active_composition_publications; affected_run text; affected_draft text;
begin
  if new.decision='accepted' then return new; end if;
  if tg_table_name='composition_mapping_reviews' then affected_draft:=new.draft_sha256;
  else select run_sha256 into affected_run from public.composition_review_tasks where id=new.task_id; end if;
  for prior in select a.* from public.active_composition_publications a
    join public.composition_publications s on s.id=a.snapshot_id join public.composition_mapping_drafts d on d.sha256=s.draft_sha256
    where d.sha256=affected_draft or d.run_sha256=affected_run
  loop
    delete from public.active_composition_publications where county=prior.county and election_date=prior.election_date;
    insert into private.composition_publication_events(snapshot_id,action,actor_id) values(prior.snapshot_id,'withdrawn',auth.uid());
  end loop;
  return new;
end $$;
create trigger withdraw_after_review after insert on public.composition_review_decisions for each row execute function private.withdraw_composition_after_review();
create trigger withdraw_after_review after insert on public.composition_mapping_reviews for each row execute function private.withdraw_composition_after_review();

do $$
declare name text; qualified text;
begin
  foreach qualified in array array['public.composition_mapping_drafts','public.composition_mapping_reviews','public.composition_publications',
    'public.active_composition_publications','private.composition_style_attestations','private.composition_archive_attestations','private.composition_publication_events'] loop
    execute format('alter table %s enable row level security',qualified);
    execute format('revoke all on %s from public,anon,authenticated',qualified);
    if exists(select 1 from pg_roles where rolname='service_role') then execute format('revoke all on %s from service_role',qualified); end if;
    if qualified<>'public.active_composition_publications' then
      execute format('create trigger immutable_record before update or delete on %s for each row execute function private.reject_mutation()',qualified);
    end if;
  end loop;
  foreach name in array array['composition_mapping_drafts','composition_mapping_reviews'] loop
    execute format('grant select on public.%I to authenticated',name);
    execute format('create policy reviewer_read on public.%I for select to authenticated using ((select public.is_composition_reviewer()))',name);
  end loop;
  foreach name in array array['composition_publications','active_composition_publications'] loop
    execute format('grant select on public.%I to anon,authenticated',name);
    execute format('create policy published_read on public.%I for select to anon,authenticated using (true)',name);
  end loop;
end $$;
revoke all on sequence public.composition_mapping_reviews_sequence_seq,private.composition_publication_events_sequence_seq from public,anon,authenticated;
revoke all on function private.mapping_integer(jsonb),private.build_composition_mapping(text,jsonb),private.stage_composition_mapping(text,jsonb),
  private.review_composition_mapping(text,text,text),private.composition_publication_blockers(text),private.composition_publication_status(text),
  private.lock_composition_scope(),private.validate_composition_publication(),private.publish_composition(text,uuid),private.withdraw_composition_after_review() from public,anon,authenticated;
revoke all on function public.composition_mapping_template(text),public.preview_composition_mapping(text,jsonb),public.stage_composition_mapping(text,jsonb),
  public.review_composition_mapping(text,text,text),public.composition_publication_status(text) from public,anon,authenticated;
grant execute on function public.composition_mapping_template(text),public.preview_composition_mapping(text,jsonb),public.stage_composition_mapping(text,jsonb),
  public.review_composition_mapping(text,text,text),public.composition_publication_status(text),private.mapping_integer(jsonb),private.build_composition_mapping(text,jsonb),
  private.stage_composition_mapping(text,jsonb),private.review_composition_mapping(text,text,text),private.composition_publication_status(text) to authenticated;
notify pgrst, 'reload schema';
commit;
