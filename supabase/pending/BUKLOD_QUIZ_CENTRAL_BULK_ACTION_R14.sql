-- R14 DEV candidate. Apply atomically only in QA until regression passes.
-- Existing v1/v2 signatures route through the same guarded implementation.
CREATE FUNCTION public.buklod_quiz_live_bulk_action_v3(
 p_session_id uuid,p_action text,p_student_user_ids uuid[] DEFAULT NULL,p_minutes integer DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
 actor uuid:=auth.uid();
 act text:=upper(btrim(coalesce(p_action,'')));
 s public.buklod_quiz_live_sessions%ROWTYPE;
 a public.buklod_quiz_attempts%ROWTYPE;
 m record;
 result jsonb;
 minutes integer;
 n integer:=0;
 original_score numeric;
 original_max numeric;
 new_id uuid;
BEGIN
 IF actor IS NULL OR public.buklod_quiz_is_examiner(actor) IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'Examiner access required' USING ERRCODE='42501';
 END IF;
 SELECT ls.* INTO s FROM public.buklod_quiz_live_sessions ls
 JOIN public.buklod_quiz_exams e ON e.id=ls.exam_id
 JOIN public.buklod_quiz_sections sec ON sec.id=ls.section_id AND sec.exam_id=e.id
 WHERE ls.id=p_session_id AND ls.faculty_user_id=actor AND e.owner_user_id=actor FOR UPDATE OF ls;
 IF NOT FOUND THEN RAISE EXCEPTION 'Live class not found or unauthorized' USING ERRCODE='42501'; END IF;
 IF act NOT IN ('ADMIT','ADMIT_ALL','REMOVE','REMOVE_SELECTED','FORCE_SUBMIT','FORCE_SUBMIT_ALL',
 'RELEASE_RESULTS','RELEASE_ALL','RESET_ATTEMPT','RESET_SELECTED','RESET_ALL','SET_TIME','ADD_TIME','RESET_TIMER')
 THEN RAISE EXCEPTION 'Unsupported bulk action'; END IF;
 IF act NOT IN ('RELEASE_RESULTS','RELEASE_ALL') AND s.status NOT IN ('LIVE','PAUSED') THEN
   RAISE EXCEPTION 'Bulk actions require an active room';
 END IF;
 IF p_student_user_ids IS NOT NULL AND cardinality(p_student_user_ids)=0 THEN RETURN 0; END IF;
 IF act IN ('SET_TIME','ADD_TIME','RESET_TIMER','RESET_ATTEMPT','RESET_SELECTED','RESET_ALL') THEN
   minutes:=coalesce(p_minutes,CASE WHEN act='ADD_TIME' THEN 5 ELSE s.duration_minutes END,30);
   IF minutes NOT BETWEEN 1 AND 1440 THEN RAISE EXCEPTION 'Minutes must be 1 to 1440'; END IF;
 END IF;
 IF act IN ('ADMIT','ADMIT_ALL','REMOVE','REMOVE_SELECTED') THEN
   FOR m IN SELECT lm.student_user_id,lm.status FROM public.buklod_quiz_live_members lm
   WHERE lm.session_id=s.id AND (p_student_user_ids IS NULL OR lm.student_user_id=ANY(p_student_user_ids))
   ORDER BY lm.student_user_id FOR UPDATE LOOP
     IF (act IN ('ADMIT','ADMIT_ALL') AND m.status IN ('WAITING','REMOVED','LEFT'))
        OR (act IN ('REMOVE','REMOVE_SELECTED') AND m.status<>'REMOVED') THEN
       PERFORM public.buklod_quiz_live_student_action_v2(s.id,m.student_user_id,
         CASE WHEN act IN ('ADMIT','ADMIT_ALL') THEN 'READMIT' ELSE 'REMOVE' END,NULL);
       n:=n+1;
     END IF;
   END LOOP;
   RETURN n;
 END IF;
 -- Only the latest non-VOID attempt for each member, in this exact exam/section/session.
 FOR m IN SELECT lm.student_user_id,lm.status FROM public.buklod_quiz_live_members lm
 WHERE lm.session_id=s.id AND (p_student_user_ids IS NULL OR lm.student_user_id=ANY(p_student_user_ids))
 ORDER BY lm.student_user_id FOR UPDATE LOOP
   SELECT t.* INTO a FROM public.buklod_quiz_attempts t
   WHERE t.live_session_id=s.id AND t.exam_id=s.exam_id AND t.section_id=s.section_id
     AND t.student_user_id=m.student_user_id AND t.status<>'VOID'
   ORDER BY t.attempt_no DESC,t.created_at DESC,t.id DESC LIMIT 1 FOR UPDATE;
   IF NOT FOUND THEN CONTINUE; END IF;
   IF act IN ('RELEASE_RESULTS','RELEASE_ALL') THEN
     IF a.status<>'GRADED' THEN CONTINUE; END IF;
     IF EXISTS(SELECT 1 FROM public.buklod_quiz_responses r WHERE r.attempt_id=a.id AND r.needs_review IS TRUE AND r.manual_score IS NULL) THEN CONTINUE; END IF;
     original_score:=a.total_score; original_max:=a.max_score;
     -- Never disclose answers automatically via legacy bulk release.
     IF public.buklod_quiz_release_attempt_v2(a.id,false,false,false) IS DISTINCT FROM true THEN
       RAISE EXCEPTION 'Release rejected';
     END IF;
     IF NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempts t WHERE t.id=a.id AND t.status='RELEASED'
       AND t.total_score IS NOT DISTINCT FROM original_score AND t.max_score IS NOT DISTINCT FROM original_max)
     THEN RAISE EXCEPTION 'Release would change a recorded score; manual review required'; END IF;
     n:=n+1;
   ELSIF act IN ('FORCE_SUBMIT','FORCE_SUBMIT_ALL') THEN
     IF m.status<>'ADMITTED' OR a.status<>'STARTED' THEN CONTINUE; END IF;
     -- The existing individual RPC filters inserted blanks to assigned questions.
     -- Its blank test does not exclude JSON null; enforce that here.
     IF NOT EXISTS(SELECT 1 FROM public.buklod_quiz_responses r
       JOIN public.buklod_quiz_questions q ON q.id=r.question_id AND q.exam_id=s.exam_id
       WHERE r.attempt_id=a.id AND q.is_active IS TRUE
         AND private.buklod_quiz_attempt_question_allowed_r1(a.id,q.id)
         AND r.answer IS NOT NULL AND r.answer NOT IN ('null'::jsonb,'[]'::jsonb,'{}'::jsonb)
         AND nullif(btrim(CASE WHEN jsonb_typeof(r.answer)='string' THEN r.answer#>>'{}' ELSE r.answer::text END),'') IS NOT NULL)
     THEN CONTINUE; END IF;
     result:=public.buklod_quiz_live_student_action_v2(s.id,a.student_user_id,'FORCE_SUBMIT',NULL);
     IF (result->>'attempt_id') IS DISTINCT FROM a.id::text
       OR NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempts t WHERE t.id=a.id AND t.status IN ('GRADED','NEEDS_REVIEW'))
       OR EXISTS(SELECT 1 FROM public.buklod_quiz_responses r WHERE r.attempt_id=a.id
          AND NOT private.buklod_quiz_attempt_question_allowed_r1(a.id,r.question_id))
     THEN RAISE EXCEPTION 'Force-submit postcondition failed'; END IF;
     n:=n+1;
   ELSIF act IN ('SET_TIME','ADD_TIME','RESET_TIMER') THEN
     IF m.status<>'ADMITTED' OR a.status<>'STARTED' THEN CONTINUE; END IF;
     UPDATE public.buklod_quiz_attempts t SET expires_at=
       CASE WHEN act='ADD_TIME' THEN greatest(t.expires_at,now()) ELSE now() END+make_interval(mins=>minutes),
       updated_at=now() WHERE t.id=a.id AND t.status='STARTED';
     IF FOUND THEN n:=n+1; END IF;
   ELSE
     -- Existing single-reset RPC can VOID multiple attempts and initializes max_score
     -- from the full bank. Restrict this compatibility path to unsnapshotted,
     -- full-bank rooms with exactly one non-VOID attempt and no released result.
     IF m.status<>'ADMITTED' OR a.status NOT IN ('STARTED','NEEDS_REVIEW','GRADED') THEN CONTINUE; END IF;
     IF coalesce(s.settings_snapshot->>'question_selection_mode','')<>'' 
       OR EXISTS(SELECT 1 FROM public.buklod_quiz_attempt_questions q WHERE q.attempt_id=a.id)
       OR (SELECT count(*) FROM public.buklod_quiz_attempts t WHERE t.exam_id=s.exam_id
           AND t.section_id=s.section_id AND t.student_user_id=a.student_user_id AND t.status<>'VOID')<>1
       OR s.question_count IS DISTINCT FROM (SELECT count(*)::integer FROM public.buklod_quiz_questions q
           WHERE q.exam_id=s.exam_id AND q.is_active IS TRUE)
       OR s.total_score_target IS DISTINCT FROM (SELECT e.total_points FROM public.buklod_quiz_exams e WHERE e.id=s.exam_id)
     THEN RAISE EXCEPTION 'Bulk reset requires assignment-aware reset or individual review'; END IF;
     result:=public.buklod_quiz_live_student_action_v2(s.id,a.student_user_id,'RESET_ATTEMPT',minutes);
     new_id:=nullif(result->>'attempt_id','')::uuid;
     IF new_id IS NULL OR new_id=a.id OR (result->>'voided_attempts')::integer IS DISTINCT FROM 1
       OR NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempts t WHERE t.id=a.id AND t.status='VOID')
       OR NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempts t WHERE t.id=new_id AND t.status='STARTED'
         AND t.live_session_id=s.id AND t.exam_id=s.exam_id AND t.section_id=s.section_id AND t.student_user_id=a.student_user_id
         AND t.max_score IS NOT DISTINCT FROM s.total_score_target)
     THEN RAISE EXCEPTION 'Reset postcondition failed'; END IF;
     n:=n+1;
   END IF;
 END LOOP;
 RETURN n;
END;
$fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_live_bulk_action_v3(uuid,text,uuid[],integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_live_bulk_action_v3(uuid,text,uuid[],integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.buklod_quiz_live_bulk_action_v1(
 p_session_id uuid,p_action text,p_student_user_ids uuid[] DEFAULT NULL)
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $fn$
 SELECT public.buklod_quiz_live_bulk_action_v3(p_session_id,p_action,p_student_user_ids,NULL);
$fn$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_live_bulk_action_v2(
 p_session_id uuid,p_action text,p_student_user_ids uuid[] DEFAULT NULL)
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $fn$
 SELECT public.buklod_quiz_live_bulk_action_v3(p_session_id,p_action,p_student_user_ids,NULL);
$fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_live_bulk_action_v1(uuid,text,uuid[]) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_live_bulk_action_v2(uuid,text,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_live_bulk_action_v1(uuid,text,uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_live_bulk_action_v2(uuid,text,uuid[]) TO authenticated;
