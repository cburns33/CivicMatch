-- Selected-race research drafts are separate from county composition publication.
-- Only the trusted database operator can stage immutable drafts. Reviewers can read.
create table public.race_guide_drafts (
  version text primary key check (length(version) between 1 and 100),
  payload jsonb not null,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  constraint pending_research_only check ((
    jsonb_typeof(payload) = 'object'
    and payload->>'version' = version
    and payload->'review'->>'status' = 'pending'
    and jsonb_typeof(payload->'positions') = 'array'
    and jsonb_typeof(payload->'sources') = 'array'
    and payload->'review'->'reviewer' = 'null'::jsonb
    and payload->'review'->'reviewedAt' = 'null'::jsonb
  ) is true)
);
alter table public.race_guide_drafts enable row level security;
revoke all on public.race_guide_drafts from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    revoke all on public.race_guide_drafts from service_role;
  end if;
end $$;
grant select on public.race_guide_drafts to authenticated;
create policy reviewer_read on public.race_guide_drafts for select to authenticated
  using ((select public.is_composition_reviewer()));
create trigger immutable_record before update or delete on public.race_guide_drafts
  for each row execute function private.reject_mutation();
create function private.hash_race_guide_draft() returns trigger
language plpgsql set search_path = '' as $$ begin
  new.sha256 := encode(sha256(convert_to(new.payload::text, 'UTF8')), 'hex');
  return new;
end $$;
revoke all on function private.hash_race_guide_draft() from public, anon, authenticated;
create trigger stamp_checksum before insert on public.race_guide_drafts
  for each row execute function private.hash_race_guide_draft();
