-- Faculty breakdown and progress use only assigned questions.
CREATE OR REPLACE FUNCTION public.buklod_quiz_attempt_faculty_analysis_v1(p_attempt_id uuid)
 RETURNS TABLE(attempt_id uuid, display_name text, attempt_status text, total_questions integer, answered_count integer, unanswered_count integer, correct_count integer, incorrect_count integer, partial_credit_count integer, manual_pending_count integer, earned_score numeric, max_score numeric, score_percent numeric, question_type_breakdown jsonb, cheating_risk_pct integer, cheating_risk_level text, leakage_risk_pct integer, leakage_risk_level text, confidence_pct integer, integrity_incident_count integer, strong_signal_count integer, performance_summary text, integrity_summary text, analysis_notice text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_actor uuid := (select auth.uid()); v_owner uuid;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_quiz_is_examiner(v_actor) then raise exception 'Examiner access required.'; end if;
  select e.owner_user_id into v_owner from public.buklod_quiz_attempts a join public.buklod_quiz_exams e on e.id=a.exam_id where a.id=p_attempt_id;
  if v_owner is null then raise exception 'Attempt not found.'; end if;
  if v_owner<>v_actor then raise exception 'Exam owner access required.'; end if;
  return query
  with target as (
    select a.*,coalesce(public.buklod_quiz_profile_display_name_v1(a.student_user_id),nullif(rst.display_name,''),'BUKLOD Student')::text as student_name
    from public.buklod_quiz_attempts a
    left join public.buklod_quiz_roster rst on rst.exam_id=a.exam_id and rst.section_id=a.section_id and rst.student_user_id=a.student_user_id
    where a.id=p_attempt_id
  ), per_question as (
    select q.question_type,q.points,rr.answer,rr.objective_score,rr.manual_score,rr.is_correct,
      coalesce(rr.manual_score,rr.objective_score,0)::numeric as awarded,
      (upper(q.question_type) in ('ESSAY','ENUMERATION','MANUAL') and rr.manual_score is null) as manual_pending,
      (rr.answer is not null and nullif(trim(case when jsonb_typeof(rr.answer)='string' then rr.answer #>> '{}' else rr.answer::text end),'') is not null) as answered
    from target t join public.buklod_quiz_questions q on q.exam_id=t.exam_id and q.is_active=true
    AND private.buklod_quiz_attempt_question_allowed_r1(t.id,q.id)
    left join public.buklod_quiz_responses rr on rr.attempt_id=t.id and rr.question_id=q.id
  ), totals as (
    select count(*)::integer total_questions,count(*) filter(where answered)::integer answered_count,
      count(*) filter(where not answered)::integer unanswered_count,count(*) filter(where is_correct is true)::integer correct_count,
      count(*) filter(where is_correct is false)::integer incorrect_count,count(*) filter(where awarded>0 and awarded<points)::integer partial_credit_count,
      count(*) filter(where manual_pending)::integer manual_pending_count,coalesce(sum(awarded),0)::numeric earned_score,coalesce(sum(points),0)::numeric max_score
    from per_question
  ), by_type as (
    select coalesce(jsonb_object_agg(question_type,obj),'{}'::jsonb) breakdown from (
      select question_type,jsonb_build_object('questions',count(*),'answered',count(*) filter(where answered),'correct',count(*) filter(where is_correct is true),'incorrect',count(*) filter(where is_correct is false),'manual_pending',count(*) filter(where manual_pending),'earned',coalesce(sum(awarded),0),'possible',coalesce(sum(points),0)) obj
      from per_question group by question_type
    ) x
  ), integrity as (select * from public.buklod_quiz_integrity_metrics_v1(p_attempt_id))
  select t.id,t.student_name,t.status::text,z.total_questions,z.answered_count,z.unanswered_count,z.correct_count,z.incorrect_count,z.partial_credit_count,z.manual_pending_count,z.earned_score,z.max_score,
    case when z.max_score>0 then public.buklod_quiz_transmuted_percent_v1(z.earned_score,z.max_score) else null end,b.breakdown,
    i.cheating_risk_pct,case when i.cheating_risk_pct>=75 then 'CRITICAL' when i.cheating_risk_pct>=50 then 'HIGH' when i.cheating_risk_pct>=25 then 'MODERATE' else 'LOW' end,
    i.leakage_risk_pct,case when i.leakage_risk_pct>=75 then 'CRITICAL' when i.leakage_risk_pct>=50 then 'HIGH' when i.leakage_risk_pct>=25 then 'MODERATE' else 'LOW' end,
    i.confidence_pct,(i.departure_incidents+i.copy_attempts+i.screen_capture_signals+i.devtools_attempts+i.context_menu_attempts)::integer,
    (i.copy_attempts+i.screen_capture_signals+i.devtools_attempts)::integer,
    case when z.manual_pending_count>0 then format('%s manual-review item(s) still need faculty scoring before release.',z.manual_pending_count)
         when z.unanswered_count>0 then format('%s of %s questions were answered; %s were unanswered. Current score is %s/%s.',z.answered_count,z.total_questions,z.unanswered_count,z.earned_score,z.max_score)
         else format('All %s questions were answered. Current score is %s/%s.',z.total_questions,z.earned_score,z.max_score) end::text,
    case when i.raw_integrity_signals=0 then 'No supported integrity signal was recorded. This does not prove that no misconduct occurred.'
         when (i.copy_attempts+i.screen_capture_signals+i.devtools_attempts)=0 then 'Focus-loss or exam-away behavior may be present, but no direct copy, screenshot/screen-capture, or developer-tools signal was recorded. Review the timeline before making an academic decision.'
         else 'One or more stronger integrity signals were recorded. Review the exact timeline and the student answers before making an academic decision.' end::text,
    'Faculty analysis is decision support only. Integrity risk is not proof of cheating, and release remains a manual faculty decision.'::text
  from target t cross join totals z cross join by_type b cross join integrity i;
end $function$;
