-- BUKLOD R5: old-client compatibility without a rule-based reward loophole.
-- Preserve draft capture for authenticated enrolled members; only the separate
-- authoritative R4 auto-completion and points paths may approve a lesson.

CREATE OR REPLACE FUNCTION public.submit_learning_lesson_response_v1(p_enrollment_id uuid, p_lesson_id uuid, p_question_answers jsonb, p_reflection text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  actor uuid := auth.uid();
  enrollment_user uuid;
  enrollment_track uuid;
  lesson_track uuid;
  answer_value text;
  answer_index integer := 0;
  response_id uuid;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  select
    e.user_id,
    e.track_id,
    l.track_id
  into
    enrollment_user,
    enrollment_track,
    lesson_track
  from public.track_enrollments e
  join public.learning_lessons l
    on l.id = p_lesson_id
  where e.id = p_enrollment_id;

  if enrollment_user is null then
    raise exception 'Enrollment or lesson not found';
  end if;

  if enrollment_user <> actor then
    raise exception 'This enrollment does not belong to your account';
  end if;

  if enrollment_track <> lesson_track then
    raise exception 'Lesson does not belong to this enrollment';
  end if;

  if p_question_answers is null
     or jsonb_typeof(p_question_answers) <> 'array' then
    raise exception 'Four lesson answers are required';
  end if;

  if jsonb_array_length(p_question_answers) <> 4 then
    raise exception 'Answer all four lesson questions';
  end if;

  for answer_value in
    select value
    from jsonb_array_elements_text(p_question_answers)
  loop
    answer_index := answer_index + 1;
    if char_length(trim(coalesce(answer_value,''))) < 10 then
      raise exception
        'Each lesson question must be answered with at least 10 characters';
    end if;

    -- Allow saving drafts from older and offline-compatible clients.
    -- AI checking is mandatory at authoritative completion/points award only.
  end loop;

  if char_length(trim(coalesce(p_reflection,''))) < 20 then
    raise exception
      'Personal Reflection must contain at least 20 characters';
  end if;

  -- Persist the personal reflection without prematurely awarding any points.
  -- Finalization separately checks all five fresh, source-grounded Gemini records.

  insert into public.learning_lesson_responses (
    user_id,
    enrollment_id,
    lesson_id,
    question_answers,
    reflection_text,
    submitted_at,
    updated_at
  )
  values (
    actor,
    p_enrollment_id,
    p_lesson_id,
    p_question_answers,
    trim(p_reflection),
    now(),
    now()
  )
  on conflict (user_id,lesson_id)
  do update set
    enrollment_id = excluded.enrollment_id,
    question_answers = excluded.question_answers,
    reflection_text = excluded.reflection_text,
    submitted_at = now(),
    updated_at = now()
  returning id into response_id;

  return response_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.save_my_formation_lesson_study(p_enrollment_id uuid, p_lesson_id uuid, p_reflection text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  actor uuid := auth.uid();
  access jsonb;
  enrollment_record record;
  lesson_record record;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  if public.buklod_formation_engine_v2_enabled() then
    access := public.can_access_formation_lesson_v1(p_lesson_id);
    if coalesce((access->>'allowed')::boolean, false) = false then
      raise exception 'Lesson access denied: %',
        coalesce(access->>'blocking_reason', 'STAGE_LOCKED');
    end if;
  end if;

  select e.* into enrollment_record
  from public.track_enrollments e
  where e.id = p_enrollment_id
    and e.user_id = actor;

  if enrollment_record.id is null then
    raise exception 'Enrollment not found or not authorized';
  end if;

  select
    l.id,
    l.track_id,
    l.content_ready,
    t.formation_program,
    t.status::text as track_status
  into lesson_record
  from public.learning_lessons l
  join public.learning_tracks t on t.id = l.track_id
  where l.id = p_lesson_id;

  if lesson_record.id is null then
    raise exception 'Lesson not found';
  end if;

  if lesson_record.track_id <> enrollment_record.track_id then
    raise exception 'Lesson does not belong to this enrollment';
  end if;

  if lesson_record.formation_program not in ('ccp', 'discipleship', 'mentoring')
     and not (
       public.buklod_formation_engine_v2_enabled()
       and public.buklod_formation_track_stage_code(lesson_record.track_id) between 101 and 107
     ) then
    raise exception 'This is not an official BUKLOD formation lesson';
  end if;

  if lesson_record.track_status <> 'published' then
    raise exception 'This BUKLOD lesson track is not yet published';
  end if;

  if lesson_record.content_ready = false then
    raise exception 'This lesson content is not yet ready';
  end if;

  -- Save lesson study notes without requiring an online AI result.
  -- Official completion and points remain strictly Gemini-gated.

  insert into public.lesson_progress (
    enrollment_id, lesson_id, user_id, started_at, completed_at, reflection_text
  )
  values (
    p_enrollment_id, p_lesson_id, actor, now(), null,
    nullif(trim(coalesce(p_reflection, '')), '')
  )
  on conflict (enrollment_id, lesson_id) do update set
    started_at = coalesce(public.lesson_progress.started_at, now()),
    reflection_text = excluded.reflection_text,
    updated_at = now();
end;
$function$;

-- Revoke direct arbitrary award RPCs remains enforced by R2/R3.
