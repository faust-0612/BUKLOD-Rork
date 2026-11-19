-- BUKLOD MAIN non-Season2 security scanner R2 regression checks.
-- Pure inspection: no scan execution, no notifications or data changes.
DO $test$
DECLARE v_ddl text;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
    'private.buklod_security_scan_v1()'::regprocedure
  ) INTO v_ddl;

  IF v_ddl NOT LIKE '%INTERNAL_ROLE_HELPER_CLIENT_EXECUTE%'
     OR v_ddl NOT LIKE '%AUTH_AUDIT_DB_WINDOW_UNVERIFIED%'
     OR v_ddl NOT LIKE '%PUBLIC_UNSAFE_DDL_GRANTS%'
     OR v_ddl NOT LIKE '%FINANCE_MONEY_SWITCH_ACTIVE%'
     OR v_ddl NOT LIKE '%BACKEND_CAPACITY_REVIEW%' THEN
    RAISE EXCEPTION 'Existing scan coverage or additional R2 guards missing';
  END IF;

  IF pg_catalog.has_function_privilege('anon','private.buklod_security_scan_v1()'::regprocedure,'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated','private.buklod_security_scan_v1()'::regprocedure,'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('service_role','private.buklod_security_scan_v1()'::regprocedure,'EXECUTE')
  THEN
    RAISE EXCEPTION 'Scanner privilege regression';
  END IF;

  IF NOT EXISTS(SELECT 1 FROM cron.job
    WHERE jobname='buklod-security-scan-r1' AND active
      AND schedule='*/15 * * * *') THEN
    RAISE EXCEPTION 'Existing scan cadence not active';
  END IF;

  IF EXISTS (
    SELECT 1 FROM (VALUES
      ('public.buklod_church_ensure_membership_v1(uuid,uuid)'),
      ('public.buklod_church_ensure_role_key_v1(uuid,uuid,text)'),
      ('public.buklod_church_ensure_provisional_admin_v1(uuid,uuid)'),
      ('public.buklod_church_ensure_scoped_leader_v1(uuid,uuid,text)'),
      ('public.buklod_sync_local_memberships(uuid)')
    ) AS guarded(signature)
    WHERE pg_catalog.to_regprocedure(guarded.signature) IS NOT NULL
      AND (pg_catalog.has_function_privilege(
        'anon',pg_catalog.to_regprocedure(guarded.signature),'EXECUTE')
       OR pg_catalog.has_function_privilege(
        'authenticated',pg_catalog.to_regprocedure(guarded.signature),'EXECUTE'))
  ) THEN
    RAISE EXCEPTION 'Internal role helper accessible to untrusted client';
  END IF;
END
$test$;
