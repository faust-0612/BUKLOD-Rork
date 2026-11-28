-- R26 DEV. Read-only full attempt evidence; explicit atomic faculty correction.
-- Never seed historical assignments or grade from mutable question-bank answers.
CREATE OR REPLACE FUNCTION public.buklod_quiz_attempt_full_review_v2(p_attempt_id uuid)
 RETURNS TABLE(attempt_id uuid, exam_id uuid, exam_title text, section_id uuid, section_name text, student_user_id uuid, display_name text, attempt_no integer, attempt_status text, started_at timestamp with time zone, submitted_at timestamp with time zone, released_at timestamp with time zone, total_score numeric, max_score numeric, integrity_violation_count integer, response_id uuid, question_id uuid, question_no integer, question_type text, prompt text, options jsonb, answer_text text, correct_answer_text text, points numeric, objective_score numeric, manual_score numeric, awarded_score numeric, is_correct boolean, needs_review boolean, feedback text, explanation text, source_pages text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $fn$
DECLARE actor uuid:=auth.uid();
BEGIN
 IF actor IS NULL OR public.buklod_quiz_is_examiner(actor) IS DISTINCT FROM true OR NOT EXISTS(
  SELECT 1 FROM public.buklod_quiz_attempts t JOIN public.buklod_quiz_exams e ON e.id=t.exam_id
  WHERE t.id=p_attempt_id AND e.owner_user_id=actor
 ) THEN RAISE EXCEPTION 'Attempt unavailable or unauthorized' USING ERRCODE='42501'; END IF;
 RETURN QUERY
 WITH refs AS (
  SELECT aq.question_id,aq.display_order,aq.points FROM public.buklod_quiz_attempt_questions aq WHERE aq.attempt_id=p_attempt_id
  UNION ALL
  SELECT rr.question_id,NULL::integer,NULL::numeric FROM public.buklod_quiz_responses rr
   JOIN public.buklod_quiz_attempts t ON t.id=rr.attempt_id AND t.student_user_id=rr.student_user_id
   WHERE rr.attempt_id=p_attempt_id AND NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempt_questions aq WHERE aq.attempt_id=rr.attempt_id AND aq.question_id=rr.question_id)
 )
 SELECT a.id,a.exam_id,e.title::text,a.section_id,s.name::text,a.student_user_id,
  coalesce(public.buklod_quiz_profile_display_name_v1(a.student_user_id),nullif(rst.display_name,''),'BUKLOD Student')::text,
  a.attempt_no,a.status::text,a.started_at,a.submitted_at,a.released_at,a.total_score,a.max_score,
  coalesce(a.integrity_violation_count,0)::integer,rr.id,k.question_id,
  row_number() over(order by k.display_order NULLS LAST,k.question_id)::integer,
  coalesce(snap.question_type,q.question_type,'UNKNOWN')::text,
  CASE WHEN snap.question_id IS NOT NULL THEN snap.prompt ELSE
   '[Historical reference not frozen; current question-bank text only] '||coalesce(q.prompt,'Original text unavailable') END::text,
  snap.options,
  CASE WHEN rr.answer IS NULL THEN '' WHEN jsonb_typeof(rr.answer)='string' THEN rr.answer#>>'{}' ELSE rr.answer::text END::text,
  CASE WHEN snap.question_id IS NULL OR snap.correct_answer IS NULL THEN '' WHEN jsonb_typeof(snap.correct_answer)='string' THEN snap.correct_answer#>>'{}' ELSE snap.correct_answer::text END::text,
  k.points,rr.objective_score,rr.manual_score,coalesce(rr.manual_score,rr.objective_score,0)::numeric,rr.is_correct,coalesce(rr.needs_review,false),rr.feedback::text,snap.explanation::text,snap.source_pages::text
 FROM public.buklod_quiz_attempts a
 JOIN public.buklod_quiz_exams e ON e.id=a.exam_id
 JOIN public.buklod_quiz_sections s ON s.id=a.section_id AND s.exam_id=a.exam_id
 CROSS JOIN refs k
 LEFT JOIN public.buklod_quiz_questions q ON q.id=k.question_id AND q.exam_id=a.exam_id
 LEFT JOIN public.buklod_quiz_live_question_snapshots snap ON snap.session_id=a.live_session_id AND snap.question_id=k.question_id AND k.display_order IS NOT NULL
 LEFT JOIN public.buklod_quiz_responses rr ON rr.attempt_id=a.id AND rr.question_id=k.question_id AND rr.student_user_id=a.student_user_id
 LEFT JOIN public.buklod_quiz_roster rst ON rst.exam_id=a.exam_id AND rst.section_id=a.section_id AND rst.student_user_id=a.student_user_id
 WHERE a.id=p_attempt_id ORDER BY k.display_order NULLS LAST,k.question_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_attempt_full_review_v1(p_attempt_id uuid)
 RETURNS TABLE(attempt_id uuid, exam_id uuid, exam_title text, section_id uuid, section_name text, student_user_id uuid, display_name text, attempt_no integer, attempt_status text, started_at timestamp with time zone, submitted_at timestamp with time zone, released_at timestamp with time zone, total_score numeric, max_score numeric, integrity_violation_count integer, question_id uuid, question_no integer, question_type text, prompt text, options jsonb, answer_text text, correct_answer_text text, points numeric, objective_score numeric, manual_score numeric, awarded_score numeric, is_correct boolean, needs_review boolean, feedback text, explanation text, source_pages text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $fn$
 SELECT x.attempt_id,x.exam_id,x.exam_title,x.section_id,x.section_name,x.student_user_id,x.display_name,x.attempt_no,x.attempt_status,x.started_at,x.submitted_at,x.released_at,x.total_score,x.max_score,x.integrity_violation_count,x.question_id,x.question_no,x.question_type,x.prompt,x.options,x.answer_text,x.correct_answer_text,x.points,x.objective_score,x.manual_score,x.awarded_score,x.is_correct,x.needs_review,x.feedback,x.explanation,x.source_pages
 FROM public.buklod_quiz_attempt_full_review_v2(p_attempt_id) x ORDER BY x.question_no;
$fn$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_attempt_faculty_analysis_v1(p_attempt_id uuid)
 RETURNS TABLE(attempt_id uuid, display_name text, attempt_status text, total_questions integer, answered_count integer, unanswered_count integer, correct_count integer, incorrect_count integer, partial_credit_count integer, manual_pending_count integer, earned_score numeric, max_score numeric, score_percent numeric, question_type_breakdown jsonb, cheating_risk_pct integer, cheating_risk_level text, leakage_risk_pct integer, leakage_risk_level text, confidence_pct integer, integrity_incident_count integer, strong_signal_count integer, performance_summary text, integrity_summary text, analysis_notice text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_actor uuid:=(select auth.uid()); v_owner uuid;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_quiz_is_examiner(v_actor) then raise exception 'Examiner access required.'; end if;
  select e.owner_user_id into v_owner
  from public.buklod_quiz_attempts a join public.buklod_quiz_exams e on e.id=a.exam_id
  where a.id=p_attempt_id;
  if v_owner is null then raise exception 'Attempt not found.'; end if;
  if v_owner<>v_actor then raise exception 'Exam owner access required.'; end if;

  return query
  with target as(
    select a.*,
      coalesce(public.buklod_quiz_profile_display_name_v1(a.student_user_id),'BUKLOD Student')::text as student_name
    from public.buklod_quiz_attempts a where a.id=p_attempt_id
  ), per_question as(
    SELECT x.question_type,x.points,x.answer_text AS answer,x.objective_score,x.manual_score,x.is_correct,
      x.awarded_score AS awarded,(x.needs_review AND x.manual_score IS NULL) AS manual_pending,
      (nullif(btrim(x.answer_text),'') IS NOT NULL AND x.answer_text NOT IN ('null','[]','{}')) AS answered
    FROM public.buklod_quiz_attempt_full_review_v2(p_attempt_id) x
  ), totals as(
    select count(*)::int total_questions,
      count(*) filter(where answered)::int answered_count,
      count(*) filter(where not answered)::int unanswered_count,
      count(*) filter(where is_correct is true)::int correct_count,
      count(*) filter(where is_correct is false)::int incorrect_count,
      count(*) filter(where awarded>0 and awarded<points)::int partial_credit_count,
      count(*) filter(where manual_pending)::int manual_pending_count,
      coalesce(sum(awarded),0)::numeric earned_score,coalesce(sum(points),0)::numeric max_score
    from per_question
  ), by_type as(
    select coalesce(jsonb_object_agg(question_type,obj),'{}'::jsonb) breakdown
    from(
      select question_type,jsonb_build_object(
        'questions',count(*),'answered',count(*) filter(where answered),
        'correct',count(*) filter(where is_correct is true),
        'incorrect',count(*) filter(where is_correct is false),
        'manual_pending',count(*) filter(where manual_pending),
        'earned',coalesce(sum(awarded),0),'possible',coalesce(sum(points),0)
      ) obj
      from per_question group by question_type
    ) x
  ), integrity as(select * from public.buklod_quiz_integrity_metrics_v1(p_attempt_id))
  select t.id,t.student_name,t.status::text,z.total_questions,z.answered_count,z.unanswered_count,
    z.correct_count,z.incorrect_count,z.partial_credit_count,z.manual_pending_count,
    t.total_score,t.max_score,
    case when t.max_score>0 then public.buklod_quiz_transmuted_percent_v1(t.total_score,t.max_score) else null end,
    b.breakdown,i.cheating_risk_pct,
    case when i.cheating_risk_pct>=75 then 'CRITICAL' when i.cheating_risk_pct>=50 then 'HIGH' when i.cheating_risk_pct>=25 then 'MODERATE' else 'LOW' end,
    i.leakage_risk_pct,
    case when i.leakage_risk_pct>=75 then 'CRITICAL' when i.leakage_risk_pct>=50 then 'HIGH' when i.leakage_risk_pct>=25 then 'MODERATE' else 'LOW' end,
    i.confidence_pct,
    (i.departure_incidents+i.copy_attempts+i.screen_capture_signals+i.devtools_attempts+i.context_menu_attempts)::int,
    (i.copy_attempts+i.screen_capture_signals+i.devtools_attempts)::int,
    format('Recorded result %s/%s. %s of %s available question records answered; %s pending manual review. Historical question coverage may be incomplete.',t.total_score,t.max_score,z.answered_count,z.total_questions,z.manual_pending_count)::text,
    case
      when i.raw_integrity_signals=0 then 'No supported integrity signal was recorded. This does not prove that no misconduct occurred.'
      when (i.copy_attempts+i.screen_capture_signals+i.devtools_attempts)=0 then 'Focus-loss or exam-away behavior may be present, but no direct copy, screenshot/screen-capture, or developer-tools signal was recorded. Review the timeline before making an academic decision.'
      else 'One or more stronger integrity signals were recorded. Review the exact timeline and the student answers before making an academic decision.'
    end::text,
    'Question counts use preserved assignment/response records, not the current question bank. Missing historical questions are not reconstructed. Integrity risk is not proof of cheating; release remains a manual faculty decision.'::text
  from target t cross join totals z cross join by_type b cross join integrity i;
end $function$;

CREATE FUNCTION public.buklod_quiz_override_response_score_v2(p_response_id uuid,p_score numeric,p_feedback text,p_original_confirmed boolean,p_released_confirmed boolean)
RETURNS TABLE(attempt_id uuid,attempt_status text,total_score numeric,max_score numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE actor uuid:=auth.uid(); a public.buklod_quiz_attempts%ROWTYPE; r public.buklod_quiz_responses%ROWTYPE;
 aid uuid; cap numeric; assigned numeric; obj numeric; man numeric; ded numeric; final numeric; new_status text; pending boolean;
 old_award numeric; old_total numeric; old_status text; old_max numeric; old_released_at timestamptz; frozen boolean;
BEGIN
 IF actor IS NULL OR public.buklod_quiz_is_examiner(actor) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Examiner required' USING ERRCODE='42501'; END IF;
 SELECT x.attempt_id INTO aid FROM public.buklod_quiz_responses x WHERE x.id=p_response_id;
 SELECT t.* INTO a FROM public.buklod_quiz_attempts t JOIN public.buklod_quiz_exams e ON e.id=t.exam_id
 WHERE t.id=aid AND e.owner_user_id=actor FOR UPDATE OF t;
 IF NOT FOUND THEN RAISE EXCEPTION 'Attempt unavailable or unauthorized' USING ERRCODE='42501'; END IF;
 IF a.status NOT IN ('NEEDS_REVIEW','GRADED','RELEASED') THEN RAISE EXCEPTION 'Score correction requires a submitted attempt'; END IF;
 IF a.status='RELEASED' AND p_released_confirmed IS DISTINCT FROM true THEN RAISE EXCEPTION 'Explicit released result correction confirmation required'; END IF;
 PERFORM 1 FROM public.buklod_quiz_responses x WHERE x.attempt_id=a.id ORDER BY x.id FOR UPDATE;
 PERFORM 1 FROM public.buklod_quiz_attempt_questions x WHERE x.attempt_id=a.id ORDER BY x.question_id FOR SHARE;
 PERFORM 1 FROM public.buklod_quiz_integrity_deductions x WHERE x.attempt_id=a.id ORDER BY x.id FOR SHARE;
 SELECT x.* INTO r FROM public.buklod_quiz_responses x WHERE x.id=p_response_id AND x.attempt_id=a.id AND x.student_user_id=a.student_user_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Response unavailable or unauthorized' USING ERRCODE='42501'; END IF;
 SELECT sum(x.points) INTO assigned FROM public.buklod_quiz_attempt_questions x WHERE x.attempt_id=a.id;
 SELECT x.points INTO cap FROM public.buklod_quiz_attempt_questions x WHERE x.attempt_id=a.id AND x.question_id=r.question_id;
 IF cap IS NULL OR assigned IS NULL OR assigned IS DISTINCT FROM a.max_score OR cap<0 OR cap::text IN ('NaN','Infinity','-Infinity') OR a.max_score<=0 OR a.max_score::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Verified original assignment required'; END IF;
 IF EXISTS(SELECT 1 FROM public.buklod_quiz_attempt_questions x WHERE x.attempt_id=a.id AND (x.points<0 OR x.points::text IN ('NaN','Infinity','-Infinity'))) THEN RAISE EXCEPTION 'Invalid original assignment points'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.buklod_quiz_live_question_snapshots x WHERE x.session_id=a.live_session_id AND x.question_id=r.question_id) INTO frozen;
 IF NOT frozen AND p_original_confirmed IS DISTINCT FROM true THEN RAISE EXCEPTION 'Faculty must confirm the original question reference'; END IF;
 IF p_score IS NULL OR p_score::text IN ('NaN','Infinity','-Infinity') OR p_score<0 OR p_score>cap THEN RAISE EXCEPTION 'Score must be from 0 to %',cap; END IF;
 IF EXISTS(SELECT 1 FROM public.buklod_quiz_responses x LEFT JOIN public.buklod_quiz_attempt_questions k ON k.attempt_id=x.attempt_id AND k.question_id=x.question_id
 WHERE x.attempt_id=a.id AND (x.student_user_id IS DISTINCT FROM a.student_user_id OR k.question_id IS NULL OR
 coalesce(x.manual_score,x.objective_score,0)<0 OR coalesce(x.manual_score,x.objective_score,0)>k.points OR
 coalesce(x.manual_score,x.objective_score,0)::text IN ('NaN','Infinity','-Infinity'))) THEN RAISE EXCEPTION 'Recorded responses require separate evidence review'; END IF;
 SELECT coalesce(sum(CASE WHEN x.manual_score IS NULL THEN coalesce(x.objective_score,0) ELSE 0 END),0),coalesce(sum(x.manual_score),0),
 coalesce(bool_or(x.needs_review IS TRUE AND x.manual_score IS NULL),false) INTO obj,man,pending
 FROM public.buklod_quiz_responses x WHERE x.attempt_id=a.id;
 SELECT coalesce(sum(x.deduction_points),0) INTO ded FROM public.buklod_quiz_integrity_deductions x WHERE x.attempt_id=a.id;
 IF ded<0 OR ded::text IN ('NaN','Infinity','-Infinity') OR obj IS DISTINCT FROM a.objective_score OR man IS DISTINCT FROM a.manual_score OR greatest(0,obj+man-ded) IS DISTINCT FROM a.total_score OR a.total_score<0 OR a.total_score>a.max_score OR (a.status IN ('GRADED','RELEASED') AND pending) THEN RAISE EXCEPTION 'Recorded scores are inconsistent; preserve result and review original evidence'; END IF;
 old_award:=coalesce(r.manual_score,r.objective_score,0); old_total:=a.total_score; old_status:=a.status; old_max:=a.max_score; old_released_at:=a.released_at;
 UPDATE public.buklod_quiz_responses x SET manual_score=p_score,objective_score=0,
 is_correct=CASE WHEN p_score=cap AND cap>0 THEN true WHEN p_score=0 THEN false ELSE null END,
 needs_review=false,feedback=nullif(btrim(left(coalesce(p_feedback,''),4000)),''),reviewed_by=actor,reviewed_at=now(),updated_at=now()
 WHERE x.id=r.id AND x.attempt_id=a.id;
 SELECT coalesce(sum(CASE WHEN x.manual_score IS NULL THEN coalesce(x.objective_score,0) ELSE 0 END),0),coalesce(sum(x.manual_score),0),
 coalesce(bool_or(x.needs_review IS TRUE AND x.manual_score IS NULL),false) INTO obj,man,pending
 FROM public.buklod_quiz_responses x WHERE x.attempt_id=a.id;
 final:=greatest(0,obj+man-ded);
 IF final IS NULL OR final::text IN ('NaN','Infinity','-Infinity') OR final>old_max THEN RAISE EXCEPTION 'Corrected total outside original maximum'; END IF;
 new_status:=CASE WHEN old_status='RELEASED' THEN 'RELEASED' WHEN pending THEN 'NEEDS_REVIEW' ELSE 'GRADED' END;
 UPDATE public.buklod_quiz_attempts t SET objective_score=obj,manual_score=man,total_score=final,status=new_status,updated_at=now() WHERE t.id=a.id;
 IF NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempts t WHERE t.id=a.id AND t.total_score=final AND t.max_score=old_max AND t.status=new_status AND t.released_at IS NOT DISTINCT FROM old_released_at) THEN RAISE EXCEPTION 'Correction would alter original result identity or maximum'; END IF;
 INSERT INTO public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
 VALUES(a.id,a.student_user_id,'FACULTY_SCORE_OVERRIDE',jsonb_build_object('faculty_user_id',actor,'response_id',r.id,'question_id',r.question_id,'old_score',old_award,'new_score',p_score,'max_points',cap,'old_total',old_total,'new_total',final,'frozen_reference',frozen,'original_confirmed',p_original_confirmed IS TRUE,'preserved_released',old_status='RELEASED'));
 INSERT INTO public.buklod_quiz_audit_log(exam_id,section_id,live_session_id,attempt_id,actor_user_id,action,details)
 VALUES(a.exam_id,a.section_id,a.live_session_id,a.id,actor,'FACULTY_SCORE_CORRECTION_R26',jsonb_build_object('response_id',r.id,'old_score',old_award,'new_score',p_score,'old_total',old_total,'new_total',final,'original_max',old_max,'original_status',old_status,'new_status',new_status,'original_reference_confirmed',p_original_confirmed IS TRUE,'released_correction_confirmed',p_released_confirmed IS TRUE));
 RETURN QUERY SELECT t.id,t.status,t.total_score,t.max_score FROM public.buklod_quiz_attempts t WHERE t.id=a.id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_override_response_score_v2(uuid,numeric,text,boolean,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_override_response_score_v2(uuid,numeric,text,boolean,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.buklod_quiz_override_response_score_v1(p_response_id uuid,p_score numeric,p_feedback text DEFAULT NULL::text)
RETURNS TABLE(attempt_id uuid,attempt_status text,total_score numeric,max_score numeric)
LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $fn$
 SELECT * FROM public.buklod_quiz_override_response_score_v2(p_response_id,p_score,p_feedback,false,false);
$fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_override_response_score_v1(uuid,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_override_response_score_v1(uuid,numeric,text) TO authenticated,service_role;

