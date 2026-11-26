-- R19 DEV candidate; depends on R18 grading references and R11 provenance.
-- Legacy suggestions without capture-time proof remain advisory only.
CREATE FUNCTION private.buklod_quiz_review_reference_r19(p_attempt_id uuid)
RETURNS TABLE(id uuid,question_type text,prompt text,points numeric,correct_answer jsonb,explanation text,rubric jsonb,sort_order integer,immutable boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
 SELECT g.id,g.question_type,
 CASE WHEN a.live_session_id IS NOT NULL AND aq.question_id IS NOT NULL THEN s.prompt ELSE q.prompt END,g.points,g.correct_answer,
 CASE WHEN a.live_session_id IS NOT NULL AND aq.question_id IS NOT NULL THEN s.explanation ELSE q.explanation END,
 CASE WHEN a.live_session_id IS NOT NULL AND aq.question_id IS NOT NULL THEN s.rubric ELSE q.rubric END,
 coalesce(aq.display_order,q.sort_order),
 (aq.question_id IS NOT NULL AND s.question_id IS NOT NULL)
 FROM public.buklod_quiz_attempts a
 CROSS JOIN LATERAL private.buklod_quiz_grading_items_r18(a.id) g
 JOIN public.buklod_quiz_questions q ON q.id=g.id AND q.exam_id=a.exam_id
 LEFT JOIN public.buklod_quiz_attempt_questions aq ON aq.attempt_id=a.id AND aq.question_id=g.id
 LEFT JOIN public.buklod_quiz_live_question_snapshots s ON s.session_id=a.live_session_id AND s.question_id=g.id
 WHERE a.id=p_attempt_id;
$fn$;
REVOKE ALL ON FUNCTION private.buklod_quiz_review_reference_r19(uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION private.buklod_quiz_review_capture_r19(p_response_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
 SELECT encode(extensions.digest(jsonb_build_object('response_id',r.id,'attempt_id',a.id,'exam_id',a.exam_id,'section_id',a.section_id,'student_id',a.student_user_id,'answer',r.answer,'saved_at',r.saved_at,'reference',to_jsonb(q))::text,'sha256'),'hex')
 FROM public.buklod_quiz_responses r JOIN public.buklod_quiz_attempts a ON a.id=r.attempt_id
 CROSS JOIN LATERAL private.buklod_quiz_review_reference_r19(a.id) q
 WHERE r.id=p_response_id AND q.id=r.question_id AND a.status='NEEDS_REVIEW' AND r.needs_review IS TRUE AND r.manual_score IS NULL;
$fn$;
REVOKE ALL ON FUNCTION private.buklod_quiz_review_capture_r19(uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.buklod_quiz_review_ai_payload_v2(p_attempt_id uuid)
RETURNS TABLE(response_id uuid,question_type text,question text,max_points numeric,student_answer text,correct_answer text,explanation text,rubric text,capture_digest text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
BEGIN
 IF auth.uid() IS NULL OR public.buklod_quiz_is_examiner(auth.uid()) IS DISTINCT FROM true OR NOT EXISTS(
 SELECT 1 FROM public.buklod_quiz_attempts a JOIN public.buklod_quiz_exams e ON e.id=a.exam_id WHERE a.id=p_attempt_id AND e.owner_user_id=auth.uid())
 THEN RAISE EXCEPTION 'Exam owner and examiner required' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT r.id,q.question_type,q.prompt,q.points,
 CASE WHEN jsonb_typeof(r.answer)='string' THEN r.answer#>>'{}' ELSE coalesce(r.answer::text,'') END,
 CASE WHEN jsonb_typeof(q.correct_answer)='string' THEN q.correct_answer#>>'{}' ELSE q.correct_answer::text END,
 q.explanation,q.rubric::text,private.buklod_quiz_review_capture_r19(r.id)
 FROM public.buklod_quiz_responses r JOIN public.buklod_quiz_attempts a ON a.id=r.attempt_id
 CROSS JOIN LATERAL private.buklod_quiz_review_reference_r19(a.id) q
 WHERE r.attempt_id=p_attempt_id AND a.status='NEEDS_REVIEW' AND q.id=r.question_id AND r.needs_review IS TRUE AND r.manual_score IS NULL
 AND upper(q.question_type) IN ('SHORT_TEXT','ESSAY','ENUMERATION','MANUAL')
 ORDER BY q.sort_order,q.id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_review_ai_payload_v2(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_review_ai_payload_v2(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.buklod_quiz_review_ai_payload_v1(p_attempt_id uuid)
RETURNS TABLE(response_id uuid,question_type text,question text,max_points numeric,student_answer text,correct_answer text,explanation text,rubric text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$ SELECT x.response_id,x.question_type,x.question,x.max_points,x.student_answer,x.correct_answer,x.explanation,x.rubric FROM public.buklod_quiz_review_ai_payload_v2(p_attempt_id) x; $fn$;

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
  if (select auth.uid()) is null OR public.buklod_quiz_is_examiner(auth.uid()) IS DISTINCT FROM true then raise exception 'Authentication required.'; end if;

  select e.owner_user_id,a.status into v_owner,v_status
  from public.buklod_quiz_attempts a
  join public.buklod_quiz_exams e on e.id=a.exam_id
  where a.id=p_attempt_id for update of a;

  if v_owner is null or v_owner<>(select auth.uid()) then raise exception 'Attempt not found or unauthorized.'; end if;
  if v_status<>'NEEDS_REVIEW' then raise exception 'Attempt is not pending manual review.'; end if;
  if p_reviews is null or jsonb_typeof(p_reviews)<>'array' then raise exception 'p_reviews must be a JSON array.'; end if;

  select count(*)::int into v_expected
  from public.buklod_quiz_responses r
  join private.buklod_quiz_review_reference_r19(p_attempt_id) q on q.id=r.question_id
  where r.attempt_id=p_attempt_id
    and upper(q.question_type) in ('SHORT_TEXT','ESSAY','ENUMERATION','MANUAL')
    and r.manual_score is null
    and coalesce(r.needs_review,false)=true;

  if v_expected<>(select count(*) from public.buklod_quiz_responses r where r.attempt_id=p_attempt_id and r.needs_review is true and r.manual_score is null) then raise exception 'Pending review reference missing'; end if;
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
    join private.buklod_quiz_review_reference_r19(p_attempt_id) q on q.id=r.question_id
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
    join private.buklod_quiz_review_reference_r19(p_attempt_id) q on q.id=r.question_id
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
 IF jsonb_typeof(p_suggestions) IS DISTINCT FROM 'array' OR jsonb_typeof(p_patch) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid worker payload'; END IF;
 IF jsonb_array_length(p_suggestions)>500 OR pg_column_size(p_suggestions)>2097152 THEN RAISE EXCEPTION 'Worker payload too large'; END IF;
 IF (SELECT count(DISTINCT x->>'response_id') FROM jsonb_array_elements(p_suggestions) x)<>jsonb_array_length(p_suggestions) THEN RAISE EXCEPTION 'Duplicate worker response'; END IF;
 -- Lock in deterministic order; all approval paths must serialize on attempt row.
 PERFORM 1 FROM public.buklod_quiz_attempts a WHERE a.id IN (SELECT (x->>'attempt_id')::uuid FROM jsonb_array_elements(p_suggestions) x) ORDER BY a.id FOR UPDATE;
 PERFORM 1 FROM public.buklod_quiz_responses r WHERE r.id IN (SELECT (x->>'response_id')::uuid FROM jsonb_array_elements(p_suggestions) x) ORDER BY r.id FOR UPDATE;
 PERFORM 1 FROM public.buklod_quiz_questions q WHERE q.id IN (SELECT r.question_id FROM public.buklod_quiz_responses r WHERE r.id IN (SELECT (x->>'response_id')::uuid FROM jsonb_array_elements(p_suggestions) x)) ORDER BY q.id FOR SHARE;
 PERFORM 1 FROM public.buklod_quiz_attempt_questions aq WHERE aq.attempt_id IN (SELECT (x->>'attempt_id')::uuid FROM jsonb_array_elements(p_suggestions) x) ORDER BY aq.attempt_id,aq.question_id FOR SHARE;
 PERFORM 1 FROM public.buklod_quiz_live_question_snapshots s WHERE s.session_id IN (SELECT a.live_session_id FROM public.buklod_quiz_attempts a WHERE a.id IN (SELECT (x->>'attempt_id')::uuid FROM jsonb_array_elements(p_suggestions) x)) ORDER BY s.session_id,s.question_id FOR SHARE;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_suggestions) x WHERE nullif(x->>'capture_digest','') IS NULL OR (x->>'capture_digest') IS DISTINCT FROM private.buklod_quiz_review_capture_r19((x->>'response_id')::uuid)) THEN RAISE EXCEPTION 'STALE_REVIEW_CAPTURE'; END IF;
 n:=jsonb_populate_record(j,p_patch);
 IF n.next_index IS NULL OR n.processed_attempts IS NULL OR n.failed_attempts IS NULL OR n.failed_attempts<0 OR n.failed_attempts>n.processed_attempts OR n.next_index<j.next_index OR n.next_index>j.total_attempts OR n.processed_attempts<j.processed_attempts OR n.processed_attempts>j.total_attempts OR n.status NOT IN ('QUEUED','RUNNING','PARTIAL','COMPLETED') THEN RAISE EXCEPTION 'Invalid worker progress'; END IF;
 IF EXISTS(
 SELECT 1 FROM jsonb_populate_recordset(NULL::public.buklod_quiz_review_suggestions,p_suggestions) x
 LEFT JOIN public.buklod_quiz_responses r ON r.id=x.response_id AND r.attempt_id=x.attempt_id
 LEFT JOIN public.buklod_quiz_attempts a ON a.id=r.attempt_id
 LEFT JOIN LATERAL private.buklod_quiz_review_reference_r19(a.id) q ON q.id=r.question_id
 WHERE r.id IS NULL OR q.id IS NULL OR a.exam_id IS DISTINCT FROM j.exam_id OR a.section_id IS DISTINCT FROM j.section_id
 OR NOT coalesce(a.id=ANY(j.attempt_ids),false) OR x.job_id IS DISTINCT FROM j.id OR x.created_by IS DISTINCT FROM j.created_by
 OR a.status IS DISTINCT FROM 'NEEDS_REVIEW' OR r.needs_review IS DISTINCT FROM true OR r.manual_score IS NOT NULL
 OR (x.suggested_score IS NOT NULL AND (x.suggested_score::text IN ('NaN','Infinity','-Infinity') OR x.suggested_score<0 OR x.suggested_score>q.points)) OR x.confidence IS NULL OR x.confidence::text IN ('NaN','Infinity','-Infinity') OR x.confidence<0 OR x.confidence>1
 ) THEN RAISE EXCEPTION 'Invalid or stale review suggestion'; END IF;
 INSERT INTO public.buklod_quiz_review_suggestions(response_id,job_id,attempt_id,suggested_score,feedback,confidence,model,created_by,updated_at)
 SELECT response_id,job_id,attempt_id,suggested_score,feedback,confidence,model,created_by,clock_timestamp()
 FROM jsonb_populate_recordset(NULL::public.buklod_quiz_review_suggestions,p_suggestions)
 ON CONFLICT(response_id) DO UPDATE SET job_id=excluded.job_id,attempt_id=excluded.attempt_id,suggested_score=excluded.suggested_score,feedback=excluded.feedback,confidence=excluded.confidence,model=excluded.model,created_by=excluded.created_by,updated_at=excluded.updated_at;
 INSERT INTO public.buklod_quiz_trusted_review_suggestions(response_id,job_id,snapshot)
 SELECT s.response_id,s.job_id,jsonb_build_object('suggestion',to_jsonb(s),'capture_digest',private.buklod_quiz_review_capture_r19(r.id),'version',19)
 FROM public.buklod_quiz_review_suggestions s
 JOIN public.buklod_quiz_responses r ON r.id=s.response_id
 WHERE s.response_id IN (SELECT x.response_id FROM jsonb_populate_recordset(NULL::public.buklod_quiz_review_suggestions,p_suggestions) x)
 AND s.job_id=j.id
 ON CONFLICT(response_id) DO UPDATE SET job_id=excluded.job_id,snapshot=excluded.snapshot;
 UPDATE public.buklod_quiz_review_jobs SET status=n.status,next_index=n.next_index,processed_attempts=n.processed_attempts,failed_attempts=n.failed_attempts,current_attempt_id=n.current_attempt_id,last_error=n.last_error,heartbeat_at=clock_timestamp(),updated_at=clock_timestamp(),completed_at=n.completed_at WHERE id=j.id;
 RETURN true;
END;
$fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_worker_commit_v1(uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_worker_commit_v1(uuid,uuid,jsonb,jsonb) TO service_role;


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
   SELECT count(*)::integer,count(*) FILTER(WHERE s.response_id IS NOT NULL AND proof.response_id IS NOT NULL AND s.suggested_score IS NOT NULL AND s.suggested_score::text NOT IN ('NaN','Infinity','-Infinity') AND q.immutable IS TRUE AND s.suggested_score BETWEEN 0 AND q.points AND s.confidence BETWEEN 0.9 AND 1 AND (nullif(btrim(q.correct_answer::text),'') IS NOT NULL AND q.correct_answer::text NOT IN ('null','""','{}','[]') OR nullif(btrim(q.explanation),'') IS NOT NULL OR q.rubric::text NOT IN ('null','""','{}','[]')))::integer,
   jsonb_agg(jsonb_build_object('response_id',r.id,'score',s.suggested_score,'feedback',s.feedback) ORDER BY r.id)
   INTO pending,eligible,reviews
   FROM public.buklod_quiz_responses r LEFT JOIN LATERAL private.buklod_quiz_review_reference_r19(a.id) q ON q.id=r.question_id
   LEFT JOIN public.buklod_quiz_review_suggestions s ON s.response_id=r.id AND s.attempt_id=a.id AND s.job_id=p_job_id AND s.created_by=actor
   LEFT JOIN public.buklod_quiz_trusted_review_suggestions proof ON proof.response_id=s.response_id AND proof.job_id=s.job_id AND proof.snapshot=jsonb_build_object('suggestion',to_jsonb(s),'capture_digest',private.buklod_quiz_review_capture_r19(r.id),'version',19)
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

-- Disable old class suggestion approval path; v2 remains client-disabled pending QA.
REVOKE ALL ON FUNCTION public.buklod_quiz_approve_section_suggestions_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
