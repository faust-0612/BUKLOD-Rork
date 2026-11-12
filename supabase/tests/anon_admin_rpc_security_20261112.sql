-- Read-only post-migration release gate for main BUKLOD Supabase.
-- Run after applying the ACL migration. Must throw if admin RPC exposure returns.
DO $assert_anon_admin_locked$
DECLARE
  exposed integer;
BEGIN
  SELECT count(*) INTO exposed
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND p.proname LIKE 'admin\_%' ESCAPE '\'
    AND has_function_privilege('anon', p.oid, 'EXECUTE');

  IF exposed > 0 THEN
    RAISE EXCEPTION 'BUKLOD security regression: % anonymous admin definer RPCs', exposed;
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.admin_set_user_role(uuid,text,boolean)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.admin_award_buklod_points_v1(uuid,integer,text)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'BUKLOD regression: signed-in admin RPC privileges missing';
  END IF;
END;
$assert_anon_admin_locked$;
