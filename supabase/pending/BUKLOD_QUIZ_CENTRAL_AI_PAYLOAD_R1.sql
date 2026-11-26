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
