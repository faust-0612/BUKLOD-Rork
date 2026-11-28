-- Restore the four pre-R26 MAIN definitions and effective API grants.
-- Apply only after review; does not reverse legitimate faculty grade changes.
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

  perform public.buklod_quiz_seed_attempt_questions_v1(p_attempt_id);

  return query
  with target as(
    select a.*,
      coalesce(public.buklod_quiz_profile_display_name_v1(a.student_user_id),'BUKLOD Student')::text as student_name
    from public.buklod_quiz_attempts a where a.id=p_attempt_id
  ), per_question as(
    select q.question_type,aq.points,rr.answer,rr.objective_score,rr.manual_score,rr.is_correct,
      coalesce(rr.manual_score,rr.objective_score,0)::numeric as awarded,
      (coalesce(rr.needs_review,false) and rr.manual_score is null) as manual_pending,
      (rr.answer is not null and nullif(trim(case when jsonb_typeof(rr.answer)='string' then rr.answer#>>'{}' else rr.answer::text end),'') is not null) as answered
    from target t
    join public.buklod_quiz_attempt_questions aq on aq.attempt_id=t.id
    join public.buklod_quiz_questions q on q.id=aq.question_id
    left join public.buklod_quiz_responses rr on rr.attempt_id=t.id and rr.question_id=q.id
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
    z.earned_score,z.max_score,
    case when z.max_score>0 then public.buklod_quiz_transmuted_percent_v1(z.earned_score,z.max_score) else null end,
    b.breakdown,i.cheating_risk_pct,
    case when i.cheating_risk_pct>=75 then 'CRITICAL' when i.cheating_risk_pct>=50 then 'HIGH' when i.cheating_risk_pct>=25 then 'MODERATE' else 'LOW' end,
    i.leakage_risk_pct,
    case when i.leakage_risk_pct>=75 then 'CRITICAL' when i.leakage_risk_pct>=50 then 'HIGH' when i.leakage_risk_pct>=25 then 'MODERATE' else 'LOW' end,
    i.confidence_pct,
    (i.departure_incidents+i.copy_attempts+i.screen_capture_signals+i.devtools_attempts+i.context_menu_attempts)::int,
    (i.copy_attempts+i.screen_capture_signals+i.devtools_attempts)::int,
    case
      when z.manual_pending_count>0 then format('%s faculty-review item(s) still need scoring before release.',z.manual_pending_count)
      when z.unanswered_count>0 then format('%s of %s questions were answered; %s were unanswered. Current score is %s/%s.',z.answered_count,z.total_questions,z.unanswered_count,z.earned_score,z.max_score)
      else format('All %s questions were answered. Current score is %s/%s.',z.total_questions,z.earned_score,z.max_score)
    end::text,
    case
      when i.raw_integrity_signals=0 then 'No supported integrity signal was recorded. This does not prove that no misconduct occurred.'
      when (i.copy_attempts+i.screen_capture_signals+i.devtools_attempts)=0 then 'Focus-loss or exam-away behavior may be present, but no direct copy, screenshot/screen-capture, or developer-tools signal was recorded. Review the timeline before making an academic decision.'
      else 'One or more stronger integrity signals were recorded. Review the exact timeline and the student answers before making an academic decision.'
    end::text,
    'Faculty analysis is decision support only. Integrity risk is not proof of cheating, and release remains a manual faculty decision.'::text
  from target t cross join totals z cross join by_type b cross join integrity i;
end $function$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_attempt_full_review_v1(p_attempt_id uuid)
 RETURNS TABLE(attempt_id uuid, exam_id uuid, exam_title text, section_id uuid, section_name text, student_user_id uuid, display_name text, attempt_no integer, attempt_status text, started_at timestamp with time zone, submitted_at timestamp with time zone, released_at timestamp with time zone, total_score numeric, max_score numeric, integrity_violation_count integer, question_id uuid, question_no integer, question_type text, prompt text, options jsonb, answer_text text, correct_answer_text text, points numeric, objective_score numeric, manual_score numeric, awarded_score numeric, is_correct boolean, needs_review boolean, feedback text, explanation text, source_pages text)
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
  select a.id,a.exam_id,e.title::text,a.section_id,s.name::text,a.student_user_id,
    coalesce(public.buklod_quiz_profile_display_name_v1(a.student_user_id),nullif(rst.display_name,''),'BUKLOD Student')::text,
    a.attempt_no,a.status::text,a.started_at,a.submitted_at,a.released_at,a.total_score,a.max_score,
    coalesce(a.integrity_violation_count,0)::integer,
    q.id,row_number() over(order by q.sort_order,q.id)::integer,q.question_type::text,q.prompt::text,q.options,
    case when rr.answer is null then '' when jsonb_typeof(rr.answer)='string' then rr.answer #>> '{}' else rr.answer::text end::text,
    case when q.correct_answer is null then '' when jsonb_typeof(q.correct_answer)='string' then q.correct_answer #>> '{}' else q.correct_answer::text end::text,
    q.points,rr.objective_score,rr.manual_score,coalesce(rr.manual_score,rr.objective_score,0)::numeric,rr.is_correct,
    coalesce(rr.needs_review,false),rr.feedback::text,q.explanation::text,q.source_pages::text
  from public.buklod_quiz_attempts a
  join public.buklod_quiz_exams e on e.id=a.exam_id
  join public.buklod_quiz_sections s on s.id=a.section_id and s.exam_id=a.exam_id
  join public.buklod_quiz_questions q on q.exam_id=a.exam_id and q.is_active=true
  left join public.buklod_quiz_responses rr on rr.attempt_id=a.id and rr.question_id=q.id
  left join public.buklod_quiz_roster rst on rst.exam_id=a.exam_id and rst.section_id=a.section_id and rst.student_user_id=a.student_user_id
  where a.id=p_attempt_id
  order by q.sort_order,q.id;
end $function$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_attempt_full_review_v2(p_attempt_id uuid)
 RETURNS TABLE(attempt_id uuid, exam_id uuid, exam_title text, section_id uuid, section_name text, student_user_id uuid, display_name text, attempt_no integer, attempt_status text, started_at timestamp with time zone, submitted_at timestamp with time zone, released_at timestamp with time zone, total_score numeric, max_score numeric, integrity_violation_count integer, response_id uuid, question_id uuid, question_no integer, question_type text, prompt text, options jsonb, answer_text text, correct_answer_text text, points numeric, objective_score numeric, manual_score numeric, awarded_score numeric, is_correct boolean, needs_review boolean, feedback text, explanation text, source_pages text)
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

  perform public.buklod_quiz_seed_attempt_questions_v1(p_attempt_id);

  return query
  select a.id,a.exam_id,e.title::text,a.section_id,s.name::text,a.student_user_id,
    coalesce(public.buklod_quiz_profile_display_name_v1(a.student_user_id),nullif(rst.display_name,''),'BUKLOD Student')::text,
    a.attempt_no,a.status::text,a.started_at,a.submitted_at,a.released_at,a.total_score,a.max_score,
    coalesce(a.integrity_violation_count,0)::integer,rr.id,q.id,aq.display_order,q.question_type::text,q.prompt::text,q.options,
    case when rr.answer is null then '' when jsonb_typeof(rr.answer)='string' then rr.answer#>>'{}' else rr.answer::text end::text,
    case when q.correct_answer is null then '' when jsonb_typeof(q.correct_answer)='string' then q.correct_answer#>>'{}' else q.correct_answer::text end::text,
    aq.points,rr.objective_score,rr.manual_score,coalesce(rr.manual_score,rr.objective_score,0)::numeric,
    rr.is_correct,coalesce(rr.needs_review,false),rr.feedback::text,q.explanation::text,q.source_pages::text
  from public.buklod_quiz_attempts a
  join public.buklod_quiz_exams e on e.id=a.exam_id
  join public.buklod_quiz_sections s on s.id=a.section_id and s.exam_id=a.exam_id
  join public.buklod_quiz_attempt_questions aq on aq.attempt_id=a.id
  join public.buklod_quiz_questions q on q.id=aq.question_id
  left join public.buklod_quiz_responses rr on rr.attempt_id=a.id and rr.question_id=q.id
  left join public.buklod_quiz_roster rst on rst.exam_id=a.exam_id and rst.section_id=a.section_id and rst.student_user_id=a.student_user_id
  where a.id=p_attempt_id
  order by aq.display_order;
end $function$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_override_response_score_v1(p_response_id uuid, p_score numeric, p_feedback text DEFAULT NULL::text)
 RETURNS TABLE(attempt_id uuid, attempt_status text, total_score numeric, max_score numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid:=(select auth.uid());
  r public.buklod_quiz_responses%rowtype;
  a public.buklod_quiz_attempts%rowtype;
  v_owner uuid; v_points numeric; v_original_status text;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_quiz_is_examiner(v_actor) then raise exception 'Examiner access required.'; end if;

  select rr.* into r from public.buklod_quiz_responses rr where rr.id=p_response_id;
  if r.id is null then raise exception 'Response not found.'; end if;

  select aa.* into a from public.buklod_quiz_attempts aa where aa.id=r.attempt_id;
  if a.id is null then raise exception 'Attempt not found.'; end if;
  select e.owner_user_id into v_owner from public.buklod_quiz_exams e where e.id=a.exam_id;
  if v_owner<>v_actor then raise exception 'Exam owner access required.'; end if;
  if a.status in ('STARTED','VOID') then raise exception 'Score correction is available only after submission.'; end if;

  perform public.buklod_quiz_seed_attempt_questions_v1(a.id);
  select aq.points into v_points
  from public.buklod_quiz_attempt_questions aq
  where aq.attempt_id=a.id and aq.question_id=r.question_id;
  if v_points is null then raise exception 'This response is not part of the attempt question set.'; end if;
  if p_score<0 or p_score>v_points then raise exception 'Score must be from 0 to %.',v_points; end if;

  v_original_status:=a.status;
  update public.buklod_quiz_responses rr
  set manual_score=p_score,objective_score=0,
      is_correct=case when p_score>=v_points then true when p_score<=0 then false else null end,
      needs_review=false,feedback=nullif(trim(coalesce(p_feedback,'')),''),
      reviewed_by=v_actor,reviewed_at=now()
  where rr.id=r.id;

  perform public.buklod_quiz_compute_attempt_internal(a.id);
  if v_original_status='RELEASED' then
    update public.buklod_quiz_attempts aa
    set status='RELEASED',released_at=coalesce(aa.released_at,now()),updated_at=now()
    where aa.id=a.id;
  end if;

  insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
  values(a.id,a.student_user_id,'FACULTY_SCORE_OVERRIDE',
         jsonb_build_object('faculty_user_id',v_actor,'response_id',r.id,'question_id',r.question_id,
                            'new_score',p_score,'max_points',v_points,'feedback',p_feedback,
                            'preserved_released',v_original_status='RELEASED'));

  return query select aa.id,aa.status,aa.total_score,aa.max_score
  from public.buklod_quiz_attempts aa where aa.id=a.id;
end $function$;

REVOKE ALL ON FUNCTION public.buklod_quiz_attempt_faculty_analysis_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_attempt_faculty_analysis_v1(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_attempt_faculty_analysis_v1(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.buklod_quiz_attempt_full_review_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_attempt_full_review_v1(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_attempt_full_review_v1(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.buklod_quiz_attempt_full_review_v2(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_attempt_full_review_v2(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_attempt_full_review_v2(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.buklod_quiz_override_response_score_v1(uuid,numeric,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_override_response_score_v1(uuid,numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_override_response_score_v1(uuid,numeric,text) TO service_role;
DROP FUNCTION IF EXISTS public.buklod_quiz_override_response_score_v2(uuid,numeric,text,boolean,boolean);
