-- Safe read-only runtime regression for migrated BUKLOD Faith access.
-- Run against the BUKLOD project with permission to inspect RPC definitions.
-- No user records, submissions, rewards or entitlements are modified.

BEGIN TRANSACTION READ ONLY;

DO $test$
DECLARE
  v_scope uuid;
  v_member uuid;
  v_access jsonb;
  v_reading text;
BEGIN
  SELECT s.id, m.user_id INTO v_scope, v_member
  FROM public.buklod_scopes s
  JOIN public.buklod_scope_memberships m ON m.scope_id = s.id
  WHERE s.scope_type='CLUSTER'
    AND s.status='ACTIVE'
    AND s.name='MZB NAYON'
    AND m.membership_status='ACTIVE'
  ORDER BY m.joined_at DESC NULLS LAST
  LIMIT 1;

  IF v_scope IS NULL OR v_member IS NULL THEN
    RAISE EXCEPTION 'Test fixture: MZB NAYON active Cluster member not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.buklod_scope_product_entitlements e
    WHERE e.scope_id=v_scope AND e.product_code='cluster_premium'
      AND e.status='ACTIVE'
      AND (e.expires_at IS NULL OR e.expires_at >= now())
  ) THEN
    RAISE EXCEPTION 'Test fixture is no longer premium-free';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_member::text, true);
  v_access := public.buklod_scope_faith_access_status_v1(v_scope);
  IF NOT coalesce((v_access->>'has_active_cluster')::boolean,false)
    OR NOT coalesce((v_access->'daily_reading'->>'unlocked')::boolean,false)
    OR NOT coalesce((v_access->'devotion_word'->>'unlocked')::boolean,false)
    OR NOT coalesce((v_access->'lesson_stages'->0->>'scope_unlocked')::boolean,false)
    OR NOT coalesce((v_access->'lesson_stages'->6->>'scope_unlocked')::boolean,false)
  THEN
    RAISE EXCEPTION 'Active member without Premium cannot access faith feature';
  END IF;

  SELECT t.bible_reference INTO v_reading FROM public.get_automatic_bible_today() t LIMIT 1;
  IF v_reading IS NULL OR length(btrim(v_reading))=0 THEN
    RAISE EXCEPTION 'Active member cannot load assigned reading';
  END IF;

  IF NOT public.buklod_scope_lesson_stage_unlocked_v1(v_scope,101)
     OR NOT public.buklod_scope_lesson_stage_unlocked_v1(v_scope,107)
     OR public.buklod_scope_lesson_stage_unlocked_v1(v_scope,108) THEN
    RAISE EXCEPTION 'Lesson stage availability is not bounded to 101-107';
  END IF;

  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000000',true);
  v_access := public.buklod_scope_faith_access_status_v1(v_scope);
  IF coalesce((v_access->>'has_active_cluster')::boolean,false)
    OR coalesce((v_access->'daily_reading'->>'unlocked')::boolean,false)
    OR coalesce((v_access->'devotion_word'->>'unlocked')::boolean,false)
    OR coalesce((v_access->'lesson_stages'->0->>'scope_unlocked')::boolean,false)
  THEN
    RAISE EXCEPTION 'Nonmember gained unauthorized faith access';
  END IF;

  IF position('buklod_has_active_cluster_membership_v1'
     IN pg_get_functiondef('public.buklod_daily_bible_submission_requires_cluster_premium_v1()'::regprocedure))=0 THEN
    RAISE EXCEPTION 'Daily Reading submission lost active Cluster enforcement';
  END IF;
END;
$test$;

ROLLBACK;
