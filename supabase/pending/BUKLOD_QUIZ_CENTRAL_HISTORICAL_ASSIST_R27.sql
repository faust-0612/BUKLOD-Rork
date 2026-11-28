-- R27: faculty-confirmed original-reference AI suggestions and atomic historical bulk approval.
-- Current bank is a candidate reference ONLY, never automatically authoritative.
CREATE FUNCTION public.buklod_quiz_historical_class_review_v2(p_exam_id uuid,p_section_id uuid)
RETURNS TABLE(attempt_id uuid,response_id uuid,display_name text,question_id uuid,assigned_order integer,assigned_points numeric,current_bank_prompt text,answer_text text,manual_eligible boolean,reason text,recorded_total numeric,recorded_max numeric,reference jsonb,reference_digest text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
 WITH rows AS MATERIALIZED (
  SELECT x.*, CASE WHEN x.manual_eligible AND x.assigned_points IS NOT NULL AND x.assigned_points>=0
   AND x.assigned_points::text NOT IN ('NaN','Infinity','-Infinity')
   AND upper(q.question_type) IN ('SHORT_TEXT','ESSAY','ENUMERATION','MANUAL')
   AND nullif(btrim(q.prompt),'') IS NOT NULL
   AND (coalesce(nullif(btrim(q.correct_answer#>>'{}'),''),'null') NOT IN ('null','{}','[]')
    OR nullif(btrim(q.explanation),'') IS NOT NULL
    OR coalesce(nullif(btrim(q.rubric::text),''),'null') NOT IN ('null','{}','[]','""'))
   THEN jsonb_build_object('response_id',x.response_id,'question_type',q.question_type,'question',q.prompt,'max_points',x.assigned_points,
    'student_answer',x.answer_text,'correct_answer',q.correct_answer#>>'{}','explanation',q.explanation,'rubric',q.rubric::text)
   ELSE NULL END AS ref
  FROM public.buklod_quiz_historical_class_review_v1(p_exam_id,p_section_id) x
  LEFT JOIN public.buklod_quiz_questions q ON q.id=x.question_id AND q.exam_id=p_exam_id
 ), captured AS (
  SELECT x.*,CASE WHEN x.ref IS NOT NULL THEN encode(sha256(convert_to(jsonb_build_array(x.attempt_id,x.question_id,x.ref)::text,'UTF8')),'hex') END AS capture
  FROM rows x
 ), digests AS (
  SELECT x.attempt_id,CASE WHEN count(*)=count(x.capture) THEN encode(sha256(convert_to(string_agg(x.capture,'' ORDER BY x.response_id),'UTF8')),'hex') END AS digest
  FROM captured x GROUP BY x.attempt_id
 )
 SELECT x.attempt_id,x.response_id,x.display_name,x.question_id,x.assigned_order,x.assigned_points,x.current_bank_prompt,x.answer_text,x.manual_eligible,x.reason,x.recorded_total,x.recorded_max,
 CASE WHEN x.ref IS NOT NULL THEN x.ref||jsonb_build_object('capture_digest',x.capture) END,d.digest
 FROM captured x JOIN digests d ON d.attempt_id=x.attempt_id ORDER BY x.attempt_id,x.assigned_order NULLS LAST,x.response_id;
$fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_historical_class_review_v2(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_historical_class_review_v2(uuid,uuid) TO authenticated;

CREATE FUNCTION public.buklod_quiz_historical_ai_payload_v1(p_attempt_id uuid,p_reference_digest text,p_reference_confirmed boolean)
RETURNS TABLE(response_id uuid,question_type text,question text,max_points numeric,student_answer text,correct_answer text,explanation text,rubric text,capture_digest text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE a public.buklod_quiz_attempts%ROWTYPE; actor uuid:=auth.uid();
BEGIN
 IF actor IS NULL OR public.buklod_quiz_is_examiner(actor) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Examiner required' USING ERRCODE='42501'; END IF;
 IF p_reference_confirmed IS DISTINCT FROM true OR p_reference_digest IS NULL OR p_reference_digest !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Confirm the exact original grading reference before AI checking'; END IF;
 SELECT t.* INTO a FROM public.buklod_quiz_attempts t JOIN public.buklod_quiz_exams e ON e.id=t.exam_id WHERE t.id=p_attempt_id AND t.status='NEEDS_REVIEW' AND e.owner_user_id=actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pending attempt unavailable or unauthorized' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT x.response_id,x.reference->>'question_type',x.reference->>'question',x.assigned_points,x.answer_text,x.reference->>'correct_answer',x.reference->>'explanation',x.reference->>'rubric',x.reference->>'capture_digest'
 FROM public.buklod_quiz_historical_class_review_v2(a.exam_id,a.section_id) x
 WHERE x.attempt_id=a.id AND x.manual_eligible AND x.reference_digest=p_reference_digest AND x.reference IS NOT NULL ORDER BY x.assigned_order,x.response_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Original reference missing, changed, or incomplete. Refresh and verify the original evidence.'; END IF;
END;
$fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_historical_ai_payload_v1(uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_historical_ai_payload_v1(uuid,text,boolean) TO authenticated;

CREATE FUNCTION public.buklod_quiz_approve_historical_class_v1(p_exam_id uuid,p_section_id uuid,p_attempts jsonb,p_reference_confirmed boolean)
RETURNS TABLE(approved_attempts integer,reviewed_items integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE actor uuid:=auth.uid(); item jsonb; aid uuid; digest text; n integer; total integer:=0; result record;
BEGIN
 IF actor IS NULL OR public.buklod_quiz_is_examiner(actor) IS DISTINCT FROM true OR NOT EXISTS(
 SELECT 1 FROM public.buklod_quiz_exams e JOIN public.buklod_quiz_sections s ON s.exam_id=e.id
 WHERE e.id=p_exam_id AND s.id=p_section_id AND e.owner_user_id=actor)
 THEN RAISE EXCEPTION 'Exam owner and examiner required' USING ERRCODE='42501'; END IF;
 IF p_reference_confirmed IS DISTINCT FROM true THEN RAISE EXCEPTION 'Explicit faculty confirmation of original reference required'; END IF;
 IF jsonb_typeof(p_attempts) IS DISTINCT FROM 'array' OR pg_column_size(p_attempts)>2097152 THEN RAISE EXCEPTION 'Invalid bulk review payload'; END IF;
 n:=jsonb_array_length(p_attempts);
 IF n<1 OR n>100 OR (SELECT count(DISTINCT (x->>'attempt_id')::uuid) FROM jsonb_array_elements(p_attempts) x)<>n THEN RAISE EXCEPTION 'Select 1 to 100 distinct complete attempts'; END IF;
 -- Stable attempt lock order; all grades commit or none do.
 FOR aid IN SELECT (x->>'attempt_id')::uuid FROM jsonb_array_elements(p_attempts) x ORDER BY 1 LOOP
  PERFORM 1 FROM public.buklod_quiz_attempts a WHERE a.id=aid AND a.exam_id=p_exam_id AND a.section_id=p_section_id AND a.status='NEEDS_REVIEW' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Attempt is no longer pending in this class'; END IF;
 END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(p_attempts) ORDER BY (value->>'attempt_id')::uuid LOOP
  aid:=(item->>'attempt_id')::uuid; digest:=nullif(item->>'reference_digest','');
  IF digest IS NOT NULL THEN
   PERFORM 1 FROM public.buklod_quiz_questions q WHERE q.exam_id=p_exam_id AND EXISTS(SELECT 1 FROM public.buklod_quiz_responses r WHERE r.attempt_id=aid AND r.question_id=q.id AND r.needs_review AND r.manual_score IS NULL) ORDER BY q.id FOR SHARE;
   PERFORM 1 FROM public.buklod_quiz_historical_ai_payload_v1(aid,digest,true);
  END IF;
  SELECT * INTO STRICT result FROM public.buklod_quiz_approve_historical_review_v1(aid,item->'reviews',true);
  IF result.status<>'GRADED' THEN RAISE EXCEPTION 'Review did not finalize'; END IF;
  total:=total+result.reviewed_count;
 END LOOP;
 RETURN QUERY SELECT n,total;
END;
$fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_approve_historical_class_v1(uuid,uuid,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_approve_historical_class_v1(uuid,uuid,jsonb,boolean) TO authenticated;
