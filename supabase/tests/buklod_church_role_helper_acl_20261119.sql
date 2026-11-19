-- Regression check: role/membership helpers are internal-only server operations.
-- Read-only inspection; safe on the production database.
DO $test$
DECLARE v_func regprocedure;
BEGIN
 FOR v_func IN SELECT unnest(ARRAY[
  'public.buklod_church_ensure_membership_v1(uuid,uuid)'::regprocedure,
  'public.buklod_church_ensure_role_key_v1(uuid,uuid,text)'::regprocedure,
  'public.buklod_church_ensure_provisional_admin_v1(uuid,uuid)'::regprocedure,
  'public.buklod_church_ensure_scoped_leader_v1(uuid,uuid,text)'::regprocedure
 ]) LOOP
  IF pg_catalog.has_function_privilege('anon',v_func,'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated',v_func,'EXECUTE')
  THEN
    RAISE EXCEPTION 'External client can execute protected church helper: %',v_func;
  END IF;
  IF NOT pg_catalog.has_function_privilege('service_role',v_func,'EXECUTE') THEN
    RAISE EXCEPTION 'Trusted server helper access unavailable: %',v_func;
  END IF;
 END LOOP;
END
$test$;
