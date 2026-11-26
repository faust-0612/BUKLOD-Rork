-- DEV candidate only. Requires worker integration and fencing tests before release.
-- Keep lease state separate from client-writable review jobs.
CREATE TABLE IF NOT EXISTS public.buklod_quiz_review_worker_leases (
  job_id uuid PRIMARY KEY REFERENCES public.buklod_quiz_review_jobs(id) ON DELETE CASCADE,
  lease_token uuid NOT NULL,
  expires_at timestamptz NOT NULL
);
ALTER TABLE public.buklod_quiz_review_worker_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.buklod_quiz_review_worker_leases FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.buklod_quiz_worker_claim_v1(p_job_id uuid,p_actor uuid,p_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_claimed uuid;
BEGIN
  IF p_job_id IS NULL OR p_actor IS NULL OR p_token IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.buklod_quiz_review_jobs j
    JOIN public.buklod_quiz_exams e ON e.id=j.exam_id
    JOIN public.buklod_quiz_sections s ON s.id=j.section_id AND s.exam_id=j.exam_id
    WHERE j.id=p_job_id AND j.created_by=p_actor AND e.owner_user_id=p_actor
    AND j.status IN ('QUEUED','RUNNING')
  ) THEN RETURN false; END IF;
  INSERT INTO public.buklod_quiz_review_worker_leases AS l(job_id,lease_token,expires_at)
  VALUES(p_job_id,p_token,clock_timestamp()+interval '180 seconds')
  ON CONFLICT(job_id) DO UPDATE SET lease_token=EXCLUDED.lease_token,expires_at=EXCLUDED.expires_at
  WHERE l.expires_at<=clock_timestamp()
  RETURNING lease_token INTO v_claimed;
  RETURN coalesce(v_claimed=p_token,false);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_worker_release_v1(p_job_id uuid,p_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
BEGIN
  DELETE FROM public.buklod_quiz_review_worker_leases
  WHERE job_id=p_job_id AND lease_token=p_token;
  RETURN FOUND;
END;
$fn$;

REVOKE ALL ON FUNCTION public.buklod_quiz_worker_claim_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_worker_release_v1(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_worker_claim_v1(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_worker_release_v1(uuid,uuid) TO service_role;
