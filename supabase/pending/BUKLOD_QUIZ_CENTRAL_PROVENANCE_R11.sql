-- R11: apply after R10. No backfill of untrusted legacy suggestions.
CREATE TABLE IF NOT EXISTS public.buklod_quiz_trusted_review_suggestions(
 response_id uuid PRIMARY KEY REFERENCES public.buklod_quiz_responses(id) ON DELETE CASCADE,
 job_id uuid NOT NULL REFERENCES public.buklod_quiz_review_jobs(id) ON DELETE CASCADE,
 snapshot jsonb NOT NULL
);
ALTER TABLE public.buklod_quiz_trusted_review_suggestions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.buklod_quiz_trusted_review_suggestions FROM PUBLIC,anon,authenticated;
-- R6: atomically fence worker writes. Apply after R4.
CREATE OR REPLACE FUNCTION public.buklod_quiz_worker_commit_v1(
 p_job_id uuid,p_token uuid,p_patch jsonb,p_suggestions jsonb DEFAULT '[]'::jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE j public.buklod_quiz_review_jobs; n public.buklod_quiz_review_jobs;
BEGIN
 PERFORM 1 FROM public.buklod_quiz_review_worker_leases
 WHERE job_id=p_job_id AND lease_token=p_token AND expires_at>clock_timestamp() FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO j FROM public.buklod_quiz_review_jobs WHERE id=p_job_id FOR UPDATE;
 IF NOT FOUND OR j.status NOT IN ('QUEUED','RUNNING') THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.buklod_quiz_exams e WHERE e.id=j.exam_id AND e.owner_user_id=j.created_by) THEN RETURN false; END IF;
 n:=jsonb_populate_record(j,p_patch);
 IF n.next_index<j.next_index OR n.next_index>j.total_attempts OR n.processed_attempts<j.processed_attempts OR n.processed_attempts>j.total_attempts OR n.status NOT IN ('QUEUED','RUNNING','PARTIAL','COMPLETED') THEN RAISE EXCEPTION 'Invalid worker progress'; END IF;
 IF EXISTS(
 SELECT 1 FROM jsonb_populate_recordset(NULL::public.buklod_quiz_review_suggestions,p_suggestions) x
 LEFT JOIN public.buklod_quiz_responses r ON r.id=x.response_id AND r.attempt_id=x.attempt_id
 LEFT JOIN public.buklod_quiz_attempts a ON a.id=r.attempt_id
 LEFT JOIN public.buklod_quiz_questions q ON q.id=r.question_id AND q.exam_id=a.exam_id
 WHERE r.id IS NULL OR q.id IS NULL OR a.exam_id IS DISTINCT FROM j.exam_id OR a.section_id IS DISTINCT FROM j.section_id
 OR NOT coalesce(a.id=ANY(j.attempt_ids),false) OR x.job_id IS DISTINCT FROM j.id OR x.created_by IS DISTINCT FROM j.created_by
 OR a.status IS DISTINCT FROM 'NEEDS_REVIEW' OR r.needs_review IS DISTINCT FROM true OR r.manual_score IS NOT NULL
 OR x.suggested_score<0 OR x.suggested_score>q.points OR x.confidence<0 OR x.confidence>1
 ) THEN RAISE EXCEPTION 'Invalid or stale review suggestion'; END IF;
 INSERT INTO public.buklod_quiz_review_suggestions(response_id,job_id,attempt_id,suggested_score,feedback,confidence,model,created_by,updated_at)
 SELECT response_id,job_id,attempt_id,suggested_score,feedback,confidence,model,created_by,clock_timestamp()
 FROM jsonb_populate_recordset(NULL::public.buklod_quiz_review_suggestions,p_suggestions)
 ON CONFLICT(response_id) DO UPDATE SET job_id=excluded.job_id,attempt_id=excluded.attempt_id,suggested_score=excluded.suggested_score,feedback=excluded.feedback,confidence=excluded.confidence,model=excluded.model,created_by=excluded.created_by,updated_at=excluded.updated_at;
 INSERT INTO public.buklod_quiz_trusted_review_suggestions(response_id,job_id,snapshot)
 SELECT s.response_id,s.job_id,jsonb_build_object('suggestion',to_jsonb(s),'answer',r.answer,'question',to_jsonb(q))
 FROM public.buklod_quiz_review_suggestions s
 JOIN public.buklod_quiz_responses r ON r.id=s.response_id
 JOIN public.buklod_quiz_questions q ON q.id=r.question_id
 WHERE s.response_id IN (SELECT x.response_id FROM jsonb_populate_recordset(NULL::public.buklod_quiz_review_suggestions,p_suggestions) x)
 AND s.job_id=j.id
 ON CONFLICT(response_id) DO UPDATE SET job_id=excluded.job_id,snapshot=excluded.snapshot;
 UPDATE public.buklod_quiz_review_jobs SET status=n.status,next_index=n.next_index,processed_attempts=n.processed_attempts,failed_attempts=n.failed_attempts,current_attempt_id=n.current_attempt_id,last_error=n.last_error,heartbeat_at=clock_timestamp(),updated_at=clock_timestamp(),completed_at=n.completed_at WHERE id=j.id;
 RETURN true;
END;
$fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_worker_commit_v1(uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_worker_commit_v1(uuid,uuid,jsonb,jsonb) TO service_role;

-- DEV candidate; requires R7 and R8, trusted suggestion provenance and client integration.
CREATE OR REPLACE FUNCTION public.buklod_quiz_approve_section_suggestions_v2(p_exam_id uuid,p_section_id uuid,p_job_id uuid,p_after uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE actor uuid:=auth.uid(); a record; reviews jsonb; pending integer; eligible integer; approved integer:=0; skipped integer:=0; failed integer:=0; last_id uuid; scanned integer:=0;
BEGIN
 IF actor IS NULL OR NOT public.buklod_quiz_is_examiner(actor) THEN RAISE EXCEPTION 'Examiner access required.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.buklod_quiz_exams e JOIN public.buklod_quiz_sections s ON s.exam_id=e.id WHERE e.id=p_exam_id AND s.id=p_section_id AND e.owner_user_id=actor) THEN RAISE EXCEPTION 'Exam owner access required.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.buklod_quiz_review_jobs j WHERE j.id=p_job_id AND j.exam_id=p_exam_id AND j.section_id=p_section_id AND j.created_by=actor AND j.status='COMPLETED') THEN RAISE EXCEPTION 'Completed review job required.'; END IF;
 FOR a IN SELECT t.id FROM public.buklod_quiz_attempts t JOIN public.buklod_quiz_review_jobs j ON j.id=p_job_id AND t.id=ANY(j.attempt_ids) WHERE t.exam_id=p_exam_id AND t.section_id=p_section_id AND t.status='NEEDS_REVIEW' AND (p_after IS NULL OR t.id>p_after) ORDER BY t.id LIMIT 50 LOOP
  last_id:=a.id; scanned:=scanned+1;
  BEGIN
   PERFORM 1 FROM public.buklod_quiz_attempts t WHERE t.id=a.id AND t.status='NEEDS_REVIEW' FOR UPDATE;
   IF NOT FOUND THEN skipped:=skipped+1; CONTINUE; END IF;
   SELECT count(*)::integer,count(*) FILTER(WHERE s.response_id IS NOT NULL AND proof.response_id IS NOT NULL AND s.suggested_score IS NOT NULL AND s.suggested_score::text NOT IN ('NaN','Infinity','-Infinity') AND s.suggested_score BETWEEN 0 AND q.points AND s.confidence BETWEEN 0.9 AND 1 AND (nullif(btrim(q.correct_answer::text),'') IS NOT NULL AND q.correct_answer::text NOT IN ('null','""','{}','[]') OR nullif(btrim(q.explanation),'') IS NOT NULL OR q.rubric::text NOT IN ('null','""','{}','[]')))::integer,
   jsonb_agg(jsonb_build_object('response_id',r.id,'score',s.suggested_score,'feedback',s.feedback) ORDER BY r.id)
   INTO pending,eligible,reviews
   FROM public.buklod_quiz_responses r JOIN public.buklod_quiz_questions q ON q.id=r.question_id AND q.exam_id=p_exam_id
   LEFT JOIN public.buklod_quiz_review_suggestions s ON s.response_id=r.id AND s.attempt_id=a.id AND s.job_id=p_job_id AND s.created_by=actor
   LEFT JOIN public.buklod_quiz_trusted_review_suggestions proof ON proof.response_id=s.response_id AND proof.job_id=s.job_id AND proof.snapshot=jsonb_build_object('suggestion',to_jsonb(s),'answer',r.answer,'question',to_jsonb(q))
   WHERE r.attempt_id=a.id AND r.needs_review IS TRUE AND r.manual_score IS NULL;
   IF pending=0 OR pending<>eligible THEN skipped:=skipped+1; CONTINUE; END IF;
   PERFORM public.buklod_quiz_approve_attempt_review_v2(a.id,reviews);
   approved:=approved+1;
  EXCEPTION WHEN OTHERS THEN failed:=failed+1;
  END;
 END LOOP;
 RETURN jsonb_build_object('approved',approved,'skipped',skipped,'failed',failed,'batch_limit',50,'scanned',scanned,'next_cursor',last_id,'may_have_more',scanned=50,'released',0);
END;
$fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_approve_section_suggestions_v2(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
-- Intentionally not granted to clients until historical suggestion provenance, eligibility and pagination are verified.
