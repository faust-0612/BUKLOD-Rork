-- R16 DEV candidate. Cross-section entry is fail-closed pending assignment-aware override/start QA.
-- Keep exact public return contracts; no production application until end-to-end QA.
CREATE OR REPLACE FUNCTION public.buklod_quiz_join_live_class_v4(p_join_code text)
 RETURNS TABLE(session_id uuid, exam_id uuid, section_id uuid, section_name text, exam_title text, join_code text, live_status text, member_status text, admission_mode text, allow_late_join boolean, can_start boolean, started_at timestamp with time zone, ended_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_code text := upper(trim(coalesce(p_join_code,'')));
  s public.buklod_quiz_live_sessions%rowtype;
  e public.buklod_quiz_exams%rowtype;
  v_section_name text;
  v_profile_full_name text; v_profile_username text; v_surname text; v_first_name text;
  v_display text;
  v_roster_id uuid; v_roster_section uuid; v_roster_status text;
  v_policy text;
  v_member text;
  v_relive_only boolean:=false;
  v_has_final_attempt boolean:=false;
  v_conflicting_active_attempt boolean:=false;
begin
  if v_actor is null then raise exception 'Sign in first.'; end if;
  if length(v_code)<4 or length(v_code)>12 then raise exception 'Enter the live class code from your faculty.'; end if;

  select ls.* into s
  from public.buklod_quiz_live_sessions ls
  join public.buklod_quiz_sections sx on sx.id=ls.section_id and sx.exam_id=ls.exam_id and sx.archived_at is null
  where ls.join_code=v_code and ls.status<>'ENDED'
  limit 1;
  if s.id is null then raise exception 'Live class code is invalid, deleted, or already ended.'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||s.exam_id::text,0));
  -- Re-read after acquiring the actor/exam lock; serialize with room closure.
  select ls.* into s from public.buklod_quiz_live_sessions ls
  join public.buklod_quiz_sections sx on sx.id=ls.section_id and sx.exam_id=ls.exam_id and sx.archived_at is null
  where ls.id=s.id and ls.join_code=v_code and ls.status<>'ENDED' FOR UPDATE OF ls;
  if not found then raise exception 'Live class is no longer available.'; end if;
  v_relive_only:=lower(coalesce(s.settings_snapshot->>'relive_only_unattempted','false')) in ('true','t','yes','1','on');
  select exists(
    select 1 from public.buklod_quiz_attempts a
    where a.live_session_id=s.id
      and a.student_user_id=v_actor
      and (
        a.submitted_at is not null
        or a.status in ('SUBMITTED','NEEDS_REVIEW','GRADED','RELEASED')
      )
  ) into v_has_final_attempt;

  if exists(
    select 1 from public.buklod_quiz_live_members m
    where m.session_id=s.id and m.student_user_id=v_actor and m.status='REMOVED'
  ) and not (v_relive_only and not v_has_final_attempt) then
    raise exception 'Faculty removed you from this live class. Ask the faculty before rejoining.';
  end if;

  if s.status in ('LIVE','PAUSED') and not s.allow_late_join and not v_relive_only then
    raise exception 'Late joining is closed for this live class.';
  end if;

  select x.* into e from public.buklod_quiz_exams x where x.id=s.exam_id;
  select sx.name into v_section_name from public.buklod_quiz_sections sx where sx.id=s.section_id and sx.exam_id=s.exam_id;
  select p.full_name,p.username,p.surname,p.first_name
    into v_profile_full_name,v_profile_username,v_surname,v_first_name
  from public.profiles p where p.id=v_actor and coalesce(p.is_active,true)=true;
  if not found then raise exception 'Active BUKLOD profile not found.'; end if;
  v_display:=coalesce(nullif(v_profile_full_name,''),nullif(v_profile_username,''),'BUKLOD Student');

  select r.id,r.section_id,r.status
    into v_roster_id,v_roster_section,v_roster_status
  from public.buklod_quiz_roster r
  where r.exam_id=s.exam_id and r.student_user_id=v_actor
  limit 1 FOR UPDATE;

  v_policy:=upper(coalesce(nullif(s.join_policy,''),e.default_live_join_policy,'OPEN'));

  select exists(
    select 1
    from public.buklod_quiz_attempts a
    left join public.buklod_quiz_live_sessions als on als.id=a.live_session_id
    where a.exam_id=s.exam_id
      and a.student_user_id=v_actor
      and a.status='STARTED'
      and a.expires_at>now()
      and coalesce(a.section_id,als.section_id) is distinct from s.section_id
  ) into v_conflicting_active_attempt;

  -- Do not change a canonical roster merely because a different code was entered.
  -- Cross-section override remains fail-closed until start/submit compatibility is verified.
  if v_roster_id is not null and v_roster_section IS DISTINCT FROM s.section_id then
    raise exception 'Wrong class code. Ask faculty to verify the assigned class.' USING ERRCODE='42501';
  end if;
  if v_roster_id is not null and v_roster_status='REMOVED' then
    raise exception 'Faculty must restore your roster before joining.' USING ERRCODE='42501';
  end if;
  if v_conflicting_active_attempt then raise exception 'Another active attempt exists for this exam.'; end if;
  if v_policy not in ('OPEN','APPROVAL','ROSTER_ONLY','ROSTER_APPROVAL') then
    raise exception 'Invalid live join policy.';
  end if;

  if v_policy in ('ROSTER_ONLY','ROSTER_APPROVAL') then
    if v_roster_id is null or v_roster_section<>s.section_id or v_roster_status<>'ACTIVE' then
      raise exception 'This live class is roster-only. Your account is not on the active class roster.';
    end if;
  end if;

  v_member:=case
    when v_relive_only and not v_has_final_attempt then 'ADMITTED'
    when v_policy in ('APPROVAL','ROSTER_APPROVAL') then 'WAITING'
    else 'ADMITTED'
  end;

  insert into public.buklod_quiz_live_members(session_id,student_user_id,status,display_name,joined_at,admitted_at,removed_at,last_seen_at)
  values(s.id,v_actor,v_member,v_display,now(),case when v_member='ADMITTED' then now() else null end,null,now())
  on conflict on constraint buklod_quiz_live_members_session_id_student_user_id_key
  do update set
    status=case
      when v_relive_only and not v_has_final_attempt then 'ADMITTED'
      when public.buklod_quiz_live_members.status='REMOVED' then 'REMOVED'
      when public.buklod_quiz_live_members.status='ADMITTED' then 'ADMITTED'
      else excluded.status end,
    display_name=excluded.display_name,last_seen_at=now(),
    removed_at=case
      when v_relive_only and not v_has_final_attempt then null
      when public.buklod_quiz_live_members.status='REMOVED' then public.buklod_quiz_live_members.removed_at
      else null end,
    admitted_at=case
      when v_relive_only and not v_has_final_attempt then coalesce(public.buklod_quiz_live_members.admitted_at,now())
      when public.buklod_quiz_live_members.status='REMOVED' then public.buklod_quiz_live_members.admitted_at
      when public.buklod_quiz_live_members.status='ADMITTED' then public.buklod_quiz_live_members.admitted_at
      when excluded.status='ADMITTED' then coalesce(public.buklod_quiz_live_members.admitted_at,now())
      else public.buklod_quiz_live_members.admitted_at end;

  select m.status into v_member
  from public.buklod_quiz_live_members m
  where m.session_id=s.id and m.student_user_id=v_actor;

  if v_policy in ('OPEN','APPROVAL') or (v_relive_only and not v_has_final_attempt) then
    insert into public.buklod_quiz_roster(exam_id,section_id,student_user_id,student_no,surname,first_name,display_name,status)
    values(s.exam_id,s.section_id,v_actor,null,coalesce(v_surname,''),coalesce(v_first_name,''),v_display,
           case when v_member='ADMITTED' then 'ACTIVE' else 'PENDING' end)
    on conflict on constraint buklod_quiz_roster_exam_id_student_user_id_key
    do update set
      -- Never update the canonical section on a conflicting insert.
      section_id=public.buklod_quiz_roster.section_id,
      surname=excluded.surname,
      first_name=excluded.first_name,
      display_name=excluded.display_name,
      status=case
        when v_relive_only and not v_has_final_attempt then 'ACTIVE'
        when public.buklod_quiz_roster.status='REMOVED' then 'REMOVED'
        when excluded.status='ACTIVE' then 'ACTIVE'
        when public.buklod_quiz_roster.status='ACTIVE' then 'ACTIVE'
        else 'PENDING'
      end
    WHERE public.buklod_quiz_roster.section_id=excluded.section_id AND public.buklod_quiz_roster.status<>'REMOVED';
    IF NOT FOUND THEN RAISE EXCEPTION 'Roster changed during join; retry after faculty review.'; END IF;
  end if;

  return query
  select s.id,s.exam_id,s.section_id,v_section_name,e.title,s.join_code,s.status,v_member,
    s.admission_mode,s.allow_late_join,
    (s.status='LIVE' and v_member='ADMITTED' and not (v_relive_only and v_has_final_attempt)),
    s.started_at,s.ended_at;
end
$function$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_join_live_class_v1(p_join_code text)
 RETURNS TABLE(session_id uuid, exam_id uuid, exam_title text, live_status text, member_status text, join_code text, can_start boolean)
 LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $fn$ SELECT j.session_id,j.exam_id,j.exam_title,j.live_status,j.member_status,j.join_code,j.can_start FROM public.buklod_quiz_join_live_class_v4(p_join_code) j; $fn$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_join_live_class_v2(p_join_code text)
 RETURNS TABLE(session_id uuid, exam_id uuid, section_id uuid, section_name text, exam_title text, live_status text, member_status text, join_code text, can_start boolean)
 LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $fn$ SELECT j.session_id,j.exam_id,j.section_id,j.section_name,j.exam_title,j.live_status,j.member_status,j.join_code,j.can_start FROM public.buklod_quiz_join_live_class_v4(p_join_code) j; $fn$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_join_live_class_v3(p_join_code text)
 RETURNS TABLE(session_id uuid, exam_id uuid, section_id uuid, section_name text, exam_title text, join_code text, live_status text, member_status text, admission_mode text, allow_late_join boolean, can_start boolean, started_at timestamp with time zone, ended_at timestamp with time zone)
 LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $fn$ SELECT j.session_id,j.exam_id,j.section_id,j.section_name,j.exam_title,j.join_code,j.live_status,j.member_status,j.admission_mode,j.allow_late_join,j.can_start,j.started_at,j.ended_at FROM public.buklod_quiz_join_live_class_v4(p_join_code) j; $fn$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_live_join_preflight_v1(p_join_code text)
 RETURNS TABLE(session_id uuid, exam_id uuid, exam_title text, code_section_id uuid, code_section_name text, roster_section_id uuid, roster_section_name text, section_state text, override_granted boolean, can_join boolean, notice text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_code text := upper(trim(coalesce(p_join_code,'')));
  v_session public.buklod_quiz_live_sessions%rowtype;
  v_exam_title text;
  v_code_section_name text;
  v_roster public.buklod_quiz_roster%rowtype;
  v_roster_section_name text;
  v_same_label boolean := false;
  v_policy text;
  v_override boolean := false;
begin
  if v_actor is null then raise exception 'Sign in first.'; end if;

  select ls.* into v_session
  from public.buklod_quiz_live_sessions ls
  join public.buklod_quiz_sections sx
    on sx.id=ls.section_id and sx.exam_id=ls.exam_id and sx.archived_at is null
  where ls.join_code=v_code and ls.status<>'ENDED'
  order by ls.created_at desc
  limit 1;

  if v_session.id is null then raise exception 'Live class code is invalid, deleted, or already ended.'; end if;

  select e.title,upper(coalesce(nullif(v_session.join_policy,''),e.default_live_join_policy,'OPEN')) into v_exam_title,v_policy from public.buklod_quiz_exams e where e.id=v_session.exam_id;
  select s.name into v_code_section_name from public.buklod_quiz_sections s where s.id=v_session.section_id;

  select r.* into v_roster
  from public.buklod_quiz_roster r
  where r.exam_id=v_session.exam_id and r.student_user_id=v_actor
  limit 1;

  if v_roster.id is not null then
    select s.name into v_roster_section_name from public.buklod_quiz_sections s where s.id=v_roster.section_id;

    v_same_label :=
      lower(trim(regexp_replace(coalesce(v_roster_section_name,''),'\s+',' ','g'))) =
      lower(trim(regexp_replace(coalesce(v_code_section_name,''),'\s+',' ','g')));

    select exists(
      select 1
      from public.buklod_quiz_section_join_overrides o
      where o.session_id=v_session.id
        and o.student_user_id=v_actor
        and o.expires_at>now()
    ) into v_override;
  end if;

  return query
  select
    v_session.id,
    v_session.exam_id,
    v_exam_title,
    v_session.section_id,
    v_code_section_name,
    case when v_roster.id is null then null else v_roster.section_id end,
    v_roster_section_name,
    case
      when v_roster.id is null then 'NO_ROSTER'
      when v_roster.section_id=v_session.section_id then 'MATCH'
      when v_override then 'MISMATCH_OVERRIDE_PENDING'
      when v_same_label then 'SAME_LABEL_REVIEW'
      else 'MISMATCH_BLOCKED'
    end,
    v_override,
    case
      when v_policy NOT IN ('OPEN','APPROVAL','ROSTER_ONLY','ROSTER_APPROVAL') then false
      when v_roster.id is null then v_policy IN ('OPEN','APPROVAL')
      when v_roster.status='REMOVED' then false
      when v_roster.section_id=v_session.section_id then (v_policy IN ('OPEN','APPROVAL') OR v_roster.status='ACTIVE')
      else false
    end,
    case
      when v_roster.id is null then
        'No existing roster section was found for this exam. The normal join flow may create the roster entry.'
      when v_roster.section_id=v_session.section_id then
        'Your roster section matches this live class code.'
      when v_same_label then
        'Duplicate class label detected. Ask faculty to verify the assigned section.'
      when v_override then
        'Faculty override recorded; cross-section entry requires verified recovery. Your roster is '||coalesce(v_roster_section_name,'Unknown')||
        ' while this code is for '||coalesce(v_code_section_name,'Unknown')||'.'
      else
        'Wrong live class code: your roster is '||coalesce(v_roster_section_name,'Unknown')||
        ' but this code is for '||coalesce(v_code_section_name,'Unknown')||
        '. Ask faculty for the correct code or an intentional override.'
    end;
end
$function$;
REVOKE ALL ON FUNCTION public.buklod_quiz_join_live_class_v1(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_join_live_class_v1(text) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_join_live_class_v2(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_join_live_class_v2(text) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_join_live_class_v3(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_join_live_class_v3(text) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_join_live_class_v4(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_join_live_class_v4(text) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_live_join_preflight_v1(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_live_join_preflight_v1(text) TO authenticated;
