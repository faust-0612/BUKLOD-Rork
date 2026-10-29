-- BUKLOD QUIZ section alias and safe archive R1
-- Source verification: 3F and 3-F were separate section IDs for the SAME exam.
-- Normalization removes only spaces/hyphens and is case-insensitive.
-- Auth and existing active-attempt conflict guard are unchanged.
-- No deletion or roster migration is performed by this DDL.
CREATE OR REPLACE FUNCTION public.buklod_quiz_join_live_class_v1(p_join_code text)
 RETURNS TABLE(session_id uuid, exam_id uuid, exam_title text, live_status text, member_status text, join_code text, can_start boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_code text := upper(trim(coalesce(p_join_code,'')));
  v_session public.buklod_quiz_live_sessions%rowtype;
  v_exam public.buklod_quiz_exams%rowtype;
  v_profile public.profiles%rowtype;
  v_roster public.buklod_quiz_roster%rowtype;
  v_member_status text;
  v_relive_only boolean:=false;
  v_has_final_attempt boolean:=false;
  v_roster_section_name text;
  v_live_section_name text;
  v_same_label boolean:=false;
  v_mismatch_override boolean:=false;
begin
  if v_actor is null then raise exception 'Sign in first.'; end if;

  select ls.* into v_session
  from public.buklod_quiz_live_sessions ls
  join public.buklod_quiz_sections sx
    on sx.id=ls.section_id and sx.exam_id=ls.exam_id and sx.archived_at is null
  where ls.join_code=v_code and ls.status<>'ENDED'
  limit 1;
  if v_session.id is null then raise exception 'Live class code is invalid, deleted, or already ended.'; end if;

  v_relive_only:=coalesce((v_session.settings_snapshot->>'relive_only_unattempted')::boolean,false);
  select exists(
    select 1 from public.buklod_quiz_attempts a
    where a.live_session_id=v_session.id
      and a.student_user_id=v_actor
      and (
        a.submitted_at is not null
        or a.status in ('SUBMITTED','NEEDS_REVIEW','GRADED','RELEASED')
      )
  ) into v_has_final_attempt;

  if exists(
    select 1 from public.buklod_quiz_live_members lm
    where lm.session_id=v_session.id and lm.student_user_id=v_actor and lm.status='REMOVED'
  ) and not (v_relive_only and not v_has_final_attempt) then
    raise exception 'Faculty removed you from this live class. Ask the faculty to admit you again before rejoining.';
  end if;

  if v_session.status in ('LIVE','PAUSED') and not v_session.allow_late_join and not v_relive_only then
    raise exception 'Late joining is closed for this live class.';
  end if;

  select e.* into v_exam
  from public.buklod_quiz_exams e
  where e.id=v_session.exam_id;

  select p.* into v_profile
  from public.profiles p
  where p.id=v_actor and coalesce(p.is_active,true)=true;
  if v_profile.id is null then raise exception 'Active BUKLOD profile not found.'; end if;

  select s.name into v_live_section_name
  from public.buklod_quiz_sections s
  where s.id=v_session.section_id;

  select r.* into v_roster
  from public.buklod_quiz_roster r
  where r.exam_id=v_session.exam_id and r.student_user_id=v_actor
  limit 1;

  if v_roster.id is not null then
    select s.name into v_roster_section_name
    from public.buklod_quiz_sections s
    where s.id=v_roster.section_id;

    v_same_label :=
      lower(regexp_replace(coalesce(v_roster_section_name,''), '[-[:space:]]+', '', 'g')) =
      lower(regexp_replace(coalesce(v_live_section_name,''), '[-[:space:]]+', '', 'g'));
  end if;

  if v_roster.id is not null and v_roster.section_id<>v_session.section_id then
    if exists(
      select 1
      from public.buklod_quiz_attempts a
      join public.buklod_quiz_live_sessions old_ls
        on old_ls.id=a.live_session_id
       and old_ls.exam_id=a.exam_id
       and old_ls.section_id=a.section_id
       and old_ls.status<>'ENDED'
      join public.buklod_quiz_sections old_s
        on old_s.id=a.section_id and old_s.exam_id=a.exam_id and old_s.archived_at is null
      where a.exam_id=v_session.exam_id
        and a.student_user_id=v_actor
        and a.section_id<>v_session.section_id
        and a.status='STARTED'
    ) then
      raise exception 'You already have a started attempt in another currently active class for this exam. Ask faculty to resolve that active attempt first.';
    end if;

    if v_same_label then
      update public.buklod_quiz_roster r
      set section_id=v_session.section_id,
          updated_at=now()
      where r.id=v_roster.id;
      v_roster.section_id:=v_session.section_id;
    else
      select exists(
        select 1
        from public.buklod_quiz_section_join_overrides o
        where o.session_id=v_session.id
          and o.student_user_id=v_actor
          and (o.expires_at is null or o.expires_at>now())
      ) into v_mismatch_override;

      if not v_mismatch_override then
        raise exception
          'Wrong live class code. Your roster is % but this code is for %. Ask faculty for the correct code or an intentional override.',
          coalesce(v_roster_section_name,'Unknown'),
          coalesce(v_live_section_name,'Unknown');
      end if;

      update public.buklod_quiz_live_members lm
      set status='LEFT',last_seen_at=now()
      where lm.student_user_id=v_actor
        and lm.session_id in (
          select old_ls.id
          from public.buklod_quiz_live_sessions old_ls
          join public.buklod_quiz_sections old_s
            on old_s.id=old_ls.section_id and old_s.exam_id=old_ls.exam_id
          where old_ls.exam_id=v_session.exam_id
            and old_ls.section_id<>v_session.section_id
            and old_ls.status<>'ENDED'
        );
    end if;
  end if;

  if v_relive_only and not v_has_final_attempt then
    v_member_status:='ADMITTED';
  elsif v_session.admission_mode='OPEN'
     or (v_roster.id is not null and v_roster.status='ACTIVE') then
    v_member_status:='ADMITTED';
  else
    v_member_status:='WAITING';
  end if;

  insert into public.buklod_quiz_live_members(
    session_id,student_user_id,status,display_name,
    joined_at,admitted_at,removed_at,last_seen_at
  ) values(
    v_session.id,v_actor,v_member_status,
    coalesce(nullif(v_profile.full_name,''),nullif(v_profile.username,''),'BUKLOD Student'),
    now(),case when v_member_status='ADMITTED' then now() else null end,null,now()
  )
  on conflict on constraint buklod_quiz_live_members_session_id_student_user_id_key
  do update set
    status=case
      when v_relive_only and not v_has_final_attempt then 'ADMITTED'
      else excluded.status
    end,
    display_name=excluded.display_name,
    last_seen_at=now(),
    removed_at=null,
    admitted_at=case
      when v_member_status='ADMITTED' then coalesce(public.buklod_quiz_live_members.admitted_at,now())
      else public.buklod_quiz_live_members.admitted_at
    end;

  if v_roster.id is null then
    insert into public.buklod_quiz_roster(
      exam_id,section_id,student_user_id,student_no,
      surname,first_name,display_name,status
    ) values(
      v_session.exam_id,v_session.section_id,v_actor,null,
      coalesce(v_profile.surname,''),coalesce(v_profile.first_name,''),
      coalesce(nullif(v_profile.full_name,''),nullif(v_profile.username,''),'BUKLOD Student'),
      case when v_member_status='ADMITTED' then 'ACTIVE' else 'PENDING' end
    )
    on conflict on constraint buklod_quiz_roster_exam_id_student_user_id_key
    do nothing;
  elsif v_roster.section_id=v_session.section_id then
    update public.buklod_quiz_roster r
    set surname=coalesce(v_profile.surname,''),
        first_name=coalesce(v_profile.first_name,''),
        display_name=coalesce(nullif(v_profile.full_name,''),nullif(v_profile.username,''),'BUKLOD Student'),
        status=case
          when v_relive_only and not v_has_final_attempt then 'ACTIVE'
          when v_member_status='ADMITTED' then 'ACTIVE'
          when r.status='ACTIVE' then 'ACTIVE'
          else 'PENDING'
        end,
        updated_at=now()
    where r.id=v_roster.id;
  else
    update public.buklod_quiz_roster r
    set surname=coalesce(v_profile.surname,''),
        first_name=coalesce(v_profile.first_name,''),
        display_name=coalesce(nullif(v_profile.full_name,''),nullif(v_profile.username,''),'BUKLOD Student'),
        updated_at=now()
    where r.id=v_roster.id;
  end if;

  return query
  select
    v_session.id,
    v_session.exam_id,
    v_exam.title,
    v_session.status,
    v_member_status,
    v_session.join_code,
    (v_session.status='LIVE' and v_member_status='ADMITTED' and not (v_relive_only and v_has_final_attempt));
end
$function$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_section_mismatch_override_candidates_v1(p_session_id uuid, p_search text DEFAULT NULL::text)
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
        and (o.expires_at is null or o.expires_at>now())
    ) as override_granted,
    r.status
  from public.buklod_quiz_live_sessions ls
  join public.buklod_quiz_sections cs on cs.id=ls.section_id
  join public.buklod_quiz_roster r on r.exam_id=ls.exam_id
  join public.buklod_quiz_sections rs on rs.id=r.section_id
  left join public.profiles p on p.id=r.student_user_id
  where ls.id=p_session_id
    and ls.faculty_user_id=(select auth.uid())
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

CREATE OR REPLACE FUNCTION public.buklod_quiz_set_section_mismatch_override_v1(p_session_id uuid, p_student_user_id uuid, p_allow boolean, p_note text DEFAULT NULL::text)
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
  where ls.id=p_session_id
    and ls.faculty_user_id=v_actor;

  if v_session.id is null then
    raise exception 'Live class not found or unauthorized.';
  end if;

  select r.* into v_roster
  from public.buklod_quiz_roster r
  where r.exam_id=v_session.exam_id
    and r.student_user_id=p_student_user_id
  limit 1;

  if v_roster.id is null then
    raise exception 'Student is not on this exam roster.';
  end if;

  select name into v_roster_name
  from public.buklod_quiz_sections
  where id=v_roster.section_id;

  select name into v_code_name
  from public.buklod_quiz_sections
  where id=v_session.section_id;

  if lower(regexp_replace(coalesce(v_roster_name,''), '[-[:space:]]+', '', 'g')) =
     lower(regexp_replace(coalesce(v_code_name,''), '[-[:space:]]+', '', 'g')) then
    raise exception 'Roster and live code already refer to the same class label.';
  end if;

  if coalesce(p_allow,false) then
    insert into public.buklod_quiz_section_join_overrides(
      session_id,student_user_id,granted_by,note,created_at,expires_at
    )
    values(
      v_session.id,p_student_user_id,v_actor,nullif(trim(coalesce(p_note,'')),''),
      now(),coalesce(v_session.ended_at, now()+interval '12 hours')
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

CREATE OR REPLACE FUNCTION public.buklod_quiz_delete_section_v1(p_exam_id uuid, p_section_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_has_history boolean;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_quiz_is_examiner(v_actor) then raise exception 'Examiner access required.'; end if;
  if not exists(select 1 from public.buklod_quiz_exams e where e.id=p_exam_id and e.owner_user_id=v_actor) then
    raise exception 'Exam owner access required.';
  end if;

  if not exists(select 1 from public.buklod_quiz_sections s where s.id=p_section_id and s.exam_id=p_exam_id and s.archived_at is null) then
    return true;
  end if;

  -- Do not end a class with in-progress non-expired exam attempts.
  -- Existing behavior ended the room and stranded those attempts in STARTED state.
  if exists(
    select 1 from public.buklod_quiz_attempts a
    join public.buklod_quiz_live_sessions ls on ls.id=a.live_session_id
    where a.exam_id=p_exam_id
      and a.section_id=p_section_id
      and a.status='STARTED'
      and a.expires_at>now()
      and ls.status in ('LIVE','PAUSED')
  ) then
    raise exception 'Cannot delete this class while students have active exams. End or safely finalize those attempts first.';
  end if;

  select
    exists(select 1 from public.buklod_quiz_attempts a where a.exam_id=p_exam_id and a.section_id=p_section_id)
    or exists(select 1 from public.buklod_quiz_live_sessions ls where ls.exam_id=p_exam_id and ls.section_id=p_section_id)
    or exists(select 1 from public.buklod_quiz_roster r where r.exam_id=p_exam_id and r.section_id=p_section_id)
  into v_has_history;

  if not v_has_history then
    delete from public.buklod_quiz_sections s where s.id=p_section_id and s.exam_id=p_exam_id;
    return true;
  end if;

  update public.buklod_quiz_sections
  set archived_at=now(), archived_by=v_actor
  where id=p_section_id and exam_id=p_exam_id;

  update public.buklod_quiz_live_sessions
  set status='ENDED',ended_at=coalesce(ended_at,now()),paused_at=null,updated_at=now()
  where exam_id=p_exam_id and section_id=p_section_id and status<>'ENDED';

  return true;
end
$function$;
