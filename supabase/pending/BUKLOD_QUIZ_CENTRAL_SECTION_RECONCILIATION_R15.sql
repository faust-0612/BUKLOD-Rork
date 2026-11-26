-- R15 DEV candidate only. Do not release until join enforcement, dependency and runtime QA.
-- Historical live-session reassignments deliberately remain manual: changing the
-- session reference may invalidate snapshot-based grading and integrity history.

CREATE FUNCTION public.buklod_quiz_section_mismatch_cases_v1(p_search text DEFAULT NULL::text)
 RETURNS TABLE(attempt_id uuid, student_user_id uuid, student_name text, exam_id uuid, exam_title text, attempt_section_id uuid, attempt_section_name text, roster_section_id uuid, roster_section_name text, attempt_status text, submitted_at timestamp with time zone, total_score numeric, max_score numeric, response_count bigint, safe_to_reassign boolean, safety_note text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with base as (
    select
      a.id as attempt_id,
      a.student_user_id,
      coalesce(nullif(p.full_name,''),nullif(r.display_name,''),trim(concat_ws(' ',p.first_name,p.surname)),'BUKLOD Student') as student_name,
      a.exam_id,
      e.title as exam_title,
      a.section_id as attempt_section_id,
      sa.name as attempt_section_name,
      r.section_id as roster_section_id,
      sr.name as roster_section_name,
      a.status as attempt_status,
      a.live_session_id,
      r.status as roster_status,
      sr.archived_at as roster_archived,
      a.submitted_at,
      a.total_score,
      a.max_score,
      (select count(*) from public.buklod_quiz_responses x where x.attempt_id=a.id) as response_count
    from public.buklod_quiz_attempts a
    join public.buklod_quiz_exams e
      on e.id=a.exam_id and e.owner_user_id=(select auth.uid())
    join public.buklod_quiz_roster r
      on r.exam_id=a.exam_id and r.student_user_id=a.student_user_id
    join public.buklod_quiz_sections sa on sa.id=a.section_id and sa.exam_id=a.exam_id
    join public.buklod_quiz_sections sr on sr.id=r.section_id and sr.exam_id=a.exam_id
    left join public.profiles p on p.id=a.student_user_id
    where public.buklod_quiz_is_examiner((select auth.uid()))
      and a.submitted_at is not null
      and a.status<>'VOID'
      and lower(trim(regexp_replace(coalesce(sa.name,''),'\s+',' ','g'))) <>
          lower(trim(regexp_replace(coalesce(sr.name,''),'\s+',' ','g')))
      and (
        nullif(trim(coalesce(p_search,'')),'') is null
        or lower(coalesce(p.full_name,'')||' '||coalesce(p.first_name,'')||' '||coalesce(p.surname,'')||' '||
                 coalesce(r.display_name,'')||' '||coalesce(e.title,''))
           like '%'||lower(trim(p_search))||'%'
      )
  )
  select
    b.attempt_id,b.student_user_id,b.student_name,b.exam_id,b.exam_title,
    b.attempt_section_id,b.attempt_section_name,b.roster_section_id,b.roster_section_name,
    b.attempt_status,b.submitted_at,b.total_score,b.max_score,b.response_count,
    (
      b.attempt_status IN ('NEEDS_REVIEW','GRADED','RELEASED')
      and b.live_session_id IS NULL AND b.roster_status='ACTIVE' AND b.roster_archived IS NULL
      and not exists(select 1 from public.buklod_quiz_review_jobs j where j.exam_id=b.exam_id and b.attempt_id=any(j.attempt_ids) and j.status in ('QUEUED','RUNNING'))
      and b.response_count>0
      and not exists(
        select 1 from public.buklod_quiz_attempts z
        where z.id<>b.attempt_id
          and z.exam_id=b.exam_id
          and z.student_user_id=b.student_user_id
          and z.section_id=b.roster_section_id
          and z.status<>'VOID'
          
      )
    ) as safe_to_reassign,
    case
      when b.attempt_status NOT IN ('NEEDS_REVIEW','GRADED','RELEASED') then 'Attempt status requires manual review.'
      when b.live_session_id IS NOT NULL then 'Live-session history requires snapshot-aware manual review.'
      when b.roster_status IS DISTINCT FROM 'ACTIVE' OR b.roster_archived IS NOT NULL then 'Active target roster required.'
      when exists(select 1 from public.buklod_quiz_review_jobs j where j.exam_id=b.exam_id and b.attempt_id=any(j.attempt_ids) and j.status in ('QUEUED','RUNNING')) then 'Review job is active.'
      when b.response_count=0 then 'No dedicated response rows are linked; recover responses first if a legacy source exists.'
      when exists(
        select 1 from public.buklod_quiz_attempts z
        where z.id<>b.attempt_id
          and z.exam_id=b.exam_id
          and z.student_user_id=b.student_user_id
          and z.section_id=b.roster_section_id
          and z.status<>'VOID'
          
      ) then 'A completed record already exists in the roster section.'
      else 'Eligible for audited reassignment to the roster section.'
    end as safety_note
  from base b
  order by b.submitted_at desc,b.student_name,b.attempt_id;
$function$;
REVOKE ALL ON FUNCTION public.buklod_quiz_section_mismatch_cases_v1(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_section_mismatch_cases_v1(text) TO authenticated;

CREATE FUNCTION public.buklod_quiz_section_mismatch_override_candidates_v1(p_session_id uuid, p_search text DEFAULT NULL::text)
 RETURNS TABLE(student_user_id uuid, student_name text, roster_section_id uuid, roster_section_name text, code_section_id uuid, code_section_name text, override_granted boolean, roster_status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    r.student_user_id,
    coalesce(nullif(p.full_name,''),nullif(r.display_name,''),trim(concat_ws(' ',p.first_name,p.surname)),'BUKLOD Student') as student_name,
    r.section_id,
    rs.name,
    ls.section_id,
    cs.name,
    exists(
      select 1
      from public.buklod_quiz_section_join_overrides o
      where o.session_id=ls.id
        and o.student_user_id=r.student_user_id
        and o.expires_at>now()
    ) as override_granted,
    r.status
  from public.buklod_quiz_live_sessions ls
  join public.buklod_quiz_exams e on e.id=ls.exam_id and e.owner_user_id=(select auth.uid())
  join public.buklod_quiz_sections cs on cs.id=ls.section_id and cs.exam_id=ls.exam_id and cs.archived_at is null
  join public.buklod_quiz_roster r on r.exam_id=ls.exam_id
  join public.buklod_quiz_sections rs on rs.id=r.section_id and rs.exam_id=ls.exam_id and rs.archived_at is null
  left join public.profiles p on p.id=r.student_user_id
  where ls.id=p_session_id
    and ls.faculty_user_id=(select auth.uid())
    and public.buklod_quiz_is_examiner((select auth.uid()))
    and ls.status<>'ENDED' and r.status='ACTIVE'
    and lower(regexp_replace(coalesce(rs.name,''), '[-[:space:]]+', '', 'g')) <>
        lower(regexp_replace(coalesce(cs.name,''), '[-[:space:]]+', '', 'g'))
    and (
      nullif(trim(coalesce(p_search,'')),'') is null
      or lower(coalesce(p.full_name,'')||' '||coalesce(p.first_name,'')||' '||coalesce(p.surname,'')||' '||
               coalesce(r.display_name,'')||' '||coalesce(rs.name,''))
         like '%'||lower(trim(p_search))||'%'
    )
  order by lower(coalesce(p.surname,p.full_name,r.display_name,'')),lower(coalesce(p.first_name,''));
$function$;
REVOKE ALL ON FUNCTION public.buklod_quiz_section_mismatch_override_candidates_v1(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_section_mismatch_override_candidates_v1(uuid,text) TO authenticated;

CREATE FUNCTION public.buklod_quiz_set_section_mismatch_override_v1(p_session_id uuid, p_student_user_id uuid, p_allow boolean, p_note text DEFAULT NULL::text)
 RETURNS TABLE(session_id uuid, student_user_id uuid, allowed boolean, roster_section_name text, code_section_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_session public.buklod_quiz_live_sessions%rowtype;
  v_roster public.buklod_quiz_roster%rowtype;
  v_roster_name text;
  v_code_name text;
begin
  if v_actor is null then
    raise exception 'Authentication required.';
  end if;

  if not public.buklod_quiz_is_examiner(v_actor) then
    raise exception 'Examiner access required.';
  end if;

  select ls.* into v_session
  from public.buklod_quiz_live_sessions ls
  join public.buklod_quiz_exams e on e.id=ls.exam_id and e.owner_user_id=v_actor
  where ls.id=p_session_id
    and ls.faculty_user_id=v_actor FOR UPDATE OF ls;

  if p_allow is null then raise exception 'Explicit allow or revoke required.'; end if;
  if v_session.id is null then
    raise exception 'Live class not found or unauthorized.';
  end if;

  select r.* into v_roster
  from public.buklod_quiz_roster r
  where r.exam_id=v_session.exam_id
    and r.student_user_id=p_student_user_id
  limit 1 FOR UPDATE;

  if v_roster.id is null then
    raise exception 'Student is not on this exam roster.';
  end if;

  select name into v_roster_name
  from public.buklod_quiz_sections
  where id=v_roster.section_id and exam_id=v_session.exam_id and archived_at is null;

  select name into v_code_name
  from public.buklod_quiz_sections
  where id=v_session.section_id and exam_id=v_session.exam_id and archived_at is null;

  if lower(regexp_replace(coalesce(v_roster_name,''), '[-[:space:]]+', '', 'g')) =
     lower(regexp_replace(coalesce(v_code_name,''), '[-[:space:]]+', '', 'g')) then
    raise exception 'Roster and live code already refer to the same class label.';
  end if;

  if p_allow then
    if v_session.status='ENDED' OR v_roster.status IS DISTINCT FROM 'ACTIVE' OR v_roster_name IS NULL OR v_code_name IS NULL OR v_session.ended_at IS NOT NULL then raise exception 'Active room and roster required.'; end if;
    if nullif(btrim(p_note),'') IS NULL OR length(p_note)>500 then raise exception 'Audited reason required (1–500 characters).'; end if;
    insert into public.buklod_quiz_section_join_overrides(
      session_id,student_user_id,granted_by,note,created_at,expires_at
    )
    values(
      v_session.id,p_student_user_id,v_actor,nullif(trim(coalesce(p_note,'')),''),
      now(),now()+interval '12 hours'
    )
    on conflict(session_id,student_user_id)
    do update set
      granted_by=excluded.granted_by,
      note=excluded.note,
      created_at=now(),
      expires_at=excluded.expires_at;

    insert into public.buklod_quiz_audit_log(
      exam_id,section_id,live_session_id,attempt_id,actor_user_id,action,details
    )
    values(
      v_session.exam_id,v_session.section_id,v_session.id,null,v_actor,
      'SECTION_MISMATCH_JOIN_OVERRIDE_GRANTED',
      jsonb_build_object(
        'student_user_id',p_student_user_id,
        'roster_section_id',v_roster.section_id,
        'roster_section_name',v_roster_name,
        'code_section_id',v_session.section_id,
        'code_section_name',v_code_name,
        'note',nullif(trim(coalesce(p_note,'')),'')
      )
    );
  else
    delete from public.buklod_quiz_section_join_overrides o
    where o.session_id=v_session.id
      and o.student_user_id=p_student_user_id;

    insert into public.buklod_quiz_audit_log(
      exam_id,section_id,live_session_id,attempt_id,actor_user_id,action,details
    )
    values(
      v_session.exam_id,v_session.section_id,v_session.id,null,v_actor,
      'SECTION_MISMATCH_JOIN_OVERRIDE_REVOKED',
      jsonb_build_object(
        'student_user_id',p_student_user_id,
        'roster_section_id',v_roster.section_id,
        'roster_section_name',v_roster_name,
        'code_section_id',v_session.section_id,
        'code_section_name',v_code_name
      )
    );
  end if;

  return query
  select v_session.id,p_student_user_id,coalesce(p_allow,false),v_roster_name,v_code_name;
end
$function$;
REVOKE ALL ON FUNCTION public.buklod_quiz_set_section_mismatch_override_v1(uuid,uuid,boolean,text) FROM PUBLIC,anon,authenticated;
-- Mutating RPC remains client-disabled pending end-to-end QA.

CREATE FUNCTION public.buklod_quiz_reassign_attempt_to_roster_section_v1(p_attempt_id uuid)
 RETURNS TABLE(attempt_id uuid, student_user_id uuid, exam_id uuid, old_section_id uuid, old_section_name text, new_section_id uuid, new_section_name text, old_live_session_id uuid, response_count bigint, total_score numeric, max_score numeric, attempt_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_attempt public.buklod_quiz_attempts%rowtype;
  v_roster public.buklod_quiz_roster%rowtype;
  v_old_name text;
  v_new_name text;
  v_source public.buklod_quiz_live_sessions%rowtype;
  v_target public.buklod_quiz_live_sessions%rowtype;
  v_response_count bigint;
begin
  if v_actor is null then
    raise exception 'Authentication required.';
  end if;

  if not public.buklod_quiz_is_examiner(v_actor) then
    raise exception 'Examiner access required.';
  end if;

  select a.* into v_attempt
  from public.buklod_quiz_attempts a
  join public.buklod_quiz_exams e on e.id=a.exam_id
  where a.id=p_attempt_id
    and e.owner_user_id=v_actor
  for update of a;

  if v_attempt.id is null then
    raise exception 'Attempt not found or unauthorized.';
  end if;

  if v_attempt.status NOT IN ('NEEDS_REVIEW','GRADED','RELEASED') OR v_attempt.submitted_at IS NULL then
    raise exception 'Active attempts cannot be reassigned. Submit or resolve the active attempt first.';
  end if;

  if v_attempt.live_session_id IS NOT NULL then raise exception 'Live-session history requires snapshot-aware manual review.'; end if;
  if exists(select 1 from public.buklod_quiz_review_jobs j where j.exam_id=v_attempt.exam_id and v_attempt.id=any(j.attempt_ids) and j.status in ('QUEUED','RUNNING')) then raise exception 'Review job is active.'; end if;
  select r.* into v_roster
  from public.buklod_quiz_roster r
  where r.exam_id=v_attempt.exam_id
    and r.student_user_id=v_attempt.student_user_id
  limit 1 FOR UPDATE;

  if v_roster.id is null OR v_roster.status IS DISTINCT FROM 'ACTIVE' then
    raise exception 'No roster section exists for this student and exam.';
  end if;

  select name into v_old_name
  from public.buklod_quiz_sections
  where id=v_attempt.section_id and exam_id=v_attempt.exam_id;

  select name into v_new_name
  from public.buklod_quiz_sections
  where id=v_roster.section_id and exam_id=v_attempt.exam_id and archived_at is null;
  if v_old_name IS NULL OR v_new_name IS NULL then raise exception 'Invalid target section.'; end if;

  if v_attempt.section_id=v_roster.section_id then
    raise exception 'Attempt is already credited to the roster section.';
  end if;

  if exists(
    select 1
    from public.buklod_quiz_attempts z
    where z.id<>v_attempt.id
      and z.exam_id=v_attempt.exam_id
      and z.student_user_id=v_attempt.student_user_id
      and z.section_id=v_roster.section_id
      and z.status<>'VOID'
      
  ) then
    raise exception 'A completed record already exists in the roster section. Resolve that collision first.';
  end if;

  select count(*) into v_response_count
  from public.buklod_quiz_responses x
  where x.attempt_id=v_attempt.id;

  if v_response_count=0 then
    raise exception 'No dedicated response rows are linked to this attempt. Recover the legacy responses first before reassignment.';
  end if;

  insert into public.buklod_quiz_audit_log(
    exam_id,section_id,live_session_id,attempt_id,actor_user_id,action,details
  )
  values(
    v_attempt.exam_id,
    v_attempt.section_id,
    v_attempt.live_session_id,
    v_attempt.id,
    v_actor,
    'ATTEMPT_SECTION_REASSIGNED_WRONG_LIVE_CODE',
    jsonb_build_object(
      'student_user_id',v_attempt.student_user_id,
      'reason','WRONG_LIVE_CODE',
      'original_section_id',v_attempt.section_id,
      'original_section_name',v_old_name,
      'original_live_session_id',v_attempt.live_session_id,
      'target_section_id',v_roster.section_id,
      'target_section_name',v_new_name,
      'responses_preserved',v_response_count,
      'score_preserved',v_attempt.total_score,
      'max_score_preserved',v_attempt.max_score
    )
  );

  insert into public.buklod_quiz_events(
    attempt_id,student_user_id,event_type,event_data
  )
  values(
    v_attempt.id,
    v_attempt.student_user_id,
    'FACULTY_ATTEMPT_SECTION_REASSIGNED',
    jsonb_build_object(
      'faculty_user_id',v_actor,
      'exam_id',v_attempt.exam_id,
      'original_section_id',v_attempt.section_id,
      'target_section_id',v_roster.section_id,
      'original_live_session_id',v_attempt.live_session_id,
      'reason','WRONG_LIVE_CODE'
    )
  );

  update public.buklod_quiz_attempts a
  set section_id=v_roster.section_id,
      live_session_id=null,
      updated_at=now()
  where a.id=v_attempt.id;

  if not exists(select 1 from public.buklod_quiz_attempts a where a.id=v_attempt.id and a.section_id=v_roster.section_id and a.status=v_attempt.status and a.total_score IS NOT DISTINCT FROM v_attempt.total_score and a.max_score IS NOT DISTINCT FROM v_attempt.max_score and a.released_at IS NOT DISTINCT FROM v_attempt.released_at) OR (select count(*) from public.buklod_quiz_responses x where x.attempt_id=v_attempt.id)<>v_response_count then raise exception 'Historical preservation postcondition failed.'; end if;
  return query
  select
    v_attempt.id,
    v_attempt.student_user_id,
    v_attempt.exam_id,
    v_attempt.section_id,
    v_old_name,
    v_roster.section_id,
    v_new_name,
    v_attempt.live_session_id,
    v_response_count,
    v_attempt.total_score,
    v_attempt.max_score,
    v_attempt.status;
end
$function$;
REVOKE ALL ON FUNCTION public.buklod_quiz_reassign_attempt_to_roster_section_v1(uuid) FROM PUBLIC,anon,authenticated;
-- Mutating RPC remains client-disabled pending end-to-end QA.
