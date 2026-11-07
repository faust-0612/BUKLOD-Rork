-- BUKLOD Quiz R10 Dedicated management restoration.
-- RC CANDIDATE ONLY. DO NOT apply on production Dedicated until isolated RC,
-- role/permission, question/exam and data-regression tests have passed.
-- No historical data is modified by merely storing this SQL in GitHub.
-- Five RPC names referenced by the R10 Quiz Web UI were absent in Dedicated.
-- Main has similarly named RPCs, but Main's other tables/data are NOT cut over.
BEGIN;

DO $preflight$
BEGIN
 IF to_regclass('public.buklod_quiz_exams') IS NULL
    OR to_regclass('public.buklod_quiz_questions') IS NULL
    OR to_regclass('public.buklod_quiz_attempts') IS NULL
    OR to_regclass('public.buklod_quiz_live_sessions') IS NULL
    OR to_regclass('public.buklod_quiz_sections') IS NULL
    OR to_regclass('public.buklod_quiz_roster') IS NULL
    OR to_regclass('public.buklod_quiz_documents') IS NULL
    OR to_regclass('public.buklod_quiz_review_jobs') IS NULL
    OR to_regprocedure('public.buklod_quiz_is_examiner(uuid)') IS NULL
    OR to_regprocedure('public.buklod_quiz_audit_write_v1(uuid,uuid,uuid,uuid,text,jsonb,uuid)') IS NULL
 THEN RAISE EXCEPTION 'Dedicated Quiz exam-management preflight mismatch'; END IF;
END
$preflight$;

-- Security is enforced in the RPC, never merely by hiding the UI.
-- Always lock one owned exam before modifying its state.
CREATE OR REPLACE FUNCTION public.buklod_quiz_publish_exam_v1(p_exam_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_actor uuid := (SELECT auth.uid()); v_total numeric;
BEGIN
 IF v_actor IS NULL OR NOT public.buklod_quiz_is_examiner(v_actor) THEN
   RAISE EXCEPTION 'Examiner access required.';
 END IF;
 PERFORM 1 FROM public.buklod_quiz_exams e
 WHERE e.id=p_exam_id AND e.owner_user_id=v_actor AND e.archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Exam unavailable or unauthorized.'; END IF;
 SELECT coalesce(sum(q.points),0) INTO v_total FROM public.buklod_quiz_questions q
 WHERE q.exam_id=p_exam_id AND q.is_active=true;
 IF v_total<=0 THEN RAISE EXCEPTION 'Add at least one active scored question before publishing.'; END IF;
 UPDATE public.buklod_quiz_exams SET
   total_points=v_total,status='PUBLISHED',published_at=coalesce(published_at,now()),updated_at=now()
 WHERE id=p_exam_id;
 PERFORM public.buklod_quiz_audit_write_v1(p_exam_id,NULL,NULL,NULL,
   'EXAM_PUBLISHED',jsonb_build_object('total_points',v_total),v_actor);
 RETURN true;
END
$fn$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_unpublish_exam_v1(p_exam_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_actor uuid := (SELECT auth.uid());
BEGIN
 IF v_actor IS NULL OR NOT public.buklod_quiz_is_examiner(v_actor) THEN
   RAISE EXCEPTION 'Examiner access required.';
 END IF;
 PERFORM 1 FROM public.buklod_quiz_exams e
 WHERE e.id=p_exam_id AND e.owner_user_id=v_actor AND e.archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Exam unavailable or unauthorized.'; END IF;
 IF EXISTS(SELECT 1 FROM public.buklod_quiz_live_sessions s
    WHERE s.exam_id=p_exam_id AND s.status IN ('LIVE','PAUSED')) THEN
   RAISE EXCEPTION 'End the active live class before unpublishing.';
 END IF;
 UPDATE public.buklod_quiz_exams SET status='DRAFT',updated_at=now() WHERE id=p_exam_id;
 PERFORM public.buklod_quiz_audit_write_v1(p_exam_id,NULL,NULL,NULL,'EXAM_UNPUBLISHED','{}'::jsonb,v_actor);
 RETURN true;
END
$fn$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_archive_exam_v1(p_exam_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_actor uuid := (SELECT auth.uid());
BEGIN
 IF v_actor IS NULL OR NOT public.buklod_quiz_is_examiner(v_actor) THEN
   RAISE EXCEPTION 'Examiner access required.';
 END IF;
 PERFORM 1 FROM public.buklod_quiz_exams e
 WHERE e.id=p_exam_id AND e.owner_user_id=v_actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Exam unavailable or unauthorized.'; END IF;
 IF EXISTS(SELECT 1 FROM public.buklod_quiz_live_sessions s
   WHERE s.exam_id=p_exam_id AND s.status IN ('LIVE','PAUSED')) THEN
   RAISE EXCEPTION 'End the active live class before archiving.';
 END IF;
 UPDATE public.buklod_quiz_exams SET archived_at=coalesce(archived_at,now()),
   archived_by=coalesce(archived_by,v_actor),status='DRAFT',updated_at=now()
 WHERE id=p_exam_id;
 UPDATE public.buklod_quiz_live_sessions
 SET status='ENDED',ended_at=coalesce(ended_at,now()),updated_at=now()
 WHERE exam_id=p_exam_id AND status='WAITING';
 PERFORM public.buklod_quiz_audit_write_v1(p_exam_id,NULL,NULL,NULL,'EXAM_ARCHIVED','{}'::jsonb,v_actor);
 RETURN true;
END
$fn$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_restore_exam_v1(p_exam_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_actor uuid := (SELECT auth.uid());
BEGIN
 IF v_actor IS NULL OR NOT public.buklod_quiz_is_examiner(v_actor) THEN
   RAISE EXCEPTION 'Examiner access required.';
 END IF;
 UPDATE public.buklod_quiz_exams SET archived_at=NULL,archived_by=NULL,
   status='DRAFT',updated_at=now()
 WHERE id=p_exam_id AND owner_user_id=v_actor AND archived_at IS NOT NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Archived exam unavailable or unauthorized.'; END IF;
 PERFORM public.buklod_quiz_audit_write_v1(p_exam_id,NULL,NULL,NULL,'EXAM_RESTORED','{}'::jsonb,v_actor);
 RETURN true;
END
$fn$;

-- Delete is intentionally MORE conservative than the older Main RPC.
-- The Dedicated schema has ON DELETE CASCADE FKs. Do not erase any dependent
-- student, class, question, document, review or historical records.
-- For a populated exam, the supported safe action is ARCHIVE.
CREATE OR REPLACE FUNCTION public.buklod_quiz_delete_exam_v1(p_exam_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_actor uuid := (SELECT auth.uid());
BEGIN
 IF v_actor IS NULL OR NOT public.buklod_quiz_is_examiner(v_actor) THEN
   RAISE EXCEPTION 'Examiner access required.';
 END IF;
 PERFORM 1 FROM public.buklod_quiz_exams e
 WHERE e.id=p_exam_id AND e.owner_user_id=v_actor AND e.status='DRAFT' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Only an owned unused DRAFT exam may be deleted.'; END IF;
 IF EXISTS(SELECT 1 FROM public.buklod_quiz_attempts WHERE exam_id=p_exam_id)
    OR EXISTS(SELECT 1 FROM public.buklod_quiz_sections WHERE exam_id=p_exam_id)
    OR EXISTS(SELECT 1 FROM public.buklod_quiz_roster WHERE exam_id=p_exam_id)
    OR EXISTS(SELECT 1 FROM public.buklod_quiz_questions WHERE exam_id=p_exam_id)
    OR EXISTS(SELECT 1 FROM public.buklod_quiz_documents WHERE exam_id=p_exam_id)
    OR EXISTS(SELECT 1 FROM public.buklod_quiz_review_jobs WHERE exam_id=p_exam_id)
    OR EXISTS(SELECT 1 FROM public.buklod_quiz_live_sessions WHERE exam_id=p_exam_id)
 THEN
   RAISE EXCEPTION 'Exam contains related records. Archive it to preserve all questions, classes and results.';
 END IF;
 PERFORM public.buklod_quiz_audit_write_v1(p_exam_id,NULL,NULL,NULL,'EMPTY_DRAFT_EXAM_DELETED','{}'::jsonb,v_actor);
 DELETE FROM public.buklod_quiz_exams e WHERE e.id=p_exam_id AND e.owner_user_id=v_actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'Exam unavailable or unauthorized.'; END IF;
 RETURN true;
END
$fn$;

-- PostgreSQL gives PUBLIC function EXECUTE by default; explicitly revoke
-- both PUBLIC-inherited and anon rights for five SECURITY DEFINER functions.
REVOKE ALL ON FUNCTION public.buklod_quiz_publish_exam_v1(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.buklod_quiz_unpublish_exam_v1(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.buklod_quiz_archive_exam_v1(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.buklod_quiz_restore_exam_v1(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.buklod_quiz_delete_exam_v1(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_publish_exam_v1(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_unpublish_exam_v1(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_archive_exam_v1(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_restore_exam_v1(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_delete_exam_v1(uuid) TO authenticated,service_role;

DO $verify$
DECLARE v_name text; v_fn regprocedure;
BEGIN
 FOREACH v_name IN ARRAY ARRAY[
  'public.buklod_quiz_publish_exam_v1(uuid)',
  'public.buklod_quiz_unpublish_exam_v1(uuid)',
  'public.buklod_quiz_archive_exam_v1(uuid)',
  'public.buklod_quiz_restore_exam_v1(uuid)',
  'public.buklod_quiz_delete_exam_v1(uuid)'
 ] LOOP
  v_fn := to_regprocedure(v_name);
  IF v_fn IS NULL
    OR has_function_privilege('anon',v_fn,'EXECUTE')
    OR NOT has_function_privilege('authenticated',v_fn,'EXECUTE')
  THEN RAISE EXCEPTION 'Exam management RPC permission postcondition failed: %',v_name; END IF;
 END LOOP;
END
$verify$;
COMMIT;
