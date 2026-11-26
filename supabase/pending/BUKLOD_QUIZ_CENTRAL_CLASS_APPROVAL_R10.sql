-- DEV candidate; requires R7 and R8, trusted suggestion provenance and client integration.
CREATE OR REPLACE FUNCTION public.buklod_quiz_approve_section_suggestions_v1(p_exam_id uuid,p_section_id uuid,p_job_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE actor uuid:=auth.uid(); a record; reviews jsonb; pending integer; eligible integer; approved integer:=0; skipped integer:=0; failed integer:=0;
BEGIN
 IF actor IS NULL OR NOT public.buklod_quiz_is_examiner(actor) THEN RAISE EXCEPTION 'Examiner access required.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.buklod_quiz_exams e JOIN public.buklod_quiz_sections s ON s.exam_id=e.id WHERE e.id=p_exam_id AND s.id=p_section_id AND e.owner_user_id=actor) THEN RAISE EXCEPTION 'Exam owner access required.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.buklod_quiz_review_jobs j WHERE j.id=p_job_id AND j.exam_id=p_exam_id AND j.section_id=p_section_id AND j.created_by=actor AND j.status='COMPLETED') THEN RAISE EXCEPTION 'Completed review job required.'; END IF;
 FOR a IN SELECT t.id FROM public.buklod_quiz_attempts t JOIN public.buklod_quiz_review_jobs j ON j.id=p_job_id AND t.id=ANY(j.attempt_ids) WHERE t.exam_id=p_exam_id AND t.section_id=p_section_id AND t.status='NEEDS_REVIEW' ORDER BY t.id LIMIT 50 LOOP
  BEGIN
   PERFORM 1 FROM public.buklod_quiz_attempts t WHERE t.id=a.id AND t.status='NEEDS_REVIEW' FOR UPDATE;
   IF NOT FOUND THEN skipped:=skipped+1; CONTINUE; END IF;
   SELECT count(*)::integer,count(*) FILTER(WHERE s.response_id IS NOT NULL AND s.suggested_score IS NOT NULL AND s.suggested_score::text NOT IN ('NaN','Infinity','-Infinity') AND s.suggested_score BETWEEN 0 AND q.points AND s.confidence BETWEEN 0.9 AND 1 AND (nullif(btrim(q.correct_answer::text),'') IS NOT NULL AND q.correct_answer::text NOT IN ('null','""','{}','[]') OR nullif(btrim(q.explanation),'') IS NOT NULL OR q.rubric::text NOT IN ('null','""','{}','[]')))::integer,
   jsonb_agg(jsonb_build_object('response_id',r.id,'score',s.suggested_score,'feedback',s.feedback) ORDER BY r.id)
   INTO pending,eligible,reviews
   FROM public.buklod_quiz_responses r JOIN public.buklod_quiz_questions q ON q.id=r.question_id AND q.exam_id=p_exam_id
   LEFT JOIN public.buklod_quiz_review_suggestions s ON s.response_id=r.id AND s.attempt_id=a.id AND s.job_id=p_job_id AND s.created_by=actor
   WHERE r.attempt_id=a.id AND r.needs_review IS TRUE AND r.manual_score IS NULL;
   IF pending=0 OR pending<>eligible THEN skipped:=skipped+1; CONTINUE; END IF;
   PERFORM public.buklod_quiz_approve_attempt_review_v2(a.id,reviews);
   approved:=approved+1;
  EXCEPTION WHEN OTHERS THEN failed:=failed+1;
  END;
 END LOOP;
 RETURN jsonb_build_object('approved',approved,'skipped',skipped,'failed',failed,'batch_limit',50,'released',0);
END;
$fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_approve_section_suggestions_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
-- Intentionally not granted to clients until historical suggestion provenance, eligibility and pagination are verified.
