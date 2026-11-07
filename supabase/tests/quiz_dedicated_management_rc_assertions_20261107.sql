-- Synthetic-only PostgreSQL 16 verification of the five pending Quiz RPCs.
-- Run after fixture and the pending Dedicated migration in isolated CI.
\set ON_ERROR_STOP on
DO $check$
DECLARE n text; p regprocedure;
BEGIN
 FOREACH n IN ARRAY ARRAY[
  'public.buklod_quiz_publish_exam_v1(uuid)',
  'public.buklod_quiz_unpublish_exam_v1(uuid)',
  'public.buklod_quiz_archive_exam_v1(uuid)',
  'public.buklod_quiz_restore_exam_v1(uuid)',
  'public.buklod_quiz_delete_exam_v1(uuid)'
 ] LOOP
  p := to_regprocedure(n);
  IF p IS NULL OR has_function_privilege('anon',p,'EXECUTE')
      OR NOT has_function_privilege('authenticated',p,'EXECUTE')
      OR NOT has_function_privilege('service_role',p,'EXECUTE')
  THEN RAISE EXCEPTION 'FAIL role grants on %',n; END IF;
 END LOOP;
END $check$;

SET ROLE authenticated;
SET request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
DO $denied$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN
   PERFORM public.buklod_quiz_publish_exam_v1('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 EXCEPTION WHEN OTHERS THEN
   blocked := position('Examiner access required' in SQLERRM)>0;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'FAIL non-faculty successfully published'; END IF;
END $denied$;
SET request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
DO $empty$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN
   PERFORM public.buklod_quiz_publish_exam_v1('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 EXCEPTION WHEN OTHERS THEN
   blocked := position('active scored question' in SQLERRM)>0;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'FAIL empty exam was published'; END IF;
END $empty$;
RESET ROLE;

INSERT INTO public.buklod_quiz_questions(id,exam_id,points,is_active)
 VALUES('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',5,true);
SET ROLE authenticated;
SELECT public.buklod_quiz_publish_exam_v1('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
RESET ROLE;
DO $published$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM public.buklod_quiz_exams
  WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    AND status='PUBLISHED' AND total_points=5 AND published_at IS NOT NULL
 ) THEN RAISE EXCEPTION 'FAIL publish state'; END IF;
END $published$;

INSERT INTO public.buklod_quiz_live_sessions(id,exam_id,status)
 VALUES('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','LIVE');
SET ROLE authenticated;
DO $live$
DECLARE blocked_unpublish boolean:=false; blocked_archive boolean:=false;
BEGIN
 BEGIN
  PERFORM public.buklod_quiz_unpublish_exam_v1('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 EXCEPTION WHEN OTHERS THEN
  blocked_unpublish := position('active live class' in SQLERRM)>0;
 END;
 BEGIN
  PERFORM public.buklod_quiz_archive_exam_v1('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 EXCEPTION WHEN OTHERS THEN
  blocked_archive := position('active live class' in SQLERRM)>0;
 END;
 IF NOT blocked_unpublish OR NOT blocked_archive
 THEN RAISE EXCEPTION 'FAIL active live class protection'; END IF;
END $live$;
RESET ROLE;

UPDATE public.buklod_quiz_live_sessions SET status='WAITING'
 WHERE id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
SET ROLE authenticated;
SELECT public.buklod_quiz_archive_exam_v1('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
RESET ROLE;
DO $archived$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM public.buklod_quiz_exams
   WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
   AND archived_at IS NOT NULL AND status='DRAFT'
 ) OR NOT EXISTS(
  SELECT 1 FROM public.buklod_quiz_live_sessions
  WHERE id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
   AND status='ENDED' AND ended_at IS NOT NULL
 ) THEN RAISE EXCEPTION 'FAIL archive and waiting-room close'; END IF;
END $archived$;

SET ROLE authenticated;
SELECT public.buklod_quiz_restore_exam_v1('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
SELECT public.buklod_quiz_publish_exam_v1('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
SELECT public.buklod_quiz_unpublish_exam_v1('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
RESET ROLE;
DO $restored$
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM public.buklod_quiz_exams
   WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
   AND archived_at IS NULL AND archived_by IS NULL AND status='DRAFT'
 ) THEN RAISE EXCEPTION 'FAIL restore/unpublish state'; END IF;
END $restored$;

SET ROLE authenticated;
DO $no_cascade$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN
  PERFORM public.buklod_quiz_delete_exam_v1('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 EXCEPTION WHEN OTHERS THEN
  blocked := position('related records' in SQLERRM)>0;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'FAIL populated exam deleted'; END IF;
END $no_cascade$;
SELECT public.buklod_quiz_delete_exam_v1('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
RESET ROLE;
DO $final$
BEGIN
 IF (SELECT count(*) FROM public.buklod_quiz_exams)<>1
   OR (SELECT count(*) FROM public.buklod_quiz_questions)<>1
   OR (SELECT count(*) FROM public.buklod_quiz_live_sessions)<>1
   OR EXISTS(SELECT 1 FROM public.buklod_quiz_exams WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
   OR (SELECT count(*) FROM public.buklod_quiz_audit_log WHERE action='EMPTY_DRAFT_EXAM_DELETED')<>1
   OR (SELECT count(*) FROM public.buklod_quiz_audit_log WHERE action='EXAM_ARCHIVED')<>1
 THEN RAISE EXCEPTION 'FAIL final data integrity / audit'; END IF;
END $final$;
SELECT 'PASS isolated five-RPC management contract: permissions, empty publish, active-class guards, archive, restore, unpublish, delete no-cascade and immutable audit' AS result;
