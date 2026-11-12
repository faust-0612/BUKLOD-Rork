-- 2026-11-12: least-privilege lock for existing BUKLOD admin RPCs.
-- Main BUKLOD production baseline: 58 public.admin_* SECURITY DEFINER RPCs
-- were executable by anon while also executable by authenticated.
--
-- Purpose: stop unauthenticated HTTP RPC calls before entering privileged
-- function code. Keep authenticated app/admin callers, triggers, and service
-- operations working. No RLS, data, media, payout, or video mutations.
--
-- Important: changing EXECUTE grants is a boundary control, not a substitute
-- for each function's internal system-admin/ownership checks.
DO $lock_admin_rpcs$
DECLARE
  target record;
  signature text;
  changed_count integer := 0;
BEGIN
  FOR target IN
    SELECT p.oid, n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname LIKE 'admin\_%' ESCAPE '\'
      AND p.prosecdef
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
  LOOP
    signature := format('%I.%I(%s)', target.nspname, target.proname, target.args);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', signature);
    changed_count := changed_count + 1;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname LIKE 'admin\_%' ESCAPE '\'
      AND p.prosecdef
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'BUKLOD security violation: anon can execute an admin SECURITY DEFINER RPC';
  END IF;

  RAISE NOTICE 'BUKLOD admin RPC anon grants closed: %', changed_count;
END;
$lock_admin_rpcs$;
