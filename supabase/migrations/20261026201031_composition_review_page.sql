begin;
create function public.composition_review_page(p_run text,p_offset integer default 0,p_limit integer default 20)
returns table(id uuid,task_key text,kind text,payload jsonb,requires_new_import boolean,last_decision jsonb)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_offset is null or p_offset<0 or p_limit is null or p_limit<1 or p_limit>50 then raise exception 'Invalid review page bounds'; end if;
  return query select t.id,t.task_key,t.kind,t.payload,t.requires_new_import,
    (select jsonb_build_object('decision',d.decision,'note',d.note,'reviewerId',d.reviewer_id,'decidedAt',d.decided_at,'sources',d.supporting_source_sha256)
      from public.composition_review_decisions d where d.task_id=t.id order by d.sequence desc limit 1)
  from public.composition_review_tasks t where t.run_sha256=p_run order by t.task_key limit p_limit offset p_offset;
end $$;
revoke all on function public.composition_review_page(text,integer,integer) from public,anon,authenticated;
grant execute on function public.composition_review_page(text,integer,integer) to authenticated;
commit;
