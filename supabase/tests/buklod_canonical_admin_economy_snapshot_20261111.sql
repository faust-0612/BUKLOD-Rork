-- Post-migration READ ONLY contract; requires canonical snapshot migration applied in RC.
do $audit$
declare
  v_fn oid:=to_regprocedure('public.admin_get_buklod_canonical_economy_snapshot_v1(text)');
  v_sql text;
begin
  if v_fn is null then raise exception 'Canonical admin Economy snapshot missing'; end if;
  if has_function_privilege('anon',v_fn,'EXECUTE') then
    raise exception 'Economy snapshot exposed to anon';
  end if;
  if not has_function_privilege('authenticated',v_fn,'EXECUTE') then
    raise exception 'Economy snapshot unreadable to authenticated admins';
  end if;
  v_sql:=lower(pg_get_functiondef(v_fn));
  if position('buklod_is_system_admin()' in v_sql)=0
     or position('admin_get_buklod_pf_finance_console_v3(v_key)' in v_sql)=0
     or position('admin_get_buklod_pf_qmp_readiness_v1(v_key)' in v_sql)=0
     or position('admin_get_buklod_community_admob_estimate_v1(v_key)' in v_sql)=0
     or position('v_finance->>''period_key''' in v_sql)=0
     or position('transaction_timestamp()' in v_sql)=0 then
    raise exception 'Source consistency or admin authorization contract missing';
  end if;
  if position('admin_get_buklod_r38_economy_report_v1' in v_sql)>0
     or position('update private.buklod_pf_' in v_sql)>0
     or position('insert into private.buklod_pf_' in v_sql)>0 then
    raise exception 'Legacy or cash-writing side effect in admin report';
  end if;
end;
$audit$;
