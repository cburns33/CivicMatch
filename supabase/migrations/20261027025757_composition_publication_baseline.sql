begin;
alter table public.composition_mapping_reviews add column baseline_snapshot_id uuid references public.composition_publications(id);
create index on public.composition_mapping_reviews(baseline_snapshot_id);

create function private.composition_mapping_baseline(p_draft text) returns uuid
language sql stable security invoker set search_path = '' as $$
  select s.id from public.composition_publications s join public.composition_mapping_drafts d on d.sha256=p_draft
  join public.composition_batches b on b.run_sha256=d.run_sha256
  where s.county=b.county and s.election_date=b.election_date and s.draft_sha256<>p_draft order by s.version desc limit 1;
$$;

create function private.composition_semantics(n jsonb) returns table(key text,value jsonb)
language sql immutable set search_path = '' as $$
  select 'record:'||(c->>'id'),jsonb_build_object('record',c-'provenance',
    'entries',coalesce((select jsonb_agg(e-'id'-'candidateId'-'provenance' order by e->>'entryType',coalesce(e->>'ballotOrder',e->>'certificationOrder')) from jsonb_array_elements(n->'entries') e where e->>'contestId'=c->>'id'),'[]'::jsonb),
    'measures',coalesce((select jsonb_agg(m-'provenance') from jsonb_array_elements(n->'measures') m where m->>'contestId'=c->>'id'),'[]'::jsonb))
    from jsonb_array_elements(n->'contests') c
  union all select 'declaration:'||(x->>'id'),x-'provenance' from jsonb_array_elements(n->'declarations') x
  union all select 'jurisdiction:'||(x->>'key'),x from jsonb_array_elements(n->'jurisdictions') x
  union all select 'district:'||(x->>'key'),x from jsonb_array_elements(n->'districts') x
  union all select 'style:'||(s->>'code')||':'||(s->>'language'),jsonb_build_object('style',s,
    'memberships',(select jsonb_agg(m order by (m->>'ballotOrder')::integer) from jsonb_array_elements(n->'memberships') m where m->>'styleCode'=s->>'code' and m->>'language'=s->>'language'))
    from jsonb_array_elements(n->'styles') s
  union all select 'cancellation:'||ordinality::text,value from jsonb_array_elements(n->'cancellations') with ordinality;
$$;
create function private.composition_mapping_diff(p_draft text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare d jsonb; baseline uuid; prior jsonb; changes jsonb;
begin
  if not public.is_composition_reviewer() then raise exception 'Provisioned reviewer required' using errcode='42501'; end if;
  select payload->'normalized' into d from public.composition_mapping_drafts where sha256=p_draft;
  if d is null then raise exception 'Unknown mapping draft'; end if;
  baseline := private.composition_mapping_baseline(p_draft);
  select payload into prior from public.composition_publications where id=baseline;
  select coalesce(jsonb_agg(jsonb_build_object('key',coalesce(a.key,b.key),'change',case when a.key is null then 'added' when b.key is null then 'removed' else 'changed' end,
    'before',a.value,'after',b.value) order by coalesce(a.key,b.key)),'[]'::jsonb) into changes
    from private.composition_semantics(prior) a full join private.composition_semantics(d) b using(key) where a.value is distinct from b.value;
  return jsonb_build_object('draftSha256',p_draft,'baselineSnapshotId',baseline,'changes',changes);
end $$;
create function public.composition_mapping_diff(p_draft text) returns jsonb
language sql security invoker set search_path = '' as $$ select private.composition_mapping_diff(p_draft); $$;

create function private.review_composition_mapping_against(p_draft text,p_decision text,p_note text,p_expected_baseline uuid) returns bigint
language plpgsql security definer set search_path = '' as $$
declare artifact jsonb; baseline uuid; result bigint; c text; e date;
begin
  if not public.is_composition_reviewer() then raise exception 'Provisioned reviewer required' using errcode='42501'; end if;
  select d.payload,b.county,b.election_date into artifact,c,e from public.composition_mapping_drafts d join public.composition_batches b on b.run_sha256=d.run_sha256 where d.sha256=p_draft;
  if artifact is null then raise exception 'Unknown mapping draft'; end if;
  perform pg_advisory_xact_lock(hashtextextended('composition:'||c||':'||e::text,0));
  baseline := private.composition_mapping_baseline(p_draft);
  if p_decision='accepted' and baseline is distinct from p_expected_baseline then raise exception 'Publication baseline changed; compare and review the current diff'; end if;
  if p_decision='accepted' and jsonb_array_length(artifact->'issues')>0 then raise exception 'Incomplete mapping cannot be accepted'; end if;
  insert into public.composition_mapping_reviews(draft_sha256,reviewer_id,decision,note,baseline_snapshot_id)
    values(p_draft,auth.uid(),p_decision,p_note,baseline) returning sequence into result;
  return result;
end $$;
create function public.review_composition_mapping_against(p_draft text,p_decision text,p_note text,p_expected_baseline uuid) returns bigint
language sql security invoker set search_path = '' as $$ select private.review_composition_mapping_against(p_draft,p_decision,p_note,p_expected_baseline); $$;
create or replace function private.review_composition_mapping(p_draft text,p_decision text,p_note text) returns bigint
language sql security definer set search_path = '' as $$ select private.review_composition_mapping_against(p_draft,p_decision,p_note,null); $$;

-- Extend the existing guard without changing applied migration bytes.
do $$
declare
  definition text := pg_get_functiondef('private.composition_publication_blockers(text)'::regprocedure);
  marker text := '  return array(select distinct x from unnest(blockers) x order by x);';
begin
  if strpos(definition,marker)=0 then raise exception 'Expected publication guard is missing'; end if;
  execute replace(definition,marker,$patch$
  if (select baseline_snapshot_id from public.composition_mapping_reviews where draft_sha256=p_draft order by sequence desc limit 1)
    is distinct from private.composition_mapping_baseline(p_draft) then blockers := array_append(blockers,'publication_baseline_changed'); end if;
  return array(select distinct x from unnest(blockers) x order by x);$patch$);
end $$;
revoke all on function private.composition_mapping_baseline(text),private.composition_semantics(jsonb),private.composition_mapping_diff(text),
  private.review_composition_mapping_against(text,text,text,uuid),public.composition_mapping_diff(text),public.review_composition_mapping_against(text,text,text,uuid) from public,anon,authenticated;
grant execute on function private.composition_mapping_diff(text),private.review_composition_mapping_against(text,text,text,uuid),
  public.composition_mapping_diff(text),public.review_composition_mapping_against(text,text,text,uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
