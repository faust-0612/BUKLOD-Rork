-- Read-only production contract for AdMob scheduler privilege separation.
-- The Edge Function signature and role gate are tested in Node; this SQL
-- checks the privileged target RPC and private snapshots remain protected.
do $buklod_admob_scheduler_auth$
declare
  v_admin oid := to_regprocedure('public.admin_set_buklod_community_admob_estimate_v1(text,numeric,text,text,timestamptz)');
  v_admin_sql text;
begin
  if v_admin is null then
    raise exception 'Official AdMob source-backed writer RPC is missing';
  end if;
  if has_function_privilege('anon',v_admin,'EXECUTE') then
    raise exception 'Anonymous users can invoke the AdMob snapshot writer';
  end if;
  if not has_function_privilege('service_role',v_admin,'EXECUTE') then
    raise exception 'Trusted service role cannot invoke AdMob snapshot writer';
  end if;
  if has_table_privilege('anon','private.buklod_community_admob_estimate_snapshots','SELECT')
     or has_table_privilege('authenticated','private.buklod_community_admob_estimate_snapshots','SELECT') then
    raise exception 'Snapshot storage leaked through unprivileged table access';
  end if;
  v_admin_sql := pg_get_functiondef(v_admin);
  if position('buklod_is_system_admin' in v_admin_sql) = 0
     or position('OFFICIAL_ADMOB_API' in v_admin_sql) = 0
     or position('service_role' in v_admin_sql) = 0 then
    raise exception 'Writer lost authenticated admin or official service-source checks';
  end if;
end;
$buklod_admob_scheduler_auth$;
