-- Local Supabase DB tests only, after DEV migration. No production mutation.
begin;
do $$
declare v_count integer;
begin
 if not exists(select 1 from storage.buckets
  where id='buklod-character-art-v1' and public=true and file_size_limit=1048576) then
  raise exception 'Public character art bucket contract missing';
 end if;
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='private' and c.relname='buklod_character_task_events_v1'
    and c.relrowsecurity) then
  raise exception 'Private character task events RLS missing';
 end if;
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='private' and c.relname='buklod_character_story_awards_v1'
    and c.relrowsecurity) then
  raise exception 'Private Character story awards RLS missing';
 end if;
 if has_table_privilege('anon','private.buklod_character_task_events_v1','SELECT')
  or has_table_privilege('authenticated','private.buklod_character_task_events_v1','INSERT')
  or has_table_privilege('authenticated','private.buklod_character_story_awards_v1','INSERT') then
  raise exception 'Direct Character task/award table grants are unsafe';
 end if;
 if has_function_privilege('anon','public.get_my_buklod_character_story_tasks_v1(text)','EXECUTE')
  or not has_function_privilege('authenticated','public.get_my_buklod_character_story_tasks_v1(text)','EXECUTE') then
  raise exception 'Character story RPC access grants invalid';
 end if;
 if has_function_privilege('authenticated',
  'private.buklod_evaluate_character_story_tasks_v1(uuid,text,integer)','EXECUTE') then
  raise exception 'Client can invoke a private story award evaluator';
 end if;
 select count(*) into v_count from pg_trigger t
  where t.tgname='trg_buklod_capture_character_task_event_v1'
    and not t.tgisinternal and t.tgenabled <> 'D';
 if v_count<>1 then raise exception 'Trusted public Wall event capture trigger missing';end if;
end;
$$;
rollback;
