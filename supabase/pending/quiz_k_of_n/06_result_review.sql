-- Student/faculty post-exam review contains ONLY assigned K questions for new sessions.
CREATE OR REPLACE FUNCTION public.buklod_quiz_attempt_full_review_v1(p_attempt_id uuid)
 RETURNS TABLE(attempt_id uuid, exam_id uuid, exam_title text, section_id uuid, section_name text, student_user_id uuid, display_name text, attempt_no integer, attempt_status text, started_at timestamp with time zone, submitted_at timestamp with time zone, released_at timestamp with time zone, total_score numeric, max_score numeric, integrity_violation_count integer, question_id uuid, question_no integer, question_type text, prompt text, options jsonb, answer_text text, correct_answer_text text, points numeric, objective_score numeric, manual_score numeric, awarded_score numeric, is_correct boolean, needs_review boolean, feedback text, explanation text, source_pages text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_owner uuid;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_quiz_is_examiner(v_actor) then raise exception 'Examiner access required.'; end if;
  select e.owner_user_id into v_owner
  from public.buklod_quiz_attempts a
  join public.buklod_quiz_exams e on e.id=a.exam_id
  where a.id=p_attempt_id;
  if v_owner is null then raise exception 'Attempt not found.'; end if;
  if v_owner<>v_actor then raise exception 'Exam owner access required.'; end if;

  return query
  select
    a.id,a.exam_id,e.title::text,a.section_id,s.name::text,a.student_user_id,
    coalesce(public.buklod_quiz_profile_display_name_v1(a.student_user_id),nullif(rst.display_name,''),'BUKLOD Student')::text,
    a.attempt_no,a.status::text,a.started_at,a.submitted_at,a.released_at,a.total_score,a.max_score,
    private.buklod_quiz_canonical_integrity_count_v1(a.id),
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
    and private.buklod_quiz_attempt_question_allowed_r1(a.id,q.id)
  order by q.sort_order,q.id;
end
$function$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_attempt_full_review_v2(p_attempt_id uuid)
 RETURNS TABLE(attempt_id uuid, exam_id uuid, exam_title text, section_id uuid, section_name text, student_user_id uuid, display_name text, attempt_no integer, attempt_status text, started_at timestamp with time zone, submitted_at timestamp with time zone, released_at timestamp with time zone, total_score numeric, max_score numeric, integrity_violation_count integer, response_id uuid, question_id uuid, question_no integer, question_type text, prompt text, options jsonb, answer_text text, correct_answer_text text, points numeric, objective_score numeric, manual_score numeric, awarded_score numeric, is_correct boolean, needs_review boolean, feedback text, explanation text, source_pages text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_owner uuid;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_quiz_is_examiner(v_actor) then raise exception 'Examiner access required.'; end if;
  select e.owner_user_id into v_owner
  from public.buklod_quiz_attempts a
  join public.buklod_quiz_exams e on e.id=a.exam_id
  where a.id=p_attempt_id;
  if v_owner is null then raise exception 'Attempt not found.'; end if;
  if v_owner<>v_actor then raise exception 'Exam owner access required.'; end if;

  return query
  select
    a.id,a.exam_id,e.title::text,a.section_id,s.name::text,a.student_user_id,
    coalesce(nullif(trim(rst.display_name),''),nullif(trim(concat_ws(', ',nullif(rst.surname,''),nullif(rst.first_name,''))),''),'BUKLOD Student')::text,
    a.attempt_no,a.status::text,a.started_at,a.submitted_at,a.released_at,a.total_score,a.max_score,
    private.buklod_quiz_canonical_integrity_count_v1(a.id),
    rr.id,
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
    and private.buklod_quiz_attempt_question_allowed_r1(a.id,q.id)
  order by q.sort_order,q.id;
end
$function$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_my_released_attempt_answers_v1(p_attempt_id uuid)
 RETURNS TABLE(question_no integer, question_type text, prompt text, options jsonb, points numeric, answer_text text, correct_answer_text text, awarded_score numeric, feedback text, explanation text, show_correct boolean, show_explanation boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  a public.buklod_quiz_attempts%rowtype;
  s public.buklod_quiz_live_sessions%rowtype;
  pref public.buklod_quiz_release_preferences%rowtype;
  v_has_pref boolean := false;
  v_show_answers boolean := true;
  v_show_correct boolean := false;
  v_show_explanations boolean := false;
begin
  select x.* into a
  from public.buklod_quiz_attempts x
  where x.id=p_attempt_id
    and x.student_user_id=(select auth.uid())
    and x.status='RELEASED';
  if a.id is null then raise exception 'Released result not found.'; end if;

  select x.* into pref
  from public.buklod_quiz_release_preferences x
  where x.attempt_id=a.id;
  v_has_pref := pref.attempt_id is not null;

  if v_has_pref then
    v_show_answers := coalesce(pref.show_answers,false) or coalesce(pref.show_rationale,false);
    v_show_correct := v_show_answers;
    v_show_explanations := coalesce(pref.show_rationale,false);
  elsif a.live_session_id is not null then
    select x.* into s from public.buklod_quiz_live_sessions x where x.id=a.live_session_id;
    v_show_answers:=coalesce(s.show_answers_after_release,true);
    v_show_correct:=coalesce(s.show_correct_after_release,false);
    v_show_explanations:=coalesce(s.show_explanations_after_release,false);
  end if;

  if not v_show_answers then
    raise exception 'Faculty released the score only. Answer review is not enabled for this result.';
  end if;

  return query
  select
    row_number() over(order by q.sort_order,q.id)::integer,
    q.question_type,
    q.prompt,
    q.options,
    q.points,
    case when r.answer is null then '' when jsonb_typeof(r.answer)='string' then r.answer#>>'{}' else r.answer::text end,
    case when v_show_correct then case when q.correct_answer is null then '' when jsonb_typeof(q.correct_answer)='string' then q.correct_answer#>>'{}' else q.correct_answer::text end else '' end,
    coalesce(r.manual_score,r.objective_score,0)::numeric,
    r.feedback,
    case when v_show_explanations then q.explanation else null end,
    v_show_correct,
    v_show_explanations
  from public.buklod_quiz_questions q
  left join public.buklod_quiz_responses r on r.attempt_id=a.id and r.question_id=q.id
  where q.exam_id=a.exam_id and q.is_active=true AND private.buklod_quiz_attempt_question_allowed_r1(a.id,q.id)
  order by q.sort_order,q.id;
end;
$function$;