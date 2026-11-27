-- R25 DEV ONLY; preserve existing R24 grading guards and isolate incomplete historical evidence.
-- No data changes or reconstruction of historical keys. Do not enable before frontend QA.
CREATE FUNCTION private.buklod_quiz_has_frozen_review_r25(p_attempt_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO '' AS $fn$
 SELECT EXISTS(
 SELECT 1 FROM public.buklod_quiz_attempts a
 WHERE a.id=p_attempt_id AND a.status='NEEDS_REVIEW'
 AND EXISTS(SELECT 1 FROM public.buklod_quiz_attempt_questions aq WHERE aq.attempt_id=a.id)
 AND (SELECT sum(aq.points) FROM public.buklod_quiz_attempt_questions aq WHERE aq.attempt_id=a.id) IS NOT DISTINCT FROM a.max_score
 AND NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempt_questions aq WHERE aq.attempt_id=a.id AND NOT EXISTS(
 SELECT 1 FROM public.buklod_quiz_live_question_snapshots snap WHERE snap.session_id=a.live_session_id AND snap.question_id=aq.question_id))
 AND NOT EXISTS(SELECT 1 FROM public.buklod_quiz_responses r WHERE r.attempt_id=a.id AND r.needs_review IS TRUE AND r.manual_score IS NULL AND NOT EXISTS(
 SELECT 1 FROM private.buklod_quiz_review_reference_r19(a.id) q WHERE q.id=r.question_id AND q.immutable AND q.question_type IN ('SHORT_TEXT','ESSAY','ENUMERATION','MANUAL')))
 );
$fn$;
REVOKE ALL ON FUNCTION private.buklod_quiz_has_frozen_review_r25(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.buklod_quiz_class_review_queue_v1(p_exam_id uuid, p_section_id uuid)
 RETURNS TABLE(attempt_id uuid, response_id uuid, student_user_id uuid, display_name text, section_name text, question_id uuid, prompt text, question_type text, points numeric, answer_text text, manual_score numeric, feedback text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    a.id,
    rr.id,
    a.student_user_id,
    coalesce(
      public.buklod_quiz_profile_display_name_v1(a.student_user_id),
      nullif(trim(ro.display_name), ''),
      'BUKLOD Student'
    )::text,
    sx.name,
    q.id,
    q.prompt,
    q.question_type,
    q.points,
    rr.answer #>> '{}',
    rr.manual_score,
    rr.feedback
  from public.buklod_quiz_attempts a
  join public.buklod_quiz_responses rr on rr.attempt_id = a.id
  join lateral private.buklod_quiz_review_reference_r19(a.id) q on q.id=rr.question_id
  join public.buklod_quiz_roster ro
    on ro.exam_id = a.exam_id
   and ro.section_id = a.section_id
   and ro.student_user_id = a.student_user_id
  left join public.profiles p on p.id = a.student_user_id
  join public.buklod_quiz_sections sx
    on sx.id = a.section_id and sx.exam_id = a.exam_id
  join public.buklod_quiz_exams e on e.id = a.exam_id
  where a.exam_id = p_exam_id
    and a.section_id = p_section_id
    and e.owner_user_id = (select auth.uid())
    and public.buklod_quiz_is_examiner(auth.uid()) and rr.manual_score is null and rr.needs_review = true
    and a.status = 'NEEDS_REVIEW'
    and private.buklod_quiz_has_frozen_review_r25(a.id)
  order by
    lower(coalesce(nullif(trim(p.surname), ''), ro.surname, '')),
    lower(coalesce(nullif(trim(p.first_name), ''), ro.first_name, '')),
    lower(coalesce(public.buklod_quiz_profile_display_name_v1(a.student_user_id), ro.display_name, '')),
    a.attempt_no,
    q.sort_order
$function$;

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
 PERFORM 1 FROM public.buklod_quiz_attempts a WHERE a.exam_id=p_exam_id AND a.section_id=p_section_id AND a.status='NEEDS_REVIEW' AND private.buklod_quiz_has_frozen_review_r25(a.id) ORDER BY a.id FOR UPDATE;
 SELECT count(*)::integer INTO expected FROM public.buklod_quiz_attempts a JOIN public.buklod_quiz_responses r ON r.attempt_id=a.id
 WHERE a.exam_id=p_exam_id AND a.section_id=p_section_id AND a.status='NEEDS_REVIEW' AND private.buklod_quiz_has_frozen_review_r25(a.id) AND r.needs_review IS TRUE AND r.manual_score IS NULL;
 IF jsonb_array_length(p_reviews)<>expected THEN RAISE EXCEPTION 'Class review changed; refresh before approval'; END IF;
 IF expected=0 THEN RETURN QUERY SELECT 0,0; RETURN; END IF;
 IF (SELECT count(DISTINCT (x->>'response_id')::uuid) FROM jsonb_array_elements(p_reviews) x)<>expected OR EXISTS(
 SELECT 1 FROM jsonb_array_elements(p_reviews) x WHERE NOT EXISTS(
 SELECT 1 FROM public.buklod_quiz_attempts a JOIN public.buklod_quiz_responses r ON r.attempt_id=a.id
 WHERE a.id=(x->>'attempt_id')::uuid AND r.id=(x->>'response_id')::uuid AND a.exam_id=p_exam_id AND a.section_id=p_section_id AND a.status='NEEDS_REVIEW' AND private.buklod_quiz_has_frozen_review_r25(a.id) AND r.needs_review IS TRUE AND r.manual_score IS NULL))
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

CREATE FUNCTION public.buklod_quiz_historical_class_review_v1(p_exam_id uuid,p_section_id uuid)
RETURNS TABLE(attempt_id uuid,response_id uuid,display_name text,question_id uuid,assigned_order integer,assigned_points numeric,current_bank_prompt text,answer_text text,manual_eligible boolean,reason text,recorded_total numeric,recorded_max numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE actor uuid:=auth.uid();
BEGIN
 IF actor IS NULL OR public.buklod_quiz_is_examiner(actor) IS DISTINCT FROM true OR NOT EXISTS(
 SELECT 1 FROM public.buklod_quiz_exams e JOIN public.buklod_quiz_sections s ON s.exam_id=e.id
 WHERE e.id=p_exam_id AND s.id=p_section_id AND e.owner_user_id=actor)
 THEN RAISE EXCEPTION 'Exam owner and examiner required' USING ERRCODE='42501'; END IF;
 RETURN QUERY
 WITH historical AS MATERIALIZED (
 SELECT a.*,public.buklod_quiz_historical_review_readiness_v1(a.id) AS readiness
 FROM public.buklod_quiz_attempts a
 WHERE a.exam_id=p_exam_id AND a.section_id=p_section_id AND a.status='NEEDS_REVIEW'
 AND NOT private.buklod_quiz_has_frozen_review_r25(a.id)
 ), eligible AS MATERIALIZED (
 SELECT h.*,((h.readiness->>'manual_historical_review_eligible')::boolean IS TRUE AND NOT EXISTS(
 SELECT 1 FROM public.buklod_quiz_responses z WHERE z.attempt_id=h.id AND z.needs_review IS TRUE AND z.manual_score IS NULL AND coalesce(z.objective_score,0)<>0
 )) AS can_review FROM historical h
 )
 SELECT a.id,r.id,coalesce(public.buklod_quiz_profile_display_name_v1(a.student_user_id),nullif(ro.display_name,''),'BUKLOD Student')::text,
 r.question_id,aq.display_order,aq.points,q.prompt::text,
 CASE WHEN jsonb_typeof(r.answer)='string' THEN r.answer#>>'{}' ELSE coalesce(r.answer::text,'') END,
 a.can_review,
 CASE WHEN a.can_review THEN 'FACULTY_ORIGINAL_REFERENCE_CONFIRMATION_REQUIRED'
 WHEN (a.readiness->>'assigned_items')::integer=0 THEN 'ORIGINAL_ASSIGNMENT_EVIDENCE_REQUIRED'
 ELSE 'INCOMPLETE_OR_INCONSISTENT_HISTORICAL_REFERENCE' END,
 a.total_score,a.max_score
 FROM eligible a JOIN public.buklod_quiz_responses r ON r.attempt_id=a.id AND r.student_user_id=a.student_user_id
 LEFT JOIN public.buklod_quiz_attempt_questions aq ON aq.attempt_id=a.id AND aq.question_id=r.question_id
 LEFT JOIN public.buklod_quiz_questions q ON q.id=r.question_id AND q.exam_id=a.exam_id
 LEFT JOIN public.buklod_quiz_roster ro ON ro.exam_id=a.exam_id AND ro.section_id=a.section_id AND ro.student_user_id=a.student_user_id
 WHERE r.needs_review IS TRUE AND r.manual_score IS NULL
 ORDER BY a.id,aq.display_order NULLS LAST,r.id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_historical_class_review_v1(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_historical_class_review_v1(uuid,uuid) TO authenticated;
-- R22 performs the atomic confirmed manual review without regenerating the original objective score.
-- This grant is intended for the tested R25 release only; never apply independently.
GRANT EXECUTE ON FUNCTION public.buklod_quiz_approve_historical_review_v1(uuid,jsonb,boolean) TO authenticated;
