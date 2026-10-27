begin;
create function private.composition_source_gap(payload jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(payload->>'code' in ('unnamed_write_in_slot','cancellation_document_type_unverified','cancellation_date_unverified','reference_scope_mismatch','ambiguous_scope'),false);
$$;
create function private.mark_composition_source_gap() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.kind='issue' and private.composition_source_gap(new.payload) then new.requires_new_import := true; end if;
  return new;
end $$;
create trigger mark_source_gap before insert on public.composition_review_tasks
for each row execute function private.mark_composition_source_gap();

-- This check also protects immutable imports staged before the new task marker.
create function private.guard_composition_source_decision() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.decision='accepted' and exists(select 1 from public.composition_review_tasks t
      where t.id=new.task_id and t.kind='issue' and private.composition_source_gap(t.payload)) then
    raise exception 'Source gap requires a new evidence-backed import';
  end if;
  return new;
end $$;
create trigger guard_source_decision before insert on public.composition_review_decisions
for each row execute function private.guard_composition_source_decision();
revoke all on function private.composition_source_gap(jsonb),private.mark_composition_source_gap(),private.guard_composition_source_decision() from public,anon,authenticated;

create or replace function public.composition_review_progress() returns table(run_sha256 text,county text,election_date date,total bigint,accepted bigint,open bigint,requires_new_import bigint)
language sql stable security invoker set search_path = '' as $$
  select b.run_sha256,b.county,b.election_date,count(t.id),count(t.id) filter(where d.decision='accepted'),
    count(t.id) filter(where d.decision is distinct from 'accepted'),count(t.id) filter(where t.requires_new_import)
  from public.composition_batches b join public.composition_review_tasks t on t.run_sha256=b.run_sha256
  left join lateral(select decision from public.composition_review_decisions where task_id=t.id order by sequence desc limit 1) d on true
  group by b.run_sha256,b.county,b.election_date order by max(b.imported_at) desc,b.county,b.run_sha256;
$$;
commit;
