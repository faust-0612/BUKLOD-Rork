-- BUKLOD Quiz — restore five missing Dedicated exam-management RPCs.
-- RC CANDIDATE ONLY; NEVER AUTO-APPLY TO LIVE DEDICATED OR MAIN.
-- Target: isolated clone of Dedicated project cjtehbfspgimyhifnjon,
-- NOT Main yhanxndaqbmuzbdqlblu (Main already has these routines).
-- Requires faculty/students functional + Auth isolation regression tests
-- and rollback rehearsal. Existing exam/attempt/grade data unchanged until
-- an explicitly authenticated faculty user invokes an RPC.
-- No service/admin token is embedded here.
BEGIN;

DO $preflight$
DECLARE n text;
BEGIN
  IF to_regclass('public.buklod_quiz_exams') IS NULL
     OR to_regclass('public.buklod_quiz_attempts') IS NULL
     OR to_regclass('public.buklod_quiz_live_sessions') IS NULL
     OR to_regclass('public.buklod_quiz_audit_log') IS NULL
     OR to_regclass('public.buklod_quiz_questions') IS NULL
     OR to_regprocedure('public.buklod_quiz_is_examiner(uuid)') IS NULL
  THEN
     RAISE EXCEPTION 'Dedicated Quiz RPC compatibility: required schema absent';
  END IF;
  FOREACH n IN ARRAY ARRAY[
    'buklod_quiz_publish_exam_v1',
    'buklod_quiz_unpublish_exam_v1',
    'buklod_quiz_archive_exam_v1',
    'buklod_quiz_restore_exam_v1',
    'buklod_quiz_delete_exam_v1'
  ] LOOP
    IF to_regprocedure('public.'||n||'(uuid)') IS NOT NULL THEN
       RAISE EXCEPTION 'Already exists: %. Abort rather than replace existing function.',n;
    END IF;
  END LOOP;
END $preflight$;

CREATE FUNCTION public.buklod_quiz_publish_exam_v1(p_exam_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $body$
DECLARE
  v_user uuid := (SELECT auth.uid());
  e public.buklod_quiz_exams%ROWTYPE;
  v_points numeric;
BEGIN
  IF v_user IS NULL OR NOT public.buklod_quiz_is_examiner(v_user) THEN
    RAISE EXCEPTION 'Authorized examiner session required';
  END IF;
  SELECT * INTO e FROM public.buklod_quiz_exams
  WHERE id=p_exam_id AND owner_user_id=v_user FOR UPDATE;
  IF e.id IS NULL THEN RAISE EXCEPTION 'Exam not found or unauthorized'; END IF;
  IF e.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Restore the exam before publishing'; END IF;
  IF e.status='PUBLISHED' THEN RETURN true; END IF;
  SELECT coalesce(sum(points),0) INTO v_points
  FROM public.buklod_quiz_questions WHERE exam_id=p_exam_id AND is_active=true;
  IF v_points<=0 THEN RAISE EXCEPTION 'Add active questions before publishing'; END IF;
  UPDATE public.buklod_quiz_exams SET
    status='PUBLISHED',total_points=v_points,published_at=now(),updated_at=now()
  WHERE id=p_exam_id;
  INSERT INTO public.buklod_quiz_audit_log(exam_id,actor_user_id,action,details)
  VALUES(p_exam_id,v_user,'EXAM_PUBLISHED',jsonb_build_object('points',v_points,'source','DEDICATED_RPC_PARITY_RC1'));
  RETURN true;
END $body$;

CREATE FUNCTION public.buklod_quiz_unpublish_exam_v1(p_exam_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $body$
DECLARE v_user uuid := (SELECT auth.uid()); e public.buklod_quiz_exams%ROWTYPE;
BEGIN
  IF v_user IS NULL OR NOT public.buklod_quiz_is_examiner(v_user) THEN
    RAISE EXCEPTION 'Authorized examiner session required';
  END IF;
  SELECT * INTO e FROM public.buklod_quiz_exams
  WHERE id=p_exam_id AND owner_user_id=v_user FOR UPDATE;
  IF e.id IS NULL THEN RAISE EXCEPTION 'Exam not found or unauthorized'; END IF;
  IF EXISTS(SELECT 1 FROM public.buklod_quiz_live_sessions
            WHERE exam_id=p_exam_id AND status IN ('LIVE','PAUSED')) THEN
    RAISE EXCEPTION 'End active live rooms before unpublishing';
  END IF;
  IF e.status='DRAFT' THEN RETURN true; END IF;
  UPDATE public.buklod_quiz_exams SET status='DRAFT',updated_at=now()
  WHERE id=p_exam_id;
  INSERT INTO public.buklod_quiz_audit_log(exam_id,actor_user_id,action,details)
  VALUES(p_exam_id,v_user,'EXAM_UNPUBLISHED','{}'::jsonb);
  RETURN true;
END $body$;

CREATE FUNCTION public.buklod_quiz_archive_exam_v1(p_exam_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $body$
DECLARE v_user uuid := (SELECT auth.uid()); e public.buklod_quiz_exams%ROWTYPE;
BEGIN
  IF v_user IS NULL OR NOT public.buklod_quiz_is_examiner(v_user) THEN
    RAISE EXCEPTION 'Authorized examiner session required';
  END IF;
  SELECT * INTO e FROM public.buklod_quiz_exams
  WHERE id=p_exam_id AND owner_user_id=v_user FOR UPDATE;
  IF e.id IS NULL THEN RAISE EXCEPTION 'Exam not found or unauthorized'; END IF;
  IF e.archived_at IS NOT NULL THEN RETURN true; END IF;
  IF EXISTS(SELECT 1 FROM public.buklod_quiz_live_sessions
            WHERE exam_id=p_exam_id AND status IN ('LIVE','PAUSED')) THEN
    RAISE EXCEPTION 'End active live rooms before archiving';
  END IF;
  UPDATE public.buklod_quiz_exams SET
    archived_at=now(),archived_by=v_user,status='DRAFT',updated_at=now()
  WHERE id=p_exam_id;
  UPDATE public.buklod_quiz_live_sessions
  SET status='ENDED',ended_at=coalesce(ended_at,now()),updated_at=now()
  WHERE exam_id=p_exam_id AND status='WAITING';
  INSERT INTO public.buklod_quiz_audit_log(exam_id,actor_user_id,action,details)
  VALUES(p_exam_id,v_user,'EXAM_ARCHIVED','{}'::jsonb);
  RETURN true;
END $body$;

CREATE FUNCTION public.buklod_quiz_restore_exam_v1(p_exam_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $body$
DECLARE v_user uuid := (SELECT auth.uid()); e public.buklod_quiz_exams%ROWTYPE;
BEGIN
  IF v_user IS NULL OR NOT public.buklod_quiz_is_examiner(v_user) THEN
    RAISE EXCEPTION 'Authorized examiner session required';
  END IF;
  SELECT * INTO e FROM public.buklod_quiz_exams
  WHERE id=p_exam_id AND owner_user_id=v_user FOR UPDATE;
  IF e.id IS NULL THEN RAISE EXCEPTION 'Exam not found or unauthorized'; END IF;
  IF e.archived_at IS NULL THEN RETURN true; END IF;
  UPDATE public.buklod_quiz_exams SET archived_at=NULL,archived_by=NULL,updated_at=now()
  WHERE id=p_exam_id;
  INSERT INTO public.buklod_quiz_audit_log(exam_id,actor_user_id,action,details)
  VALUES(p_exam_id,v_user,'EXAM_RESTORED','{}'::jsonb);
  RETURN true;
END $body$;

CREATE FUNCTION public.buklod_quiz_delete_exam_v1(p_exam_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $body$
DECLARE v_user uuid := (SELECT auth.uid()); e public.buklod_quiz_exams%ROWTYPE;
BEGIN
  IF v_user IS NULL OR NOT public.buklod_quiz_is_examiner(v_user) THEN
    RAISE EXCEPTION 'Authorized examiner session required';
  END IF;
  SELECT * INTO e FROM public.buklod_quiz_exams
  WHERE id=p_exam_id AND owner_user_id=v_user FOR UPDATE;
  IF e.id IS NULL THEN RAISE EXCEPTION 'Exam not found or unauthorized'; END IF;
  -- The Dedicated FK graph also cascades questions, sections and review jobs.
  -- Permanent delete is permitted ONLY for an entirely empty, never-used exam.
  -- Keep audit history intact; archive is the only safe action otherwise.
  IF EXISTS(SELECT 1 FROM public.buklod_quiz_attempts WHERE exam_id=p_exam_id)
     OR EXISTS(SELECT 1 FROM public.buklod_quiz_live_sessions WHERE exam_id=p_exam_id)
     OR EXISTS(SELECT 1 FROM public.buklod_quiz_roster WHERE exam_id=p_exam_id)
     OR EXISTS(SELECT 1 FROM public.buklod_quiz_documents WHERE exam_id=p_exam_id)
     OR EXISTS(SELECT 1 FROM public.buklod_quiz_questions WHERE exam_id=p_exam_id)
     OR EXISTS(SELECT 1 FROM public.buklod_quiz_sections WHERE exam_id=p_exam_id)
     OR EXISTS(SELECT 1 FROM public.buklod_quiz_review_jobs WHERE exam_id=p_exam_id)
     OR EXISTS(SELECT 1 FROM public.buklod_quiz_audit_log WHERE exam_id=p_exam_id)
  THEN
    RAISE EXCEPTION 'Exam has dependent content or historical records. Archive it; permanent delete is protected.';
  END IF;
  DELETE FROM public.buklod_quiz_exams WHERE id=p_exam_id;
  INSERT INTO public.buklod_quiz_audit_log(exam_id,actor_user_id,action,details)
  VALUES(p_exam_id,v_user,'EXAM_DELETED_NO_HISTORY',
         jsonb_build_object('title',e.title,'source','DEDICATED_RPC_PARITY_RC1'));
  RETURN true;
END $body$;

-- PostgreSQL implicitly grants PUBLIC EXECUTE on created functions.
-- These SECURITY DEFINER endpoints must be inaccessible to anonymous role.
REVOKE ALL ON FUNCTION public.buklod_quiz_publish_exam_v1(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.buklod_quiz_unpublish_exam_v1(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.buklod_quiz_archive_exam_v1(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.buklod_quiz_restore_exam_v1(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.buklod_quiz_delete_exam_v1(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_publish_exam_v1(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_unpublish_exam_v1(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_archive_exam_v1(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_restore_exam_v1(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_delete_exam_v1(uuid) TO authenticated,service_role;

DO $verify$
DECLARE n text; fn regprocedure;
BEGIN
  FOREACH n IN ARRAY ARRAY[
    'buklod_quiz_publish_exam_v1','buklod_quiz_unpublish_exam_v1',
    'buklod_quiz_archive_exam_v1','buklod_quiz_restore_exam_v1',
    'buklod_quiz_delete_exam_v1'
  ] LOOP
    fn:=to_regprocedure('public.'||n||'(uuid)');
    IF fn IS NULL OR has_function_privilege('anon',fn,'execute')
       OR NOT has_function_privilege('authenticated',fn,'execute')
       OR NOT has_function_privilege('service_role',fn,'execute') THEN
      RAISE EXCEPTION 'Exam management privilege-parity failed: %',n;
    END IF;
  END LOOP;
END $verify$;
COMMIT;
