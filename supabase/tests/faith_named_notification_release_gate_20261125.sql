-- Read-only production release gate; fail closed for unavailable integrations.
do $gate$
begin
 if to_regclass('public.saliksik_mastery') is null or not exists(
  select 1 from pg_trigger where tgrelid=to_regclass('public.saliksik_mastery')
  and tgname='buklod_faith_named_accomplishment' and not tgisinternal and tgenabled<>'D'
 ) then raise exception 'SALIKSIK canonical notification hook not installed'; end if;
 if has_function_privilege('authenticated','private.buklod_notify_faith_accomplishment_v1(uuid,text,text,text,text,timestamptz,uuid,uuid)','EXECUTE') then
  raise exception 'Unsafe notification helper grant'; end if;
 -- This gate intentionally remains blocked until Children teaching has a verified source and hook.
 raise exception 'Children teaching canonical verification and notification hook not yet implemented';
end;
$gate$;
