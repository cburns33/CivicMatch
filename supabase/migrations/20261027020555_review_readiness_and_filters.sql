begin;

create function public.composition_review_search(
  p_run text,p_offset integer default 0,p_limit integer default 20,
  p_kind text default 'all',p_state text default 'all',p_query text default ''
) returns table(id uuid,task_key text,kind text,payload jsonb,requires_new_import boolean,last_decision jsonb,matched_total bigint)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_offset is null or p_offset<0 or p_limit is null or p_limit<1 or p_limit>50 or
     p_kind is null or p_kind not in ('all','source','record','change','issue','write_in','cancellation') or
     p_state is null or p_state not in ('all','open','reviewable','unreviewed','accepted','needs_source','rejected','blocked') or
     p_query is null or length(p_query)>200 then raise exception 'Invalid review filters or page bounds'; end if;
  return query
  select t.id,t.task_key,t.kind,t.payload,t.requires_new_import,
    case when d.sequence is null then null else jsonb_build_object('decision',d.decision,'note',d.note,
      'reviewerId',d.reviewer_id,'decidedAt',d.decided_at,'sources',d.supporting_source_sha256) end,
    count(*) over()
  from public.composition_review_tasks t
  left join lateral(select x.* from public.composition_review_decisions x where x.task_id=t.id order by x.sequence desc limit 1) d on true
  where t.run_sha256=p_run and (p_kind='all' or t.kind=p_kind)
    and (p_state='all' or (p_state='open' and d.decision is distinct from 'accepted') or
      (p_state='reviewable' and d.decision is distinct from 'accepted' and not t.requires_new_import) or
      (p_state='unreviewed' and d.sequence is null) or (p_state='blocked' and t.requires_new_import) or d.decision=p_state)
    and (p_query='' or strpos(lower(t.payload::text),lower(p_query))>0 or strpos(lower(coalesce(d.note,'')),lower(p_query))>0)
  order by t.task_key limit p_limit offset p_offset;
end $$;

create function public.composition_review_readiness(p_run text) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with current_tasks as (
    select t.*,d.decision from public.composition_review_tasks t
    left join lateral(select x.decision from public.composition_review_decisions x where x.task_id=t.id order by x.sequence desc limit 1) d on true
    where t.run_sha256=p_run
  ), totals as (
    select count(*) as total,count(*) filter(where decision='accepted') as accepted,
      count(*) filter(where decision is distinct from 'accepted') as open,
      count(*) filter(where decision is distinct from 'accepted' and not requires_new_import) as reviewable_open,
      count(*) filter(where requires_new_import) as blocked,
      count(*) filter(where decision is null) as unreviewed,
      count(*) filter(where decision='needs_source') as needs_source,count(*) filter(where decision='rejected') as rejected
    from current_tasks
  ), kinds as (
    select kind,count(*) as total,count(*) filter(where decision='accepted') as accepted,
      count(*) filter(where decision is distinct from 'accepted') as open from current_tasks group by kind
  ), blockers as (
    select coalesce(payload->>'code','import_blocker') as code,count(*) as count
    from current_tasks where requires_new_import group by coalesce(payload->>'code','import_blocker')
  )
  select jsonb_build_object('runId',b.run_sha256,'county',b.county,'importStatus',b.payload->>'status',
    'isLatestImport',b.run_sha256=(select latest.run_sha256 from public.composition_batches latest
      where latest.county=b.county and latest.election_date=b.election_date order by latest.imported_at desc,latest.run_sha256 desc limit 1),
    'total',t.total,'accepted',t.accepted,'open',t.open,'reviewableOpen',t.reviewable_open,'blocked',t.blocked,
    'unreviewed',t.unreviewed,'needsSource',t.needs_source,'rejected',t.rejected,
    'reviewComplete',t.total>0 and t.open=0 and b.payload->>'status'='needs_review',
    'byKind',coalesce((select jsonb_object_agg(kind,jsonb_build_object('total',total,'accepted',accepted,'open',open)) from kinds),'{}'::jsonb),
    'blockers',coalesce((select jsonb_agg(jsonb_build_object('code',code,'count',count) order by code) from blockers),'[]'::jsonb),
    'publicationEnabled',false)
  from public.composition_batches b cross join totals t where b.run_sha256=p_run;
$$;

revoke all on function public.composition_review_search(text,integer,integer,text,text,text),public.composition_review_readiness(text) from public,anon,authenticated;
grant execute on function public.composition_review_search(text,integer,integer,text,text,text),public.composition_review_readiness(text) to authenticated;
notify pgrst, 'reload schema';
commit;
