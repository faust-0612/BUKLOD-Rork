-- Regression checks for the protected editorial save/publish path.
-- Run against a database with an approved, released KL chapter and its ready quiz.
-- All data mutations are contained in a rolled-back subtransaction.
DO $test$
DECLARE e public.kl_episodes%rowtype; a uuid; old_bank text; old_progress bigint; old_attempts bigint; old_points bigint; v jsonb; rev uuid; test_text text; test_pass boolean:=false;
BEGIN
  SELECT * INTO e FROM public.kl_episodes WHERE season_number=1 AND episode_number=1 AND status='approved' AND release_at<=now();
  IF e.id IS NULL THEN RAISE EXCEPTION 'No protected baseline'; END IF;
  SELECT p.id INTO a FROM public.profiles p JOIN auth.users u ON u.id=p.id WHERE p.role::text='system_admin' AND p.is_active=true LIMIT 1;
  IF a IS NULL THEN RAISE EXCEPTION 'No authorized test actor'; END IF;
  SELECT manuscript_hash INTO old_bank FROM public.kl_quiz_sets WHERE episode_id=e.id AND status='ready';
  IF old_bank IS DISTINCT FROM md5(e.manuscript) THEN RAISE EXCEPTION 'Unexpected quiz baseline'; END IF;
  IF EXISTS(SELECT 1 FROM private.kl_editorial_revisions_v1 WHERE episode_id=e.id AND state IN ('draft','published'))
     THEN RAISE EXCEPTION 'Choose a clean test fixture; do not run over real editorial versions'; END IF;
  SELECT count(*) INTO old_progress FROM public.kl_reading_sessions WHERE episode_id=e.id;
  SELECT count(*) INTO old_attempts FROM public.kl_quiz_attempts WHERE episode_id=e.id;
  SELECT count(*) INTO old_points FROM public.buklod_points_ledger WHERE source_id=e.id;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
    PERFORM set_config('request.jwt.claims','{}',true);
    BEGIN
      PERFORM public.kl_admin_save_content_v1(e.id,e.title,e.manuscript||E'\n\nUnauthorized test');
      RAISE EXCEPTION 'UNAUTHORIZED_SAVE_ALLOWED';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM<>'Admin only' THEN RAISE; END IF;
    END;
    BEGIN
      PERFORM public.kl_admin_publish_editorial_revision_v1(e.id,gen_random_uuid());
      RAISE EXCEPTION 'UNAUTHORIZED_PUBLISH_ALLOWED';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    PERFORM set_config('request.jwt.claim.sub',a::text,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
    test_text:=e.manuscript||E'\n\nEditorial regression fixture.';
    v:=public.kl_admin_save_content_v1(e.id,e.title,test_text);
    IF v->>'editorial_revision'<>'true' OR v->>'published_unchanged'<>'true' THEN RAISE EXCEPTION 'Save did not stage'; END IF;
    rev:=(v->>'revision_id')::uuid;
    v:=public.kl_admin_save_content_v1(e.id,e.title,test_text);
    IF v->>'changed'<>'false' OR (v->>'revision_id')::uuid<>rev THEN RAISE EXCEPTION 'Duplicate save'; END IF;
    IF (public.kl_admin_preview_v1(e.id)->>'manuscript') IS DISTINCT FROM test_text THEN RAISE EXCEPTION 'Private draft readback failed'; END IF;
    IF (public.kl_read_episode_v1(e.id)->'content'->0->>'text') IS DISTINCT FROM e.manuscript THEN RAISE EXCEPTION 'Unapproved draft leaked'; END IF;
    BEGIN
      PERFORM public.kl_admin_publish_editorial_revision_v1(e.id,rev);
      RAISE EXCEPTION 'UNPREPARED_PUBLISH_ALLOWED';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM<>'Save and prepare this exact editorial revision first' THEN RAISE; END IF;
    END;
    PERFORM public.kl_admin_prepare_preview_v1(e.id);
    v:=public.kl_admin_publish_editorial_revision_v1(e.id,rev);
    IF v->>'published'<>'true' THEN RAISE EXCEPTION 'Compatible publish failed: %',v; END IF;
    IF (public.kl_read_episode_v1(e.id)->'content'->0->>'text') IS DISTINCT FROM test_text THEN RAISE EXCEPTION 'Published revision missing'; END IF;
    v:=public.kl_admin_save_content_v1(e.id,e.title,repeat('Editorial fixture without evidence. ',20));
    rev:=(v->>'revision_id')::uuid;
    PERFORM public.kl_admin_prepare_preview_v1(e.id);
    v:=public.kl_admin_publish_editorial_revision_v1(e.id,rev);
    IF v->>'reason'<>'compatibility_review_required' OR v->>'draft_retained'<>'true' THEN RAISE EXCEPTION 'Incompatible publish not blocked: %',v; END IF;
    IF (public.kl_read_episode_v1(e.id)->'content'->0->>'text') IS DISTINCT FROM test_text THEN RAISE EXCEPTION 'Last publication was replaced'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.kl_episodes x WHERE x.id=e.id AND x.manuscript=e.manuscript AND x.release_at=e.release_at AND x.status='approved')
      OR NOT EXISTS(SELECT 1 FROM public.kl_quiz_sets WHERE episode_id=e.id AND manuscript_hash=old_bank AND status='ready')
      OR old_attempts<>(SELECT count(*) FROM public.kl_quiz_attempts WHERE episode_id=e.id)
      OR old_points<>(SELECT count(*) FROM public.buklod_points_ledger WHERE source_id=e.id)
      THEN RAISE EXCEPTION 'Protected data changed'; END IF;
    RAISE EXCEPTION 'KL_EDITORIAL_TEST_ROLLBACK_OK' USING ERRCODE='P0999';
  EXCEPTION WHEN SQLSTATE 'P0999' THEN
    IF SQLERRM<>'KL_EDITORIAL_TEST_ROLLBACK_OK' THEN RAISE; END IF;
    test_pass:=true;
  END;
  IF NOT test_pass OR old_progress<>(SELECT count(*) FROM public.kl_reading_sessions WHERE episode_id=e.id)
     OR EXISTS(SELECT 1 FROM private.kl_editorial_revisions_v1 WHERE episode_id=e.id AND state IN ('draft','published'))
     THEN RAISE EXCEPTION 'Rollback verification failed'; END IF;
END $test$;
SELECT 'passed: editorial permissions, private save, preview, compatible publication, conflict guard, preserved assessment and rewards, rollback' AS result;
