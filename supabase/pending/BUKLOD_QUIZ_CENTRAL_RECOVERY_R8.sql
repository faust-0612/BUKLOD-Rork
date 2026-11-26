-- DEV candidate. Deploy only with compatible worker and client verified.
CREATE OR REPLACE FUNCTION public.buklod_quiz_worker_requeue_v1(p_job_id uuid,p_actor uuid)
RETURNS public.buklod_quiz_review_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE j public.buklod_quiz_review_jobs;
BEGIN
 PERFORM 1 FROM public.buklod_quiz_review_worker_leases WHERE job_id=p_job_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.buklod_quiz_review_worker_leases WHERE job_id=p_job_id AND expires_at>clock_timestamp()) THEN
   RAISE EXCEPTION 'Review worker is still active.';
 END IF;
 SELECT * INTO j FROM public.buklod_quiz_review_jobs WHERE id=p_job_id FOR UPDATE;
 IF NOT FOUND OR p_actor IS NULL OR j.created_by IS DISTINCT FROM p_actor OR NOT EXISTS(SELECT 1 FROM public.buklod_quiz_exams e WHERE e.id=j.exam_id AND e.owner_user_id=p_actor) THEN
   RAISE EXCEPTION 'Review job not found or unauthorized.';
 END IF;
 IF j.status='PARTIAL' AND (j.last_error LIKE 'AI_QUOTA_TEMPORARY%' OR j.last_error LIKE 'AI_PROVIDER_CONFIG_INVALID%' OR j.last_error LIKE 'AI_PROVIDER_TEMPORARY%') THEN
   UPDATE public.buklod_quiz_review_jobs SET status='QUEUED',last_error=NULL,completed_at=NULL,heartbeat_at=clock_timestamp(),updated_at=clock_timestamp()
   WHERE id=j.id RETURNING * INTO j;
 END IF;
 RETURN j;
END;
$fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_worker_requeue_v1(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_worker_requeue_v1(uuid,uuid) TO service_role;
-- Release gate: old clients and old Edge Functions must not rely on direct writes.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.buklod_quiz_review_jobs, public.buklod_quiz_review_suggestions FROM PUBLIC,anon,authenticated;
