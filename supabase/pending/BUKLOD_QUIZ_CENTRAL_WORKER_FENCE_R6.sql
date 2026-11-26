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
 UPDATE public.buklod_quiz_review_jobs SET status=n.status,next_index=n.next_index,processed_attempts=n.processed_attempts,failed_attempts=n.failed_attempts,current_attempt_id=n.current_attempt_id,last_error=n.last_error,heartbeat_at=clock_timestamp(),updated_at=clock_timestamp(),completed_at=n.completed_at WHERE id=j.id;
 RETURN true;
END;
$fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_worker_commit_v1(uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_worker_commit_v1(uuid,uuid,jsonb,jsonb) TO service_role;
