-- Read-only privilege checks; execute after both migrations on ephemeral QA.
do $$
declare f regprocedure;
begin
  foreach f in array array[
    'public.complete_my_children_story_v1(uuid,text,integer,text,smallint[])'::regprocedure,
    'public.buklod_scope_faith_monitoring_period_v2(uuid,text,date)'::regprocedure
  ] loop
    if has_function_privilege('anon',f,'EXECUTE') or not has_function_privilege('authenticated',f,'EXECUTE') then
      raise exception 'Unexpected RPC execution privilege: %',f;
    end if;
    if not exists(select 1 from pg_proc p where p.oid=f and p.prosecdef and p.proconfig @> array['search_path=""']) then
      raise exception 'Missing secure definer/search path: %',f;
    end if;
  end loop;
  if has_table_privilege('authenticated','private.buklod_children_story_answer_keys','SELECT')
    or has_table_privilege('authenticated','private.buklod_children_story_completions','INSERT')
    or has_table_privilege('anon','private.buklod_children_story_answer_keys','SELECT') then
    raise exception 'Private answer/completion data privilege exposure';
  end if;
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname in ('buklod_children_story_answer_keys','buklod_children_story_completions') and not c.relrowsecurity) then
    raise exception 'Missing private table RLS';
  end if;
end $$;
