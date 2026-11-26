-- Apply only after R2, in the same reviewed migration transaction.
-- Both API versions share the same transaction lock and pending-item selection.
CREATE OR REPLACE FUNCTION public.buklod_quiz_review_job_start_v2(p_exam_id uuid, p_section_id uuid)
RETURNS public.buklod_quiz_review_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
BEGIN
  RETURN public.buklod_quiz_review_job_start_v1(p_exam_id,p_section_id);
END;
$fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_review_job_start_v2(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_review_job_start_v2(uuid,uuid) TO authenticated;
