-- BUKLOD QUIZ: prevent premature blank submissions and ended-room faculty changes.
-- No existing attempt, grade, roster or session rows are changed.
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
  IF a.expires_at > now() AND NOT EXISTS(
    SELECT 1 FROM public.buklod_quiz_responses r WHERE r.attempt_id=a.id
      AND r.answer IS NOT NULL AND r.answer<>'null'::jsonb
      AND nullif(trim(CASE WHEN jsonb_typeof(r.answer)='string'
        THEN r.answer #>> '{}' ELSE r.answer::text END),'') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'No server-saved answers. Attempt remains active; use recovery or return to exam.';
  END IF;


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

CREATE OR REPLACE FUNCTION public.buklod_quiz_live_student_action_v2(p_session_id uuid, p_student_user_id uuid, p_action text, p_minutes integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  s public.buklod_quiz_live_sessions%rowtype;
  e public.buklod_quiz_exams%rowtype;
  a public.buklod_quiz_attempts%rowtype;
  v_action text:=upper(trim(coalesce(p_action,'')));
  v_minutes integer;
  v_voided integer:=0;
  v_attempt_no integer;
  v_new_attempt_id uuid;
  v_expires_at timestamptz;
  v_expected_count integer:=0;
  v_saved_count integer:=0;
  v_answered_count integer:=0;
  v_prior_answered_attempt_id uuid;
  v_missing_question_ids jsonb:='[]'::jsonb;
  v_missing_inserted integer:=0;
begin
  select x.* into s
  from public.buklod_quiz_live_sessions x
  where x.id=p_session_id and x.faculty_user_id=(select auth.uid());
  if s.id is null then raise exception 'Live session not found or unauthorized.'; end if;
  IF s.status='ENDED' AND v_action IN ('READMIT','REMOVE','RESET_ATTEMPT','ALLOW_NEW_ATTEMPT','REOPEN','SET_TIME','RESET_TIMER','ADD_TIME') THEN
    RAISE EXCEPTION 'Live class has ended. Use a new session to readmit, reset, or adjust a timer.';
  END IF;


  if not exists(
    select 1 from public.buklod_quiz_live_members m
    where m.session_id=s.id and m.student_user_id=p_student_user_id
  ) then
    raise exception 'Student is not part of this live room.';
  end if;

  select x.* into e from public.buklod_quiz_exams x where x.id=s.exam_id;
  if e.id is null then raise exception 'Exam not found.'; end if;

  select x.* into a
  from public.buklod_quiz_attempts x
  where x.live_session_id=s.id
    and x.student_user_id=p_student_user_id
    and x.status<>'VOID'
  order by x.attempt_no desc
  limit 1;

  if v_action='READMIT' then
    update public.buklod_quiz_live_members m
      set status='ADMITTED',admitted_at=coalesce(m.admitted_at,now()),removed_at=null,last_seen_at=now()
    where m.session_id=s.id and m.student_user_id=p_student_user_id;
    update public.buklod_quiz_roster r
      set status='ACTIVE',updated_at=now()
    where r.exam_id=s.exam_id and r.section_id=s.section_id and r.student_user_id=p_student_user_id;

  elsif v_action='REMOVE' then
    update public.buklod_quiz_live_members m
      set status='REMOVED',removed_at=now(),last_seen_at=now()
    where m.session_id=s.id and m.student_user_id=p_student_user_id;
    update public.buklod_quiz_roster r
      set status='REMOVED',updated_at=now()
    where r.exam_id=s.exam_id and r.section_id=s.section_id and r.student_user_id=p_student_user_id;

  elsif v_action='RESET_ATTEMPT' then
    if a.id is null then raise exception 'There is no current attempt to reset.'; end if;
    v_minutes:=coalesce(p_minutes,s.duration_minutes,e.duration_minutes,30);
    if v_minutes<1 or v_minutes>1440 then raise exception 'Reset minutes must be 1 to 1440.'; end if;

    insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
    select x.id,x.student_user_id,'FACULTY_RESET_ATTEMPT',jsonb_build_object(
      'faculty_user_id',(select auth.uid()),
      'live_session_id',s.id,
      'section_id',s.section_id,
      'exam_id',s.exam_id,
      'previous_status',x.status,
      'reason','Faculty reset with immediate fresh attempt; history preserved as VOID'
    )
    from public.buklod_quiz_attempts x
    where x.exam_id=s.exam_id
      and x.section_id=s.section_id
      and x.student_user_id=p_student_user_id
      and x.status<>'VOID';

    update public.buklod_quiz_attempts x
      set status='VOID',updated_at=now()
    where x.exam_id=s.exam_id
      and x.section_id=s.section_id
      and x.student_user_id=p_student_user_id
      and x.status<>'VOID';
    get diagnostics v_voided=row_count;

    select coalesce(max(x.attempt_no),0)+1 into v_attempt_no
    from public.buklod_quiz_attempts x
    where x.exam_id=s.exam_id and x.student_user_id=p_student_user_id;

    v_expires_at:=now()+make_interval(mins=>v_minutes);
    insert into public.buklod_quiz_attempts(
      exam_id,section_id,live_session_id,student_user_id,attempt_no,status,started_at,expires_at,max_score
    ) values(
      s.exam_id,s.section_id,s.id,p_student_user_id,v_attempt_no,'STARTED',now(),v_expires_at,e.total_points
    ) returning id into v_new_attempt_id;

    insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
    values(
      v_new_attempt_id,p_student_user_id,'FACULTY_RESET_STARTED',
      jsonb_build_object('faculty_user_id',(select auth.uid()),'live_session_id',s.id,'section_id',s.section_id,'exam_id',s.exam_id,'attempt_no',v_attempt_no,'duration_minutes',v_minutes)
    );

    update public.buklod_quiz_live_members m
      set status='ADMITTED',admitted_at=coalesce(m.admitted_at,now()),removed_at=null,last_seen_at=now()
    where m.session_id=s.id and m.student_user_id=p_student_user_id;
    update public.buklod_quiz_roster r
      set status='ACTIVE',updated_at=now()
    where r.exam_id=s.exam_id and r.section_id=s.section_id and r.student_user_id=p_student_user_id;

  elsif v_action='ALLOW_NEW_ATTEMPT' then
    insert into public.buklod_quiz_attempt_allowances(live_session_id,student_user_id,bonus_attempts,granted_by,updated_at)
    values(s.id,p_student_user_id,1,(select auth.uid()),now())
    on conflict(live_session_id,student_user_id) do update set
      bonus_attempts=least(50,public.buklod_quiz_attempt_allowances.bonus_attempts+1),
      granted_by=(select auth.uid()),updated_at=now();

    update public.buklod_quiz_live_members m
      set status='ADMITTED',admitted_at=coalesce(m.admitted_at,now()),removed_at=null,last_seen_at=now()
    where m.session_id=s.id and m.student_user_id=p_student_user_id;
    update public.buklod_quiz_roster r
      set status='ACTIVE',updated_at=now()
    where r.exam_id=s.exam_id and r.section_id=s.section_id and r.student_user_id=p_student_user_id;

  elsif v_action='REOPEN' then
    v_minutes:=coalesce(p_minutes,s.duration_minutes,e.duration_minutes,30);
    if v_minutes<1 or v_minutes>1440 then raise exception 'Reopen minutes must be 1 to 1440.'; end if;
    v_expires_at:=now()+make_interval(mins=>v_minutes);
    if a.id is null then
      -- Recover an orphaned, zero-answer STARTED attempt from an ENDED room.
      -- Explicit faculty REOPEN only: never silently VOID, erase, or duplicate it.
      if s.status<>'LIVE' then
        raise exception 'Recovery requires an active LIVE room. No records changed.';
      end if;
      if not exists(
        select 1 from public.buklod_quiz_live_members m
        where m.session_id=s.id and m.student_user_id=p_student_user_id and m.status='ADMITTED'
      ) then raise exception 'Student must be admitted to the current room before recovery.'; end if;

      select ax.* into a
      from public.buklod_quiz_attempts ax
      join public.buklod_quiz_live_sessions old_ls on old_ls.id=ax.live_session_id
      where ax.exam_id=s.exam_id and ax.section_id=s.section_id
        and ax.student_user_id=p_student_user_id and ax.status='STARTED'
        and ax.live_session_id<>s.id and old_ls.status='ENDED'
        and old_ls.exam_id=s.exam_id and old_ls.section_id=s.section_id
        and old_ls.question_count=s.question_count
        and coalesce(old_ls.settings_snapshot->>'question_selection_mode','')
            =coalesce(s.settings_snapshot->>'question_selection_mode','')
      order by ax.attempt_no desc,ax.created_at desc
      limit 1
      for update of ax;

      if a.id is null then raise exception 'No safe unfinished attempt to recover. Use Troubleshoot to review prior attempts.'; end if;
      if exists(
        select 1 from public.buklod_quiz_responses rr where rr.attempt_id=a.id
      ) then
        raise exception 'This earlier attempt has saved responses. Automatic transfer blocked: review it before reopening.';
      end if;
      if private.buklod_quiz_attempt_question_count_r1(a.id)<>s.question_count
         or coalesce(a.max_score,0)<>coalesce(s.total_score_target,0) then
        raise exception 'Question count or maximum score differs between rooms. Recovery blocked.';
      end if;
      if exists(
        select 1 from public.buklod_quiz_attempts other
        where other.exam_id=s.exam_id and other.student_user_id=p_student_user_id
          and other.status='STARTED' and other.id<>a.id
      ) then
        raise exception 'Another unfinished attempt needs separate review; no records changed.';
      end if;
      update public.buklod_quiz_attempts x
        set live_session_id=s.id,expires_at=v_expires_at,updated_at=now()
      where x.id=a.id and x.status='STARTED' and x.live_session_id<>s.id;
      if not found then raise exception 'The attempt changed before recovery; refresh and retry.'; end if;
      insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
      values(
        a.id,p_student_user_id,'FACULTY_REOPEN_ORPHANED_ZERO_ANSWER_ATTEMPT',
        jsonb_build_object('faculty_user_id',(select auth.uid()),'old_live_session_id',a.live_session_id,
           'new_live_session_id',s.id,'exam_id',s.exam_id,'section_id',s.section_id,
           'attempt_no',a.attempt_no,'duration_minutes',v_minutes,
           'saved_answer_count',0,'source','REOPEN_EXISTING_ATTEMPT')
      );
      v_new_attempt_id:=a.id;
      v_attempt_no:=a.attempt_no;
    else
      if a.status='STARTED' then raise exception 'Attempt is already active.'; end if;
      update public.buklod_quiz_attempts x
        set status='STARTED',released_at=null,submitted_at=null,expires_at=v_expires_at,updated_at=now()
      where x.id=a.id;
      v_new_attempt_id:=a.id;
      v_attempt_no:=a.attempt_no;
    end if;

  elsif v_action in ('SET_TIME','RESET_TIMER') then
    if a.id is null or a.status<>'STARTED' then raise exception 'No active attempt for timer update.'; end if;
    v_minutes:=coalesce(p_minutes,s.duration_minutes,e.duration_minutes,30);
    if v_minutes<1 or v_minutes>1440 then raise exception 'Timer minutes must be 1 to 1440.'; end if;
    v_expires_at:=now()+make_interval(mins=>v_minutes);
    update public.buklod_quiz_attempts x set expires_at=v_expires_at,updated_at=now() where x.id=a.id;
    v_new_attempt_id:=a.id;
    v_attempt_no:=a.attempt_no;

  elsif v_action='ADD_TIME' then
    if a.id is null or a.status<>'STARTED' then raise exception 'No active attempt for extra time.'; end if;
    v_minutes:=coalesce(p_minutes,5);
    if v_minutes<1 or v_minutes>1440 then raise exception 'Extra minutes must be 1 to 1440.'; end if;
    update public.buklod_quiz_attempts x
      set expires_at=greatest(x.expires_at,now())+make_interval(mins=>v_minutes),updated_at=now()
    where x.id=a.id
    returning x.expires_at into v_expires_at;
    v_new_attempt_id:=a.id;
    v_attempt_no:=a.attempt_no;

  elsif v_action='FORCE_SUBMIT' then
    if a.id is null or a.status<>'STARTED' then raise exception 'No active attempt to submit.'; end if;

    select private.buklod_quiz_attempt_question_count_r1(a.id) into v_expected_count;

    select
      count(distinct r.question_id)::integer,
      count(distinct r.question_id) filter (
        where r.answer is not null
          and nullif(trim(case
            when jsonb_typeof(r.answer)='string' then r.answer #>> '{}'
            else r.answer::text
          end),'') is not null
      )::integer
    into v_saved_count,v_answered_count
    from public.buklod_quiz_responses r
    join public.buklod_quiz_questions q on q.id=r.question_id
    where r.attempt_id=a.id
      and q.exam_id=s.exam_id
      and q.is_active=true;

    if v_answered_count=0 then
      raise exception 'Force Submit blocked: this active attempt has 0 server-saved answers. Use recovery/resume; no 0-score record was created.';
    end if;

    select coalesce(jsonb_agg(to_jsonb(q.id) order by q.sort_order), '[]'::jsonb)
      into v_missing_question_ids
    from public.buklod_quiz_questions q
    where q.exam_id=s.exam_id
      and q.is_active=true
      and private.buklod_quiz_attempt_question_allowed_r1(a.id,q.id)
      and not exists(
        select 1
        from public.buklod_quiz_responses r
        where r.attempt_id=a.id and r.question_id=q.id
      );

    insert into public.buklod_quiz_responses(
      attempt_id,question_id,student_user_id,answer,saved_at,updated_at
    )
    select a.id,q.id,a.student_user_id,null::jsonb,now(),now()
    from public.buklod_quiz_questions q
    where q.exam_id=s.exam_id
      and q.is_active=true
      and private.buklod_quiz_attempt_question_allowed_r1(a.id,q.id)
      and not exists(
        select 1 from public.buklod_quiz_responses r
        where r.attempt_id=a.id and r.question_id=q.id
      )
    on conflict on constraint buklod_quiz_responses_attempt_id_question_id_key do nothing;
    get diagnostics v_missing_inserted=row_count;

    perform public.buklod_quiz_compute_attempt_internal(a.id);

    insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
    values(
      a.id,
      p_student_user_id,
      'FACULTY_FORCE_SUBMIT_COMPLETE',
      jsonb_build_object(
        'faculty_user_id',(select auth.uid()),
        'live_session_id',s.id,
        'section_id',s.section_id,
        'exam_id',s.exam_id,
        'expected_count',v_expected_count,
        'saved_count_before',v_saved_count,
        'answered_count_before',v_answered_count,
        'unanswered_inserted_count',v_missing_inserted,
        'missing_question_ids',v_missing_question_ids,
        'incomplete_submission_allowed',true
      )
    );

    v_new_attempt_id:=a.id;
    v_attempt_no:=a.attempt_no;

  else
    raise exception 'Unsupported student action.';
  end if;

  if v_new_attempt_id is not null and v_expires_at is null then
    select x.expires_at into v_expires_at
    from public.buklod_quiz_attempts x
    where x.id=v_new_attempt_id;
  end if;

  return jsonb_build_object(
    'ok',true,
    'action',v_action,
    'student_user_id',p_student_user_id,
    'attempt_id',coalesce(v_new_attempt_id,a.id),
    'attempt_no',coalesce(v_attempt_no,a.attempt_no),
    'expires_at',v_expires_at,
    'voided_attempts',v_voided,
    'unanswered_inserted_count',v_missing_inserted
  );
end
$function$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_live_bulk_action_v1(p_session_id uuid, p_action text, p_student_user_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  s public.buklod_quiz_live_sessions%rowtype;
  act text:=upper(trim(coalesce(p_action,'')));
  n integer:=0;
  rowx record;
  v_answered_count integer:=0;
begin
  select x.* into s
  from public.buklod_quiz_live_sessions x
  where x.id=p_session_id
    and x.faculty_user_id=(select auth.uid());

  if s.id is null then
    raise exception 'Live class not found or unauthorized.';
  end if;
  IF s.status='ENDED' AND act IN ('ADMIT','ADMIT_ALL','REMOVE','REMOVE_SELECTED','RESET_ATTEMPT','RESET_SELECTED') THEN
    RAISE EXCEPTION 'Live class has ended. Bulk admissions/removals/resets require a new session.';
  END IF;


  if act in ('ADMIT','ADMIT_ALL') then
    update public.buklod_quiz_live_members
      set status='ADMITTED',
          admitted_at=coalesce(admitted_at,now()),
          removed_at=null,
          last_seen_at=now()
    where session_id=p_session_id
      and status in ('WAITING','REMOVED','LEFT')
      and (p_student_user_ids is null or student_user_id=any(p_student_user_ids));
    get diagnostics n=row_count;

    update public.buklod_quiz_roster r
      set status='ACTIVE',updated_at=now()
    where r.exam_id=s.exam_id
      and r.section_id=s.section_id
      and exists(
        select 1
        from public.buklod_quiz_live_members lm
        where lm.session_id=p_session_id
          and lm.student_user_id=r.student_user_id
          and lm.status='ADMITTED'
      )
      and (p_student_user_ids is null or r.student_user_id=any(p_student_user_ids));

    return n;

  elsif act in ('REMOVE','REMOVE_SELECTED') then
    update public.buklod_quiz_live_members
      set status='REMOVED',removed_at=now(),last_seen_at=now()
    where session_id=p_session_id
      and status<>'REMOVED'
      and (p_student_user_ids is null or student_user_id=any(p_student_user_ids));
    get diagnostics n=row_count;

    update public.buklod_quiz_roster r
      set status='REMOVED',updated_at=now()
    where r.exam_id=s.exam_id
      and r.section_id=s.section_id
      and (p_student_user_ids is null or r.student_user_id=any(p_student_user_ids))
      and exists(
        select 1
        from public.buklod_quiz_live_members lm
        where lm.session_id=p_session_id
          and lm.student_user_id=r.student_user_id
          and lm.status='REMOVED'
      );

    return n;

  elsif act in ('FORCE_SUBMIT','FORCE_SUBMIT_ALL') then
    for rowx in
      select a.id,a.student_user_id
      from public.buklod_quiz_attempts a
      where a.live_session_id=p_session_id
        and a.exam_id=s.exam_id
        and a.section_id=s.section_id
        and a.status='STARTED'
        and (p_student_user_ids is null or a.student_user_id=any(p_student_user_ids))
    loop
      select count(distinct r.question_id) filter (
        where r.answer is not null
          and nullif(trim(case
            when jsonb_typeof(r.answer)='string' then r.answer #>> '{}'
            else r.answer::text
          end),'') is not null
      )::integer
      into v_answered_count
      from public.buklod_quiz_responses r
      join public.buklod_quiz_questions q on q.id=r.question_id
      where r.attempt_id=rowx.id
        and q.exam_id=s.exam_id
        and q.is_active=true;

      if coalesce(v_answered_count,0)=0 then
        insert into public.buklod_quiz_events(
          attempt_id,student_user_id,event_type,event_data
        )
        values(
          rowx.id,rowx.student_user_id,
          'FACULTY_BULK_FORCE_SUBMIT_SKIPPED_ZERO_ANSWER',
          jsonb_build_object(
            'faculty_user_id',(select auth.uid()),
            'live_session_id',s.id,
            'section_id',s.section_id,
            'exam_id',s.exam_id,
            'reason','0 server-saved answers; attempt kept STARTED for recovery/resume'
          )
        );
        continue;
      end if;

      perform public.buklod_quiz_live_student_action_v2(
        s.id,rowx.student_user_id,'FORCE_SUBMIT',null
      );
      n:=n+1;
    end loop;

    return n;

  elsif act in ('RELEASE_RESULTS','RELEASE_ALL') then
    update public.buklod_quiz_attempts
      set status='RELEASED',released_at=now(),updated_at=now()
    where live_session_id=p_session_id
      and exam_id=s.exam_id
      and section_id=s.section_id
      and status='GRADED'
      and (p_student_user_ids is null or student_user_id=any(p_student_user_ids));
    get diagnostics n=row_count;
    return n;

  elsif act in ('RESET_ATTEMPT','RESET_SELECTED') then
    for rowx in
      select distinct on(a.student_user_id)
        a.id,a.student_user_id
      from public.buklod_quiz_attempts a
      where a.live_session_id=p_session_id
        and a.exam_id=s.exam_id
        and a.section_id=s.section_id
        and a.status<>'VOID'
        and (p_student_user_ids is null or a.student_user_id=any(p_student_user_ids))
      order by a.student_user_id,a.attempt_no desc
    loop
      update public.buklod_quiz_attempts
        set status='VOID',updated_at=now()
      where id=rowx.id;
      n:=n+1;
    end loop;
    return n;

  else
    raise exception 'Unsupported bulk action.';
  end if;
end
$function$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_live_bulk_action_v3(p_session_id uuid, p_action text, p_student_user_ids uuid[] DEFAULT NULL::uuid[], p_minutes integer DEFAULT NULL::integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  s public.buklod_quiz_live_sessions%rowtype;
  act text:=upper(trim(coalesce(p_action,'')));
  n integer:=0;
  r record;
  v_minutes integer;
begin
  select x.* into s from public.buklod_quiz_live_sessions x
  where x.id=p_session_id and x.faculty_user_id=(select auth.uid());
  if s.id is null then raise exception 'Live class not found or unauthorized.'; end if;
  IF s.status='ENDED' AND act IN ('SET_TIME','ADD_TIME','RESET_ATTEMPT','RESET_SELECTED','RESET_ALL') THEN
    RAISE EXCEPTION 'Live class has ended. Bulk timer/reset actions require a new session.';
  END IF;


  if act in ('SET_TIME','ADD_TIME') then
    v_minutes:=coalesce(p_minutes,case when act='ADD_TIME' then 5 else s.duration_minutes end,30);
    if v_minutes<1 or v_minutes>1440 then raise exception 'Minutes must be 1 to 1440.'; end if;
    if act='SET_TIME' then
      update public.buklod_quiz_attempts a
        set expires_at=now()+make_interval(mins=>v_minutes),updated_at=now()
      where a.live_session_id=s.id and a.status='STARTED'
        and (p_student_user_ids is null or a.student_user_id=any(p_student_user_ids));
    else
      update public.buklod_quiz_attempts a
        set expires_at=greatest(a.expires_at,now())+make_interval(mins=>v_minutes),updated_at=now()
      where a.live_session_id=s.id and a.status='STARTED'
        and (p_student_user_ids is null or a.student_user_id=any(p_student_user_ids));
    end if;
    get diagnostics n=row_count;
    return n;
  elsif act in ('RESET_ATTEMPT','RESET_SELECTED','RESET_ALL') then
    for r in
      select m.student_user_id
      from public.buklod_quiz_live_members m
      where m.session_id=s.id
        and (p_student_user_ids is null or m.student_user_id=any(p_student_user_ids))
        and exists(
          select 1 from public.buklod_quiz_attempts a
          where a.exam_id=s.exam_id and a.section_id=s.section_id
            and a.student_user_id=m.student_user_id and a.status<>'VOID'
        )
    loop
      perform public.buklod_quiz_live_student_action_v2(s.id,r.student_user_id,'RESET_ATTEMPT',p_minutes);
      n:=n+1;
    end loop;
    return n;
  else
    return public.buklod_quiz_live_bulk_action_v1(p_session_id,p_action,p_student_user_ids);
  end if;
end
$function$;
