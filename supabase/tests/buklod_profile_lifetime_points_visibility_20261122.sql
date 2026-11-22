-- Run after its paired migration in a rollback-only transaction.
BEGIN;
DO $test$
DECLARE
  v_member uuid;
  v_locked uuid;
  v_official uuid;
  v_expected bigint;
  v_actual bigint;
BEGIN
  IF has_function_privilege('anon',
       'public.get_buklod_member_lifetime_points_v1(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated',
       'public.get_buklod_member_lifetime_points_v1(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated-only public lifetime RPC grant broken';
  END IF;
  IF has_function_privilege('anon', 'public.buklod_lifetime_points_for(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.buklod_lifetime_points_for(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.buklod_points_for(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.buklod_points_for(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Legacy unscoped points helper remains publicly callable';
  END IF;

  SELECT p.id INTO v_member FROM public.profiles p
  WHERE p.is_active = true
    AND NOT private.buklod_is_platform_official_v1(p.id)
    AND NOT EXISTS (
      SELECT 1 FROM public.buklod_user_preferences u
      WHERE u.user_id=p.id AND u.profile_locked IS TRUE)
  LIMIT 1;
  IF v_member IS NULL THEN
    RAISE EXCEPTION 'Missing unlocked active-member test fixture';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_member::text, true);
  SELECT public.get_buklod_member_lifetime_points_v1(v_member) INTO v_actual;
  SELECT GREATEST(0,COALESCE(b.lifetime_points,0))
    INTO v_expected
  FROM public.buklod_user_points_balances b WHERE b.user_id=v_member;
  IF v_actual IS DISTINCT FROM COALESCE(v_expected,0) THEN
    RAISE EXCEPTION 'Member lifetime points differ from authoritative balance';
  END IF;

  SELECT p.id INTO v_locked
  FROM public.profiles p JOIN public.buklod_user_preferences u
    ON u.user_id=p.id AND u.profile_locked IS TRUE
  WHERE p.is_active = true AND p.id<>v_member
    AND NOT private.buklod_is_platform_official_v1(p.id)
  LIMIT 1;
  IF v_locked IS NOT NULL
    AND public.get_buklod_member_lifetime_points_v1(v_locked) IS NOT NULL THEN
      RAISE EXCEPTION 'Locked profile points leaked to another member';
  END IF;
  SELECT user_id INTO v_official
  FROM private.buklod_official_identity_snapshot_v1
  WHERE principal_key='OFFICIAL_SYSTEM_ADMIN';
  IF v_official IS NULL OR
    public.get_buklod_member_lifetime_points_v1(v_official) IS NOT NULL THEN
    RAISE EXCEPTION 'BUKLOD Official must have no public member points';
  END IF;

  IF public.get_buklod_member_lifetime_points_v1(
       '00000000-0000-4000-8000-000000000000'::uuid) IS NOT NULL THEN
    RAISE EXCEPTION 'Unknown profile returned a fabricated zero';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  IF public.get_buklod_member_lifetime_points_v1(v_member) IS NOT NULL THEN
    RAISE EXCEPTION 'Unauthenticated user got lifetime points';
  END IF;
END $test$;
ROLLBACK;
