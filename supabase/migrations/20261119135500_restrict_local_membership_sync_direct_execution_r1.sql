-- BUKLOD MAIN emergency follow-up: protect internal-only local membership synchronization.
-- This SECURITY DEFINER function takes arbitrary _user_id and updates local
-- memberships. Its callers are postgres-owned registration/trigger functions;
-- no client may invoke the helper directly. No account/data mutations here.
REVOKE EXECUTE ON FUNCTION public.buklod_sync_local_memberships(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_sync_local_memberships(uuid)
  TO service_role;
DO $verify$
BEGIN
  IF has_function_privilege('anon','public.buklod_sync_local_memberships(uuid)'::regprocedure,'EXECUTE')
  OR has_function_privilege('authenticated','public.buklod_sync_local_memberships(uuid)'::regprocedure,'EXECUTE')
  OR NOT has_function_privilege('service_role','public.buklod_sync_local_memberships(uuid)'::regprocedure,'EXECUTE') THEN
    RAISE EXCEPTION 'Unsafe external direct membership sync RPC access';
  END IF;
END
$verify$;
