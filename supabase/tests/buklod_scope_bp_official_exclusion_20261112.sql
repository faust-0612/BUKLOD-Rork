-- Live-compatible, rollback-only regression: both exact scope types, all official memberships,
-- contiguous recalculated ranks, unaffected ordinary users, and strict access control.
BEGIN;
DO $test$
DECLARE
  v_official uuid;
  v record;
  v_checked integer := 0;
  v_ordinary uuid;
  v_outsider uuid;
  v_expected uuid[];
  v_actual uuid[];
  v_count integer;
  v_denied boolean;
BEGIN
  SELECT user_id INTO STRICT v_official
    FROM private.buklod_official_identity_snapshot_v1
    WHERE principal_key='OFFICIAL_SYSTEM_ADMIN';

  IF NOT private.buklod_is_platform_official_v1(v_official) THEN
    RAISE EXCEPTION 'Canonical official principal is not recognized';
  END IF;
  IF has_function_privilege('anon','public.get_buklod_scope_bp_top10_v1(uuid)','EXECUTE') OR
     NOT has_function_privilege('authenticated','public.get_buklod_scope_bp_top10_v1(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'RPC grants changed';
  END IF;

  FOR v IN
    SELECT s.id AS scope_id,s.scope_type
    FROM public.buklod_scopes s
    JOIN public.buklod_scope_memberships m ON m.scope_id=s.id
    WHERE m.user_id=v_official AND m.membership_status='ACTIVE' AND m.left_at IS NULL
      AND s.scope_type IN ('CLUSTER','ORGANIZATION') AND s.status='ACTIVE'
  LOOP
    v_checked := v_checked + 1;
    PERFORM set_config('request.jwt.claim.sub',v_official::text,true);
    SELECT COALESCE(array_agg(r.user_id ORDER BY r.rank_position),'{}'::uuid[])
      INTO v_actual FROM public.get_buklod_scope_bp_top10_v1(v.scope_id) r;
    SELECT ARRAY(
      SELECT p.id
      FROM public.buklod_scope_memberships m
      JOIN public.profiles p ON p.id=m.user_id
      LEFT JOIN public.buklod_user_points_balances b ON b.user_id=m.user_id
      WHERE m.scope_id=v.scope_id AND m.membership_status='ACTIVE' AND m.left_at IS NULL
        AND p.is_active=true AND NOT private.buklod_is_platform_official_v1(p.id)
      ORDER BY greatest(0,coalesce(b.lifetime_points,0)) DESC,
        lower(COALESCE(NULLIF(btrim(p.full_name),''),NULLIF(btrim(p.username),''),'BUKLOD Member')),p.id
      LIMIT 10
    ) INTO v_expected;
    IF v_actual IS DISTINCT FROM v_expected OR v_official=ANY(v_actual) THEN
      RAISE EXCEPTION 'Wrong ranked members in %',v.scope_type;
    END IF;
    SELECT count(*) INTO v_count FROM public.get_buklod_scope_bp_top10_v1(v.scope_id) r
      WHERE r.rank_position < 1 OR r.rank_position > 10 OR
      (SELECT count(*) FROM public.get_buklod_scope_bp_top10_v1(v.scope_id) x
        WHERE x.rank_position <= r.rank_position) <> r.rank_position;
    IF v_count<>0 THEN RAISE EXCEPTION 'Rank positions not contiguous'; END IF;
  END LOOP;
  IF v_checked=0 THEN RAISE EXCEPTION 'No active official memberships tested'; END IF;

  SELECT s.id, m.user_id INTO v.scope_id, v_ordinary
    FROM public.buklod_scopes s
    JOIN public.buklod_scope_memberships m ON m.scope_id=s.id
    JOIN public.profiles p ON p.id=m.user_id AND p.is_active=true
    WHERE s.status='ACTIVE' AND s.scope_type IN ('CLUSTER','ORGANIZATION')
      AND m.membership_status='ACTIVE' AND m.left_at IS NULL
      AND NOT private.buklod_is_platform_official_v1(m.user_id)
    ORDER BY s.id LIMIT 1;
  IF v_ordinary IS NULL THEN RAISE EXCEPTION 'Missing ordinary member fixture'; END IF;
  PERFORM set_config('request.jwt.claim.sub',v_ordinary::text,true);
  PERFORM * FROM public.get_buklod_scope_bp_top10_v1(v.scope_id);

  SELECT p.id INTO v_outsider FROM public.profiles p
    WHERE p.is_active=true AND NOT EXISTS(
      SELECT 1 FROM public.buklod_scope_memberships m
      WHERE m.scope_id=v.scope_id AND m.user_id=p.id
        AND m.membership_status='ACTIVE' AND m.left_at IS NULL
    ) LIMIT 1;
  IF v_outsider IS NULL THEN RAISE EXCEPTION 'Missing outsider fixture'; END IF;
  PERFORM set_config('request.jwt.claim.sub',v_outsider::text,true);
  v_denied := false;
  BEGIN
    PERFORM * FROM public.get_buklod_scope_bp_top10_v1(v.scope_id);
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Outsider gained access'; END IF;

  PERFORM set_config('request.jwt.claim.sub','',true);
  v_denied := false;
  BEGIN
    PERFORM * FROM public.get_buklod_scope_bp_top10_v1(v.scope_id);
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Anonymous viewer gained access'; END IF;
  RAISE NOTICE 'Scope BP official exclusion PASS, checked % official scope memberships', v_checked;
END $test$;
ROLLBACK;
