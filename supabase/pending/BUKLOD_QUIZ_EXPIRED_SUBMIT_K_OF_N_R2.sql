-- Quiz backend late-expiry K-of-N consistency correction.
-- Only assigned question IDs may be inserted on expired submit; no data updates at migration time.
CREATE OR REPLACE FUNCTION public.buklod_quiz_submit_attempt_v2(p_attempt_id uuid, p_answers jsonb)
 RETURNS TABLE(attempt_id uuid, status text, total_score numeric, max_score numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  a public.buklod_quiz_attempts%rowtype;
  v_len integer;
  v_status text;
  v_expected_count integer:=0;
  v_payload_count integer:=0;
  v_missing_inserted integer:=0;
begin
  if jsonb_typeof(coalesce(p_answers,'[]'::jsonb)) <> 'array' then
    raise exception 'Answers payload must be an array.';
  end if;

  v_len := jsonb_array_length(coalesce(p_answers,'[]'::jsonb));
  if v_len > 500 then raise exception 'Too many answers in submit payload.'; end if;

  select x.* into a
  from public.buklod_quiz_attempts x
  where x.id = p_attempt_id
    and x.student_user_id = (select auth.uid())
  for update;

  if a.id is null then raise exception 'Attempt not found.'; end if;

  if a.status in ('NEEDS_REVIEW','GRADED','RELEASED') then
    return query select a.id,a.status,a.total_score,a.max_score;
    return;
  end if;

  if a.status <> 'STARTED' then raise exception 'Attempt is not active.'; end if;
  -- Reject premature zero-answer finalization caused by stale client timer.
  IF a.expires_at > now() AND NOT EXISTS(
    SELECT 1 FROM jsonb_array_elements(coalesce(p_answers,'[]'::jsonb)) j
    WHERE j ? 'answer' AND j->'answer' IS NOT NULL
      AND j->'answer'<>'null'::jsonb
      AND nullif(trim(CASE WHEN jsonb_typeof(j->'answer')='string'
        THEN j->>'answer' ELSE (j->'answer')::text END),'') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'No answered questions received before the server deadline. Exam remains active; retry or ask faculty to troubleshoot.';
  END IF;


  if exists(
    select 1
    from jsonb_array_elements(coalesce(p_answers,'[]'::jsonb)) j
    where nullif(j->>'question_id','') is null
       or not exists(
         select 1 from public.buklod_quiz_questions q
         where q.id=(j->>'question_id')::uuid
           and q.exam_id=a.exam_id
           and q.is_active=true AND private.buklod_quiz_attempt_question_allowed_r1(a.id,q.id)
       )
  ) then
    raise exception 'One or more question IDs are invalid for this exam.';
  end if;

  select private.buklod_quiz_attempt_question_count_r1(a.id) into v_expected_count;

  select count(distinct (j->>'question_id'))::integer
    into v_payload_count
  from jsonb_array_elements(coalesce(p_answers,'[]'::jsonb)) j;

  if v_payload_count <> v_expected_count then
    raise exception 'Submission snapshot incomplete: received % of % question IDs. Exam remains active; retry from the same device so no answers are lost.',
      v_payload_count, v_expected_count;
  end if;

  if a.expires_at <= now() then
    insert into public.buklod_quiz_responses(
      attempt_id,question_id,student_user_id,answer,saved_at,updated_at
    )
    select a.id,q.id,a.student_user_id,null::jsonb,now(),now()
    from public.buklod_quiz_questions q
    where q.exam_id=a.exam_id
      and q.is_active=true
      and private.buklod_quiz_attempt_question_allowed_r1(a.id,q.id)
      and not exists(
        select 1 from public.buklod_quiz_responses r
        where r.attempt_id=a.id and r.question_id=q.id
      )
    on conflict on constraint buklod_quiz_responses_attempt_id_question_id_key do nothing;
    get diagnostics v_missing_inserted=row_count;

    v_status := public.buklod_quiz_compute_attempt_internal(a.id);
    select x.* into a from public.buklod_quiz_attempts x where x.id = p_attempt_id;

    insert into public.buklod_quiz_events(attempt_id, student_user_id, event_type, event_data)
    select a.id, a.student_user_id, 'AUTO_SUBMIT_TIME_EXPIRED',
           jsonb_build_object(
             'expires_at', a.expires_at,
             'processed_at', now(),
             'result_status', v_status,
             'source', 'LATE_SUBMIT_GUARD',
             'rejected_late_payload_count', v_len,
             'unanswered_inserted_count',v_missing_inserted,
             'incomplete_submission_allowed',true
           )
    where not exists (
      select 1 from public.buklod_quiz_events e
      where e.attempt_id = a.id
        and e.event_type = 'AUTO_SUBMIT_TIME_EXPIRED'
    );

    return query select a.id,a.status,a.total_score,a.max_score;
    return;
  end if;

  if a.live_session_id is not null
     and exists(
       select 1 from public.buklod_quiz_live_sessions ls
       where ls.id=a.live_session_id and ls.status='PAUSED'
     ) then
    raise exception 'Live class is paused. Wait for faculty to resume before submitting.';
  end if;

  if v_len > 0 then
    with payload as (
      select distinct on ((j->>'question_id')::uuid)
             (j->>'question_id')::uuid question_id,
             j->'answer' answer
      from jsonb_array_elements(p_answers) j
      order by (j->>'question_id')::uuid
    )
    insert into public.buklod_quiz_responses(attempt_id,question_id,student_user_id,answer,saved_at,updated_at)
    select a.id,p.question_id,(select auth.uid()),p.answer,now(),now()
    from payload p
    on conflict on constraint buklod_quiz_responses_attempt_id_question_id_key
    do update set
      answer=excluded.answer,
      student_user_id=excluded.student_user_id,
      saved_at=now(),
      updated_at=now();
  end if;

  insert into public.buklod_quiz_responses(
    attempt_id,question_id,student_user_id,answer,saved_at,updated_at
  )
  select a.id,q.id,a.student_user_id,null::jsonb,now(),now()
  from public.buklod_quiz_questions q
  where q.exam_id=a.exam_id
    and q.is_active=true
    and private.buklod_quiz_attempt_question_allowed_r1(a.id,q.id)
    and not exists(
      select 1 from public.buklod_quiz_responses r
      where r.attempt_id=a.id and r.question_id=q.id
    )
  on conflict on constraint buklod_quiz_responses_attempt_id_question_id_key do nothing;
  get diagnostics v_missing_inserted=row_count;

  v_status := public.buklod_quiz_compute_attempt_internal(a.id);
  select x.* into a from public.buklod_quiz_attempts x where x.id=p_attempt_id;

  insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
  values(a.id,(select auth.uid()),'ATOMIC_SUBMIT_V2',jsonb_build_object(
    'answer_payload_count',v_len,
    'distinct_payload_count',v_payload_count,
    'expected_question_count',v_expected_count,
    'unanswered_inserted_count',v_missing_inserted,
    'incomplete_submission_allowed',true,
    'status',v_status
  ));

  return query select a.id,a.status,a.total_score,a.max_score;
end;
$function$;
