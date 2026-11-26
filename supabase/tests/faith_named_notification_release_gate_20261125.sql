-- Read-only production release gate; fail closed for unavailable integrations.
do $gate$
begin
 if to_regclass('public.saliksik_mastery') is null or not exists(
  select 1 from pg_trigger where tgrelid=to_regclass('public.saliksik_mastery')
  and tgname='buklod_faith_named_accomplishment' and not tgisinternal and tgenabled<>'D'
 ) then raise exception 'SALIKSIK canonical notification hook not installed'; end if;
 if has_function_privilege('authenticated','private.buklod_notify_faith_accomplishment_v1(uuid,text,text,text,text,timestamptz,uuid,uuid)','EXECUTE') then
  raise exception 'Unsafe notification helper grant'; end if;
 if to_regclass('private.buklod_children_teaching_sessions') is null
 or to_regprocedure('public.submit_my_children_teaching_v1(uuid,uuid,uuid,text,date,text,integer,text,boolean)') is null
 or to_regprocedure('public.buklod_scope_faith_monitoring_period_v3(uuid,text,date)') is null
 then raise exception 'Children teaching canonical source, submission or report missing'; end if;
 if has_table_privilege('authenticated','private.buklod_children_teaching_sessions','SELECT')
 or has_table_privilege('authenticated','private.buklod_children_teaching_sessions','INSERT')
 or has_function_privilege('anon','public.submit_my_children_teaching_v1(uuid,uuid,uuid,text,date,text,integer,text,boolean)','EXECUTE')
 then raise exception 'Children teaching evidence exposed'; end if;
 if not exists(select 1 from storage.buckets where id='buklod-children-teaching-evidence' and public=false and file_size_limit=2097152)
 then raise exception 'Private evidence storage missing'; end if;
 if position('buklod_notify_faith_accomplishment_v1' in pg_get_functiondef('public.submit_my_children_teaching_v1(uuid,uuid,uuid,text,date,text,integer,text,boolean)'::regprocedure))=0
 then raise exception 'Children teaching notification producer missing'; end if;
 -- Release also requires independently approved retention, provider/ledger parity and runtime evidence.
 if exists(select 1 from private.buklod_children_teaching_rollout where enabled)
 then raise exception 'Children teaching must remain OFF pending privacy and provider approval'; end if;
end;
$gate$;
