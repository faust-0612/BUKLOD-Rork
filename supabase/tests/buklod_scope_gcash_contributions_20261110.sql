-- Nonmutating scope-GCash-finance contract. Run after migration.
do $test$
declare v_count int; v_func oid;
begin
  select count(*) into v_count from information_schema.tables
    where table_schema='private' and table_name='buklod_scope_gcash_contribution_reports_v1';
  if v_count<>1 then raise exception 'Manual report table missing'; end if;
  if not (select relrowsecurity from pg_class where oid='private.buklod_scope_gcash_contribution_reports_v1'::regclass) then
    raise exception 'Manual report RLS must be enabled'; end if;
  if has_table_privilege('authenticated','private.buklod_scope_gcash_contribution_reports_v1','INSERT') then
    raise exception 'Direct client INSERT forbidden'; end if;
  if not exists (
    select 1 from pg_constraint where conrelid='private.buklod_pf_community_fund_ledger'::regclass
    and conname='buklod_pf_community_fund_ledger_entry_type_check'
    and pg_get_constraintdef(oid) like '%MANUAL_GCASH_CONTRIBUTION%'
  ) then raise exception 'Canonical fund ledger contribution type missing'; end if;
  select to_regprocedure('public.report_buklod_scope_gcash_contribution_v1(uuid,numeric,text,text,text)') into v_func;
  if v_func is null then raise exception 'Report function missing'; end if;
  if has_function_privilege('anon',v_func,'EXECUTE') then raise exception 'Anon report not allowed'; end if;
  if not has_function_privilege('authenticated',v_func,'EXECUTE') then raise exception 'Authenticated report missing'; end if;
  select to_regprocedure('public.review_buklod_scope_gcash_contribution_v1(uuid,boolean,text)') into v_func;
  if v_func is null then raise exception 'Review function missing'; end if;
  if has_function_privilege('anon',v_func,'EXECUTE') then raise exception 'Anon review not allowed'; end if;
  if not has_function_privilege('authenticated',v_func,'EXECUTE') then raise exception 'Authenticated reviewer RPC missing'; end if;
  select to_regprocedure('public.get_buklod_scope_gcash_fund_dashboard_v1(uuid)') into v_func;
  if v_func is null then raise exception 'Dashboard function missing'; end if;
  if has_function_privilege('anon',v_func,'EXECUTE') then raise exception 'Anon dashboard not allowed'; end if;
end;
$test$;