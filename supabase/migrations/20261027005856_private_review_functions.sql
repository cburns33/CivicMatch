begin;

-- Membership lookup can use the caller's existing read-own-membership policy.
alter function public.is_composition_reviewer() security invoker;

-- Keep privileged write implementations outside the Data API's exposed schema.
alter function public.stage_composition_batch(jsonb) set schema private;
alter function public.decide_composition_task(uuid,text,text,text[]) set schema private;

create function public.stage_composition_batch(p_payload jsonb) returns text
language sql security invoker set search_path = '' as $$
  select private.stage_composition_batch(p_payload);
$$;
create function public.decide_composition_task(p_task_id uuid,p_decision text,p_note text,p_source_hashes text[]) returns bigint
language sql security invoker set search_path = '' as $$
  select private.decide_composition_task(p_task_id,p_decision,p_note,p_source_hashes);
$$;

revoke all on function public.stage_composition_batch(jsonb),public.decide_composition_task(uuid,text,text,text[]) from public,anon,authenticated;
revoke all on function private.stage_composition_batch(jsonb),private.decide_composition_task(uuid,text,text,text[]) from public,anon,authenticated;
grant execute on function public.stage_composition_batch(jsonb),public.decide_composition_task(uuid,text,text,text[]) to authenticated;
grant execute on function private.stage_composition_batch(jsonb),private.decide_composition_task(uuid,text,text,text[]) to authenticated;
notify pgrst, 'reload schema';
commit;
