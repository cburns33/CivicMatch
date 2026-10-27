begin;
-- Extend only the contributing-source MIME check. Preserve the existing
-- private implementation, grants, reviewer checks, and immutable history.
do $$
declare
  definition text := pg_get_functiondef('private.stage_composition_batch(jsonb)'::regprocedure);
  old_check text := $check$doc->'source'->>'mediaType' is distinct from 'application/pdf'$check$;
  new_check text := $check$(doc->'source'->>'mediaType' is distinct from 'application/pdf' and
         not coalesce(doc->'source'->>'kind'='supporting_reference' and
           doc->'source'->>'mediaType'='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' and
           doc->'source'->>'url'='https://goelect.txelections.civixapps.com/ivis-cbp-ui/candidate-information',false))$check$;
begin
  if strpos(definition,old_check)=0 then raise exception 'Expected source MIME check is missing'; end if;
  execute replace(definition,old_check,new_check);
end $$;
notify pgrst, 'reload schema';
commit;
