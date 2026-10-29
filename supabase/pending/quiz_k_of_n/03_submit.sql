-- All submission paths respect selected IDs and expected K; legacy fallback intact.
CREATE OR REPLACE FUNCTION public.buklod_quiz_submit_attempt_v1(p_attempt_id uuid)
 RETURNS TABLE(attempt_id uuid, status text, total_score numeric, max_score numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  a public.buklod_quiz_attempts%rowtype;
  v_status text;
  v_missing_inserted integer:=0;
begin
  select x.* into a
  from public.buklod_quiz_attempts x
  where x.id=p_attempt_id
    and x.student_user_id=(select auth.uid())
  for update;

  if a.id is null then raise exception 'Attempt not found.'; end if;

  if a.status in ('NEEDS_REVIEW','GRADED','RELEASED') then
    return query select a.id,a.status,a.total_score,a.max_score;
    return;
  end if;

  if a.status<>'STARTED' then raise exception 'Attempt is not active.'; end if;

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

  v_status:=public.buklod_quiz_compute_attempt_internal(a.id);

  select x.* into a
  from public.buklod_quiz_attempts x
  where x.id=p_attempt_id;

  insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
  values(
    a.id,(select auth.uid()),'ATTEMPT_SUBMITTED',
    jsonb_build_object(
      'status',v_status,
      'unanswered_inserted_count',v_missing_inserted,
      'incomplete_submission_allowed',true
    )
  );

  return query select a.id,a.status,a.total_score,a.max_score;
end
$function$;

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

CREATE OR REPLACE FUNCTION public.buklod_quiz_submit_attempt_v4(p_attempt_id uuid, p_answers jsonb, p_client_completed_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_offline boolean DEFAULT false, p_offline_lease_token text DEFAULT NULL::text, p_device_token text DEFAULT NULL::text)
 RETURNS TABLE(status text, total_score numeric, max_score numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  a public.buklod_quiz_attempts%rowtype;
  v_uid uuid := (select auth.uid());
  v_len integer;
  v_expected integer;
  v_payload integer;
  v_status text;
  v_valid_lease boolean := false;
  v_basic_grace boolean := false;
  v_late_by numeric := 0;
begin
  if v_uid is null then
    raise exception 'Sign in first.';
  end if;

  if jsonb_typeof(coalesce(p_answers,'[]'::jsonb)) <> 'array' then
    raise exception 'Answers payload must be an array.';
  end if;

  select x.* into a
  from public.buklod_quiz_attempts x
  where x.id=p_attempt_id
    and x.student_user_id=v_uid
  for update;

  if a.id is null then
    raise exception 'Attempt not found.';
  end if;

  if a.status in ('NEEDS_REVIEW','GRADED','RELEASED') then
    return query select a.status,a.total_score,a.max_score;
    return;
  end if;

  if a.status <> 'STARTED' then
    raise exception 'Attempt is not active.';
  end if;

  if a.expires_at > now() then
    return query
    select x.status,x.total_score,x.max_score
    from public.buklod_quiz_submit_attempt_v2(p_attempt_id,p_answers) x;
    return;
  end if;

  if p_client_completed_at is null
     or p_client_completed_at < a.started_at - interval '1 minute'
     or p_client_completed_at > a.expires_at + interval '2 seconds'
  then
    raise exception 'Late submission proof is invalid. Attempt remains in recovery handling.';
  end if;

  if nullif(btrim(coalesce(p_offline_lease_token,'')),'') is not null then
    select exists(
      select 1
      from public.buklod_quiz_offline_leases l
      where l.attempt_id=a.id
        and l.student_user_id=v_uid
        and l.lease_token_hash=encode(extensions.digest(p_offline_lease_token,'sha256'),'hex')
        and l.used_at is null
        and l.sync_grace_expires_at >= now()
    ) into v_valid_lease;
  end if;

  v_basic_grace := now() <= a.expires_at + interval '2 minutes';

  if not v_valid_lease and not v_basic_grace then
    raise exception 'Offline recovery window expired. Attempt remains under server expiry handling.';
  end if;

  v_len := jsonb_array_length(coalesce(p_answers,'[]'::jsonb));
  if v_len > 500 then
    raise exception 'Too many answers in submit payload.';
  end if;

  if exists(
    select 1
    from jsonb_array_elements(coalesce(p_answers,'[]'::jsonb)) j
    where nullif(j->>'question_id','') is null
       or not exists(
         select 1
         from public.buklod_quiz_questions q
         where q.id=(j->>'question_id')::uuid
           and q.exam_id=a.exam_id
           and q.is_active=true AND private.buklod_quiz_attempt_question_allowed_r1(a.id,q.id)
       )
  ) then
    raise exception 'One or more question IDs are invalid for this exam.';
  end if;

  select private.buklod_quiz_attempt_question_count_r1(a.id) into v_expected;

  select count(distinct (j->>'question_id'))::integer into v_payload
  from jsonb_array_elements(coalesce(p_answers,'[]'::jsonb)) j;

  if v_payload <> v_expected then
    raise exception 'Submission snapshot incomplete: received % of % question IDs. Recovery remains active.',
      v_payload,v_expected;
  end if;

  if a.live_session_id is not null
     and exists(
       select 1
       from public.buklod_quiz_live_sessions ls
       where ls.id=a.live_session_id and ls.status='PAUSED'
     )
  then
    raise exception 'Live class is paused. Wait for faculty to resume before submitting.';
  end if;

  with payload as (
    select distinct on ((j->>'question_id')::uuid)
           (j->>'question_id')::uuid as question_id,
           j->'answer' as answer
    from jsonb_array_elements(p_answers) j
    order by (j->>'question_id')::uuid
  )
  insert into public.buklod_quiz_responses(
    attempt_id,question_id,student_user_id,answer,saved_at,updated_at
  )
  select a.id,p.question_id,v_uid,p.answer,now(),now()
  from payload p
  on conflict on constraint buklod_quiz_responses_attempt_id_question_id_key
  do update set
    answer=excluded.answer,
    student_user_id=excluded.student_user_id,
    saved_at=now(),
    updated_at=now();

  v_status := public.buklod_quiz_compute_attempt_internal(a.id);

  if v_valid_lease then
    update public.buklod_quiz_offline_leases l
    set used_at=now()
    where l.attempt_id=a.id
      and l.student_user_id=v_uid;
  end if;

  v_late_by := greatest(0,extract(epoch from (now()-a.expires_at)));

  insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
  values(
    a.id,v_uid,'ATOMIC_SUBMIT_V4_RECOVERY',
    jsonb_build_object(
      'offline',coalesce(p_offline,false),
      'lease_valid',v_valid_lease,
      'basic_grace_used',not v_valid_lease,
      'client_completed_at',p_client_completed_at,
      'server_received_at',now(),
      'late_by_seconds',v_late_by,
      'answer_payload_count',v_len,
      'result_status',v_status
    )
  );

  select x.* into a
  from public.buklod_quiz_attempts x
  where x.id=p_attempt_id;

  return query select a.status,a.total_score,a.max_score;
end;
$function$;