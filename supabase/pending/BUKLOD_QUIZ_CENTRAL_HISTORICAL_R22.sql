-- R22 DEV candidate. Existing assignments were reconciled read-only:
-- 318 attempts / 29,850 rows; identical IDs, order and assigned points.
-- No historical backfill from mutable question content. No production writes.
-- This path is deliberately not client-enabled before QA and explicit UI confirmation.
CREATE FUNCTION public.buklod_quiz_historical_review_readiness_v1(p_attempt_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE a public.buklod_quiz_attempts%ROWTYPE; actor uuid:=auth.uid();
 n integer; assigned_total numeric; pending integer; unmatched integer; frozen integer;
 obj numeric; man numeric; deduction numeric; consistent boolean;
BEGIN
 IF actor IS NULL OR public.buklod_quiz_is_examiner(actor) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Examiner required' USING ERRCODE='42501'; END IF;
 SELECT t.* INTO a FROM public.buklod_quiz_attempts t JOIN public.buklod_quiz_exams e ON e.id=t.exam_id WHERE t.id=p_attempt_id AND e.owner_user_id=actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'Attempt unavailable' USING ERRCODE='42501'; END IF;
 SELECT count(*)::integer,coalesce(sum(q.points),0) INTO n,assigned_total FROM public.buklod_quiz_attempt_questions q WHERE q.attempt_id=a.id;
 SELECT count(*)::integer INTO frozen FROM public.buklod_quiz_attempt_questions q JOIN public.buklod_quiz_live_question_snapshots s ON s.session_id=a.live_session_id AND s.question_id=q.question_id WHERE q.attempt_id=a.id;
 SELECT count(*) FILTER(WHERE r.needs_review IS TRUE AND r.manual_score IS NULL)::integer,
 count(*) FILTER(WHERE q.question_id IS NULL)::integer,
 coalesce(sum(CASE WHEN r.manual_score IS NULL THEN coalesce(r.objective_score,0) ELSE 0 END),0),coalesce(sum(r.manual_score),0)
 INTO pending,unmatched,obj,man FROM public.buklod_quiz_responses r LEFT JOIN public.buklod_quiz_attempt_questions q ON q.attempt_id=r.attempt_id AND q.question_id=r.question_id WHERE r.attempt_id=a.id;
 SELECT coalesce(sum(d.deduction_points),0) INTO deduction FROM public.buklod_quiz_integrity_deductions d WHERE d.attempt_id=a.id;
 consistent:=obj IS NOT DISTINCT FROM a.objective_score AND man IS NOT DISTINCT FROM a.manual_score AND greatest(0,obj+man-deduction) IS NOT DISTINCT FROM a.total_score;
 RETURN jsonb_build_object('status',a.status,'assigned_items',n,'frozen_items',frozen,'pending_items',pending,
 'assigned_points_match',n>0 AND assigned_total IS NOT DISTINCT FROM a.max_score,'unassigned_response_count',unmatched,'recorded_scores_consistent',consistent,
 'manual_historical_review_eligible',a.status='NEEDS_REVIEW' AND n>0 AND frozen=0 AND pending>0 AND unmatched=0 AND assigned_total IS NOT DISTINCT FROM a.max_score AND consistent,
 'automatic_reference_verified',n>0 AND frozen=n,'reference_notice','Historical question content must be independently confirmed by faculty; do not reconstruct answer keys from current question bank.');
END;
$fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_historical_review_readiness_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_historical_review_readiness_v1(uuid) TO authenticated;

CREATE FUNCTION public.buklod_quiz_approve_historical_review_v1(p_attempt_id uuid,p_reviews jsonb,p_reference_confirmed boolean)
RETURNS TABLE(status text,total_score numeric,max_score numeric,reviewed_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE a public.buklod_quiz_attempts%ROWTYPE; actor uuid:=auth.uid(); ready jsonb; item jsonb; rid uuid; score numeric; cap numeric; n integer; manual_total numeric; deduction numeric; final_total numeric;
BEGIN
 IF actor IS NULL OR public.buklod_quiz_is_examiner(actor) IS DISTINCT FROM true OR p_reference_confirmed IS DISTINCT FROM true THEN RAISE EXCEPTION 'Explicit faculty confirmation of original reference required'; END IF;
 SELECT t.* INTO a FROM public.buklod_quiz_attempts t JOIN public.buklod_quiz_exams e ON e.id=t.exam_id WHERE t.id=p_attempt_id AND e.owner_user_id=actor FOR UPDATE OF t;
 IF NOT FOUND THEN RAISE EXCEPTION 'Attempt unavailable' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.buklod_quiz_responses r WHERE r.attempt_id=a.id ORDER BY r.id FOR UPDATE;
 PERFORM 1 FROM public.buklod_quiz_attempt_questions q WHERE q.attempt_id=a.id ORDER BY q.question_id FOR SHARE;
 ready:=public.buklod_quiz_historical_review_readiness_v1(a.id);
 IF (ready->>'manual_historical_review_eligible')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'Historical attempt requires separate evidence review'; END IF;
 n:=(ready->>'pending_items')::integer;
 IF jsonb_typeof(p_reviews) IS DISTINCT FROM 'array' OR pg_column_size(p_reviews)>2097152 OR jsonb_array_length(p_reviews)<>n THEN RAISE EXCEPTION 'Complete review required'; END IF;
 IF (SELECT count(DISTINCT (x->>'response_id')::uuid) FROM jsonb_array_elements(p_reviews) x)<>n THEN RAISE EXCEPTION 'Duplicate or missing response ID'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_reviews) LOOP
   rid:=(item->>'response_id')::uuid; score:=(item->>'score')::numeric;
   SELECT q.points INTO cap FROM public.buklod_quiz_responses r JOIN public.buklod_quiz_attempt_questions q ON q.attempt_id=r.attempt_id AND q.question_id=r.question_id
   WHERE r.id=rid AND r.attempt_id=a.id AND r.needs_review IS TRUE AND r.manual_score IS NULL AND r.student_user_id=a.student_user_id;
   IF NOT FOUND OR score IS NULL OR score::text IN ('NaN','Infinity','-Infinity') OR score<0 OR score>cap THEN RAISE EXCEPTION 'Invalid historical review score or response'; END IF;
   -- Do not replace an existing objective award with a manual award implicitly.
   IF EXISTS(SELECT 1 FROM public.buklod_quiz_responses r WHERE r.id=rid AND coalesce(r.objective_score,0)<>0) THEN RAISE EXCEPTION 'Existing objective award requires separate review'; END IF;
   UPDATE public.buklod_quiz_responses r SET manual_score=score,feedback=nullif(btrim(left(coalesce(item->>'feedback',''),4000)),''),
   reviewed_by=actor,reviewed_at=now(),needs_review=false,is_correct=CASE WHEN score=cap AND cap>0 THEN true WHEN score=0 THEN false ELSE null END,updated_at=now()
   WHERE r.id=rid AND r.attempt_id=a.id;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.buklod_quiz_responses r WHERE r.attempt_id=a.id AND r.needs_review IS TRUE AND r.manual_score IS NULL) THEN RAISE EXCEPTION 'Pending review remains'; END IF;
 SELECT coalesce(sum(r.manual_score),0) INTO manual_total FROM public.buklod_quiz_responses r WHERE r.attempt_id=a.id;
 SELECT coalesce(sum(d.deduction_points),0) INTO deduction FROM public.buklod_quiz_integrity_deductions d WHERE d.attempt_id=a.id;
 final_total:=greatest(0,a.objective_score+manual_total-deduction);
 IF final_total IS NULL OR final_total>a.max_score OR final_total::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Historical grade outside bounds'; END IF;
 UPDATE public.buklod_quiz_attempts t SET manual_score=manual_total,total_score=final_total,status='GRADED',updated_at=now() WHERE t.id=a.id AND t.status='NEEDS_REVIEW';
 IF NOT FOUND THEN RAISE EXCEPTION 'Attempt changed'; END IF;
 INSERT INTO public.buklod_quiz_audit_log(exam_id,section_id,live_session_id,attempt_id,actor_user_id,action,details)
 VALUES(a.exam_id,a.section_id,a.live_session_id,a.id,actor,'HISTORICAL_MANUAL_REVIEW_CONFIRMED',
 jsonb_build_object('reviewed_count',n,'original_objective_score',a.objective_score,'original_max_score',a.max_score,'previous_total',a.total_score,'new_total',final_total,'reference_confirmed_by_faculty',true));
 RETURN QUERY SELECT t.status,t.total_score,t.max_score,n FROM public.buklod_quiz_attempts t WHERE t.id=a.id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_approve_historical_review_v1(uuid,jsonb,boolean) FROM PUBLIC,anon,authenticated;
-- No automatic approvals, no grants until runtime and UI QA.
