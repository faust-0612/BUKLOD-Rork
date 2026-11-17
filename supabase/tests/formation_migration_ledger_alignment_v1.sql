-- Formation migration ledger integrity and exposed-RPC security regression.
-- Intended for an environment after the Formation migrations have been applied.
begin;
do $verify$
declare
  v_count integer;
begin
  if to_regprocedure('public.buklod_formation_reports_member_v1(uuid,uuid)') is null
     or to_regprocedure('public.buklod_resolve_auto_submission_scope_v1(text,uuid)') is null
  then
    raise exception 'Formation reporting RPCs are missing';
  end if;
  if has_function_privilege('anon','public.buklod_formation_reports_member_v1(uuid,uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.buklod_formation_reports_member_v1(uuid,uuid)','EXECUTE')
     or has_function_privilege('anon','public.buklod_resolve_auto_submission_scope_v1(text,uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.buklod_resolve_auto_submission_scope_v1(text,uuid)','EXECUTE')
  then
    raise exception 'Internal Formation reporting RPC access exposed';
  end if;

  if to_regclass('supabase_migrations.schema_migrations') is not null then
    select count(*) into v_count
    from supabase_migrations.schema_migrations
    where (version,name) in (
      ('20261117142009','formation_all_active_scope_reporting_v1_20261117'),
      ('20261117142308','formation_scope_resolver_privilege_lock_v1_20261117'),
      ('20261117142548','formation_multi_scope_reporting_dedup_v2_20261117')
    );
    if v_count <> 3 then
      raise exception 'Formation migration ledger mismatch; expected 3 applied versions, got %',v_count;
    end if;
  end if;
end
$verify$;
rollback;
