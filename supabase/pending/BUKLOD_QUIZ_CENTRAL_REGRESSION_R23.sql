-- R23 regression corrections. DEV only; after R22.
CREATE OR REPLACE FUNCTION public.buklod_quiz_compute_attempt_internal(p_attempt_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_obj numeric;
  v_man numeric;
  v_max numeric;
  v_pending boolean;
  v_status text;
  v_deduction numeric;
  a public.buklod_quiz_attempts%rowtype;
begin
  select x.* into a from public.buklod_quiz_attempts x where x.id=p_attempt_id for update;
  if not found then raise exception 'Attempt not found'; end if;
  if a.status in ('RELEASED','GRADED') then return a.status; end if;
  if a.status not in ('STARTED','NEEDS_REVIEW') then raise exception 'Attempt cannot be graded'; end if;
  if a.live_session_id is null or not exists(select 1 from public.buklod_quiz_attempt_questions q where q.attempt_id=a.id) or not exists(select 1 from public.buklod_quiz_live_question_snapshots s where s.session_id=a.live_session_id) then raise exception 'Historical grading reference unavailable; explicit faculty review required'; end if;
  if a.status='STARTED' and not exists(select 1 from public.buklod_quiz_responses r where r.attempt_id=a.id and r.answer is not null and r.answer not in ('null'::jsonb,'[]'::jsonb,'{}'::jsonb) and nullif(btrim(r.answer#>>'{}'),'') is not null) then raise exception 'Blank attempt requires recovery; no automatic grade'; end if;
  if exists(select 1 from public.buklod_quiz_attempt_questions aq where aq.attempt_id=a.id) then
    if (select count(*) from private.buklod_quiz_grading_items_r18(a.id))<>(select count(*) from public.buklod_quiz_attempt_questions aq where aq.attempt_id=a.id) then raise exception 'Immutable grading references incomplete'; end if;
    if exists(select 1 from public.buklod_quiz_responses r where r.attempt_id=a.id and not exists(select 1 from private.buklod_quiz_grading_items_r18(a.id) q where q.id=r.question_id)) then raise exception 'Unassigned response'; end if;
  end if;
  if exists(select 1 from public.buklod_quiz_responses r join private.buklod_quiz_grading_items_r18(a.id) q on q.id=r.question_id where r.attempt_id=a.id and r.manual_score is not null and (r.manual_score<0 or r.manual_score>q.points or r.manual_score::text in ('NaN','Infinity','-Infinity'))) then raise exception 'Manual score out of bounds'; end if;
  update public.buklod_quiz_responses r
     set objective_score = case
       when q.question_type in ('MCQ','TRUE_FALSE') then
         case when nullif(trim(r.answer#>>'{}'),'') is not null and nullif(trim(q.correct_answer#>>'{}'),'') is not null and lower(trim(r.answer#>>'{}')) = lower(trim(q.correct_answer#>>'{}')) then q.points else 0 end
       when q.question_type='SHORT_TEXT' then
         case
           when r.manual_score is not null then 0
           when public.buklod_quiz_normalize_short_text_v1(r.answer#>>'{}') = '' then 0
           when public.buklod_quiz_normalize_short_text_v1(r.answer#>>'{}') = public.buklod_quiz_normalize_short_text_v1(q.correct_answer#>>'{}') then q.points
           else 0
         end
       when q.question_type='NUMERIC' then
         case when trim(coalesce(r.answer#>>'{}',''))~'^-?[0-9]+([.][0-9]+)?$'
                and trim(coalesce(q.correct_answer#>>'{}',''))~'^-?[0-9]+([.][0-9]+)?$'
                and abs((r.answer#>>'{}')::numeric-(q.correct_answer#>>'{}')::numeric)<=0.000001
              then q.points else 0 end
       else null
     end,
     is_correct = case
       when q.question_type in ('MCQ','TRUE_FALSE') then
         nullif(trim(r.answer#>>'{}'),'') is not null and nullif(trim(q.correct_answer#>>'{}'),'') is not null and lower(trim(r.answer#>>'{}')) = lower(trim(q.correct_answer#>>'{}'))
       when q.question_type='SHORT_TEXT' then
         case
           when r.manual_score is not null then
             case when r.manual_score >= q.points then true when r.manual_score <= 0 then false else null end
           when public.buklod_quiz_normalize_short_text_v1(r.answer#>>'{}') = '' then false
           when public.buklod_quiz_normalize_short_text_v1(r.answer#>>'{}') = public.buklod_quiz_normalize_short_text_v1(q.correct_answer#>>'{}') then true
           else null
         end
       when q.question_type='NUMERIC' then
         case when trim(coalesce(r.answer#>>'{}',''))~'^-?[0-9]+([.][0-9]+)?$'
                and trim(coalesce(q.correct_answer#>>'{}',''))~'^-?[0-9]+([.][0-9]+)?$'
              then abs((r.answer#>>'{}')::numeric-(q.correct_answer#>>'{}')::numeric)<=0.000001
              else false end
       else case when r.manual_score is null then null when r.manual_score >= q.points then true when r.manual_score <= 0 then false else null end
     end,
     needs_review = case
       when q.question_type='SHORT_TEXT' then
         r.manual_score is null
         and public.buklod_quiz_normalize_short_text_v1(r.answer#>>'{}') <> ''
         and public.buklod_quiz_normalize_short_text_v1(r.answer#>>'{}') <> public.buklod_quiz_normalize_short_text_v1(q.correct_answer#>>'{}')
       when q.question_type in ('ESSAY','ENUMERATION','MANUAL') then
         r.manual_score is null
         and case
           when r.answer is null or r.answer='null'::jsonb then false
           when jsonb_typeof(r.answer)='string' then nullif(trim(r.answer#>>'{}'),'') is not null
           when jsonb_typeof(r.answer)='array' then jsonb_array_length(r.answer)>0
           when jsonb_typeof(r.answer)='object' then r.answer <> '{}'::jsonb
           else true
         end
       else false
     end
  from private.buklod_quiz_grading_items_r18(p_attempt_id) q
  where q.id = r.question_id
    and r.attempt_id = p_attempt_id;

  select
    coalesce(sum(case when r.manual_score is null then coalesce(r.objective_score,0) else 0 end),0),
    coalesce(sum(coalesce(r.manual_score,0)),0),
    coalesce(sum(q.points),0),
    coalesce(bool_or(r.needs_review and r.manual_score is null),false)
    into v_obj,v_man,v_max,v_pending
  from public.buklod_quiz_responses r
  join private.buklod_quiz_grading_items_r18(p_attempt_id) q on q.id=r.question_id
  where r.attempt_id=p_attempt_id
    ;
  if exists(select 1 from public.buklod_quiz_attempt_questions aq where aq.attempt_id=a.id) then
    select coalesce(sum(q.points),0) into v_max from private.buklod_quiz_grading_items_r18(a.id) q;
    if v_max is distinct from a.max_score then raise exception 'Assigned maximum score mismatch'; end if;
  end if;

  select coalesce(sum(d.deduction_points),0)
    into v_deduction
  from public.buklod_quiz_integrity_deductions d
  where d.attempt_id=p_attempt_id;

  v_status := case when v_pending then 'NEEDS_REVIEW' else 'GRADED' end;

  update public.buklod_quiz_attempts
     set status=v_status,
         objective_score=v_obj,
         manual_score=v_man,
         total_score=greatest(0,v_obj+v_man-v_deduction),
         max_score=v_max,
         submitted_at=coalesce(submitted_at,now()),
         updated_at=now()
   where id=p_attempt_id;

  return v_status;
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
  if auth.uid() is null or public.buklod_quiz_is_examiner(auth.uid()) is distinct from true then raise exception 'Examiner access required' using errcode='42501'; end if;
  select x.* into s
  from public.buklod_quiz_live_sessions x
  where x.id=p_session_id and x.faculty_user_id=(select auth.uid()) and exists(select 1 from public.buklod_quiz_exams ex where ex.id=x.exam_id and ex.owner_user_id=auth.uid()) for update;
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

  perform 1 from public.buklod_quiz_live_members m where m.session_id=s.id and m.student_user_id=p_student_user_id for update;
  perform 1 from public.buklod_quiz_roster r where r.exam_id=s.exam_id and r.section_id=s.section_id and r.student_user_id=p_student_user_id for update;
  if not found then raise exception 'Exact class roster required'; end if;
  select x.* into e from public.buklod_quiz_exams x where x.id=s.exam_id;
  if e.id is null then raise exception 'Exam not found.'; end if;

  select x.* into a
  from public.buklod_quiz_attempts x
  where x.live_session_id=s.id
    and x.student_user_id=p_student_user_id and x.exam_id=s.exam_id and x.section_id=s.section_id
    and x.status<>'VOID'
  order by x.attempt_no desc,x.created_at desc,x.id desc
  limit 1 for update;

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
    if a.id is null or a.status<>'STARTED' or a.released_at is not null or a.submitted_at is not null then raise exception 'Only an unfinished attempt may be reset; use RETAKE for unreleased completed records'; end if;
    if exists(select 1 from public.buklod_quiz_responses r where r.attempt_id=a.id) then raise exception 'Saved responses exist; use recovery instead of reset'; end if;
    if not exists(select 1 from public.buklod_quiz_live_question_snapshots q where q.session_id=s.id) or nullif(s.question_snapshot_hash,'') is null then raise exception 'Verified room snapshot required for reset'; end if;
    if exists(select 1 from public.buklod_quiz_attempts t where t.exam_id=s.exam_id and t.student_user_id=p_student_user_id and t.status='STARTED' and t.id<>a.id) then raise exception 'Another unfinished attempt requires review'; end if;
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
      and x.id=a.id and x.status='STARTED' and x.released_at is null and x.submitted_at is null;

    update public.buklod_quiz_attempts x
      set status='VOID',updated_at=now()
    where x.exam_id=s.exam_id
      and x.section_id=s.section_id
      and x.student_user_id=p_student_user_id
      and x.id=a.id and x.status='STARTED' and x.released_at is null and x.submitted_at is null;
    get diagnostics v_voided=row_count;

    select coalesce(max(x.attempt_no),0)+1 into v_attempt_no
    from public.buklod_quiz_attempts x
    where x.exam_id=s.exam_id and x.student_user_id=p_student_user_id;

    v_expires_at:=now()+make_interval(mins=>v_minutes);
    insert into public.buklod_quiz_attempts(
      exam_id,section_id,live_session_id,student_user_id,attempt_no,status,started_at,expires_at,max_score,security_snapshot
    ) values(
      s.exam_id,s.section_id,s.id,p_student_user_id,v_attempt_no,'STARTED',now(),v_expires_at,s.total_score_target,
      coalesce(s.settings_snapshot,'{}'::jsonb)||jsonb_build_object('device_policy',coalesce(s.device_policy,e.device_policy),'snapshot_hash',s.question_snapshot_hash)
    ) returning id into v_new_attempt_id;
    if public.buklod_quiz_seed_attempt_questions_v2(v_new_attempt_id) is distinct from s.question_count or not exists(select 1 from public.buklod_quiz_attempts t where t.id=v_new_attempt_id and t.max_score=s.total_score_target) then raise exception 'Reset assignment mismatch'; end if;

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
        and old_ls.question_count=s.question_count and nullif(s.question_snapshot_hash,'') is not null and old_ls.question_snapshot_hash=s.question_snapshot_hash
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
      if a.status<>'STARTED' or a.submitted_at is not null or a.released_at is not null then raise exception 'Completed results cannot be reopened; use authorized retake'; end if;
      if a.expires_at>now() then raise exception 'Attempt is already active.'; end if;
      update public.buklod_quiz_attempts x set expires_at=v_expires_at,updated_at=now() where x.id=a.id and x.status='STARTED';
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

    select count(*)::integer into v_expected_count from public.buklod_quiz_attempt_questions q where q.attempt_id=a.id;
    if v_expected_count<1 or (select count(*) from private.buklod_quiz_grading_items_r18(a.id))<>v_expected_count then raise exception 'Verified assignments required for force submit'; end if;

    select
      count(distinct r.question_id)::integer,
      count(distinct r.question_id) filter (
        where r.answer is not null and r.answer not in ('null'::jsonb,'[]'::jsonb,'{}'::jsonb)
          and nullif(trim(case
            when jsonb_typeof(r.answer)='string' then r.answer #>> '{}'
            else r.answer::text
          end),'') is not null
      )::integer
    into v_saved_count,v_answered_count
    from public.buklod_quiz_responses r
    join public.buklod_quiz_attempt_questions q on q.attempt_id=r.attempt_id and q.question_id=r.question_id
    where r.attempt_id=a.id and r.student_user_id=a.student_user_id;

    if v_answered_count=0 then
      raise exception 'Force Submit blocked: this active attempt has 0 server-saved answers. Use recovery/resume; no 0-score record was created.';
    end if;

    select coalesce(jsonb_agg(to_jsonb(q.question_id) order by q.display_order), '[]'::jsonb)
      into v_missing_question_ids
    from public.buklod_quiz_attempt_questions q
    where q.attempt_id=a.id
      and not exists(
        select 1
        from public.buklod_quiz_responses r
        where r.attempt_id=a.id and r.question_id=q.question_id
      );

    insert into public.buklod_quiz_responses(
      attempt_id,question_id,student_user_id,answer,saved_at,updated_at
    )
    select a.id,q.question_id,a.student_user_id,null::jsonb,now(),now()
    from public.buklod_quiz_attempt_questions q
    where q.attempt_id=a.id
      and not exists(
        select 1 from public.buklod_quiz_responses r
        where r.attempt_id=a.id and r.question_id=q.question_id
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

  if v_action in ('REOPEN','SET_TIME','RESET_TIMER','ADD_TIME','RESET_ATTEMPT','FORCE_SUBMIT') and a.id is not null then
    update public.buklod_quiz_offline_leases l set revoked_at=now() where l.attempt_id=a.id and l.used_at is null and l.revoked_at is null;
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
CREATE OR REPLACE FUNCTION public.buklod_quiz_live_student_action_v1(p_session_id uuid,p_student_user_id uuid,p_action text,p_minutes integer DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $fn$ SELECT public.buklod_quiz_live_student_action_v2(p_session_id,p_student_user_id,p_action,p_minutes); $fn$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_live_bulk_action_v3(
 p_session_id uuid,p_action text,p_student_user_ids uuid[] DEFAULT NULL,p_minutes integer DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
 actor uuid:=auth.uid();
 act text:=upper(btrim(coalesce(p_action,'')));
 s public.buklod_quiz_live_sessions%ROWTYPE;
 a public.buklod_quiz_attempts%ROWTYPE;
 m record;
 result jsonb;
 minutes integer;
 n integer:=0;
 original_score numeric;
 original_max numeric;
 new_id uuid;
BEGIN
 IF actor IS NULL OR public.buklod_quiz_is_examiner(actor) IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'Examiner access required' USING ERRCODE='42501';
 END IF;
 SELECT ls.* INTO s FROM public.buklod_quiz_live_sessions ls
 JOIN public.buklod_quiz_exams e ON e.id=ls.exam_id
 JOIN public.buklod_quiz_sections sec ON sec.id=ls.section_id AND sec.exam_id=e.id
 WHERE ls.id=p_session_id AND ls.faculty_user_id=actor AND e.owner_user_id=actor FOR UPDATE OF ls;
 IF NOT FOUND THEN RAISE EXCEPTION 'Live class not found or unauthorized' USING ERRCODE='42501'; END IF;
 IF act NOT IN ('ADMIT','ADMIT_ALL','REMOVE','REMOVE_SELECTED','FORCE_SUBMIT','FORCE_SUBMIT_ALL',
 'RELEASE_RESULTS','RELEASE_ALL','RESET_ATTEMPT','RESET_SELECTED','RESET_ALL','SET_TIME','ADD_TIME','RESET_TIMER')
 THEN RAISE EXCEPTION 'Unsupported bulk action'; END IF;
 IF act NOT IN ('RELEASE_RESULTS','RELEASE_ALL') AND s.status NOT IN ('LIVE','PAUSED') THEN
   RAISE EXCEPTION 'Bulk actions require an active room';
 END IF;
 IF p_student_user_ids IS NOT NULL AND cardinality(p_student_user_ids)=0 THEN RETURN 0; END IF;
 IF p_student_user_ids IS NULL AND act IN ('REMOVE_SELECTED','RESET_SELECTED','REMOVE','RESET_ATTEMPT','SET_TIME','ADD_TIME','RESET_TIMER') THEN RAISE EXCEPTION 'Explicit student selection required'; END IF;
 IF act IN ('SET_TIME','ADD_TIME','RESET_TIMER','RESET_ATTEMPT','RESET_SELECTED','RESET_ALL') THEN
   minutes:=coalesce(p_minutes,CASE WHEN act='ADD_TIME' THEN 5 ELSE s.duration_minutes END,30);
   IF minutes NOT BETWEEN 1 AND 1440 THEN RAISE EXCEPTION 'Minutes must be 1 to 1440'; END IF;
 END IF;
 IF act IN ('ADMIT','ADMIT_ALL','REMOVE','REMOVE_SELECTED') THEN
   FOR m IN SELECT lm.student_user_id,lm.status FROM public.buklod_quiz_live_members lm
   WHERE lm.session_id=s.id AND (p_student_user_ids IS NULL OR lm.student_user_id=ANY(p_student_user_ids))
   ORDER BY lm.student_user_id FOR UPDATE LOOP
     IF (act IN ('ADMIT','ADMIT_ALL') AND m.status IN ('WAITING','REMOVED','LEFT'))
        OR (act IN ('REMOVE','REMOVE_SELECTED') AND m.status<>'REMOVED') THEN
       PERFORM public.buklod_quiz_live_student_action_v2(s.id,m.student_user_id,
         CASE WHEN act IN ('ADMIT','ADMIT_ALL') THEN 'READMIT' ELSE 'REMOVE' END,NULL);
       n:=n+1;
     END IF;
   END LOOP;
   RETURN n;
 END IF;
 -- Only the latest non-VOID attempt for each member, in this exact exam/section/session.
 FOR m IN SELECT lm.student_user_id,lm.status FROM public.buklod_quiz_live_members lm
 WHERE lm.session_id=s.id AND (p_student_user_ids IS NULL OR lm.student_user_id=ANY(p_student_user_ids))
 ORDER BY lm.student_user_id FOR UPDATE LOOP
   SELECT t.* INTO a FROM public.buklod_quiz_attempts t
   WHERE t.live_session_id=s.id AND t.exam_id=s.exam_id AND t.section_id=s.section_id
     AND t.student_user_id=m.student_user_id AND t.status<>'VOID'
   ORDER BY t.attempt_no DESC,t.created_at DESC,t.id DESC LIMIT 1 FOR UPDATE;
   IF NOT FOUND THEN CONTINUE; END IF;
   IF act IN ('RELEASE_RESULTS','RELEASE_ALL') THEN
     IF a.status<>'GRADED' THEN CONTINUE; END IF;
     IF EXISTS(SELECT 1 FROM public.buklod_quiz_responses r WHERE r.attempt_id=a.id AND r.needs_review IS TRUE AND r.manual_score IS NULL) THEN CONTINUE; END IF;
     original_score:=a.total_score; original_max:=a.max_score;
     -- Never disclose answers automatically via legacy bulk release.
     IF public.buklod_quiz_release_attempt_v2(a.id,false,false,false) IS DISTINCT FROM true THEN
       RAISE EXCEPTION 'Release rejected';
     END IF;
     IF NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempts t WHERE t.id=a.id AND t.status='RELEASED'
       AND t.total_score IS NOT DISTINCT FROM original_score AND t.max_score IS NOT DISTINCT FROM original_max)
     THEN RAISE EXCEPTION 'Release would change a recorded score; manual review required'; END IF;
     n:=n+1;
   ELSIF act IN ('FORCE_SUBMIT','FORCE_SUBMIT_ALL') THEN
     IF m.status<>'ADMITTED' OR a.status<>'STARTED' THEN CONTINUE; END IF;
     -- The existing individual RPC filters inserted blanks to assigned questions.
     -- Its blank test does not exclude JSON null; enforce that here.
     IF NOT EXISTS(SELECT 1 FROM public.buklod_quiz_responses r
       JOIN public.buklod_quiz_questions q ON q.id=r.question_id AND q.exam_id=s.exam_id
       WHERE r.attempt_id=a.id AND q.is_active IS TRUE
         AND private.buklod_quiz_attempt_question_allowed_r1(a.id,q.id)
         AND r.answer IS NOT NULL AND r.answer NOT IN ('null'::jsonb,'[]'::jsonb,'{}'::jsonb)
         AND nullif(btrim(CASE WHEN jsonb_typeof(r.answer)='string' THEN r.answer#>>'{}' ELSE r.answer::text END),'') IS NOT NULL)
     THEN CONTINUE; END IF;
     result:=public.buklod_quiz_live_student_action_v2(s.id,a.student_user_id,'FORCE_SUBMIT',NULL);
     IF (result->>'attempt_id') IS DISTINCT FROM a.id::text
       OR NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempts t WHERE t.id=a.id AND t.status IN ('GRADED','NEEDS_REVIEW'))
       OR EXISTS(SELECT 1 FROM public.buklod_quiz_responses r WHERE r.attempt_id=a.id
          AND NOT private.buklod_quiz_attempt_question_allowed_r1(a.id,r.question_id))
     THEN RAISE EXCEPTION 'Force-submit postcondition failed'; END IF;
     n:=n+1;
   ELSIF act IN ('SET_TIME','ADD_TIME','RESET_TIMER') THEN
     IF m.status<>'ADMITTED' OR a.status<>'STARTED' THEN CONTINUE; END IF;
     PERFORM public.buklod_quiz_live_student_action_v2(s.id,a.student_user_id,act,minutes);
     n:=n+1;
   ELSE
     IF m.status<>'ADMITTED' OR a.status<>'STARTED' OR a.submitted_at IS NOT NULL OR a.released_at IS NOT NULL THEN CONTINUE; END IF;
     IF EXISTS(SELECT 1 FROM public.buklod_quiz_responses r WHERE r.attempt_id=a.id) THEN CONTINUE; END IF;
     result:=public.buklod_quiz_live_student_action_v2(s.id,a.student_user_id,'RESET_ATTEMPT',minutes);
     new_id:=nullif(result->>'attempt_id','')::uuid;
     IF new_id IS NULL OR new_id=a.id OR (result->>'voided_attempts')::integer IS DISTINCT FROM 1
       OR NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempts t WHERE t.id=a.id AND t.status='VOID')
       OR NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempts t WHERE t.id=new_id AND t.status='STARTED'
         AND t.live_session_id=s.id AND t.exam_id=s.exam_id AND t.section_id=s.section_id AND t.student_user_id=a.student_user_id
         AND t.max_score IS NOT DISTINCT FROM s.total_score_target)
     THEN RAISE EXCEPTION 'Reset postcondition failed'; END IF;
     n:=n+1;
   END IF;
 END LOOP;
 RETURN n;
END;
$fn$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_records_remove_for_reentry_v1(p_exam_id uuid, p_section_id uuid, p_student_user_id uuid)
 RETURNS TABLE(student_user_id uuid, voided_attempts integer, reentry_session_id uuid, reentry_ready boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_session uuid;
  v_count integer := 0;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_quiz_is_examiner(v_actor) then raise exception 'Examiner access required.'; end if;

  if not exists(
    select 1
    from public.buklod_quiz_exams e
    join public.buklod_quiz_sections s on s.exam_id=e.id and s.id=p_section_id
    where e.id=p_exam_id and e.owner_user_id=v_actor
  ) then raise exception 'Exam/class not found or unauthorized.'; end if;

  if not exists(
    select 1 from public.buklod_quiz_roster r
    where r.exam_id=p_exam_id and r.section_id=p_section_id and r.student_user_id=p_student_user_id
  ) then raise exception 'Student is not part of this exam section.'; end if;

  perform 1 from public.buklod_quiz_live_sessions ls where ls.exam_id=p_exam_id and ls.section_id=p_section_id order by ls.id for update;
  perform 1 from public.buklod_quiz_attempts a where a.exam_id=p_exam_id and a.section_id=p_section_id and a.student_user_id=p_student_user_id order by a.id for update;
  if exists(select 1 from public.buklod_quiz_attempts a where a.exam_id=p_exam_id and a.section_id=p_section_id and a.student_user_id=p_student_user_id and (a.status='RELEASED' or a.released_at is not null)) then raise exception 'Released records cannot be removed for reentry'; end if;
  insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
  select a.id,a.student_user_id,'FACULTY_RECORD_REMOVED_FOR_REENTRY',
    jsonb_build_object(
      'faculty_user_id',v_actor,'exam_id',p_exam_id,'section_id',p_section_id,
      'previous_status',a.status,'previous_total_score',a.total_score,
      'record_merge_key',p_exam_id::text||':'||p_section_id::text,
      'reason','Faculty removed current record and allowed a future re-entry'
    )
  from public.buklod_quiz_attempts a
  where a.exam_id=p_exam_id and a.section_id=p_section_id
    and a.student_user_id=p_student_user_id and a.status<>'VOID';

  update public.buklod_quiz_attempts a
     set status='VOID',updated_at=now()
   where a.exam_id=p_exam_id and a.section_id=p_section_id
     and a.student_user_id=p_student_user_id and a.status<>'VOID';
  get diagnostics v_count = row_count;

  update public.buklod_quiz_roster r
     set status='REMOVED',updated_at=now()
   where r.exam_id=p_exam_id and r.section_id=p_section_id
     and r.student_user_id=p_student_user_id;

  update public.buklod_quiz_live_members m
     set status='REMOVED',removed_at=now(),last_seen_at=now()
   where m.student_user_id=p_student_user_id
     and exists (
       select 1 from public.buklod_quiz_live_sessions ls
       where ls.id=m.session_id and ls.exam_id=p_exam_id and ls.section_id=p_section_id
     );

  select ls.id into v_session
  from public.buklod_quiz_live_sessions ls
  where ls.exam_id=p_exam_id and ls.section_id=p_section_id and ls.faculty_user_id=v_actor
  order by case ls.status when 'LIVE' then 0 when 'PAUSED' then 1 when 'WAITING' then 2 when 'ENDED' then 3 else 4 end,
           ls.created_at desc
  limit 1;

  return query select p_student_user_id,v_count,v_session,true;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_release_attempt_v2(p_attempt_id uuid, p_show_violations boolean DEFAULT false, p_show_answers boolean DEFAULT false, p_show_rationale boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid()); v_owner uuid; v_status text; v_pending integer:=0; v_response_count integer:=0; v_event_count integer:=0;
  v_total numeric; v_max numeric; v_legacy_score_only boolean:=false; v_show_answers boolean:=false; v_show_rationale boolean:=false; v_show_violations boolean:=false;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_quiz_is_examiner(v_actor) then raise exception 'Examiner access required.'; end if;
  select e.owner_user_id,a.status,a.total_score,a.max_score into v_owner,v_status,v_total,v_max
  from public.buklod_quiz_attempts a join public.buklod_quiz_exams e on e.id=a.exam_id where a.id=p_attempt_id for update of a;
  if v_owner is null then raise exception 'Attempt not found.'; end if;
  if v_owner<>v_actor then raise exception 'Exam owner access required.'; end if;
  if v_status='STARTED' then raise exception 'The student is still taking this attempt.'; end if;
  if v_status='VOID' then raise exception 'A VOID attempt cannot be released.'; end if;
  select count(*)::integer,count(*) filter(where r.needs_review=true and r.manual_score is null)::integer into v_response_count,v_pending
  from public.buklod_quiz_responses r where r.attempt_id=p_attempt_id;
  select count(*)::integer into v_event_count from public.buklod_quiz_events ev where ev.attempt_id=p_attempt_id and ev.event_type in ('APP_EXIT_OR_BACKGROUND','USER_LEFT_EXAM','TAB_HIDDEN','WINDOW_BLUR','FULLSCREEN_EXIT','SCREENSHOT_ATTEMPT','SCREEN_CAPTURE_DETECTED','COPY_ATTEMPT','CONTEXT_MENU_ATTEMPT','DEVTOOLS_SHORTCUT_ATTEMPT');
  if v_total is null or v_max is null or v_max<=0 or v_total<0 or v_total>v_max or v_total::text in ('NaN','Infinity','-Infinity') or v_max::text in ('NaN','Infinity','-Infinity') then raise exception 'Recorded score is invalid; review required'; end if;
  if v_pending>0 then raise exception 'Faculty review is still incomplete for % response(s).',v_pending; end if;
  if v_status<>'RELEASED' then
    if v_response_count>0 then
      if v_status<>'GRADED' then perform public.buklod_quiz_compute_attempt_internal(p_attempt_id); end if;
      select a.status,a.total_score,a.max_score into v_status,v_total,v_max from public.buklod_quiz_attempts a where a.id=p_attempt_id;
      if v_status<>'GRADED' then raise exception 'Only a submitted result with no pending review can be released.'; end if;
    else
      v_legacy_score_only := v_status in ('NEEDS_REVIEW','GRADED') and v_total is not null and coalesce(v_max,0)>0;
      if not v_legacy_score_only then raise exception 'No reviewable response data or valid recorded score is available for release.'; end if;
    end if;
  else v_legacy_score_only := v_response_count=0 and v_total is not null and coalesce(v_max,0)>0; end if;
  v_show_answers := (coalesce(p_show_answers,false) or coalesce(p_show_rationale,false)) and v_response_count>0;
  v_show_rationale := coalesce(p_show_rationale,false) and v_response_count>0;
  v_show_violations := coalesce(p_show_violations,false) and v_event_count>0;
  insert into public.buklod_quiz_release_preferences(attempt_id,show_score,show_violations,show_answers,show_rationale,released_by,created_at,updated_at)
  values(p_attempt_id,true,v_show_violations,v_show_answers,v_show_rationale,v_actor,now(),now())
  on conflict(attempt_id) do update set show_score=true,show_violations=excluded.show_violations,show_answers=excluded.show_answers,show_rationale=excluded.show_rationale,released_by=excluded.released_by,updated_at=now();
  if v_status<>'RELEASED' then
    update public.buklod_quiz_attempts set status='RELEASED',released_at=coalesce(released_at,now()),updated_at=now() where id=p_attempt_id and status in ('GRADED','NEEDS_REVIEW');
    if not found then raise exception 'Attempt changed before release. Refresh and try again.'; end if;
    insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
    select a.id,a.student_user_id,'FACULTY_MANUAL_RELEASE',jsonb_build_object('faculty_user_id',v_actor,'released_at',now(),'release_mode',case when v_legacy_score_only then 'LEGACY_SCORE_ONLY' else 'STANDARD' end,'release_visibility',jsonb_build_object('score',true,'violations',v_show_violations,'answers',v_show_answers,'rationale',v_show_rationale),'unavailable_requested',jsonb_build_object('violations',coalesce(p_show_violations,false) and not v_show_violations,'answers',(coalesce(p_show_answers,false) or coalesce(p_show_rationale,false)) and not v_show_answers,'rationale',coalesce(p_show_rationale,false) and not v_show_rationale))
    from public.buklod_quiz_attempts a where a.id=p_attempt_id;
  end if;
  return true;
end;
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_release_attempt_v1(p_attempt_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
BEGIN
 IF EXISTS(SELECT 1 FROM public.buklod_quiz_attempts a JOIN public.buklod_quiz_exams e ON e.id=a.exam_id WHERE a.id=p_attempt_id AND a.status='RELEASED' AND e.owner_user_id=auth.uid() AND public.buklod_quiz_is_examiner(auth.uid())) THEN RETURN true; END IF;
 RETURN public.buklod_quiz_release_attempt_v2(p_attempt_id,false,false,false);
END; $fn$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_finalize_attempt_v1(p_attempt_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $fn$ SELECT public.buklod_quiz_finalize_attempt_v2(p_attempt_id) IN ('GRADED','RELEASED'); $fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_live_student_action_v1(uuid,uuid,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_live_student_action_v1(uuid,uuid,text,integer) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_live_student_action_v2(uuid,uuid,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_live_student_action_v2(uuid,uuid,text,integer) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_live_bulk_action_v3(uuid,text,uuid[],integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_live_bulk_action_v3(uuid,text,uuid[],integer) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_records_remove_for_reentry_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_records_remove_for_reentry_v1(uuid,uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_release_attempt_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_release_attempt_v1(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_release_attempt_v2(uuid,boolean,boolean,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_release_attempt_v2(uuid,boolean,boolean,boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_finalize_attempt_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_finalize_attempt_v1(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_compute_attempt_internal(uuid) FROM PUBLIC,anon,authenticated;
