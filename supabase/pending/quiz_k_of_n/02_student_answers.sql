-- Student sees only assigned K; legacy sessions remain unchanged.
CREATE OR REPLACE FUNCTION public.buklod_quiz_student_questions_v1(p_attempt_id uuid)
 RETURNS TABLE(question_id uuid, question_type text, prompt text, options jsonb, points numeric, display_order integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
 WITH a AS (
  SELECT x.id,x.exam_id,e.randomize_questions
  FROM public.buklod_quiz_attempts x
  JOIN public.buklod_quiz_sections sx ON sx.id=x.section_id AND sx.archived_at IS NULL
  JOIN public.buklod_quiz_exams e ON e.id=x.exam_id
  WHERE x.id=p_attempt_id AND x.student_user_id=(SELECT auth.uid()) AND x.status='STARTED'
 ), selected AS (
  SELECT q.id,q.question_type,q.prompt,q.options,q.points,t.display_order
  FROM a JOIN private.buklod_quiz_attempt_questions_r1 t ON t.attempt_id=a.id
    JOIN public.buklod_quiz_questions q ON q.id=t.question_id
  UNION ALL
  SELECT q.id,q.question_type,q.prompt,q.options,q.points,
    row_number() over(order by CASE WHEN a.randomize_questions
      THEN md5(q.id::text||':'||a.id::text)
      ELSE lpad(q.sort_order::text,12,'0') END,q.id::text)::integer
  FROM a JOIN public.buklod_quiz_questions q ON q.exam_id=a.exam_id AND q.is_active=true
  WHERE NOT EXISTS(SELECT 1 FROM private.buklod_quiz_attempt_questions_r1 t WHERE t.attempt_id=a.id)
 )
 SELECT id,question_type,prompt,options,points,display_order FROM selected ORDER BY display_order
$fn$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_save_answer_v1(p_attempt_id uuid, p_question_id uuid, p_answer jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.buklod_quiz_attempts%rowtype;
begin
  select x.* into a from public.buklod_quiz_attempts x where x.id=p_attempt_id and x.student_user_id=(select auth.uid());
  if a.id is null then raise exception 'Attempt not found.'; end if;
  if a.status<>'STARTED' then
    if a.status in ('NEEDS_REVIEW','GRADED','RELEASED') then return true; end if;
    raise exception 'Attempt is not active.';
  end if;
  if a.expires_at<=now() then perform public.buklod_quiz_compute_attempt_internal(a.id); raise exception 'Time limit has ended.'; end if;
  if a.live_session_id is not null and not exists(select 1 from public.buklod_quiz_live_sessions ls where ls.id=a.live_session_id and ls.status='LIVE') then raise exception 'Live class is paused or ended.'; end if;
  if not exists(select 1 from public.buklod_quiz_questions q where q.id=p_question_id and q.exam_id=a.exam_id and q.is_active=true) then raise exception 'Question is not part of this exam.'; end if;
  IF NOT private.buklod_quiz_attempt_question_allowed_r1(a.id,p_question_id) THEN RAISE EXCEPTION 'Question not assigned to this attempt.'; END IF;
  insert into public.buklod_quiz_responses(attempt_id,question_id,student_user_id,answer,saved_at,updated_at)
  values(a.id,p_question_id,(select auth.uid()),p_answer,now(),now())
  on conflict(attempt_id,question_id) do update set answer=excluded.answer,student_user_id=excluded.student_user_id,saved_at=now(),updated_at=now();
  return true;
end
$function$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_save_answers_batch_v1(p_attempt_id uuid, p_answers jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.buklod_quiz_attempts%rowtype; v_count integer; v_len integer;
begin
  if jsonb_typeof(p_answers)<>'array' then raise exception 'Answers payload must be an array.'; end if;
  v_len:=jsonb_array_length(p_answers);
  if v_len<1 then return 0; end if;
  if v_len>50 then raise exception 'Maximum 50 answers per batch.'; end if;

  select x.* into a from public.buklod_quiz_attempts x where x.id=p_attempt_id and x.student_user_id=(select auth.uid());
  if a.id is null then raise exception 'Attempt not found.'; end if;
  if a.status<>'STARTED' then
    if a.status in ('NEEDS_REVIEW','GRADED','RELEASED') then return 0; end if;
    raise exception 'Attempt is not active.';
  end if;
  if a.expires_at<=now() then perform public.buklod_quiz_compute_attempt_internal(a.id); raise exception 'Time limit has ended.'; end if;
  if a.live_session_id is not null and not exists(select 1 from public.buklod_quiz_live_sessions ls where ls.id=a.live_session_id and ls.status='LIVE') then raise exception 'Live class is paused or ended.'; end if;

  if exists(
    select 1 from jsonb_array_elements(p_answers) j
    where not exists(
      select 1 from public.buklod_quiz_questions q
      where q.id=(j->>'question_id')::uuid and q.exam_id=a.exam_id and q.is_active=true AND private.buklod_quiz_attempt_question_allowed_r1(a.id,q.id)
    )
  ) then raise exception 'One or more question IDs are invalid for this exam.'; end if;

  with payload as (
    select (j->>'question_id')::uuid question_id,j->'answer' answer
    from jsonb_array_elements(p_answers) j
  ), up as (
    insert into public.buklod_quiz_responses(attempt_id,question_id,student_user_id,answer,saved_at,updated_at)
    select a.id,p.question_id,(select auth.uid()),p.answer,now(),now() from payload p
    on conflict(attempt_id,question_id) do update set answer=excluded.answer,student_user_id=excluded.student_user_id,saved_at=now(),updated_at=now()
    returning 1
  ) select count(*) into v_count from up;
  return v_count;
end
$function$;