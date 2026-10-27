begin;

-- Raw county composition is staged separately from normalized/published ballots.
create table public.composition_batches (
  run_sha256 text primary key check (run_sha256 ~ '^[a-f0-9]{64}$'),
  county text not null check (county in ('travis','harris')),
  election_date date not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  imported_by uuid not null references auth.users(id),
  imported_at timestamptz not null default now()
);
create table public.composition_review_tasks (
  id uuid primary key default gen_random_uuid(),
  run_sha256 text not null references public.composition_batches(run_sha256),
  task_key text not null,
  kind text not null check (kind in ('source','record','change','issue','write_in','cancellation')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  requires_new_import boolean not null default false,
  unique (run_sha256, task_key)
);
create table public.composition_review_decisions (
  sequence bigint generated always as identity primary key,
  task_id uuid not null references public.composition_review_tasks(id),
  reviewer_id uuid not null references auth.users(id),
  decision text not null check (decision in ('accepted','rejected','needs_source')),
  note text not null check (length(trim(note)) >= 10),
  supporting_source_sha256 text[] not null check (cardinality(supporting_source_sha256) > 0),
  decided_at timestamptz not null default now()
);
create index on public.composition_batches(imported_by);
create index on public.composition_review_decisions(task_id, sequence desc);
create index on public.composition_review_decisions(reviewer_id);

create function public.is_composition_reviewer() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from private.admin_users where user_id = (select auth.uid()));
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['composition_batches','composition_review_tasks','composition_review_decisions'] loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('revoke all on public.%I from public, anon, authenticated',table_name);
    execute format('grant select on public.%I to authenticated',table_name);
    execute format('create policy reviewer_read on public.%I for select to authenticated using ((select public.is_composition_reviewer()))',table_name);
    execute format('create trigger immutable_record before update or delete on public.%I for each row execute function private.reject_mutation()',table_name);
  end loop;
end $$;
revoke all on sequence public.composition_review_decisions_sequence_seq from public, anon, authenticated;

create function public.stage_composition_batch(p_payload jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare
  run_key text := p_payload->>'runId';
  payload_hash text := encode(sha256(convert_to(p_payload::text,'UTF8')),'hex');
  existing_hash text;
  doc jsonb;
  item jsonb;
  source_hashes text[];
  counter integer := 0;
  doc_counter integer := 0;
begin
  if not public.is_composition_reviewer() then raise exception 'Provisioned reviewer required' using errcode = '42501'; end if;
  if run_key is null or run_key !~ '^[a-f0-9]{64}$' or
     p_payload->>'schemaVersion' is distinct from '2' or
     coalesce(p_payload->>'county' not in ('travis','harris'),true) or
     p_payload->>'electionDate' is distinct from '2026-11-03' or
     coalesce(p_payload->>'status' not in ('needs_review','failed'),true) or
     p_payload->>'parseScope' is distinct from 'all_master_pages_and_supplements' or
     jsonb_typeof(p_payload->'documents') is distinct from 'array' or
     jsonb_typeof(p_payload->'records') is distinct from 'array' or
     jsonb_typeof(p_payload->'diff') is distinct from 'array' or
     jsonb_typeof(p_payload->'reconciliation'->'issues') is distinct from 'array' or
     jsonb_typeof(p_payload->'reconciliation'->'writeIns') is distinct from 'array' or
     jsonb_typeof(p_payload->'reconciliation'->'cancellations') is distinct from 'array' or
     jsonb_array_length(p_payload->'documents') = 0 or jsonb_array_length(p_payload->'records') = 0 then
    raise exception 'Invalid county staging envelope';
  end if;
  -- Serialize retries for the same immutable run before checking existing bytes.
  perform pg_advisory_xact_lock(hashtextextended(run_key,0));
  select payload_sha256 into existing_hash from public.composition_batches where run_sha256=run_key;
  if found then
    if existing_hash <> payload_hash then raise exception 'Immutable run payload differs'; end if;
    return run_key;
  end if;
  select array_agg(d->'source'->>'sha256') into source_hashes from jsonb_array_elements(p_payload->'documents') d;
  if (select count(*) from jsonb_array_elements(p_payload->'documents') d where d->'source'->>'kind'='master_ballot') <> 1 then
    raise exception 'Exactly one county master is required';
  end if;
  insert into public.composition_batches values (run_key,p_payload->>'county',(p_payload->>'electionDate')::date,p_payload,payload_hash,auth.uid(),now());
  for doc in select value from jsonb_array_elements(p_payload->'documents') loop
    if doc->'source'->>'sha256' is null or doc->'source'->>'sha256' !~ '^[a-f0-9]{64}$' or
       doc->'source'->>'county' is distinct from p_payload->>'county' or
       doc->'source'->>'mediaType' is distinct from 'application/pdf' or
       jsonb_typeof(doc->'issues') is distinct from 'array' or jsonb_typeof(doc->'pages') is distinct from 'array' then raise exception 'Invalid contributing source'; end if;
    insert into public.composition_review_tasks(run_sha256,task_key,kind,payload)
      values(run_key,'source:'||(doc->'source'->>'sha256'),'source',doc->'source') on conflict (run_sha256,task_key) do nothing;
    counter := 0;
    for item in select value from jsonb_array_elements(coalesce(doc->'issues','[]'::jsonb)) loop
      insert into public.composition_review_tasks(run_sha256,task_key,kind,payload,requires_new_import)
        values(run_key,'issue:document:'||doc_counter||':'||counter,'issue',item||jsonb_build_object('sourceSha256',doc->'source'->>'sha256'),
          item->>'code' in ('parse_error','duplicate_identity','unassigned_choices','candidate_parse_incomplete','measure_parse_incomplete','unclassified_region','ballot_styles_unverified'));
      counter := counter+1;
    end loop;
    doc_counter := doc_counter+1;
  end loop;
  for item in select value from jsonb_array_elements(p_payload->'records') loop
    if nullif(trim(item->>'id'),'') is null or not coalesce((item->>'sourceSha256')=any(source_hashes),false) or
       coalesce(item->>'kind' not in ('candidate_contest','measure','declaration'),true) or
       not exists(select 1 from jsonb_array_elements(p_payload->'documents') d where d->'source'->>'sha256'=item->>'sourceSha256'
         and (item->>'sourcePage')::integer between 1 and jsonb_array_length(d->'pages')) then raise exception 'Invalid source-linked staged record'; end if;
    insert into public.composition_review_tasks(run_sha256,task_key,kind,payload) values(run_key,'record:'||(item->>'id'),'record',item);
  end loop;
  for item in select value from jsonb_array_elements(coalesce(p_payload->'diff','[]'::jsonb)) loop
    insert into public.composition_review_tasks(run_sha256,task_key,kind,payload) values(run_key,'change:'||(item->>'recordId'),'change',item);
  end loop;
  counter := 0;
  for item in select value from jsonb_array_elements(coalesce(p_payload->'reconciliation'->'issues','[]'::jsonb)) loop
    insert into public.composition_review_tasks(run_sha256,task_key,kind,payload) values(run_key,'issue:reconciliation:'||counter,'issue',item);
    counter := counter+1;
  end loop;
  counter := 0;
  for item in select value from jsonb_array_elements(coalesce(p_payload->'reconciliation'->'writeIns','[]'::jsonb)) loop
    insert into public.composition_review_tasks(run_sha256,task_key,kind,payload) values(run_key,'write_in:'||counter,'write_in',item);
    counter := counter+1;
  end loop;
  counter := 0;
  for item in select value from jsonb_array_elements(coalesce(p_payload->'reconciliation'->'cancellations','[]'::jsonb)) loop
    insert into public.composition_review_tasks(run_sha256,task_key,kind,payload) values(run_key,'cancellation:'||counter,'cancellation',item);
    counter := counter+1;
  end loop;
  if p_payload->>'status' = 'failed' then
    insert into public.composition_review_tasks(run_sha256,task_key,kind,payload,requires_new_import)
      values(run_key,'issue:failed_import','issue','{"code":"failed_import","message":"Correct the failed extraction and import a new run."}',true);
  end if;
  return run_key;
end $$;

create function public.decide_composition_task(p_task_id uuid,p_decision text,p_note text,p_source_hashes text[]) returns bigint
language plpgsql security definer set search_path = '' as $$
declare task public.composition_review_tasks; result bigint; source_hash text;
begin
  if not public.is_composition_reviewer() then raise exception 'Provisioned reviewer required' using errcode = '42501'; end if;
  select * into strict task from public.composition_review_tasks where id=p_task_id;
  if task.requires_new_import and p_decision='accepted' then raise exception 'This issue requires a corrected or verified import'; end if;
  if cardinality(p_source_hashes) is null or cardinality(p_source_hashes)=0 then raise exception 'Supporting source required'; end if;
  foreach source_hash in array p_source_hashes loop
    if not exists(select 1 from public.composition_review_tasks t where t.run_sha256=task.run_sha256 and t.kind='source' and t.payload->>'sha256'=source_hash) then
      raise exception 'Supporting source does not belong to this import';
    end if;
  end loop;
  insert into public.composition_review_decisions(task_id,reviewer_id,decision,note,supporting_source_sha256)
    values(p_task_id,auth.uid(),p_decision,p_note,p_source_hashes) returning sequence into result;
  return result;
end $$;

create function public.composition_review_progress() returns table(run_sha256 text,county text,election_date date,total bigint,accepted bigint,open bigint,requires_new_import bigint)
language sql stable security invoker set search_path = '' as $$
  select b.run_sha256,b.county,b.election_date,count(t.id),count(t.id) filter(where d.decision='accepted'),
    count(t.id) filter(where d.decision is distinct from 'accepted'),count(t.id) filter(where t.requires_new_import)
  from public.composition_batches b join public.composition_review_tasks t on t.run_sha256=b.run_sha256
  left join lateral(select decision from public.composition_review_decisions where task_id=t.id order by sequence desc limit 1) d on true
  group by b.run_sha256,b.county,b.election_date order by b.county,b.run_sha256;
$$;

revoke all on function public.is_composition_reviewer(),public.stage_composition_batch(jsonb),public.decide_composition_task(uuid,text,text,text[]),public.composition_review_progress() from public,anon,authenticated;
grant execute on function public.is_composition_reviewer(),public.stage_composition_batch(jsonb),public.decide_composition_task(uuid,text,text,text[]),public.composition_review_progress() to authenticated;

-- No function in this migration approves composition or publishes snapshots.
commit;
