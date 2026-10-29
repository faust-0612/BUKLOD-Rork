-- Existing faculty / student live actions now follow assigned K for new sessions only.
CREATE OR REPLACE FUNCTION public.buklod_quiz_live_start_attempt_v3(p_session_id uuid, p_device_token text DEFAULT NULL::text)
 RETURNS TABLE(attempt_id uuid, status text, expires_at timestamp with time zone, duration_minutes integer, one_question_at_a_time boolean, no_backtracking boolean, section_id uuid, section_name text, question_count integer, total_score_target numeric, randomize_choices boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  a public.buklod_quiz_attempts%rowtype;
begin
  select x.* into a
  from public.buklod_quiz_attempts x
  where x.live_session_id=p_session_id
    and x.student_user_id=(select auth.uid())
    and x.status='STARTED'
  order by x.attempt_no desc
  limit 1;

  if a.id is not null
     and a.expires_at <= now()
     and (
       now() <= a.expires_at + interval '2 minutes'
       or exists(
         select 1
         from public.buklod_quiz_offline_leases l
         where l.attempt_id=a.id
           and l.student_user_id=(select auth.uid())
           and l.used_at is null
           and l.sync_grace_expires_at > now()
       )
     )
  then
    insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
    select a.id,a.student_user_id,'EXPIRED_ATTEMPT_RECOVERY_WINDOW_OPEN',
           jsonb_build_object(
             'expires_at',a.expires_at,
             'opened_at',now(),
             'source','LIVE_START_V3'
           )
    where not exists(
      select 1 from public.buklod_quiz_events e
      where e.attempt_id=a.id
        and e.event_type='EXPIRED_ATTEMPT_RECOVERY_WINDOW_OPEN'
    );

    return query
    select
      a.id,
      a.status,
      a.expires_at,
      e.duration_minutes,
      e.one_question_at_a_time,
      e.no_backtracking,
      ls.section_id,
      sec.name::text,
      private.buklod_quiz_attempt_question_count_r1(a.id),
      coalesce((select sum(selected_points) from private.buklod_quiz_attempt_questions_r1 x where x.attempt_id=a.id),e.total_points)::numeric,
      false
    from public.buklod_quiz_live_sessions ls
    join public.buklod_quiz_sections sec
      on sec.id=ls.section_id and sec.exam_id=ls.exam_id
    join public.buklod_quiz_exams e
      on e.id=ls.exam_id
    where ls.id=p_session_id;
    return;
  end if;

  return query
  with started as (
    select * from public.buklod_quiz_live_start_attempt_v1(p_session_id)
  )
  select
    started.attempt_id,
    started.status,
    started.expires_at,
    started.duration_minutes,
    started.one_question_at_a_time,
    started.no_backtracking,
    ls.section_id,
    sec.name::text,
    private.buklod_quiz_attempt_question_count_r1(started.attempt_id),
    coalesce((select sum(selected_points) from private.buklod_quiz_attempt_questions_r1 x where x.attempt_id=started.attempt_id),e.total_points)::numeric,
    false
  from started
  join public.buklod_quiz_live_sessions ls on ls.id=p_session_id
  join public.buklod_quiz_sections sec on sec.id=ls.section_id and sec.exam_id=ls.exam_id
  join public.buklod_quiz_exams e on e.id=ls.exam_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_faculty_live_room_v3(p_session_id uuid)
 RETURNS TABLE(session_id uuid, exam_id uuid, section_id uuid, section_name text, exam_title text, join_code text, live_status text, admission_mode text, allow_late_join boolean, student_user_id uuid, surname text, first_name text, display_name text, member_status text, joined_at timestamp with time zone, attempt_id uuid, attempt_no integer, attempt_status text, started_at timestamp with time zone, expires_at timestamp with time zone, remaining_seconds integer, answered_count integer, total_questions integer, total_score numeric, max_score numeric, score_percent numeric, integrity_events integer, released_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    ls.id,ls.exam_id,ls.section_id,sec.name,e.title,ls.join_code,ls.status,ls.admission_mode,ls.allow_late_join,
    m.student_user_id,p.surname,p.first_name,
    coalesce(nullif(p.full_name,''),trim(concat_ws(' ',p.first_name,p.surname)),'BUKLOD Student'),
    m.status,m.joined_at,
    a.id,a.attempt_no,a.status,a.started_at,a.expires_at,
    case when a.status='STARTED' and a.expires_at is not null
      then greatest(0,floor(extract(epoch from (a.expires_at-now())))::int)
      else null end,
    coalesce((select count(*)::int from public.buklod_quiz_responses r where r.attempt_id=a.id and r.answer is not null),0),
    CASE WHEN a.id IS NOT NULL THEN private.buklod_quiz_attempt_question_count_r1(a.id)
     ELSE coalesce(ls.question_count,(select count(*)::int from public.buklod_quiz_questions q where q.exam_id=ls.exam_id and q.is_active=true)) END,
    a.total_score,a.max_score,
    case when a.max_score>0 then public.buklod_quiz_transmuted_percent_v1(a.total_score,a.max_score) else null end,
    case when a.id is null then 0 else private.buklod_quiz_canonical_integrity_count_v1(a.id) end,
    a.released_at
  from public.buklod_quiz_live_sessions ls
  join public.buklod_quiz_exams e on e.id=ls.exam_id
  join public.buklod_quiz_sections sec on sec.id=ls.section_id
  join public.buklod_quiz_live_members m on m.session_id=ls.id
  left join public.profiles p on p.id=m.student_user_id
  left join lateral (
    select x.*
    from public.buklod_quiz_attempts x
    where x.live_session_id=ls.id and x.student_user_id=m.student_user_id and x.status<>'VOID'
    order by x.attempt_no desc
    limit 1
  ) a on true
  where ls.id=p_session_id
    and ls.faculty_user_id=(select auth.uid())
    and m.status<>'REMOVED'
  order by lower(coalesce(p.surname,p.full_name,'')),lower(coalesce(p.first_name,'')),m.joined_at
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
    if a.id is null then raise exception 'No completed attempt to reopen.'; end if;
    if a.status='STARTED' then raise exception 'Attempt is already active.'; end if;
    v_minutes:=coalesce(p_minutes,s.duration_minutes,e.duration_minutes,30);
    if v_minutes<1 or v_minutes>1440 then raise exception 'Reopen minutes must be 1 to 1440.'; end if;
    v_expires_at:=now()+make_interval(mins=>v_minutes);
    update public.buklod_quiz_attempts x
      set status='STARTED',released_at=null,submitted_at=null,expires_at=v_expires_at,updated_at=now()
    where x.id=a.id;
    v_new_attempt_id:=a.id;
    v_attempt_no:=a.attempt_no;

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

    select count(*)::integer into v_expected_count
    from public.buklod_quiz_questions q
    where q.exam_id=s.exam_id and q.is_active=true;

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