-- BUKLOD MAIN emergency role-helper execution ACL hardening (non-Season 2).
-- Internal-only SECURITY DEFINER helpers must not be directly callable through
-- PostgREST by anon or authenticated clients. These helpers accept actor-chosen
-- scope/user/role and do not independently validate the caller. Their intended
-- internal callers are SECURITY DEFINER functions owned by postgres, so owner
-- execution remains available. Preserve service_role for trusted backend work.
-- Intentionally no table/role data, rewards, finance switches or RLS policies changed.

REVOKE EXECUTE ON FUNCTION public.buklod_church_ensure_membership_v1(uuid,uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.buklod_church_ensure_role_key_v1(uuid,uuid,text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.buklod_church_ensure_provisional_admin_v1(uuid,uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.buklod_church_ensure_scoped_leader_v1(uuid,uuid,text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.buklod_church_ensure_membership_v1(uuid,uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.buklod_church_ensure_role_key_v1(uuid,uuid,text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.buklod_church_ensure_provisional_admin_v1(uuid,uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.buklod_church_ensure_scoped_leader_v1(uuid,uuid,text)
  TO service_role;

DO $verify$
DECLARE v_func regprocedure;
BEGIN
  FOR v_func IN
    SELECT unnest(ARRAY[
      'public.buklod_church_ensure_membership_v1(uuid,uuid)'::regprocedure,
      'public.buklod_church_ensure_role_key_v1(uuid,uuid,text)'::regprocedure,
      'public.buklod_church_ensure_provisional_admin_v1(uuid,uuid)'::regprocedure,
      'public.buklod_church_ensure_scoped_leader_v1(uuid,uuid,text)'::regprocedure
    ])
  LOOP
    IF has_function_privilege('anon',v_func,'EXECUTE')
       OR has_function_privilege('authenticated',v_func,'EXECUTE')
       OR NOT has_function_privilege('service_role',v_func,'EXECUTE')
    THEN
      RAISE EXCEPTION 'Unsafe RPC helper privileges: %', v_func;
    END IF;
  END LOOP;
END
$verify$;
