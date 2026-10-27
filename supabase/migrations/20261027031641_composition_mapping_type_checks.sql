begin;
-- Reject JSON objects/numbers masquerading as entity names or reference keys.
-- Unknown assignment values remain null and produce the existing draft issues.
do $$
declare
  definition text := pg_get_functiondef('private.build_composition_mapping(text,jsonb)'::regprocedure);
  marker text := $marker$  if (select count(*)<>count(distinct x->>'recordId')$marker$;
  checks text := $checks$
  if exists(select 1 from jsonb_array_elements(p_mapping->'jurisdictions') x where
      jsonb_typeof(x) is distinct from 'object' or exists(select 1 from unnest(array['key','name','kind','sourceRecordId']) k where jsonb_typeof(x->k) is distinct from 'string')) or
    exists(select 1 from jsonb_array_elements(p_mapping->'districts') x where
      jsonb_typeof(x) is distinct from 'object' or exists(select 1 from unnest(array['key','name','jurisdictionKey','sourceRecordId']) k where jsonb_typeof(x->k) is distinct from 'string')) or
    exists(select 1 from jsonb_array_elements(p_mapping->'records') x where
      jsonb_typeof(x) is distinct from 'object' or jsonb_typeof(x->'recordId') is distinct from 'string' or
      exists(select 1 from unnest(array['jurisdictionKey','districtKey','officeType','electionType']) k where coalesce(jsonb_typeof(x->k),'null') not in ('string','null')) or
      exists(select 1 from unnest(array['seats','voteLimit']) k where coalesce(jsonb_typeof(x->k),'null') not in ('number','null'))) or
    exists(select 1 from jsonb_array_elements(p_mapping->'styles') x where
      jsonb_typeof(x) is distinct from 'object' or exists(select 1 from unnest(array['code','language','jurisdictionKey','referenceSha256']) k where jsonb_typeof(x->k) is distinct from 'string')) then
    raise exception 'Invalid mapping field types';
  end if;
  if exists(select 1 from jsonb_array_elements(p_mapping->'styles') x where jsonb_typeof(x->'recordIds') is distinct from 'array') then raise exception 'Invalid style membership types'; end if;
  if exists(select 1 from jsonb_array_elements(p_mapping->'styles') x, jsonb_array_elements(x->'recordIds') y where jsonb_typeof(y) is distinct from 'string') then raise exception 'Invalid style membership types'; end if;
$checks$;
begin
  if strpos(definition,marker)=0 then raise exception 'Expected normalization guard is missing'; end if;
  execute replace(definition,marker,checks||marker);
end $$;
commit;
