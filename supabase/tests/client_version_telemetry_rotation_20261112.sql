begin;
do $telemetry_test$
declare
  source_text text;
  is_definer boolean;
begin
  select pg_get_functiondef('public.buklod_register_client_version_r1(uuid,text,text,integer,text,uuid,text)'::regprocedure),prosecdef
    into source_text,is_definer
  from pg_proc where oid='public.buklod_register_client_version_r1(uuid,text,text,integer,text,uuid,text)'::regprocedure;
  if not is_definer or position('pg_advisory_xact_lock' in source_text)=0 or
     position('delete from private.buklod_client_version_registry_r1' in source_text)=0 or
     position('order by last_seen_at asc, first_seen_at asc, installation_id asc' in source_text)=0 then
     raise exception 'Bounded telemetry rotation or privilege protection missing';
  end if;
  if position('Client version telemetry installation limit' in source_text)>0 then
     raise exception 'Legacy installation limit exception remains';
  end if;
  if position('OBSERVE_ONLY' in source_text)=0 or position('enforcement_enabled' in source_text)=0 or
     position('actor is null' in source_text)=0 then
     raise exception 'Telemetry/admission safety contract changed';
  end if;
  if has_function_privilege('anon','public.buklod_register_client_version_r1(uuid,text,text,integer,text,uuid,text)','EXECUTE') then
     raise exception 'Anonymous registration must not be executable';
  end if;
end $telemetry_test$;
rollback;
