-- Pinned source: AI_PAYLOAD_R1 blob 59c232be0e5d53250aac106a5bc0a74e18c32900
-- MAIN Quiz compatibility: read-only, owner-scoped grading payload.
CREATE OR REPLACE FUNCTION public.buklod_quiz_review_ai_payload_v1(p_attempt_id uuid)
RETURNS TABLE(response_id uuid, question_type text, question text, max_points numeric, student_answer text, correct_answer text, explanation text, rubric text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_actor uuid := auth.uid(); v_owner uuid; v_status text;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  SELECT e.owner_user_id,a.status INTO v_owner,v_status FROM public.buklod_quiz_attempts a JOIN public.buklod_quiz_exams e ON e.id=a.exam_id WHERE a.id=p_attempt_id;
  IF v_owner IS NULL OR v_owner<>v_actor THEN RAISE EXCEPTION 'Attempt not found or unauthorized.'; END IF;
  IF v_status<>'NEEDS_REVIEW' THEN RETURN; END IF;
  RETURN QUERY SELECT r.id,q.question_type,q.prompt,q.points,
    CASE WHEN r.answer IS NULL THEN '' WHEN jsonb_typeof(r.answer)='string' THEN r.answer #>> '{}' ELSE r.answer::text END,
    CASE WHEN q.correct_answer IS NULL THEN NULL WHEN jsonb_typeof(q.correct_answer)='string' THEN q.correct_answer #>> '{}' ELSE q.correct_answer::text END,
    q.explanation,q.rubric::text
  FROM public.buklod_quiz_responses r JOIN public.buklod_quiz_questions q ON q.id=r.question_id
  JOIN public.buklod_quiz_attempts a ON a.id=r.attempt_id AND a.exam_id=q.exam_id
  WHERE r.attempt_id=p_attempt_id AND r.needs_review IS TRUE AND r.manual_score IS NULL
  AND upper(q.question_type) IN ('SHORT_TEXT','ESSAY','ENUMERATION','MANUAL')
  ORDER BY q.sort_order,q.id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_review_ai_payload_v1(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_review_ai_payload_v1(uuid) TO authenticated;


-- Pinned source: REVIEW_R2 blob 52c2e6277c0237ab3884d50be7b2ac62fccf3785
-- DEV candidate: recovered Quiz RPCs; not authorized for automatic deployment.
CREATE OR REPLACE FUNCTION public.buklod_quiz_finalize_attempt_v2(p_attempt_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_owner uuid;
  v_pending integer;
  v_status text;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_quiz_is_examiner(v_actor) then raise exception 'Examiner access required.'; end if;

  select e.owner_user_id,a.status into v_owner,v_status
  from public.buklod_quiz_attempts a join public.buklod_quiz_exams e on e.id=a.exam_id
  where a.id=p_attempt_id for update of a;
  if v_owner is null then raise exception 'Attempt not found.'; end if;
  if v_owner<>v_actor then raise exception 'Exam owner access required.'; end if;

  if v_status in ('RELEASED','GRADED') then return v_status; end if;
  if v_status is distinct from 'NEEDS_REVIEW' then raise exception 'Attempt is not awaiting review.'; end if;
  select count(*) into v_pending
  from public.buklod_quiz_responses r
  join public.buklod_quiz_questions q on q.id=r.question_id
  where r.attempt_id=p_attempt_id
    and upper(q.question_type) in ('SHORT_TEXT','ESSAY','ENUMERATION','MANUAL')
    and r.manual_score is null
    and coalesce(r.needs_review,false)=true;
  if v_pending>0 then raise exception 'Manual review is still incomplete for % response(s).',v_pending; end if;

  v_status:=public.buklod_quiz_compute_attempt_internal(p_attempt_id);
  return v_status;
end
$function$;
REVOKE ALL ON FUNCTION public.buklod_quiz_finalize_attempt_v2(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_finalize_attempt_v2(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.buklod_quiz_release_section_v1(p_exam_id uuid, p_section_id uuid, p_show_violations boolean DEFAULT false, p_show_answers boolean DEFAULT false, p_show_rationale boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid()); v_attempt uuid; v_released integer:=0; v_failed integer:=0; v_pending_review integer:=0; v_in_progress integer:=0;
  v_not_started integer:=0; v_already_released integer:=0; v_total_students integer:=0; v_eligible integer:=0; v_legacy_score_only integer:=0;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_quiz_is_examiner(v_actor) then raise exception 'Examiner access required.'; end if;
  if not exists(select 1 from public.buklod_quiz_exams e join public.buklod_quiz_sections s on s.exam_id=e.id and s.id=p_section_id where e.id=p_exam_id and e.owner_user_id=v_actor) then raise exception 'Exam owner access required.'; end if;
  with d as (select * from public.buklod_quiz_record_diagnostics_v1(p_exam_id,p_section_id)), latest as (
    select r.student_user_id,a.status from public.buklod_quiz_roster r left join lateral (
      select ax.status from public.buklod_quiz_attempts ax where ax.exam_id=p_exam_id and ax.section_id=p_section_id and ax.student_user_id=r.student_user_id and ax.status<>'VOID' order by ax.attempt_no desc,ax.created_at desc limit 1
    ) a on true where r.exam_id=p_exam_id and r.section_id=p_section_id and r.status='ACTIVE'
  )
  select count(*)::integer,count(*) filter(where l.status is null)::integer,count(*) filter(where l.status='STARTED')::integer,
    count(*) filter(where coalesce(d.pending_review_count,0)>0)::integer,count(*) filter(where l.status='RELEASED')::integer,
    count(*) filter(where coalesce(d.release_eligible,false))::integer,count(*) filter(where coalesce(d.release_eligible,false) and coalesce(d.legacy_score_only,false))::integer
  into v_total_students,v_not_started,v_in_progress,v_pending_review,v_already_released,v_eligible,v_legacy_score_only
  from latest l left join d on d.student_user_id=l.student_user_id;
  for v_attempt in select d.attempt_id from public.buklod_quiz_record_diagnostics_v1(p_exam_id,p_section_id) d where d.release_eligible=true and d.attempt_id is not null loop
    begin if public.buklod_quiz_release_attempt_v2(v_attempt,p_show_violations,p_show_answers,p_show_rationale) then v_released:=v_released+1; else v_failed:=v_failed+1; end if;
    exception when others then v_failed:=v_failed+1; end;
  end loop;
  return jsonb_build_object('ok',true,'total_students',v_total_students,'eligible_count',v_eligible,'released_count',v_released,'failed_count',v_failed,'already_released',v_already_released,'pending_review',v_pending_review,'in_progress',v_in_progress,'not_started',v_not_started,'legacy_score_only_eligible',v_legacy_score_only,'visibility_requested',jsonb_build_object('score',true,'violations',coalesce(p_show_violations,false),'answers',coalesce(p_show_answers,false) or coalesce(p_show_rationale,false),'rationale',coalesce(p_show_rationale,false)),'note','Unavailable legacy answers/rationale/violation details are never fabricated; those records release score only.');
end;$function$;
REVOKE ALL ON FUNCTION public.buklod_quiz_release_section_v1(uuid,uuid,boolean,boolean,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_release_section_v1(uuid,uuid,boolean,boolean,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.buklod_quiz_review_job_start_v1(p_exam_id uuid, p_section_id uuid)
 RETURNS public.buklod_quiz_review_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_job public.buklod_quiz_review_jobs;
  v_attempts uuid[];
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not exists(select 1 from public.buklod_quiz_exams e where e.id=p_exam_id and e.owner_user_id=v_actor) then
    raise exception 'Exam owner access required.';
  end if;
  if not exists(select 1 from public.buklod_quiz_sections s where s.id=p_section_id and s.exam_id=p_exam_id) then
    raise exception 'Section not found.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_exam_id::text || ':' || p_section_id::text, 0));
  select j.* into v_job from public.buklod_quiz_review_jobs j
  where j.exam_id=p_exam_id and j.section_id=p_section_id and j.created_by=v_actor and j.status in ('QUEUED','RUNNING')
  order by j.created_at desc limit 1;
  if found then return v_job; end if;

  select coalesce(array_agg(distinct a.id order by a.id), '{}') into v_attempts
  from public.buklod_quiz_attempts a
  join public.buklod_quiz_responses r on r.attempt_id=a.id
  join public.buklod_quiz_questions q on q.id=r.question_id
  where a.exam_id=p_exam_id
    and a.section_id=p_section_id
    and a.status='NEEDS_REVIEW'
    and r.manual_score is null
    and r.needs_review is true
    and q.exam_id=a.exam_id
    and upper(q.question_type) in ('SHORT_TEXT','ESSAY','ENUMERATION','MANUAL');

  insert into public.buklod_quiz_review_jobs(exam_id,section_id,created_by,status,attempt_ids,total_attempts,started_at,heartbeat_at)
  values(p_exam_id,p_section_id,v_actor,case when coalesce(array_length(v_attempts,1),0)=0 then 'COMPLETED' else 'QUEUED' end,
         v_attempts,coalesce(array_length(v_attempts,1),0),case when coalesce(array_length(v_attempts,1),0)>0 then now() end,now())
  returning * into v_job;
  if v_job.total_attempts=0 then
    update public.buklod_quiz_review_jobs set completed_at=now(),updated_at=now() where id=v_job.id returning * into v_job;
  end if;
  return v_job;
end
$function$;
REVOKE ALL ON FUNCTION public.buklod_quiz_review_job_start_v1(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_review_job_start_v1(uuid,uuid) TO authenticated;



-- Pinned source: JOB_V2_R3 blob 2a38d8f858fd01c090f65ceeff1713c4b8b7478b
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


-- Pinned source: WORKER_LEASE_R4 blob 73ad9eb676849ef2694349d68c46ee5a8fbbb30f
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


-- Pinned source: WORKER_FENCE_R6 blob d1cc5cf88a70a85c3f4ae498e1094bd9d2e2fbee
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


-- Pinned source: APPROVAL_R7 blob 8177304b274f3009817509c4a92efdc9b203d84d
-- DEV candidate: preserve existing approval contract; serialize with release/finalization.
CREATE OR REPLACE FUNCTION public.buklod_quiz_approve_attempt_review_v2(p_attempt_id uuid, p_reviews jsonb)
 RETURNS TABLE(status text, total_score numeric, max_score numeric, reviewed_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_owner uuid;
  v_status text;
  v_expected integer;
  v_item jsonb;
  v_response_id uuid;
  v_score numeric;
  v_points numeric;
  v_feedback text;
  v_seen integer;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required.'; end if;

  select e.owner_user_id,a.status into v_owner,v_status
  from public.buklod_quiz_attempts a
  join public.buklod_quiz_exams e on e.id=a.exam_id
  where a.id=p_attempt_id for update of a;

  if v_owner is null or v_owner<>(select auth.uid()) then raise exception 'Attempt not found or unauthorized.'; end if;
  if v_status<>'NEEDS_REVIEW' then raise exception 'Attempt is not pending manual review.'; end if;
  if p_reviews is null or jsonb_typeof(p_reviews)<>'array' then raise exception 'p_reviews must be a JSON array.'; end if;

  select count(*)::int into v_expected
  from public.buklod_quiz_responses r
  join public.buklod_quiz_questions q on q.id=r.question_id
  where r.attempt_id=p_attempt_id
    and upper(q.question_type) in ('SHORT_TEXT','ESSAY','ENUMERATION','MANUAL')
    and r.manual_score is null
    and coalesce(r.needs_review,false)=true;

  if v_expected=0 then
    perform public.buklod_quiz_compute_attempt_internal(p_attempt_id);
    return query select a.status,a.total_score,a.max_score,0 from public.buklod_quiz_attempts a where a.id=p_attempt_id;
    return;
  end if;

  if jsonb_array_length(p_reviews)<>v_expected then
    raise exception 'Approve Student requires exactly % pending review item(s). Refresh Review and try again.',v_expected;
  end if;

  for v_item in select value from jsonb_array_elements(p_reviews) loop
    begin
      v_response_id:=nullif(v_item->>'response_id','')::uuid;
      v_score:=(v_item->>'score')::numeric;
    exception when others then
      raise exception 'Each review must contain a valid response_id and numeric score.';
    end;
    v_feedback:=nullif(btrim(coalesce(v_item->>'feedback','')),'');

    select q.points into v_points
    from public.buklod_quiz_responses r
    join public.buklod_quiz_questions q on q.id=r.question_id
    where r.id=v_response_id
      and r.attempt_id=p_attempt_id
      and upper(q.question_type) in ('SHORT_TEXT','ESSAY','ENUMERATION','MANUAL')
      and r.manual_score is null
      and coalesce(r.needs_review,false)=true;

    if v_points is null then raise exception 'Review response is stale or not part of this attempt.'; end if;
    if v_score is null or v_score::text in ('NaN','Infinity','-Infinity') or v_score<0 or v_score>v_points then raise exception 'Manual score out of range for response %.',v_response_id; end if;

    select count(*)::int into v_seen
    from jsonb_array_elements(p_reviews) x
    where x->>'response_id'=v_response_id::text;
    if v_seen<>1 then raise exception 'Duplicate or missing review response %.',v_response_id; end if;

    update public.buklod_quiz_responses
    set manual_score=v_score,
        feedback=v_feedback,
        reviewed_by=(select auth.uid()),
        reviewed_at=now(),
        needs_review=false,
        updated_at=now()
    where id=v_response_id and attempt_id=p_attempt_id;
  end loop;

  if exists(
    select 1 from public.buklod_quiz_responses r
    join public.buklod_quiz_questions q on q.id=r.question_id
    where r.attempt_id=p_attempt_id
      and upper(q.question_type) in ('SHORT_TEXT','ESSAY','ENUMERATION','MANUAL')
      and r.manual_score is null
      and coalesce(r.needs_review,false)=true
  ) then raise exception 'Manual review is incomplete.'; end if;

  perform public.buklod_quiz_compute_attempt_internal(p_attempt_id);
  return query select a.status,a.total_score,a.max_score,v_expected from public.buklod_quiz_attempts a where a.id=p_attempt_id;
end
$function$;
REVOKE ALL ON FUNCTION public.buklod_quiz_approve_attempt_review_v2(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_approve_attempt_review_v2(uuid,jsonb) TO authenticated;


-- Pinned source: RECOVERY_R8 blob 1cf54ab406a3a259e2fa066e4c396d25c8204718
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


-- Pinned source: CLASS_APPROVAL_R10 blob 9d8145f88d17fd5c5336c8b53eb3d15a32eedc0b
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


-- Pinned source: PROVENANCE_R11 blob 6f2226ce78916717fc4f4733bd4096b2ee070e26
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


-- Pinned source: FACULTY_READ_R12 blob 82bcf3d0d0647a45142ea8cec2f7c3429ed4eda7
-- DEV candidate only. Restores three read-only faculty RPC contracts.
-- Source: Dedicated deployed definitions; existing MAIN functions not replaced.
-- Apply in a transaction; requires owner/nonowner/anonymous QA before release.

CREATE FUNCTION public.buklod_quiz_faculty_class_inventory_v1(p_exam_id uuid, p_include_archived boolean DEFAULT false)
 RETURNS TABLE(section_id uuid, section_name text, archived_at timestamp with time zone, roster_total bigint, active_students bigint, removed_students bigint, historical_attempts bigint, in_progress_attempts bigint, current_session_id uuid, current_live_status text, current_join_code text, can_archive boolean, matching_active_section_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT public.buklod_quiz_is_examiner((SELECT auth.uid())) OR NOT EXISTS(
    SELECT 1 FROM public.buklod_quiz_exams e
    WHERE e.id=p_exam_id AND e.owner_user_id=(SELECT auth.uid())
  ) THEN RAISE EXCEPTION 'Exam owner and examiner access required.' USING errcode='42501'; END IF;

  RETURN QUERY
  SELECT
    s.id,s.name::text,s.archived_at,
    (SELECT count(*) FROM public.buklod_quiz_roster r WHERE r.exam_id=p_exam_id AND r.section_id=s.id),
    (SELECT count(*) FROM public.buklod_quiz_roster r WHERE r.exam_id=p_exam_id AND r.section_id=s.id AND r.status='ACTIVE'),
    (SELECT count(*) FROM public.buklod_quiz_roster r WHERE r.exam_id=p_exam_id AND r.section_id=s.id AND r.status='REMOVED'),
    (SELECT count(*) FROM public.buklod_quiz_attempts a WHERE a.exam_id=p_exam_id AND a.section_id=s.id),
    (SELECT count(*) FROM public.buklod_quiz_attempts a
       JOIN public.buklod_quiz_live_sessions ls ON ls.id=a.live_session_id
       WHERE a.exam_id=p_exam_id AND a.section_id=s.id AND a.status='STARTED'
       AND a.expires_at>now() AND ls.status IN ('LIVE','PAUSED')),
    l.id,l.status::text,l.join_code,
    NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempts a
       JOIN public.buklod_quiz_live_sessions ls ON ls.id=a.live_session_id
       WHERE a.exam_id=p_exam_id AND a.section_id=s.id AND a.status='STARTED'
       AND a.expires_at>now() AND ls.status IN ('LIVE','PAUSED')),
    (SELECT count(*) FROM public.buklod_quiz_sections other
       WHERE other.exam_id=p_exam_id AND other.id<>s.id AND other.archived_at IS NULL
       AND lower(regexp_replace(other.name,'[-[:space:]]+','','g')) =
           lower(regexp_replace(s.name,'[-[:space:]]+','','g')))
  FROM public.buklod_quiz_sections s
  LEFT JOIN LATERAL (
    SELECT ls.id,ls.status,ls.join_code
    FROM public.buklod_quiz_live_sessions ls
    WHERE ls.exam_id=p_exam_id AND ls.section_id=s.id AND ls.status<>'ENDED'
    ORDER BY ls.created_at DESC,ls.id DESC LIMIT 1
  ) l ON true
  WHERE s.exam_id=p_exam_id AND (coalesce(p_include_archived,false) OR s.archived_at IS NULL)
  ORDER BY s.sort_order,lower(s.name),s.id;
END $function$;
REVOKE ALL ON FUNCTION public.buklod_quiz_faculty_class_inventory_v1(uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_faculty_class_inventory_v1(uuid,boolean) TO authenticated;

CREATE FUNCTION public.buklod_quiz_faculty_class_roster_v1(p_exam_id uuid, p_section_id uuid, p_status text DEFAULT 'ALL'::text, p_search text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(roster_id uuid, student_user_id uuid, display_name text, student_no text, roster_status text, enrolled_at timestamp with time zone, roster_updated_at timestamp with time zone, last_attempt_id uuid, last_attempt_status text, last_attempt_section_name text, last_attempt_at timestamp with time zone, has_running_attempt boolean, total_matching bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_filter text:=upper(trim(coalesce(p_status,'ALL')));
  v_limit integer:=greatest(1,least(coalesce(p_limit,50),100));
  v_offset integer:=greatest(0,least(coalesce(p_offset,0),10000));
  v_search text:=nullif(trim(left(coalesce(p_search,''),80)),'');
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT public.buklod_quiz_is_examiner((SELECT auth.uid())) OR NOT EXISTS(
    SELECT 1 FROM public.buklod_quiz_exams e
    JOIN public.buklod_quiz_sections s ON s.exam_id=e.id
    WHERE e.id=p_exam_id AND e.owner_user_id=(SELECT auth.uid()) AND s.id=p_section_id
  ) THEN RAISE EXCEPTION 'Exam section owner and examiner access required.' USING errcode='42501'; END IF;

  IF v_filter NOT IN ('ALL','ACTIVE','REMOVED','PENDING') THEN
    RAISE EXCEPTION 'Invalid roster status filter.' USING errcode='22023';
  END IF;

  RETURN QUERY
  SELECT r.id,r.student_user_id,r.display_name::text,r.student_no::text,
    r.status::text,r.created_at,r.updated_at,
    last_a.id,last_a.status::text,last_s.name::text,last_a.created_at,
    EXISTS(
      SELECT 1 FROM public.buklod_quiz_attempts run
      JOIN public.buklod_quiz_live_sessions live ON live.id=run.live_session_id
      WHERE run.exam_id=p_exam_id AND run.student_user_id=r.student_user_id
        AND run.status='STARTED' AND run.expires_at>now()
        AND live.status IN ('LIVE','PAUSED')
    ),
    count(*) over()
  FROM public.buklod_quiz_roster r
  LEFT JOIN LATERAL (
    SELECT a.id,a.status,a.section_id,a.created_at FROM public.buklod_quiz_attempts a
    WHERE a.exam_id=p_exam_id AND a.student_user_id=r.student_user_id
    ORDER BY a.attempt_no DESC,a.created_at DESC,a.id DESC LIMIT 1
  ) last_a ON true
  LEFT JOIN public.buklod_quiz_sections last_s ON last_s.id=last_a.section_id
  WHERE r.exam_id=p_exam_id AND r.section_id=p_section_id
    AND (v_filter='ALL' OR r.status=v_filter)
    AND (v_search IS NULL OR
      lower(coalesce(r.display_name,'')) LIKE '%'||lower(v_search)||'%' OR
      lower(coalesce(r.student_no,'')) LIKE '%'||lower(v_search)||'%')
  ORDER BY lower(coalesce(r.surname,'')),lower(coalesce(r.first_name,'')),lower(r.display_name),r.id
  LIMIT v_limit OFFSET v_offset;
END $function$;
REVOKE ALL ON FUNCTION public.buklod_quiz_faculty_class_roster_v1(uuid,uuid,text,text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_faculty_class_roster_v1(uuid,uuid,text,text,integer,integer) TO authenticated;

CREATE FUNCTION public.buklod_quiz_faculty_room_history_v1(p_exam_id uuid, p_section_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(session_id uuid, section_id uuid, section_name text, join_code text, live_status text, created_at timestamp with time zone, started_at timestamp with time zone, ended_at timestamp with time zone, question_count integer, relive_count integer, relive_only_unattempted boolean, is_latest_for_class boolean, can_relive boolean, total_members bigint, removed_members bigint, stranded_unfinished_attempts bigint, total_matching bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_actor uuid := (select auth.uid());
BEGIN
 IF v_actor IS NULL
   OR NOT public.buklod_quiz_is_examiner(v_actor)
   OR NOT EXISTS(SELECT 1 FROM public.buklod_quiz_exams e WHERE e.id=p_exam_id AND e.owner_user_id=v_actor)
 THEN RAISE EXCEPTION 'Exam owner and examiner access required.' USING errcode='42501'; END IF;
 IF p_section_id IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM public.buklod_quiz_sections sx WHERE sx.id=p_section_id AND sx.exam_id=p_exam_id
 ) THEN RAISE EXCEPTION 'Section is not part of this exam.' USING errcode='22023'; END IF;

 RETURN QUERY
 WITH rooms AS (
 SELECT ls.*,sx.name::text AS section_name,sx.archived_at AS section_archived,
   row_number() over(partition by ls.section_id order by ls.created_at desc,ls.id desc) AS rank_in_class
 FROM public.buklod_quiz_live_sessions ls
 JOIN public.buklod_quiz_sections sx ON sx.id=ls.section_id AND sx.exam_id=ls.exam_id
 WHERE ls.exam_id=p_exam_id AND ls.faculty_user_id=v_actor
   AND (p_section_id IS NULL OR ls.section_id=p_section_id)
 )
 SELECT x.id,x.section_id,x.section_name,x.join_code,x.status::text,
 x.created_at,x.started_at,x.ended_at,x.question_count,
 CASE WHEN coalesce(x.settings_snapshot->>'relive_count','') ~ '^[0-9]{1,5}$'
   THEN (x.settings_snapshot->>'relive_count')::int ELSE 0 END,
 CASE lower(coalesce(x.settings_snapshot->>'relive_only_unattempted','')) WHEN 'true' THEN true WHEN 't' THEN true WHEN '1' THEN true WHEN 'yes' THEN true WHEN 'on' THEN true ELSE false END,
 (x.rank_in_class=1),
 (x.status='ENDED' AND x.section_archived IS NULL
   AND NOT EXISTS(SELECT 1 FROM public.buklod_quiz_live_sessions other
    WHERE other.exam_id=x.exam_id AND other.section_id=x.section_id AND other.id<>x.id
      AND other.status<>'ENDED')),
 (SELECT count(*) FROM public.buklod_quiz_live_members lm WHERE lm.session_id=x.id),
 (SELECT count(*) FROM public.buklod_quiz_live_members lm WHERE lm.session_id=x.id AND lm.status='REMOVED'),
 (SELECT count(*) FROM public.buklod_quiz_attempts a WHERE a.live_session_id=x.id AND a.status='STARTED'
   AND NOT EXISTS(SELECT 1 FROM public.buklod_quiz_responses r WHERE r.attempt_id=a.id
     AND r.answer IS NOT NULL AND r.answer<>'null'::jsonb)),
 count(*) over()
 FROM rooms x ORDER BY x.created_at DESC,x.id DESC
 LIMIT greatest(1,least(coalesce(p_limit,50),100))
 OFFSET greatest(0,least(coalesce(p_offset,0),10000));
END $function$;
REVOKE ALL ON FUNCTION public.buklod_quiz_faculty_room_history_v1(uuid,uuid,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_faculty_room_history_v1(uuid,uuid,integer,integer) TO authenticated;


-- Pinned source: LIVE_RECOVERY_R13 blob c3825a965c4a4e99904e701ca51e03633146831b
-- DEV only. Requires functional and concurrency QA. Do not apply to production.
-- Restore faculty room v3 and unfinished recovery without replacing existing MAIN RPCs.

CREATE FUNCTION public.buklod_quiz_faculty_live_room_v3(p_session_id uuid)
 RETURNS TABLE(session_id uuid, exam_id uuid, section_id uuid, section_name text, exam_title text, join_code text, live_status text, admission_mode text, allow_late_join boolean, student_user_id uuid, surname text, first_name text, display_name text, member_status text, joined_at timestamp with time zone, attempt_id uuid, attempt_no integer, attempt_status text, started_at timestamp with time zone, expires_at timestamp with time zone, remaining_seconds integer, answered_count integer, total_questions integer, total_score numeric, max_score numeric, score_percent numeric, integrity_events integer, released_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    ls.id,ls.exam_id,ls.section_id,sec.name,e.title,ls.join_code,ls.status,ls.admission_mode,ls.allow_late_join,
    m.student_user_id,p.surname,p.first_name,
    coalesce(nullif(p.full_name,''),trim(concat_ws(' ',p.first_name,p.surname)),'BUKLOD Student'),
    m.status,m.joined_at,
    a.id,a.attempt_no,a.status,a.started_at,a.expires_at,
    case when a.status='STARTED' and a.expires_at is not null
      then greatest(0,floor(extract(epoch from (a.expires_at-now())))::int)
      else null end,
    coalesce((select count(*)::int from public.buklod_quiz_responses r where r.attempt_id=a.id and r.answer is not null and r.answer<>'null'::jsonb and r.answer<>'""'::jsonb),0),
    CASE WHEN a.id IS NOT NULL THEN private.buklod_quiz_attempt_question_count_r1(a.id)
     ELSE coalesce(ls.question_count,(select count(*)::int from public.buklod_quiz_questions q where q.exam_id=ls.exam_id and q.is_active=true)) END,
    a.total_score,a.max_score,
    case when a.max_score>0 then public.buklod_quiz_transmuted_percent_v1(a.total_score,a.max_score) else null end,
    case when a.id is null then 0 else private.buklod_quiz_canonical_integrity_count_v1(a.id) end,
    a.released_at
  from public.buklod_quiz_live_sessions ls
  join public.buklod_quiz_exams e on e.id=ls.exam_id
  join public.buklod_quiz_sections sec on sec.id=ls.section_id
  join public.buklod_quiz_live_members m on m.session_id=ls.id
  left join public.profiles p on p.id=m.student_user_id
  left join lateral (
    select x.*
    from public.buklod_quiz_attempts x
    where x.live_session_id=ls.id and x.student_user_id=m.student_user_id and x.status<>'VOID'
    order by x.attempt_no desc,x.created_at desc,x.id desc
    limit 1
  ) a on true
  where ls.id=p_session_id
    and ls.faculty_user_id=(select auth.uid())
    and e.owner_user_id=(select auth.uid())
    and public.buklod_quiz_is_examiner((select auth.uid()))
    and sec.exam_id=ls.exam_id
    and m.status<>'REMOVED'
  order by lower(coalesce(p.surname,p.full_name,'')),lower(coalesce(p.first_name,'')),m.joined_at
$function$;
REVOKE ALL ON FUNCTION public.buklod_quiz_faculty_live_room_v3(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_faculty_live_room_v3(uuid) TO authenticated;

CREATE FUNCTION public.buklod_quiz_faculty_unfinished_recovery_v1(p_exam_id uuid, p_section_id uuid, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(attempt_id uuid, student_user_id uuid, student_name text, attempt_no integer, source_session_id uuid, source_join_code text, source_room_status text, roster_status text, saved_answer_rows bigint, selected_question_count integer, max_score numeric, current_live_session_id uuid, current_live_code text, current_member_status text, can_recover_to_current boolean, reason text, total_matching bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_actor uuid := (select auth.uid());
BEGIN
 IF v_actor IS NULL OR NOT public.buklod_quiz_is_examiner(v_actor)
  OR NOT EXISTS(SELECT 1 FROM public.buklod_quiz_exams e
    JOIN public.buklod_quiz_sections sx ON sx.id=p_section_id AND sx.exam_id=e.id
    WHERE e.id=p_exam_id AND e.owner_user_id=v_actor)
 THEN RAISE EXCEPTION 'Exam section owner and examiner access required.' USING errcode='42501'; END IF;

 RETURN QUERY
 SELECT a.id,a.student_user_id,coalesce(r.display_name,'Unknown')::text,a.attempt_no,
 src.id,src.join_code,src.status::text,r.status::text,
 (SELECT count(*) FROM public.buklod_quiz_responses rsp WHERE rsp.attempt_id=a.id),
 private.buklod_quiz_attempt_question_count_r1(a.id),a.max_score,
 target.id,target.join_code,m.status::text,
 (target.id IS NOT NULL AND m.status='ADMITTED' AND r.status='ACTIVE' AND src.status='ENDED'
   AND NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempts z WHERE z.live_session_id=target.id AND z.student_user_id=a.student_user_id AND z.status<>'VOID')
   AND src.question_snapshot_hash IS NOT DISTINCT FROM target.question_snapshot_hash
   AND (coalesce(src.settings_snapshot->>'question_selection_mode','')<>'SNAPSHOT_R1' OR nullif(src.question_snapshot_hash,'') IS NOT NULL)
   AND NOT EXISTS(SELECT 1 FROM public.buklod_quiz_responses rsp WHERE rsp.attempt_id=a.id)
   AND private.buklod_quiz_attempt_question_count_r1(a.id)=target.question_count
   AND coalesce(a.max_score,0)=coalesce(target.total_score_target,0)
   AND coalesce(src.settings_snapshot->>'question_selection_mode','')
       =coalesce(target.settings_snapshot->>'question_selection_mode','')
   AND NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempts other
     WHERE other.exam_id=a.exam_id AND other.student_user_id=a.student_user_id
       AND other.status='STARTED' AND other.id<>a.id)),
 CASE
 WHEN src.status<>'ENDED' THEN 'Source session is not ended'
 WHEN EXISTS(SELECT 1 FROM public.buklod_quiz_responses rsp WHERE rsp.attempt_id=a.id) THEN 'Review saved answers first'
 WHEN target.id IS NULL THEN 'No live target room for this class'
 WHEN r.status IS DISTINCT FROM 'ACTIVE' THEN 'Active class roster required'
 WHEN m.status IS DISTINCT FROM 'ADMITTED' THEN 'Student has no entry in the target room; authorized rejoin first'
 WHEN private.buklod_quiz_attempt_question_count_r1(a.id)<>target.question_count
   OR coalesce(a.max_score,0)<>coalesce(target.total_score_target,0) THEN 'Exam structure differs'
 WHEN coalesce(src.settings_snapshot->>'question_selection_mode','')
       <>coalesce(target.settings_snapshot->>'question_selection_mode','') THEN 'Assignment mode differs'
 WHEN EXISTS(SELECT 1 FROM public.buklod_quiz_attempts z WHERE z.live_session_id=target.id AND z.student_user_id=a.student_user_id AND z.status<>'VOID') THEN 'Target room already has an attempt'
 WHEN src.question_snapshot_hash IS DISTINCT FROM target.question_snapshot_hash OR (coalesce(src.settings_snapshot->>'question_selection_mode','')='SNAPSHOT_R1' AND nullif(src.question_snapshot_hash,'') IS NULL) THEN 'Question snapshot cannot be verified'
 WHEN EXISTS(SELECT 1 FROM public.buklod_quiz_attempts other WHERE other.exam_id=a.exam_id AND other.student_user_id=a.student_user_id AND other.status='STARTED' AND other.id<>a.id) THEN 'Another unfinished attempt exists'
 ELSE 'Eligible for faculty-authorized recovery; existing attempt and answers preserved' END,
 count(*) over()
 FROM public.buklod_quiz_attempts a
 JOIN public.buklod_quiz_live_sessions src ON src.id=a.live_session_id AND src.exam_id=a.exam_id
 LEFT JOIN public.buklod_quiz_roster r ON r.exam_id=a.exam_id AND r.student_user_id=a.student_user_id AND r.section_id=a.section_id
 LEFT JOIN LATERAL (
   SELECT ls.* FROM public.buklod_quiz_live_sessions ls
   WHERE ls.exam_id=a.exam_id AND ls.section_id=a.section_id AND ls.status='LIVE'
     AND ls.faculty_user_id=v_actor ORDER BY ls.created_at DESC,ls.id DESC LIMIT 1
 ) target ON true
 LEFT JOIN public.buklod_quiz_live_members m ON m.session_id=target.id AND m.student_user_id=a.student_user_id
 WHERE a.exam_id=p_exam_id AND a.section_id=p_section_id AND a.status='STARTED'
   AND src.status='ENDED'
 ORDER BY a.created_at DESC,a.attempt_no DESC
 LIMIT greatest(1,least(coalesce(p_limit,50),100))
 OFFSET greatest(0,least(coalesce(p_offset,0),10000));
END $function$;
REVOKE ALL ON FUNCTION public.buklod_quiz_faculty_unfinished_recovery_v1(uuid,uuid,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_faculty_unfinished_recovery_v1(uuid,uuid,integer,integer) TO authenticated;

CREATE FUNCTION public.buklod_quiz_faculty_recover_unfinished_v1(p_current_session_id uuid, p_student_user_id uuid, p_minutes integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_actor uuid := (select auth.uid());
 v_session public.buklod_quiz_live_sessions%rowtype;
 v_member public.buklod_quiz_live_members%rowtype;
 v_old public.buklod_quiz_attempts%rowtype;
 v_result jsonb;
 v_minutes int;
BEGIN
 IF v_actor IS NULL OR NOT public.buklod_quiz_is_examiner(v_actor) THEN
   RAISE EXCEPTION 'Examiner access required.' USING errcode='42501'; END IF;
 SELECT * INTO v_session FROM public.buklod_quiz_live_sessions
 WHERE id=p_current_session_id AND faculty_user_id=v_actor AND status='LIVE' FOR UPDATE;
 IF v_session.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.buklod_quiz_exams e WHERE e.id=v_session.exam_id AND e.owner_user_id=v_actor) THEN RAISE EXCEPTION 'A current LIVE room owned by faculty is required.'; END IF;
 SELECT * INTO v_member FROM public.buklod_quiz_live_members
 WHERE session_id=v_session.id AND student_user_id=p_student_user_id FOR UPDATE;
 IF v_member.student_user_id IS NULL OR v_member.status IS DISTINCT FROM 'ADMITTED' THEN
   RAISE EXCEPTION 'Student must first join this room with a valid class code.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.buklod_quiz_roster r
   WHERE r.exam_id=v_session.exam_id AND r.section_id=v_session.section_id
    AND r.student_user_id=p_student_user_id AND r.status='ACTIVE') THEN
   RAISE EXCEPTION 'Student must belong to the current exam class.'; END IF;
 SELECT a.* INTO v_old FROM public.buklod_quiz_attempts a
 JOIN public.buklod_quiz_live_sessions old ON old.id=a.live_session_id
 WHERE a.exam_id=v_session.exam_id AND a.section_id=v_session.section_id
  AND a.student_user_id=p_student_user_id AND a.status='STARTED'
  AND a.live_session_id<>v_session.id AND old.status='ENDED'
  AND old.question_count=v_session.question_count
  AND old.exam_id=v_session.exam_id AND old.section_id=v_session.section_id
  AND old.question_snapshot_hash IS NOT DISTINCT FROM v_session.question_snapshot_hash
  AND (coalesce(old.settings_snapshot->>'question_selection_mode','')<>'SNAPSHOT_R1' OR nullif(old.question_snapshot_hash,'') IS NOT NULL)
  AND coalesce(old.settings_snapshot->>'question_selection_mode','')
      =coalesce(v_session.settings_snapshot->>'question_selection_mode','')
 ORDER BY a.attempt_no DESC,a.created_at DESC LIMIT 1 FOR UPDATE OF a;
 IF EXISTS(SELECT 1 FROM public.buklod_quiz_attempts z WHERE z.live_session_id=v_session.id AND z.student_user_id=p_student_user_id AND z.status<>'VOID') THEN RAISE EXCEPTION 'Target room already has an attempt.'; END IF;
 IF v_old.id IS NULL THEN RAISE EXCEPTION 'No safe unfinished attempt was found.'; END IF;
 IF EXISTS(SELECT 1 FROM public.buklod_quiz_responses r WHERE r.attempt_id=v_old.id) THEN
   RAISE EXCEPTION 'Attempt has saved rows; manual review required before recovery.'; END IF;
 IF coalesce(v_old.max_score,0)<>coalesce(v_session.total_score_target,0)
 OR private.buklod_quiz_attempt_question_count_r1(v_old.id)<>v_session.question_count THEN
   RAISE EXCEPTION 'Exam item count or maximum points mismatch; cannot move attempt.'; END IF;
 IF EXISTS(SELECT 1 FROM public.buklod_quiz_attempts a
   WHERE a.exam_id=v_session.exam_id AND a.student_user_id=p_student_user_id
      AND a.status='STARTED' AND a.id<>v_old.id) THEN
   RAISE EXCEPTION 'Another unfinished attempt exists; manual review required.'; END IF;
 v_minutes:=coalesce(p_minutes,v_session.duration_minutes,30);
 IF v_minutes<1 OR v_minutes>1440 THEN RAISE EXCEPTION 'Recovery duration must be 1 to 1440 minutes.'; END IF;

 v_result:=public.buklod_quiz_live_student_action_v2(v_session.id,p_student_user_id,'REOPEN',v_minutes);
 IF (v_result->>'attempt_id') IS DISTINCT FROM v_old.id::text OR NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempts t WHERE t.id=v_old.id AND t.live_session_id=v_session.id AND t.status='STARTED') THEN
   RAISE EXCEPTION 'Recovered attempt identity mismatch; changes rolled back.'; END IF;
 RETURN v_result || jsonb_build_object('recovery','ENDED_ROOM_ZERO_ANSWER','previous_room',v_old.live_session_id,'preserved_attempt_id',v_old.id);
END $function$;
REVOKE ALL ON FUNCTION public.buklod_quiz_faculty_recover_unfinished_v1(uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
-- Mutation remains service-only/owner-auth gated until actual recovery QA.

