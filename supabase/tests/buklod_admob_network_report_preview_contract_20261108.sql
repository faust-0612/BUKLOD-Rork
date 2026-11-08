-- Read-only production contract for source-backed QMP AdMob estimates.
-- Run after the 2026-10-27 preview migration. This test never writes funds.
do $buklod_admob_preview$
declare
  v_member oid := to_regprocedure('public.get_my_buklod_community_contribution_live_v1()');
  v_admin oid := to_regprocedure('public.admin_set_buklod_community_admob_estimate_v1(text,numeric,text,text,timestamptz)');
  v_member_sql text;
  v_admin_sql text;
begin
  if v_member is null or v_admin is null then
    raise exception 'QMP AdMob preview RPC missing';
  end if;
  if has_function_privilege('anon',v_member,'EXECUTE')
     or has_function_privilege('anon',v_admin,'EXECUTE') then
    raise exception 'AdMob revenue preview RPC exposed to anonymous users';
  end if;
  if not has_function_privilege('authenticated',v_member,'EXECUTE') then
    raise exception 'Authenticated community users cannot load their own estimate';
  end if;
  if has_table_privilege('anon','private.buklod_community_admob_estimate_snapshots','SELECT')
     or has_table_privilege('authenticated','private.buklod_community_admob_estimate_snapshots','SELECT') then
    raise exception 'Private source-backed estimate snapshots leaked';
  end if;
  v_member_sql := pg_get_functiondef(v_member);
  v_admin_sql := pg_get_functiondef(v_admin);
  if position('auth.uid()' in v_member_sql) = 0
     or position('SOURCE_NOT_CONNECTED' in v_member_sql) = 0
     or position('STALE' in v_member_sql) = 0
     or position('estimated_share_minor' in v_member_sql) = 0
     or position('total_qualified_qmp' in v_member_sql) = 0 then
    raise exception 'Missing authenticated, fail-closed, QMP-weighted preview';
  end if;
  if position('buklod_is_system_admin' in v_admin_sql) = 0
     or position('OFFICIAL_ADMOB_API' in v_admin_sql) = 0
     or position('service_role' in v_admin_sql) = 0 then
    raise exception 'AdMob snapshot writer must require admin or server role';
  end if;
end;
$buklod_admob_preview$;
