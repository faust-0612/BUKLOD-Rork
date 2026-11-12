-- BUKLOD Official Wall publish hotfix regression, rollback-only.
-- Run after migration 20261112115000. No durable posts or member credits.
BEGIN;
DO $test$
DECLARE
  v_official uuid;
  v_post uuid;
  v_points_before bigint;
  v_qmp_before bigint;
  v_points_after bigint;
  v_qmp_after bigint;
  v_guard_count integer;
BEGIN
  SELECT user_id INTO STRICT v_official
    FROM private.buklod_official_identity_snapshot_v1
    WHERE principal_key='OFFICIAL_SYSTEM_ADMIN';
  IF NOT private.buklod_is_platform_official_v1(v_official) THEN
    RAISE EXCEPTION 'Official identity mismatch';
  END IF;
  SELECT count(*) INTO v_guard_count
    FROM pg_trigger
    WHERE tgname='zz_buklod_official_points_ledger_guard_v1'
      AND tgenabled='O';
  IF v_guard_count<>1 THEN RAISE EXCEPTION 'Official points guard disabled'; END IF;

  SELECT count(*) INTO v_points_before
    FROM public.buklod_points_ledger WHERE user_id=v_official;
  SELECT count(*) INTO v_qmp_before
    FROM private.buklod_community_qmp_events WHERE user_id=v_official;

  PERFORM set_config('request.jwt.claim.sub',v_official::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub',v_official::text,'role','authenticated')::text,true);

  SELECT public.create_buklod_community_post_v3(
    'public',NULL,'reflection',
    'BUKLOD rollback-only Official Wall publishing regression',
    NULL,NULL,NULL,'{}'::uuid[],NULL,false
  ) INTO v_post;

  IF v_post IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.community_posts WHERE id=v_post AND user_id=v_official
  ) THEN
    RAISE EXCEPTION 'Official post creation did not commit within test transaction';
  END IF;

  SELECT count(*) INTO v_points_after
    FROM public.buklod_points_ledger WHERE user_id=v_official;
  SELECT count(*) INTO v_qmp_after
    FROM private.buklod_community_qmp_events WHERE user_id=v_official;

  IF v_points_after<>v_points_before OR v_qmp_after<>v_qmp_before
  THEN RAISE EXCEPTION 'Official publishing generated member rewards'; END IF;

  IF EXISTS(SELECT 1 FROM private.buklod_r36_bcu_ledger
    WHERE user_id=v_official AND source_id=v_post) THEN
    RAISE EXCEPTION 'Official publishing generated BCU';
  END IF;
END
$test$;
ROLLBACK;
