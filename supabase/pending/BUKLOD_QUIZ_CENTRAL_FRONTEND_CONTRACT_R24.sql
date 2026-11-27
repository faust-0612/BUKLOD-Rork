-- R24: deployed R10 frontend contract compatibility, after R23.
-- DEV only; no historical reconstruction or production data changes.
CREATE OR REPLACE FUNCTION public.buklod_quiz_student_questions_v1(p_attempt_id uuid)
RETURNS TABLE(question_id uuid,question_type text,prompt text,options jsonb,points numeric,display_order integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE a public.buklod_quiz_attempts%ROWTYPE; n integer; total numeric;
BEGIN
 SELECT t.* INTO a FROM public.buklod_quiz_attempts t
 JOIN public.buklod_quiz_live_sessions s ON s.id=t.live_session_id AND s.exam_id=t.exam_id AND s.section_id=t.section_id
 JOIN public.buklod_quiz_sections sec ON sec.id=t.section_id AND sec.exam_id=t.exam_id AND sec.archived_at IS NULL
 JOIN public.profiles p ON p.id=t.student_user_id AND coalesce(p.is_active,true)
 JOIN public.buklod_quiz_live_members m ON m.session_id=s.id AND m.student_user_id=t.student_user_id AND m.status='ADMITTED'
 JOIN public.buklod_quiz_roster r ON r.exam_id=t.exam_id AND r.section_id=t.section_id AND r.student_user_id=t.student_user_id AND r.status='ACTIVE'
 WHERE t.id=p_attempt_id AND t.student_user_id=auth.uid() AND t.status='STARTED' AND s.status IN ('LIVE','PAUSED');
 IF NOT FOUND THEN RAISE EXCEPTION 'Active admitted attempt required' USING ERRCODE='42501'; END IF;
 SELECT count(*)::integer,coalesce(sum(aq.points),0) INTO n,total
 FROM public.buklod_quiz_attempt_questions aq WHERE aq.attempt_id=a.id;
 IF n<1 OR total IS DISTINCT FROM a.max_score OR n<>(SELECT count(*) FROM public.buklod_quiz_attempt_questions aq JOIN public.buklod_quiz_live_question_snapshots snap ON snap.session_id=a.live_session_id AND snap.question_id=aq.question_id WHERE aq.attempt_id=a.id)
 THEN RAISE EXCEPTION 'Verified question assignments unavailable; contact faculty'; END IF;
 RETURN QUERY SELECT aq.question_id,snap.question_type::text,snap.prompt::text,snap.options,aq.points,aq.display_order
 FROM public.buklod_quiz_attempt_questions aq
 JOIN public.buklod_quiz_live_question_snapshots snap ON snap.session_id=a.live_session_id AND snap.question_id=aq.question_id
 WHERE aq.attempt_id=a.id ORDER BY aq.display_order;
END;
$fn$;

-- R10 sends explicit faculty-entered/confirmed scores to v1.
-- Delegate to the already tested R19 individual approval; never seed historical assignments.
CREATE OR REPLACE FUNCTION public.buklod_quiz_approve_attempt_review_v1(p_attempt_id uuid,p_reviews jsonb)
RETURNS TABLE(status text,total_score numeric,max_score numeric,reviewed_count integer)
LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $fn$ SELECT * FROM public.buklod_quiz_approve_attempt_review_v2(p_attempt_id,p_reviews); $fn$;

-- Class manual approval is atomic and requires every pending item, within the owned section.
CREATE OR REPLACE FUNCTION public.buklod_quiz_approve_class_review_v1(p_exam_id uuid,p_section_id uuid,p_reviews jsonb)
RETURNS TABLE(approved_attempts integer,reviewed_items integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE actor uuid:=auth.uid(); expected integer; item_count integer; a_id uuid; n integer:=0; reviewed integer:=0; result record;
BEGIN
 IF actor IS NULL OR public.buklod_quiz_is_examiner(actor) IS DISTINCT FROM true OR NOT EXISTS(
 SELECT 1 FROM public.buklod_quiz_exams e JOIN public.buklod_quiz_sections s ON s.exam_id=e.id
 WHERE e.id=p_exam_id AND s.id=p_section_id AND e.owner_user_id=actor)
 THEN RAISE EXCEPTION 'Exam owner and examiner required' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_reviews) IS DISTINCT FROM 'array' OR pg_column_size(p_reviews)>2097152 THEN RAISE EXCEPTION 'Valid review array required'; END IF;
 PERFORM 1 FROM public.buklod_quiz_attempts a WHERE a.exam_id=p_exam_id AND a.section_id=p_section_id AND a.status='NEEDS_REVIEW' ORDER BY a.id FOR UPDATE;
 SELECT count(*)::integer INTO expected FROM public.buklod_quiz_attempts a JOIN public.buklod_quiz_responses r ON r.attempt_id=a.id
 WHERE a.exam_id=p_exam_id AND a.section_id=p_section_id AND a.status='NEEDS_REVIEW' AND r.needs_review IS TRUE AND r.manual_score IS NULL;
 IF jsonb_array_length(p_reviews)<>expected THEN RAISE EXCEPTION 'Class review changed; refresh before approval'; END IF;
 IF expected=0 THEN RETURN QUERY SELECT 0,0; RETURN; END IF;
 IF (SELECT count(DISTINCT (x->>'response_id')::uuid) FROM jsonb_array_elements(p_reviews) x)<>expected OR EXISTS(
 SELECT 1 FROM jsonb_array_elements(p_reviews) x WHERE NOT EXISTS(
 SELECT 1 FROM public.buklod_quiz_attempts a JOIN public.buklod_quiz_responses r ON r.attempt_id=a.id
 WHERE a.id=(x->>'attempt_id')::uuid AND r.id=(x->>'response_id')::uuid AND a.exam_id=p_exam_id AND a.section_id=p_section_id AND a.status='NEEDS_REVIEW' AND r.needs_review IS TRUE AND r.manual_score IS NULL))
 THEN RAISE EXCEPTION 'Duplicate or out-of-scope review item'; END IF;
 FOR a_id IN SELECT DISTINCT (x->>'attempt_id')::uuid FROM jsonb_array_elements(p_reviews) x ORDER BY 1 LOOP
   SELECT * INTO STRICT result FROM public.buklod_quiz_approve_attempt_review_v2(a_id,(SELECT jsonb_agg(x) FROM jsonb_array_elements(p_reviews) x WHERE (x->>'attempt_id')::uuid=a_id));
   IF result.status<>'GRADED' THEN RAISE EXCEPTION 'Class approval incomplete'; END IF;
   n:=n+1; reviewed:=reviewed+result.reviewed_count;
 END LOOP;
 IF reviewed<>expected THEN RAISE EXCEPTION 'Class approval count changed'; END IF;
 RETURN QUERY SELECT n,reviewed;
END;
$fn$;

-- Single manual review must not change a previously finalized grade.
CREATE OR REPLACE FUNCTION public.buklod_quiz_review_response_v1(p_response_id uuid,p_manual_score numeric,p_feedback text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE actor uuid:=auth.uid(); a_id uuid; cap numeric;
BEGIN
 IF actor IS NULL OR public.buklod_quiz_is_examiner(actor) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Examiner access required' USING ERRCODE='42501'; END IF;
 SELECT a.id INTO a_id FROM public.buklod_quiz_responses r JOIN public.buklod_quiz_attempts a ON a.id=r.attempt_id
 JOIN public.buklod_quiz_exams e ON e.id=a.exam_id WHERE r.id=p_response_id AND a.status='NEEDS_REVIEW' AND e.owner_user_id=actor FOR UPDATE OF a;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pending response unavailable' USING ERRCODE='42501'; END IF;
 SELECT q.points INTO cap FROM public.buklod_quiz_responses r CROSS JOIN LATERAL private.buklod_quiz_review_reference_r19(a_id) q
 WHERE r.id=p_response_id AND r.attempt_id=a_id AND r.question_id=q.id AND r.needs_review IS TRUE AND r.manual_score IS NULL AND q.immutable
 FOR UPDATE OF r;
 IF NOT FOUND OR p_manual_score IS NULL OR p_manual_score::text IN ('NaN','Infinity','-Infinity') OR p_manual_score<0 OR p_manual_score>cap THEN RAISE EXCEPTION 'Invalid score or missing verified reference'; END IF;
 UPDATE public.buklod_quiz_responses r SET manual_score=p_manual_score,feedback=nullif(btrim(left(coalesce(p_feedback,''),4000)),''),
 reviewed_by=actor,reviewed_at=now(),needs_review=false,updated_at=now() WHERE r.id=p_response_id;
 PERFORM public.buklod_quiz_compute_attempt_internal(a_id);
 RETURN true;
END;
$fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_student_questions_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_student_questions_v1(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_approve_attempt_review_v1(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_approve_attempt_review_v1(uuid,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_approve_class_review_v1(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_approve_class_review_v1(uuid,uuid,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_review_response_v1(uuid,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_review_response_v1(uuid,numeric,text) TO authenticated;
