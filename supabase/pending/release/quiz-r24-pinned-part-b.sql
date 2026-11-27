-- Pinned source: BULK_ACTION_R14 blob 831cb81e1a9317f4af49fa33e20835a6d7959ab5
-- R14 DEV candidate. Apply atomically only in QA until regression passes.
-- Existing v1/v2 signatures route through the same guarded implementation.
CREATE FUNCTION public.buklod_quiz_live_bulk_action_v3(
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
     UPDATE public.buklod_quiz_attempts t SET expires_at=
       CASE WHEN act='ADD_TIME' THEN greatest(t.expires_at,now()) ELSE now() END+make_interval(mins=>minutes),
       updated_at=now() WHERE t.id=a.id AND t.status='STARTED';
     IF FOUND THEN n:=n+1; END IF;
   ELSE
     -- Existing single-reset RPC can VOID multiple attempts and initializes max_score
     -- from the full bank. Restrict this compatibility path to unsnapshotted,
     -- full-bank rooms with exactly one non-VOID attempt and no released result.
     IF m.status<>'ADMITTED' OR a.status NOT IN ('STARTED','NEEDS_REVIEW','GRADED') THEN CONTINUE; END IF;
     IF coalesce(s.settings_snapshot->>'question_selection_mode','')<>'' 
       OR EXISTS(SELECT 1 FROM public.buklod_quiz_attempt_questions q WHERE q.attempt_id=a.id)
       OR (SELECT count(*) FROM public.buklod_quiz_attempts t WHERE t.exam_id=s.exam_id
           AND t.section_id=s.section_id AND t.student_user_id=a.student_user_id AND t.status<>'VOID')<>1
       OR s.question_count IS DISTINCT FROM (SELECT count(*)::integer FROM public.buklod_quiz_questions q
           WHERE q.exam_id=s.exam_id AND q.is_active IS TRUE)
       OR s.total_score_target IS DISTINCT FROM (SELECT e.total_points FROM public.buklod_quiz_exams e WHERE e.id=s.exam_id)
     THEN RAISE EXCEPTION 'Bulk reset requires assignment-aware reset or individual review'; END IF;
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
REVOKE ALL ON FUNCTION public.buklod_quiz_live_bulk_action_v3(uuid,text,uuid[],integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_live_bulk_action_v3(uuid,text,uuid[],integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.buklod_quiz_live_bulk_action_v1(
 p_session_id uuid,p_action text,p_student_user_ids uuid[] DEFAULT NULL)
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $fn$
 SELECT public.buklod_quiz_live_bulk_action_v3(p_session_id,p_action,p_student_user_ids,NULL);
$fn$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_live_bulk_action_v2(
 p_session_id uuid,p_action text,p_student_user_ids uuid[] DEFAULT NULL)
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $fn$
 SELECT public.buklod_quiz_live_bulk_action_v3(p_session_id,p_action,p_student_user_ids,NULL);
$fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_live_bulk_action_v1(uuid,text,uuid[]) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_live_bulk_action_v2(uuid,text,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_live_bulk_action_v1(uuid,text,uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_live_bulk_action_v2(uuid,text,uuid[]) TO authenticated;


-- Pinned source: SECTION_RECONCILIATION_R15 blob a20c3a5a0ca38a6a14bb2fb331b7b6d087b8a96c
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


-- Pinned source: SECURE_JOIN_R16 blob cabe3df02cbc1ec2f1b16a29d6ae5dc89e031b3a
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


-- Pinned source: SECURE_START_R17 blob d63d116fc1700bdd7f1768380ebb7fb79e85ba1a
-- R17 isolated DEV candidate. No live release until rollback and device/offline E2E QA.
-- All start contracts route to one checked snapshot-aware path.
CREATE OR REPLACE FUNCTION public.buklod_quiz_snapshot_live_session_v1(p_session_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  s public.buklod_quiz_live_sessions%rowtype;
  e public.buklod_quiz_exams%rowtype;
  v_selected uuid[];
  v_expected integer;
  v_count integer;
  v_hash text;
  v_pts numeric;
  v_actor_kind text;
begin
  select ls.* into s
  from public.buklod_quiz_live_sessions ls
  where ls.id=p_session_id
    and (
      ls.faculty_user_id=v_actor
      or (
        ls.status='LIVE'
        and exists(
          select 1 from public.buklod_quiz_live_members m
          where m.session_id=ls.id and m.student_user_id=v_actor and m.status='ADMITTED'
        )
      )
    )
  for update;
  if s.id is null then raise exception 'Live class not found or unauthorized.'; end if;
  v_actor_kind:=case when s.faculty_user_id=v_actor then 'FACULTY' else 'ADMITTED_STUDENT_LEGACY_RECOVERY' end;

  select x.* into e from public.buklod_quiz_exams x where x.id=s.exam_id;
  if e.id is null then raise exception 'Exam not found.'; end if;

  select count(*)::int into v_count
  from public.buklod_quiz_live_question_snapshots x where x.session_id=s.id;
  if v_count>0 then return v_count; end if;

  v_selected:=s.selected_question_ids;
  if coalesce(array_length(v_selected,1),0)=0 then
    select array_agg(q.id order by q.sort_order,q.id) into v_selected
    from public.buklod_quiz_questions q
    where q.exam_id=s.exam_id and q.is_active=true;
  end if;
  v_expected:=coalesce(array_length(v_selected,1),0);
  if s.question_count IS NOT NULL AND s.question_count>0 AND s.question_count<>v_expected THEN raise exception 'Configured question count differs from selected questions; faculty must prepare room again.'; END IF;
  if v_expected<1 then raise exception 'Add at least one active question before starting.'; end if;

  if exists(
    select 1 from unnest(v_selected) x(question_id)
    where not exists(
      select 1 from public.buklod_quiz_questions q
      where q.id=x.question_id and q.exam_id=s.exam_id and q.is_active=true
    )
  ) then raise exception 'One or more selected live questions are missing or inactive.'; end if;

  insert into public.buklod_quiz_live_question_snapshots(
    session_id,question_id,question_type,prompt,options,correct_answer,points,sort_order,
    source_pages,rubric,explanation,snapshot_order
  )
  select s.id,q.id,q.question_type,q.prompt,q.options,q.correct_answer,q.points,q.sort_order,
         q.source_pages,q.rubric,q.explanation,
         coalesce(array_position(v_selected,q.id),row_number() over(order by q.sort_order,q.id)::int)
  from public.buklod_quiz_questions q
  where q.exam_id=s.exam_id and q.id=any(v_selected) and q.is_active=true
  order by coalesce(array_position(v_selected,q.id),q.sort_order),q.id;

  select count(*)::int,coalesce(sum(x.points),0),
         md5(string_agg(
           x.question_id::text||'|'||x.question_type||'|'||x.prompt||'|'||
           coalesce(x.options::text,'')||'|'||coalesce(x.correct_answer::text,'')||'|'||
           x.points::text||'|'||x.snapshot_order::text,
           '||' order by x.snapshot_order,x.question_id
         ))
    into v_count,v_pts,v_hash
  from public.buklod_quiz_live_question_snapshots x where x.session_id=s.id;
  if v_count<>v_expected then raise exception 'Live question snapshot is incomplete.'; end if;

  update public.buklod_quiz_live_sessions ls set
    selected_question_ids=v_selected,question_count=v_count,
    total_score_target=coalesce(nullif(ls.total_score_target,0),v_pts),
    duration_minutes=coalesce(ls.duration_minutes,e.duration_minutes),
    max_attempts=coalesce(ls.max_attempts,e.max_attempts),
    pass_percent=coalesce(ls.pass_percent,e.pass_percent),
    randomize_questions=coalesce(ls.randomize_questions,e.randomize_questions),
    randomize_choices=coalesce(ls.randomize_choices,e.randomize_choices),
    one_question_at_a_time=coalesce(ls.one_question_at_a_time,e.one_question_at_a_time),
    no_backtracking=coalesce(ls.no_backtracking,e.no_backtracking),
    require_fullscreen_web=coalesce(ls.require_fullscreen_web,e.require_fullscreen_web),
    block_screen_capture=coalesce(ls.block_screen_capture,e.block_screen_capture),
    integrity_mode=coalesce(ls.integrity_mode,e.integrity_mode),
    security_preset=coalesce(ls.security_preset,e.security_preset),
    device_policy=coalesce(ls.device_policy,e.device_policy),
    behavior_monitoring=coalesce(ls.behavior_monitoring,e.behavior_monitoring),
    offline_security_mode=coalesce(ls.offline_security_mode,e.offline_security_mode),
    join_policy=coalesce(nullif(ls.join_policy,''),e.default_live_join_policy),
    settings_snapshot=coalesce(ls.settings_snapshot,'{}'::jsonb)||jsonb_build_object(
      'duration_minutes',coalesce(ls.duration_minutes,e.duration_minutes),
      'max_attempts',coalesce(ls.max_attempts,e.max_attempts),
      'pass_percent',coalesce(ls.pass_percent,e.pass_percent),
      'randomize_questions',coalesce(ls.randomize_questions,e.randomize_questions),
      'randomize_choices',coalesce(ls.randomize_choices,e.randomize_choices),
      'one_question_at_a_time',coalesce(ls.one_question_at_a_time,e.one_question_at_a_time),
      'no_backtracking',coalesce(ls.no_backtracking,e.no_backtracking),
      'require_fullscreen_web',coalesce(ls.require_fullscreen_web,e.require_fullscreen_web),
      'block_screen_capture',coalesce(ls.block_screen_capture,e.block_screen_capture),
      'integrity_mode',coalesce(ls.integrity_mode,e.integrity_mode),
      'security_preset',coalesce(ls.security_preset,e.security_preset),
      'device_policy',coalesce(ls.device_policy,e.device_policy),
      'behavior_monitoring',coalesce(ls.behavior_monitoring,e.behavior_monitoring),
      'offline_security_mode',coalesce(ls.offline_security_mode,e.offline_security_mode),
      'join_policy',coalesce(nullif(ls.join_policy,''),e.default_live_join_policy),
      'snapshot_hash',v_hash,'snapshot_question_count',v_count
    ),
    question_snapshot_hash=v_hash,config_locked_at=coalesce(ls.config_locked_at,now()),updated_at=now()
  where ls.id=s.id;

  perform public.buklod_quiz_audit_write_v1(
    s.exam_id,s.section_id,s.id,null,'LIVE_SNAPSHOT_LOCKED',
    jsonb_build_object('question_count',v_count,'snapshot_hash',v_hash,'total_points',v_pts,'actor_kind',v_actor_kind),v_actor
  );
  return v_count;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_live_start_attempt_v3(p_session_id uuid, p_device_token text DEFAULT NULL::text)
 RETURNS TABLE(attempt_id uuid, status text, expires_at timestamp with time zone, duration_minutes integer, one_question_at_a_time boolean, no_backtracking boolean, section_id uuid, section_name text, question_count integer, total_score_target numeric, randomize_choices boolean)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
 actor uuid:=auth.uid();
 s public.buklod_quiz_live_sessions%ROWTYPE;
 e public.buklod_quiz_exams%ROWTYPE;
 a public.buklod_quiz_attempts%ROWTYPE;
 started record;
 n integer;
 assigned_total numeric;
 policy text;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Sign in first.' USING ERRCODE='42501'; END IF;
 SELECT ls.* INTO s FROM public.buklod_quiz_live_sessions ls WHERE ls.id=p_session_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Live class unavailable'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||':'||s.exam_id::text,0));
 SELECT ls.* INTO s FROM public.buklod_quiz_live_sessions ls
 JOIN public.buklod_quiz_sections sec ON sec.id=ls.section_id AND sec.exam_id=ls.exam_id AND sec.archived_at IS NULL
 WHERE ls.id=p_session_id AND ls.status='LIVE' FOR UPDATE OF ls;
 IF NOT FOUND THEN RAISE EXCEPTION 'Live class unavailable'; END IF;
 SELECT x.* INTO e FROM public.buklod_quiz_exams x WHERE x.id=s.exam_id AND x.status='PUBLISHED' AND x.archived_at IS NULL;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=actor AND coalesce(p.is_active,true))
 THEN RAISE EXCEPTION 'Active profile and published exam required'; END IF;
 PERFORM 1 FROM public.buklod_quiz_live_members m WHERE m.session_id=s.id AND m.student_user_id=actor AND m.status='ADMITTED' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Faculty admission required'; END IF;
 PERFORM 1 FROM public.buklod_quiz_roster r WHERE r.exam_id=s.exam_id AND r.section_id=s.section_id AND r.student_user_id=actor AND r.status='ACTIVE' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active exact class roster required'; END IF;
 IF EXISTS(SELECT 1 FROM public.buklod_quiz_attempts t WHERE t.exam_id=s.exam_id AND t.student_user_id=actor AND t.status='STARTED' AND t.live_session_id IS DISTINCT FROM s.id)
 THEN RAISE EXCEPTION 'Another unfinished attempt exists; faculty recovery required'; END IF;
 SELECT t.* INTO a FROM public.buklod_quiz_attempts t WHERE t.live_session_id=s.id AND t.student_user_id=actor AND t.status='STARTED' ORDER BY t.attempt_no DESC,t.id DESC LIMIT 1 FOR UPDATE;
 IF a.id IS NOT NULL AND EXISTS(SELECT 1 FROM public.buklod_quiz_attempts t WHERE t.exam_id=s.exam_id AND t.student_user_id=actor AND t.status='STARTED' AND t.id<>a.id)
 THEN RAISE EXCEPTION 'Multiple unfinished attempts; faculty review required'; END IF;
 policy:=upper(coalesce(nullif(a.security_snapshot->>'device_policy',''),s.device_policy,e.device_policy,'MONITOR'));
 IF policy='LOCK' AND nullif(btrim(coalesce(p_device_token,'')),'') IS NULL THEN RAISE EXCEPTION 'Device token required for locked exam'; END IF;
 IF a.id IS NOT NULL THEN
   -- Never rebuild an historical question set from a mutable question bank.
   SELECT count(*)::integer,coalesce(sum(q.points),0) INTO n,assigned_total FROM public.buklod_quiz_attempt_questions q WHERE q.attempt_id=a.id;
   IF n=0 THEN RAISE EXCEPTION 'Existing attempt has no immutable assignments; faculty recovery required'; END IF;
   IF assigned_total IS DISTINCT FROM a.max_score OR (s.question_count>0 AND n<>s.question_count)
   THEN RAISE EXCEPTION 'Existing assignment differs from exam configuration; faculty recovery required'; END IF;
   IF a.expires_at IS NULL THEN RAISE EXCEPTION 'Attempt deadline is missing'; END IF;
   IF a.expires_at<=now() THEN
     IF now()>a.expires_at+interval '2 minutes' AND NOT EXISTS(SELECT 1 FROM public.buklod_quiz_offline_leases l
       WHERE l.attempt_id=a.id AND l.student_user_id=actor AND l.used_at IS NULL AND l.sync_grace_expires_at>now())
     THEN RAISE EXCEPTION 'Attempt expired; use submission recovery or contact faculty'; END IF;
     PERFORM public.buklod_quiz_bind_attempt_device_v1(a.id,p_device_token,'LIVE_OFFLINE_RECOVERY');
     INSERT INTO public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
     SELECT a.id,actor,'EXPIRED_ATTEMPT_RECOVERY_WINDOW_OPEN',jsonb_build_object('expires_at',a.expires_at,'source','LIVE_START_V3')
     WHERE NOT EXISTS(SELECT 1 FROM public.buklod_quiz_events ev WHERE ev.attempt_id=a.id AND ev.event_type='EXPIRED_ATTEMPT_RECOVERY_WINDOW_OPEN');
     RETURN QUERY SELECT a.id,a.status,a.expires_at,coalesce(s.duration_minutes,e.duration_minutes),
       coalesce(s.one_question_at_a_time,e.one_question_at_a_time),coalesce(s.no_backtracking,e.no_backtracking),
       s.section_id,(SELECT sec.name::text FROM public.buklod_quiz_sections sec WHERE sec.id=s.section_id),
       n,a.max_score,coalesce(s.randomize_choices,e.randomize_choices,false);
     RETURN;
   END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.buklod_quiz_live_question_snapshots x WHERE x.session_id=s.id) THEN
   IF a.id IS NOT NULL OR EXISTS(SELECT 1 FROM public.buklod_quiz_attempts t WHERE t.live_session_id=s.id)
   THEN RAISE EXCEPTION 'Room has historical attempts without a snapshot; faculty recovery required'; END IF;
   PERFORM public.buklod_quiz_snapshot_live_session_v1(s.id);
   SELECT ls.* INTO s FROM public.buklod_quiz_live_sessions ls WHERE ls.id=p_session_id;
 END IF;
 SELECT count(*)::integer INTO n FROM public.buklod_quiz_live_question_snapshots x WHERE x.session_id=s.id;
 IF n<1 OR s.question_count IS DISTINCT FROM n OR nullif(s.question_snapshot_hash,'') IS NULL
 THEN RAISE EXCEPTION 'Room snapshot incomplete'; END IF;
 SELECT * INTO STRICT started FROM public.buklod_quiz_live_start_attempt_v3_core(s.id,p_device_token);
 SELECT t.* INTO STRICT a FROM public.buklod_quiz_attempts t WHERE t.id=started.attempt_id AND t.student_user_id=actor AND t.live_session_id=s.id;
 SELECT count(*)::integer,coalesce(sum(q.points),0) INTO n,assigned_total FROM public.buklod_quiz_attempt_questions q WHERE q.attempt_id=a.id;
 IF a.status<>'STARTED' OR n<>s.question_count OR assigned_total IS DISTINCT FROM a.max_score OR a.max_score IS DISTINCT FROM s.total_score_target
 THEN RAISE EXCEPTION 'Attempt assignment postcondition failed'; END IF;
 RETURN QUERY SELECT a.id,a.status,a.expires_at,started.duration_minutes,started.one_question_at_a_time,started.no_backtracking,
   started.section_id,started.section_name,n,a.max_score,coalesce(s.randomize_choices,e.randomize_choices,false);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_live_start_attempt_v1(p_session_id uuid)
 RETURNS TABLE(attempt_id uuid, status text, expires_at timestamp with time zone, duration_minutes integer, one_question_at_a_time boolean, no_backtracking boolean)
 LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $fn$ SELECT x.attempt_id,x.status,x.expires_at,x.duration_minutes,x.one_question_at_a_time,x.no_backtracking FROM public.buklod_quiz_live_start_attempt_v3(p_session_id,NULL) x; $fn$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_live_start_attempt_v2(p_session_id uuid)
 RETURNS TABLE(attempt_id uuid, status text, expires_at timestamp with time zone, duration_minutes integer, one_question_at_a_time boolean, no_backtracking boolean, section_id uuid, section_name text)
 LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $fn$ SELECT x.attempt_id,x.status,x.expires_at,x.duration_minutes,x.one_question_at_a_time,x.no_backtracking,x.section_id,x.section_name FROM public.buklod_quiz_live_start_attempt_v3(p_session_id,NULL) x; $fn$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_start_attempt_v2(p_exam_id uuid, p_device_token text DEFAULT NULL::text)
 RETURNS TABLE(attempt_id uuid, status text, expires_at timestamp with time zone, duration_minutes integer, one_question_at_a_time boolean, no_backtracking boolean)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE actor uuid:=auth.uid(); room uuid; n integer;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Sign in first.' USING ERRCODE='42501'; END IF;
 SELECT count(*)::integer,min(ls.id::text)::uuid INTO n,room FROM public.buklod_quiz_live_sessions ls
 JOIN public.buklod_quiz_live_members m ON m.session_id=ls.id AND m.student_user_id=actor AND m.status='ADMITTED'
 JOIN public.buklod_quiz_roster r ON r.exam_id=ls.exam_id AND r.section_id=ls.section_id AND r.student_user_id=actor AND r.status='ACTIVE'
 JOIN public.buklod_quiz_sections sec ON sec.id=ls.section_id AND sec.exam_id=ls.exam_id AND sec.archived_at IS NULL
 WHERE ls.exam_id=p_exam_id AND ls.status='LIVE';
 IF n<>1 THEN RAISE EXCEPTION 'Enter the exact active live class code from faculty.'; END IF;
 RETURN QUERY SELECT x.attempt_id,x.status,x.expires_at,x.duration_minutes,x.one_question_at_a_time,x.no_backtracking FROM public.buklod_quiz_live_start_attempt_v3(room,p_device_token) x;
END;
$fn$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_start_attempt_v1(p_exam_id uuid)
 RETURNS TABLE(attempt_id uuid, status text, expires_at timestamp with time zone, duration_minutes integer, one_question_at_a_time boolean, no_backtracking boolean)
 LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $fn$ SELECT * FROM public.buklod_quiz_start_attempt_v2(p_exam_id,NULL); $fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_live_start_attempt_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_live_start_attempt_v1(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_live_start_attempt_v2(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_live_start_attempt_v2(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_live_start_attempt_v3(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_live_start_attempt_v3(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_start_attempt_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_start_attempt_v1(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_start_attempt_v2(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_start_attempt_v2(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_live_start_attempt_v3_core(uuid,text) FROM PUBLIC,anon,authenticated;


-- Pinned source: SUBMISSION_R18 blob 18121b150ee2317460dd5b138f047fc1d9278f8a
-- R18 DEV only; apply after R17, never independently in production.
-- Assigned points and frozen live references take precedence over mutable bank.
CREATE FUNCTION private.buklod_quiz_grading_items_r18(p_attempt_id uuid)
RETURNS TABLE(id uuid,question_type text,correct_answer jsonb,points numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
 SELECT aq.question_id,CASE WHEN a.live_session_id IS NULL THEN q.question_type ELSE snap.question_type END,
 CASE WHEN a.live_session_id IS NULL THEN q.correct_answer ELSE snap.correct_answer END,aq.points
 FROM public.buklod_quiz_attempts a JOIN public.buklod_quiz_attempt_questions aq ON aq.attempt_id=a.id
 JOIN public.buklod_quiz_questions q ON q.id=aq.question_id AND q.exam_id=a.exam_id
 LEFT JOIN public.buklod_quiz_live_question_snapshots snap ON snap.session_id=a.live_session_id AND snap.question_id=aq.question_id
 WHERE a.id=p_attempt_id AND (a.live_session_id IS NULL OR snap.question_id IS NOT NULL)
 UNION ALL
 SELECT q.id,q.question_type,q.correct_answer,q.points FROM public.buklod_quiz_attempts a
 JOIN public.buklod_quiz_questions q ON q.exam_id=a.exam_id AND q.is_active=true
 WHERE a.id=p_attempt_id AND NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempt_questions aq WHERE aq.attempt_id=a.id);
$fn$;
REVOKE ALL ON FUNCTION private.buklod_quiz_grading_items_r18(uuid) FROM PUBLIC,anon,authenticated;
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
REVOKE ALL ON FUNCTION public.buklod_quiz_compute_attempt_internal(uuid) FROM PUBLIC,anon,authenticated;

-- Own-attempt write authorization; room lock precedes attempt lock.
CREATE FUNCTION private.buklod_quiz_lock_student_write_r18(p_attempt_id uuid,p_device_token text)
RETURNS public.buklod_quiz_attempts LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE a public.buklod_quiz_attempts%ROWTYPE; actor uuid:=auth.uid(); room uuid; policy text; s public.buklod_quiz_live_sessions%ROWTYPE;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
 SELECT t.* INTO a FROM public.buklod_quiz_attempts t WHERE t.id=p_attempt_id AND t.student_user_id=actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'Attempt not found'; END IF;
 room:=a.live_session_id;
 IF room IS NOT NULL THEN
   SELECT ls.* INTO s FROM public.buklod_quiz_live_sessions ls WHERE ls.id=room FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Room unavailable'; END IF;
 END IF;
 SELECT t.* INTO STRICT a FROM public.buklod_quiz_attempts t WHERE t.id=p_attempt_id AND t.student_user_id=actor FOR UPDATE;
 IF a.live_session_id IS DISTINCT FROM room THEN RAISE EXCEPTION 'Attempt moved; refresh'; END IF;
 IF a.status IN ('GRADED','RELEASED','NEEDS_REVIEW') THEN RETURN a; END IF;
 IF a.status<>'STARTED' OR a.expires_at IS NULL THEN RAISE EXCEPTION 'Attempt is not active'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=actor AND coalesce(p.is_active,true)) THEN RAISE EXCEPTION 'Active profile required'; END IF;
 IF room IS NOT NULL AND (s.status<>'LIVE' OR NOT EXISTS(
   SELECT 1 FROM public.buklod_quiz_live_members m JOIN public.buklod_quiz_roster r ON r.exam_id=s.exam_id AND r.section_id=s.section_id AND r.student_user_id=m.student_user_id AND r.status='ACTIVE'
   WHERE m.session_id=room AND m.student_user_id=actor AND m.status='ADMITTED')
   OR s.exam_id IS DISTINCT FROM a.exam_id OR s.section_id IS DISTINCT FROM a.section_id)
 THEN RAISE EXCEPTION 'Active admitted class required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempt_questions q WHERE q.attempt_id=a.id) THEN RAISE EXCEPTION 'Immutable assignment missing; faculty recovery required'; END IF;
 policy:=upper(coalesce(nullif(a.security_snapshot->>'device_policy',''),s.device_policy,(SELECT e.device_policy FROM public.buklod_quiz_exams e WHERE e.id=a.exam_id),'MONITOR'));
 IF policy='LOCK' AND nullif(btrim(coalesce(p_device_token,'')),'') IS NULL THEN RAISE EXCEPTION 'Device token required'; END IF;
 PERFORM public.buklod_quiz_bind_attempt_device_v1(a.id,p_device_token,'STUDENT_WRITE_R18');
 RETURN a;
END;
$fn$;
REVOKE ALL ON FUNCTION private.buklod_quiz_lock_student_write_r18(uuid,text) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION private.buklod_quiz_validate_payload_r18(p_attempt_id uuid,p_answers jsonb,p_limit integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE n integer;
BEGIN
 IF jsonb_typeof(p_answers) IS DISTINCT FROM 'array' OR pg_column_size(p_answers)>2097152 THEN RAISE EXCEPTION 'Invalid answers payload'; END IF;
 n:=jsonb_array_length(p_answers);
 IF n>p_limit THEN RAISE EXCEPTION 'Too many answers'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_answers) j WHERE jsonb_typeof(j)<>'object' OR NOT(j?'answer') OR coalesce(j->>'question_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN RAISE EXCEPTION 'Invalid answer item'; END IF;
 IF (SELECT count(DISTINCT (j->>'question_id')::uuid) FROM jsonb_array_elements(p_answers) j)<>n THEN RAISE EXCEPTION 'Duplicate question IDs'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_answers) j WHERE NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempt_questions q WHERE q.attempt_id=p_attempt_id AND q.question_id=(j->>'question_id')::uuid)) THEN RAISE EXCEPTION 'Unassigned question'; END IF;
 RETURN n;
END;
$fn$;
REVOKE ALL ON FUNCTION private.buklod_quiz_validate_payload_r18(uuid,jsonb,integer) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.buklod_quiz_save_answers_batch_v2(p_attempt_id uuid, p_answers jsonb, p_device_token text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE a public.buklod_quiz_attempts%ROWTYPE; n integer;
BEGIN
 a:=private.buklod_quiz_lock_student_write_r18(p_attempt_id,p_device_token);
 IF a.status<>'STARTED' THEN RETURN 0; END IF;
 IF a.expires_at<=now() THEN RAISE EXCEPTION 'Time limit ended; use submission recovery'; END IF;
 n:=private.buklod_quiz_validate_payload_r18(a.id,p_answers,50);
 INSERT INTO public.buklod_quiz_responses(attempt_id,question_id,student_user_id,answer,saved_at,updated_at)
 SELECT a.id,(j->>'question_id')::uuid,a.student_user_id,j->'answer',now(),now() FROM jsonb_array_elements(p_answers) j
 ON CONFLICT ON CONSTRAINT buklod_quiz_responses_attempt_id_question_id_key DO UPDATE SET answer=excluded.answer,saved_at=now(),updated_at=now();
 RETURN n;
END;
$fn$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_save_answers_batch_v1(p_attempt_id uuid, p_answers jsonb)
 RETURNS integer
 LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $fn$ SELECT public.buklod_quiz_save_answers_batch_v2(p_attempt_id,p_answers,NULL); $fn$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_save_answer_v2(p_attempt_id uuid, p_question_id uuid, p_answer jsonb, p_device_token text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $fn$ SELECT public.buklod_quiz_save_answers_batch_v2(p_attempt_id,jsonb_build_array(jsonb_build_object('question_id',p_question_id,'answer',p_answer)),p_device_token)=1; $fn$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_save_answer_v1(p_attempt_id uuid, p_question_id uuid, p_answer jsonb)
 RETURNS boolean
 LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $fn$ SELECT public.buklod_quiz_save_answer_v2(p_attempt_id,p_question_id,p_answer,NULL); $fn$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_submit_attempt_v4(p_attempt_id uuid, p_answers jsonb, p_client_completed_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_offline boolean DEFAULT false, p_offline_lease_token text DEFAULT NULL::text, p_device_token text DEFAULT NULL::text)
 RETURNS TABLE(status text, total_score numeric, max_score numeric)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE a public.buklod_quiz_attempts%ROWTYPE; n integer; expected integer; lease_ok boolean:=false; result_status text; token_hash text;
BEGIN
 a:=private.buklod_quiz_lock_student_write_r18(p_attempt_id,p_device_token);
 IF a.status<>'STARTED' THEN RETURN QUERY SELECT a.status,a.total_score,a.max_score; RETURN; END IF;
 n:=private.buklod_quiz_validate_payload_r18(a.id,coalesce(p_answers,'[]'::jsonb),500);
 SELECT count(*)::integer INTO expected FROM public.buklod_quiz_attempt_questions q WHERE q.attempt_id=a.id;
 IF expected<1 OR (n<>0 AND n<>expected) THEN RAISE EXCEPTION 'Incomplete submission snapshot; retry'; END IF;
 IF a.expires_at<=now() OR coalesce(p_offline,false) THEN
   IF p_client_completed_at IS NULL OR p_client_completed_at<a.started_at-interval '1 minute' OR p_client_completed_at>a.expires_at+interval '2 seconds' OR p_client_completed_at>now()+interval '2 seconds'
   THEN RAISE EXCEPTION 'Invalid completion timestamp'; END IF;
   IF nullif(btrim(coalesce(p_offline_lease_token,'')),'') IS NOT NULL THEN
     token_hash:=encode(extensions.digest(p_offline_lease_token,'sha256'),'hex');
     SELECT EXISTS(SELECT 1 FROM public.buklod_quiz_offline_leases l WHERE l.attempt_id=a.id AND l.student_user_id=a.student_user_id
     AND l.lease_token_hash=token_hash AND l.used_at IS NULL AND l.revoked_at IS NULL
     AND l.issued_at<=a.expires_at AND l.attempt_expires_at=a.expires_at AND l.sync_grace_expires_at>=now()
     AND l.device_hash IS NOT NULL AND l.device_hash=encode(extensions.digest(coalesce(p_device_token,''),'sha256'),'hex')) INTO lease_ok;
   END IF;
   -- Client time is not trusted proof. Require an issued, device-bound lease for late answer writes.
   IF NOT lease_ok THEN RAISE EXCEPTION 'Valid device-bound offline lease required; saved answers preserved'; END IF;
   IF n<>expected THEN RAISE EXCEPTION 'Complete offline snapshot required'; END IF;
 END IF;
 INSERT INTO public.buklod_quiz_responses(attempt_id,question_id,student_user_id,answer,saved_at,updated_at)
 SELECT a.id,(j->>'question_id')::uuid,a.student_user_id,j->'answer',now(),now() FROM jsonb_array_elements(coalesce(p_answers,'[]'::jsonb)) j
 ON CONFLICT ON CONSTRAINT buklod_quiz_responses_attempt_id_question_id_key DO UPDATE SET answer=excluded.answer,saved_at=now(),updated_at=now();
 IF NOT EXISTS(SELECT 1 FROM public.buklod_quiz_responses r WHERE r.attempt_id=a.id AND r.answer IS NOT NULL AND r.answer NOT IN ('null'::jsonb,'[]'::jsonb,'{}'::jsonb) AND nullif(btrim(CASE WHEN jsonb_typeof(r.answer)='string' THEN r.answer#>>'{}' ELSE r.answer::text END),'') IS NOT NULL)
 THEN RAISE EXCEPTION 'Blank submission blocked; attempt remains available for recovery'; END IF;
 INSERT INTO public.buklod_quiz_responses(attempt_id,question_id,student_user_id,answer)
 SELECT a.id,q.question_id,a.student_user_id,NULL FROM public.buklod_quiz_attempt_questions q WHERE q.attempt_id=a.id
 ON CONFLICT ON CONSTRAINT buklod_quiz_responses_attempt_id_question_id_key DO NOTHING;
 result_status:=public.buklod_quiz_compute_attempt_internal(a.id);
 IF result_status NOT IN ('GRADED','NEEDS_REVIEW') THEN RAISE EXCEPTION 'Submission grading failed'; END IF;
 IF lease_ok THEN UPDATE public.buklod_quiz_offline_leases l SET used_at=now(),last_used_at=now() WHERE l.attempt_id=a.id AND l.lease_token_hash=token_hash AND l.used_at IS NULL; IF NOT FOUND THEN RAISE EXCEPTION 'Offline lease already consumed'; END IF; END IF;
 INSERT INTO public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
 VALUES(a.id,a.student_user_id,'ATOMIC_SUBMIT_V4',jsonb_build_object('offline_lease_used',lease_ok,'assigned_question_count',expected,'result_status',result_status));
 RETURN QUERY SELECT t.status,t.total_score,t.max_score FROM public.buklod_quiz_attempts t WHERE t.id=a.id;
END;
$fn$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_submit_attempt_v1(p_attempt_id uuid)
 RETURNS TABLE(status text, total_score numeric, max_score numeric)
 LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $fn$ SELECT * FROM public.buklod_quiz_submit_attempt_v4(p_attempt_id,'[]'::jsonb,NULL,false,NULL,NULL); $fn$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_submit_attempt_v2(p_attempt_id uuid, p_answers jsonb)
 RETURNS TABLE(attempt_id uuid, status text, total_score numeric, max_score numeric)
 LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $fn$ SELECT p_attempt_id,x.status,x.total_score,x.max_score FROM public.buklod_quiz_submit_attempt_v4(p_attempt_id,p_answers,NULL,false,NULL,NULL) x; $fn$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_issue_offline_lease_v2(p_attempt_id uuid, p_device_token text DEFAULT NULL::text, p_existing_lease_token text DEFAULT NULL::text)
 RETURNS TABLE(lease_token text, lease_expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  declare
    a public.buklod_quiz_attempts%rowtype;
    v_uid uuid := (select auth.uid());
    v_token text;
    v_existing_hash text;
    v_grace timestamptz;
    v_device_hash text;
  begin
    if v_uid is null then raise exception 'Sign in first.'; end if;

    a:=private.buklod_quiz_lock_student_write_r18(p_attempt_id,p_device_token);
    if a.status<>'STARTED' then raise exception 'Attempt is not active.'; end if;
    if length(btrim(coalesce(p_device_token,''))) not between 16 and 200 then raise exception 'Device token required for offline lease'; end if;
    v_device_hash:=encode(extensions.digest(p_device_token,'sha256'),'hex');

    v_grace := a.expires_at + interval '15 minutes';

    if nullif(btrim(coalesce(p_existing_lease_token,'')),'') is not null then
      v_existing_hash := encode(extensions.digest(p_existing_lease_token,'sha256'),'hex');
      if exists(
        select 1
        from public.buklod_quiz_offline_leases l
        where l.attempt_id=a.id
          and l.student_user_id=v_uid
          and l.lease_token_hash=v_existing_hash
          and l.used_at is null and l.revoked_at is null and l.device_hash=v_device_hash and l.attempt_expires_at=a.expires_at
          and l.sync_grace_expires_at > now()
      ) then
        return query select p_existing_lease_token, v_grace;
        return;
      end if;
    end if;

    if a.expires_at <= now() then
      raise exception 'Offline lease cannot be issued after the attempt expires.';
    end if;

    v_token := encode(extensions.gen_random_bytes(32),'hex');

    insert into public.buklod_quiz_offline_leases(
      attempt_id,student_user_id,lease_token_hash,device_hash,issued_at,
      attempt_expires_at,sync_grace_expires_at,used_at
    )
    values(
      a.id,v_uid,encode(extensions.digest(v_token,'sha256'),'hex'),v_device_hash,now(),
      a.expires_at,v_grace,null
    )
    on conflict (attempt_id) do update
    set student_user_id=excluded.student_user_id,
        lease_token_hash=excluded.lease_token_hash,
        device_hash=excluded.device_hash,revoked_at=null,last_used_at=null,
        issued_at=excluded.issued_at,
        attempt_expires_at=excluded.attempt_expires_at,
        sync_grace_expires_at=excluded.sync_grace_expires_at,
        used_at=null;

    insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
    values(
      a.id,v_uid,'OFFLINE_LEASE_ISSUED_V2',
      jsonb_build_object(
        'attempt_expires_at',a.expires_at,
        'sync_grace_expires_at',v_grace
      )
    );

    return query select v_token, v_grace;
  end;
  $function$;
REVOKE ALL ON FUNCTION public.buklod_quiz_save_answer_v1(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_save_answer_v1(uuid,uuid,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_save_answer_v2(uuid,uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_save_answer_v2(uuid,uuid,jsonb,text) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_save_answers_batch_v1(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_save_answers_batch_v1(uuid,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_save_answers_batch_v2(uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_save_answers_batch_v2(uuid,jsonb,text) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_submit_attempt_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_submit_attempt_v1(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_submit_attempt_v2(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_submit_attempt_v2(uuid,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_submit_attempt_v3(uuid,jsonb,timestamptz,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_submit_attempt_v3(uuid,jsonb,timestamptz,boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_submit_attempt_v4(uuid,jsonb,timestamptz,boolean,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_submit_attempt_v4(uuid,jsonb,timestamptz,boolean,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_issue_offline_lease_v1(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_issue_offline_lease_v1(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_issue_offline_lease_v2(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_issue_offline_lease_v2(uuid,text,text) TO authenticated;


-- Pinned source: REVIEW_CAPTURE_R19 blob c95f6495fe378f7347507b23c26ab88544ad3b36
-- R19 DEV candidate; depends on R18 grading references and R11 provenance.
-- Legacy suggestions without capture-time proof remain advisory only.
CREATE FUNCTION private.buklod_quiz_review_reference_r19(p_attempt_id uuid)
RETURNS TABLE(id uuid,question_type text,prompt text,points numeric,correct_answer jsonb,explanation text,rubric jsonb,sort_order integer,immutable boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
 SELECT g.id,g.question_type,
 CASE WHEN a.live_session_id IS NOT NULL AND aq.question_id IS NOT NULL THEN s.prompt ELSE q.prompt END,g.points,g.correct_answer,
 CASE WHEN a.live_session_id IS NOT NULL AND aq.question_id IS NOT NULL THEN s.explanation ELSE q.explanation END,
 CASE WHEN a.live_session_id IS NOT NULL AND aq.question_id IS NOT NULL THEN s.rubric ELSE q.rubric END,
 coalesce(aq.display_order,q.sort_order),
 (aq.question_id IS NOT NULL AND s.question_id IS NOT NULL)
 FROM public.buklod_quiz_attempts a
 CROSS JOIN LATERAL private.buklod_quiz_grading_items_r18(a.id) g
 JOIN public.buklod_quiz_questions q ON q.id=g.id AND q.exam_id=a.exam_id
 LEFT JOIN public.buklod_quiz_attempt_questions aq ON aq.attempt_id=a.id AND aq.question_id=g.id
 LEFT JOIN public.buklod_quiz_live_question_snapshots s ON s.session_id=a.live_session_id AND s.question_id=g.id
 WHERE a.id=p_attempt_id;
$fn$;
REVOKE ALL ON FUNCTION private.buklod_quiz_review_reference_r19(uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION private.buklod_quiz_review_capture_r19(p_response_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
 SELECT encode(extensions.digest(jsonb_build_object('response_id',r.id,'attempt_id',a.id,'exam_id',a.exam_id,'section_id',a.section_id,'student_id',a.student_user_id,'answer',r.answer,'saved_at',r.saved_at,'reference',to_jsonb(q))::text,'sha256'),'hex')
 FROM public.buklod_quiz_responses r JOIN public.buklod_quiz_attempts a ON a.id=r.attempt_id
 CROSS JOIN LATERAL private.buklod_quiz_review_reference_r19(a.id) q
 WHERE r.id=p_response_id AND q.id=r.question_id AND a.status='NEEDS_REVIEW' AND r.needs_review IS TRUE AND r.manual_score IS NULL;
$fn$;
REVOKE ALL ON FUNCTION private.buklod_quiz_review_capture_r19(uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.buklod_quiz_review_ai_payload_v2(p_attempt_id uuid)
RETURNS TABLE(response_id uuid,question_type text,question text,max_points numeric,student_answer text,correct_answer text,explanation text,rubric text,capture_digest text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
BEGIN
 IF auth.uid() IS NULL OR public.buklod_quiz_is_examiner(auth.uid()) IS DISTINCT FROM true OR NOT EXISTS(
 SELECT 1 FROM public.buklod_quiz_attempts a JOIN public.buklod_quiz_exams e ON e.id=a.exam_id WHERE a.id=p_attempt_id AND e.owner_user_id=auth.uid())
 THEN RAISE EXCEPTION 'Exam owner and examiner required' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT r.id,q.question_type,q.prompt,q.points,
 CASE WHEN jsonb_typeof(r.answer)='string' THEN r.answer#>>'{}' ELSE coalesce(r.answer::text,'') END,
 CASE WHEN jsonb_typeof(q.correct_answer)='string' THEN q.correct_answer#>>'{}' ELSE q.correct_answer::text END,
 q.explanation,q.rubric::text,private.buklod_quiz_review_capture_r19(r.id)
 FROM public.buklod_quiz_responses r JOIN public.buklod_quiz_attempts a ON a.id=r.attempt_id
 CROSS JOIN LATERAL private.buklod_quiz_review_reference_r19(a.id) q
 WHERE r.attempt_id=p_attempt_id AND a.status='NEEDS_REVIEW' AND q.id=r.question_id AND r.needs_review IS TRUE AND r.manual_score IS NULL
 AND upper(q.question_type) IN ('SHORT_TEXT','ESSAY','ENUMERATION','MANUAL')
 ORDER BY q.sort_order,q.id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_review_ai_payload_v2(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_review_ai_payload_v2(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.buklod_quiz_review_ai_payload_v1(p_attempt_id uuid)
RETURNS TABLE(response_id uuid,question_type text,question text,max_points numeric,student_answer text,correct_answer text,explanation text,rubric text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$ SELECT x.response_id,x.question_type,x.question,x.max_points,x.student_answer,x.correct_answer,x.explanation,x.rubric FROM public.buklod_quiz_review_ai_payload_v2(p_attempt_id) x; $fn$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_approve_attempt_review_v2(p_attempt_id uuid, p_reviews jsonb)
 RETURNS TABLE(status text, total_score numeric, max_score numeric, reviewed_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_owner uuid;
  v_status text;
  v_expected integer;
  v_item jsonb;
  v_response_id uuid;
  v_score numeric;
  v_points numeric;
  v_feedback text;
  v_seen integer;
begin
  if (select auth.uid()) is null OR public.buklod_quiz_is_examiner(auth.uid()) IS DISTINCT FROM true then raise exception 'Authentication required.'; end if;

  select e.owner_user_id,a.status into v_owner,v_status
  from public.buklod_quiz_attempts a
  join public.buklod_quiz_exams e on e.id=a.exam_id
  where a.id=p_attempt_id for update of a;

  if v_owner is null or v_owner<>(select auth.uid()) then raise exception 'Attempt not found or unauthorized.'; end if;
  if v_status<>'NEEDS_REVIEW' then raise exception 'Attempt is not pending manual review.'; end if;
  if p_reviews is null or jsonb_typeof(p_reviews)<>'array' then raise exception 'p_reviews must be a JSON array.'; end if;

  select count(*)::int into v_expected
  from public.buklod_quiz_responses r
  join private.buklod_quiz_review_reference_r19(p_attempt_id) q on q.id=r.question_id
  where r.attempt_id=p_attempt_id
    and upper(q.question_type) in ('SHORT_TEXT','ESSAY','ENUMERATION','MANUAL')
    and r.manual_score is null
    and coalesce(r.needs_review,false)=true;

  if v_expected<>(select count(*) from public.buklod_quiz_responses r where r.attempt_id=p_attempt_id and r.needs_review is true and r.manual_score is null) then raise exception 'Pending review reference missing'; end if;
  if v_expected=0 then
    perform public.buklod_quiz_compute_attempt_internal(p_attempt_id);
    return query select a.status,a.total_score,a.max_score,0 from public.buklod_quiz_attempts a where a.id=p_attempt_id;
    return;
  end if;

  if jsonb_array_length(p_reviews)<>v_expected then
    raise exception 'Approve Student requires exactly % pending review item(s). Refresh Review and try again.',v_expected;
  end if;

  for v_item in select value from jsonb_array_elements(p_reviews) loop
    begin
      v_response_id:=nullif(v_item->>'response_id','')::uuid;
      v_score:=(v_item->>'score')::numeric;
    exception when others then
      raise exception 'Each review must contain a valid response_id and numeric score.';
    end;
    v_feedback:=nullif(btrim(coalesce(v_item->>'feedback','')),'');

    select q.points into v_points
    from public.buklod_quiz_responses r
    join private.buklod_quiz_review_reference_r19(p_attempt_id) q on q.id=r.question_id
    where r.id=v_response_id
      and r.attempt_id=p_attempt_id
      and upper(q.question_type) in ('SHORT_TEXT','ESSAY','ENUMERATION','MANUAL')
      and r.manual_score is null
      and coalesce(r.needs_review,false)=true;

    if v_points is null then raise exception 'Review response is stale or not part of this attempt.'; end if;
    if v_score is null or v_score::text in ('NaN','Infinity','-Infinity') or v_score<0 or v_score>v_points then raise exception 'Manual score out of range for response %.',v_response_id; end if;

    select count(*)::int into v_seen
    from jsonb_array_elements(p_reviews) x
    where x->>'response_id'=v_response_id::text;
    if v_seen<>1 then raise exception 'Duplicate or missing review response %.',v_response_id; end if;

    update public.buklod_quiz_responses
    set manual_score=v_score,
        feedback=v_feedback,
        reviewed_by=(select auth.uid()),
        reviewed_at=now(),
        needs_review=false,
        updated_at=now()
    where id=v_response_id and attempt_id=p_attempt_id;
  end loop;

  if exists(
    select 1 from public.buklod_quiz_responses r
    join private.buklod_quiz_review_reference_r19(p_attempt_id) q on q.id=r.question_id
    where r.attempt_id=p_attempt_id
      and upper(q.question_type) in ('SHORT_TEXT','ESSAY','ENUMERATION','MANUAL')
      and r.manual_score is null
      and coalesce(r.needs_review,false)=true
  ) then raise exception 'Manual review is incomplete.'; end if;

  perform public.buklod_quiz_compute_attempt_internal(p_attempt_id);
  return query select a.status,a.total_score,a.max_score,v_expected from public.buklod_quiz_attempts a where a.id=p_attempt_id;
end
$function$;
REVOKE ALL ON FUNCTION public.buklod_quiz_approve_attempt_review_v2(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_approve_attempt_review_v2(uuid,jsonb) TO authenticated;


CREATE OR REPLACE FUNCTION public.buklod_quiz_worker_commit_v1(
 p_job_id uuid,p_token uuid,p_patch jsonb,p_suggestions jsonb DEFAULT '[]'::jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE j public.buklod_quiz_review_jobs; n public.buklod_quiz_review_jobs;
BEGIN
 PERFORM 1 FROM public.buklod_quiz_review_worker_leases
 WHERE job_id=p_job_id AND lease_token=p_token AND expires_at>clock_timestamp() FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO j FROM public.buklod_quiz_review_jobs WHERE id=p_job_id FOR UPDATE;
 IF NOT FOUND OR j.status NOT IN ('QUEUED','RUNNING') THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.buklod_quiz_exams e WHERE e.id=j.exam_id AND e.owner_user_id=j.created_by) THEN RETURN false; END IF;
 IF jsonb_typeof(p_suggestions) IS DISTINCT FROM 'array' OR jsonb_typeof(p_patch) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid worker payload'; END IF;
 IF jsonb_array_length(p_suggestions)>500 OR pg_column_size(p_suggestions)>2097152 THEN RAISE EXCEPTION 'Worker payload too large'; END IF;
 IF (SELECT count(DISTINCT x->>'response_id') FROM jsonb_array_elements(p_suggestions) x)<>jsonb_array_length(p_suggestions) THEN RAISE EXCEPTION 'Duplicate worker response'; END IF;
 -- Lock in deterministic order; all approval paths must serialize on attempt row.
 PERFORM 1 FROM public.buklod_quiz_attempts a WHERE a.id IN (SELECT (x->>'attempt_id')::uuid FROM jsonb_array_elements(p_suggestions) x) ORDER BY a.id FOR UPDATE;
 PERFORM 1 FROM public.buklod_quiz_responses r WHERE r.id IN (SELECT (x->>'response_id')::uuid FROM jsonb_array_elements(p_suggestions) x) ORDER BY r.id FOR UPDATE;
 PERFORM 1 FROM public.buklod_quiz_questions q WHERE q.id IN (SELECT r.question_id FROM public.buklod_quiz_responses r WHERE r.id IN (SELECT (x->>'response_id')::uuid FROM jsonb_array_elements(p_suggestions) x)) ORDER BY q.id FOR SHARE;
 PERFORM 1 FROM public.buklod_quiz_attempt_questions aq WHERE aq.attempt_id IN (SELECT (x->>'attempt_id')::uuid FROM jsonb_array_elements(p_suggestions) x) ORDER BY aq.attempt_id,aq.question_id FOR SHARE;
 PERFORM 1 FROM public.buklod_quiz_live_question_snapshots s WHERE s.session_id IN (SELECT a.live_session_id FROM public.buklod_quiz_attempts a WHERE a.id IN (SELECT (x->>'attempt_id')::uuid FROM jsonb_array_elements(p_suggestions) x)) ORDER BY s.session_id,s.question_id FOR SHARE;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_suggestions) x WHERE nullif(x->>'capture_digest','') IS NULL OR (x->>'capture_digest') IS DISTINCT FROM private.buklod_quiz_review_capture_r19((x->>'response_id')::uuid)) THEN RAISE EXCEPTION 'STALE_REVIEW_CAPTURE'; END IF;
 n:=jsonb_populate_record(j,p_patch);
 IF n.next_index IS NULL OR n.processed_attempts IS NULL OR n.failed_attempts IS NULL OR n.failed_attempts<0 OR n.failed_attempts>n.processed_attempts OR n.next_index<j.next_index OR n.next_index>j.total_attempts OR n.processed_attempts<j.processed_attempts OR n.processed_attempts>j.total_attempts OR n.status NOT IN ('QUEUED','RUNNING','PARTIAL','COMPLETED') THEN RAISE EXCEPTION 'Invalid worker progress'; END IF;
 IF EXISTS(
 SELECT 1 FROM jsonb_populate_recordset(NULL::public.buklod_quiz_review_suggestions,p_suggestions) x
 LEFT JOIN public.buklod_quiz_responses r ON r.id=x.response_id AND r.attempt_id=x.attempt_id
 LEFT JOIN public.buklod_quiz_attempts a ON a.id=r.attempt_id
 LEFT JOIN LATERAL private.buklod_quiz_review_reference_r19(a.id) q ON q.id=r.question_id
 WHERE r.id IS NULL OR q.id IS NULL OR a.exam_id IS DISTINCT FROM j.exam_id OR a.section_id IS DISTINCT FROM j.section_id
 OR NOT coalesce(a.id=ANY(j.attempt_ids),false) OR x.job_id IS DISTINCT FROM j.id OR x.created_by IS DISTINCT FROM j.created_by
 OR a.status IS DISTINCT FROM 'NEEDS_REVIEW' OR r.needs_review IS DISTINCT FROM true OR r.manual_score IS NOT NULL
 OR (x.suggested_score IS NOT NULL AND (x.suggested_score::text IN ('NaN','Infinity','-Infinity') OR x.suggested_score<0 OR x.suggested_score>q.points)) OR x.confidence IS NULL OR x.confidence::text IN ('NaN','Infinity','-Infinity') OR x.confidence<0 OR x.confidence>1
 ) THEN RAISE EXCEPTION 'Invalid or stale review suggestion'; END IF;
 INSERT INTO public.buklod_quiz_review_suggestions(response_id,job_id,attempt_id,suggested_score,feedback,confidence,model,created_by,updated_at)
 SELECT response_id,job_id,attempt_id,suggested_score,feedback,confidence,model,created_by,clock_timestamp()
 FROM jsonb_populate_recordset(NULL::public.buklod_quiz_review_suggestions,p_suggestions)
 ON CONFLICT(response_id) DO UPDATE SET job_id=excluded.job_id,attempt_id=excluded.attempt_id,suggested_score=excluded.suggested_score,feedback=excluded.feedback,confidence=excluded.confidence,model=excluded.model,created_by=excluded.created_by,updated_at=excluded.updated_at;
 INSERT INTO public.buklod_quiz_trusted_review_suggestions(response_id,job_id,snapshot)
 SELECT s.response_id,s.job_id,jsonb_build_object('suggestion',to_jsonb(s),'capture_digest',private.buklod_quiz_review_capture_r19(r.id),'version',19)
 FROM public.buklod_quiz_review_suggestions s
 JOIN public.buklod_quiz_responses r ON r.id=s.response_id
 WHERE s.response_id IN (SELECT x.response_id FROM jsonb_populate_recordset(NULL::public.buklod_quiz_review_suggestions,p_suggestions) x)
 AND s.job_id=j.id
 ON CONFLICT(response_id) DO UPDATE SET job_id=excluded.job_id,snapshot=excluded.snapshot;
 UPDATE public.buklod_quiz_review_jobs SET status=n.status,next_index=n.next_index,processed_attempts=n.processed_attempts,failed_attempts=n.failed_attempts,current_attempt_id=n.current_attempt_id,last_error=n.last_error,heartbeat_at=clock_timestamp(),updated_at=clock_timestamp(),completed_at=n.completed_at WHERE id=j.id;
 RETURN true;
END;
$fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_worker_commit_v1(uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_worker_commit_v1(uuid,uuid,jsonb,jsonb) TO service_role;


CREATE OR REPLACE FUNCTION public.buklod_quiz_approve_section_suggestions_v2(p_exam_id uuid,p_section_id uuid,p_job_id uuid,p_after uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE actor uuid:=auth.uid(); a record; reviews jsonb; pending integer; eligible integer; approved integer:=0; skipped integer:=0; failed integer:=0; last_id uuid; scanned integer:=0;
BEGIN
 IF actor IS NULL OR NOT public.buklod_quiz_is_examiner(actor) THEN RAISE EXCEPTION 'Examiner access required.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.buklod_quiz_exams e JOIN public.buklod_quiz_sections s ON s.exam_id=e.id WHERE e.id=p_exam_id AND s.id=p_section_id AND e.owner_user_id=actor) THEN RAISE EXCEPTION 'Exam owner access required.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.buklod_quiz_review_jobs j WHERE j.id=p_job_id AND j.exam_id=p_exam_id AND j.section_id=p_section_id AND j.created_by=actor AND j.status='COMPLETED') THEN RAISE EXCEPTION 'Completed review job required.'; END IF;
 FOR a IN SELECT t.id FROM public.buklod_quiz_attempts t JOIN public.buklod_quiz_review_jobs j ON j.id=p_job_id AND t.id=ANY(j.attempt_ids) WHERE t.exam_id=p_exam_id AND t.section_id=p_section_id AND t.status='NEEDS_REVIEW' AND (p_after IS NULL OR t.id>p_after) ORDER BY t.id LIMIT 50 LOOP
  last_id:=a.id; scanned:=scanned+1;
  BEGIN
   PERFORM 1 FROM public.buklod_quiz_attempts t WHERE t.id=a.id AND t.status='NEEDS_REVIEW' FOR UPDATE;
   IF NOT FOUND THEN skipped:=skipped+1; CONTINUE; END IF;
   SELECT count(*)::integer,count(*) FILTER(WHERE s.response_id IS NOT NULL AND proof.response_id IS NOT NULL AND s.suggested_score IS NOT NULL AND s.suggested_score::text NOT IN ('NaN','Infinity','-Infinity') AND q.immutable IS TRUE AND s.suggested_score BETWEEN 0 AND q.points AND s.confidence BETWEEN 0.9 AND 1 AND (nullif(btrim(q.correct_answer::text),'') IS NOT NULL AND q.correct_answer::text NOT IN ('null','""','{}','[]') OR nullif(btrim(q.explanation),'') IS NOT NULL OR q.rubric::text NOT IN ('null','""','{}','[]')))::integer,
   jsonb_agg(jsonb_build_object('response_id',r.id,'score',s.suggested_score,'feedback',s.feedback) ORDER BY r.id)
   INTO pending,eligible,reviews
   FROM public.buklod_quiz_responses r LEFT JOIN LATERAL private.buklod_quiz_review_reference_r19(a.id) q ON q.id=r.question_id
   LEFT JOIN public.buklod_quiz_review_suggestions s ON s.response_id=r.id AND s.attempt_id=a.id AND s.job_id=p_job_id AND s.created_by=actor
   LEFT JOIN public.buklod_quiz_trusted_review_suggestions proof ON proof.response_id=s.response_id AND proof.job_id=s.job_id AND proof.snapshot=jsonb_build_object('suggestion',to_jsonb(s),'capture_digest',private.buklod_quiz_review_capture_r19(r.id),'version',19)
   WHERE r.attempt_id=a.id AND r.needs_review IS TRUE AND r.manual_score IS NULL;
   IF pending=0 OR pending<>eligible THEN skipped:=skipped+1; CONTINUE; END IF;
   PERFORM public.buklod_quiz_approve_attempt_review_v2(a.id,reviews);
   approved:=approved+1;
  EXCEPTION WHEN OTHERS THEN failed:=failed+1;
  END;
 END LOOP;
 RETURN jsonb_build_object('approved',approved,'skipped',skipped,'failed',failed,'batch_limit',50,'scanned',scanned,'next_cursor',last_id,'may_have_more',scanned=50,'released',0);
END;
$fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_approve_section_suggestions_v2(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
-- Intentionally not granted to clients until historical suggestion provenance, eligibility and pagination are verified.

-- Disable old class suggestion approval path; v2 remains client-disabled pending QA.
REVOKE ALL ON FUNCTION public.buklod_quiz_approve_section_suggestions_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;


-- Pinned source: RECORDS_R20 blob 894b5f54e1198947c959f59ecc94aa1128f890d5
-- R20 DEV candidate: reporting is read-only, never reconstruct historical grades.
-- Depends on R19 capture-time provenance. Historical item references without
-- frozen snapshots are explicitly marked unverified in class analytics.
CREATE OR REPLACE FUNCTION public.buklod_quiz_record_diagnostics_v1(p_exam_id uuid, p_section_id uuid)
 RETURNS TABLE(student_user_id uuid, attempt_id uuid, response_count integer, pending_review_count integer, event_row_count integer, supported_event_count integer, integrity_incident_count integer, legacy_integrity_count integer, legacy_score_only boolean, score_available boolean, item_data_available boolean, integrity_detail_available boolean, release_eligible boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_quiz_is_examiner(v_actor) then raise exception 'Examiner access required.'; end if;
  if not exists(select 1 from public.buklod_quiz_exams e join public.buklod_quiz_sections s on s.exam_id=e.id and s.id=p_section_id where e.id=p_exam_id and e.owner_user_id=v_actor) then raise exception 'Exam owner access required.'; end if;
  return query
  with roster as (
    select r.student_user_id from public.buklod_quiz_roster r where r.exam_id=p_exam_id and r.section_id=p_section_id and r.status='ACTIVE'
  ), latest as (
    select r.student_user_id as roster_student_user_id,
           a.id as attempt_id,a.status,a.total_score,a.max_score,a.integrity_violation_count
    from roster r left join lateral (
      select ax.id,ax.status,ax.total_score,ax.max_score,ax.integrity_violation_count
      from public.buklod_quiz_attempts ax
      where ax.exam_id=p_exam_id and ax.section_id=p_section_id and ax.student_user_id=r.student_user_id and ax.status<>'VOID'
      order by ax.attempt_no desc,ax.created_at desc,ax.id desc limit 1
    ) a on true
  ), counts as (
    select l.roster_student_user_id,l.attempt_id,l.status,l.total_score,l.max_score,coalesce(l.integrity_violation_count,0)::integer legacy_integrity_count,
      coalesce((select count(*)::integer from public.buklod_quiz_responses r where r.attempt_id=l.attempt_id),0) response_count,
      coalesce((select count(*)::integer from public.buklod_quiz_responses r where r.attempt_id=l.attempt_id and r.needs_review=true and r.manual_score is null),0) pending_review_count,
      coalesce((select count(*)::integer from public.buklod_quiz_events ev where ev.attempt_id=l.attempt_id),0) event_row_count,
      coalesce((select count(*)::integer from public.buklod_quiz_events ev where ev.attempt_id=l.attempt_id and ev.event_type in ('APP_EXIT_OR_BACKGROUND','USER_LEFT_EXAM','TAB_HIDDEN','WINDOW_BLUR','FULLSCREEN_EXIT','SCREENSHOT_ATTEMPT','SCREEN_CAPTURE_DETECTED','COPY_ATTEMPT','CONTEXT_MENU_ATTEMPT','DEVTOOLS_SHORTCUT_ATTEMPT')),0) supported_event_count
    from latest l
  )
  select c.roster_student_user_id,c.attempt_id,c.response_count,c.pending_review_count,c.event_row_count,c.supported_event_count,
    case when c.attempt_id is null or c.event_row_count=0 then 0 else coalesce(m.departure_incidents,0)+coalesce(m.copy_attempts,0)+coalesce(m.screen_capture_signals,0)+coalesce(m.devtools_attempts,0)+coalesce(m.context_menu_attempts,0) end::integer,
    c.legacy_integrity_count,
    (c.attempt_id is not null and c.response_count=0 and c.total_score is not null and coalesce(c.max_score,0)>0 and c.status in ('NEEDS_REVIEW','GRADED','RELEASED')),
    (c.status in ('NEEDS_REVIEW','GRADED','RELEASED') and c.total_score is not null and coalesce(c.max_score,0)>0 and c.total_score between 0 and c.max_score),
    (c.response_count>0),(c.event_row_count>0),
    (c.attempt_id is not null and c.status in ('GRADED','NEEDS_REVIEW') and c.pending_review_count=0 and (c.response_count>0 or (c.total_score is not null and coalesce(c.max_score,0)>0)))
  from counts c left join lateral public.buklod_quiz_integrity_metrics_v1(c.attempt_id) m on c.attempt_id is not null and c.event_row_count>0;
end;
$function$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_section_analytics_v2(p_exam_id uuid, p_section_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_actor uuid := (select auth.uid()); v_result jsonb;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_quiz_is_examiner(v_actor) then raise exception 'Examiner access required.'; end if;
  if not exists(select 1 from public.buklod_quiz_exams e join public.buklod_quiz_sections s on s.exam_id=e.id and s.id=p_section_id where e.id=p_exam_id and e.owner_user_id=v_actor) then raise exception 'Exam owner access required.'; end if;
  with roster as (
    select r.student_user_id from public.buklod_quiz_roster r where r.exam_id=p_exam_id and r.section_id=p_section_id and r.status='ACTIVE'
  ), latest as (
    select r.student_user_id,a.id attempt_id,a.status,a.total_score,a.max_score,a.live_session_id
    from roster r left join lateral (
      select ax.id,ax.status,ax.total_score,ax.max_score,ax.live_session_id from public.buklod_quiz_attempts ax
      where ax.exam_id=p_exam_id and ax.section_id=p_section_id and ax.student_user_id=r.student_user_id and ax.status<>'VOID'
      order by ax.attempt_no desc,ax.created_at desc,ax.id desc limit 1
    ) a on true
  ), diag as (
    select * from public.buklod_quiz_record_diagnostics_v1(p_exam_id,p_section_id)
  ), enriched as (
    select l.*,coalesce(d.response_count,0) response_count,coalesce(d.pending_review_count,0) pending_review_count,
      coalesce(d.legacy_score_only,false) legacy_score_only,coalesce(d.score_available,false) score_available,
      coalesce(d.item_data_available,false) item_data_available,coalesce(d.release_eligible,false) release_eligible
    from latest l left join diag d on d.student_user_id=l.student_user_id and d.attempt_id is not distinct from l.attempt_id
  ), exam_cfg as (
    select e.pass_percent from public.buklod_quiz_exams e where e.id=p_exam_id
  ), score_finalish as (
    select e.* from enriched e where e.score_available=true and (e.status in ('GRADED','RELEASED') or e.legacy_score_only=true or (e.status='NEEDS_REVIEW' and e.pending_review_count=0 and e.response_count>0))
  ), item_attempts as (
    select e.* from enriched e where e.attempt_id is not null and e.response_count>0 and e.status in ('NEEDS_REVIEW','GRADED','RELEASED')
  ), retained as (
    select ia.attempt_id,r.question_id,r.answer,r.is_correct,r.manual_score,r.objective_score,r.needs_review,
      aq.points assigned_points,coalesce(s.question_type,q.question_type) question_type,
      coalesce(s.prompt,q.prompt) prompt,coalesce(s.options,q.options) options,
      coalesce(aq.display_order,q.sort_order) sort_order,
      (aq.question_id is not null and s.question_id is not null) verified,
      case when r.answer is null or r.answer in ('null'::jsonb,'[]'::jsonb,'{}'::jsonb) then false
           when jsonb_typeof(r.answer)='string' then nullif(btrim(r.answer#>>'{}'),'') is not null else true end answered
    from item_attempts ia join public.buklod_quiz_attempts at on at.id=ia.attempt_id
    join public.buklod_quiz_responses r on r.attempt_id=ia.attempt_id and r.student_user_id=at.student_user_id
    join public.buklod_quiz_questions q on q.id=r.question_id and q.exam_id=at.exam_id
    left join public.buklod_quiz_attempt_questions aq on aq.attempt_id=at.id and aq.question_id=r.question_id
    left join public.buklod_quiz_live_question_snapshots s on s.session_id=at.live_session_id and s.question_id=r.question_id
    where aq.question_id is not null or not exists(select 1 from public.buklod_quiz_attempt_questions x where x.attempt_id=at.id)
  ), grouped as (
    select x.question_id,min(x.sort_order) sort_order,min(x.question_type) question_type,
      case when count(distinct x.prompt)=1 then min(x.prompt) else '[Different examination versions; review separately]' end prompt,
      count(distinct jsonb_build_array(x.question_type,x.prompt,x.options)) reference_variants,
      bool_and(x.verified) reference_verified,
      count(*)::integer submitted_count,
      count(*) filter(where x.answered)::integer answered_count,
      count(*) filter(where x.answered and not (x.needs_review is true and x.manual_score is null) and x.is_correct is true)::integer correct_count,
      count(*) filter(where x.answered and not (x.needs_review is true and x.manual_score is null) and x.is_correct is false)::integer incorrect_count,
      count(*) filter(where x.answered and x.is_correct is null and x.assigned_points is not null and x.manual_score>0 and x.manual_score<x.assigned_points)::integer partial_count,
      count(*) filter(where x.needs_review is true and x.manual_score is null)::integer pending_review_count,
      count(*) filter(where not x.answered)::integer unanswered_count
    from retained x group by x.question_id
  ), item_rows as (
    select g.*,row_number() over(order by g.sort_order,g.question_id)::integer question_no from grouped g
  ), items as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'question_id',i.question_id,'question_no',i.question_no,'question_type',i.question_type,'prompt',i.prompt,
      'submitted_count',i.submitted_count,'answered_count',i.answered_count,'correct_count',i.correct_count,
      'incorrect_count',i.incorrect_count,'partial_count',i.partial_count,'pending_review_count',i.pending_review_count,
      'unanswered_count',i.unanswered_count,'reference_verified',i.reference_verified,'reference_variants',i.reference_variants,
      'option_counts',case when i.reference_verified and i.reference_variants=1 and i.question_type='MCQ' then (
        select coalesce(jsonb_agg(jsonb_build_object('label',chr(64+opt.ord::integer),'option',opt.option_text,'count',(
          select count(*) from retained x where x.question_id=i.question_id and lower(btrim(x.answer#>>'{}'))=lower(btrim(opt.option_text))
        )) order by opt.ord),'[]'::jsonb)
        from jsonb_array_elements_text(case when jsonb_typeof((select x.options from retained x where x.question_id=i.question_id limit 1))='array'
          then (select x.options from retained x where x.question_id=i.question_id limit 1) else '[]'::jsonb end) with ordinality opt(option_text,ord)
      ) else '[]'::jsonb end
    ) order by i.question_no),'[]'::jsonb) value from item_rows i
  )
  select jsonb_build_object(
    'ok',true,
    'summary',jsonb_build_object(
      'active_students',(select count(*) from enriched),
      'submitted',(select count(*) from enriched where attempt_id is not null and status<>'STARTED'),
      'pending_review',(select count(*) from enriched where pending_review_count>0),
      'review_complete_stale',(select count(*) from enriched where status='NEEDS_REVIEW' and pending_review_count=0 and response_count>0),
      'legacy_score_only',(select count(*) from enriched where legacy_score_only=true),
      'in_progress',(select count(*) from enriched where status='STARTED'),
      'not_started',(select count(*) from enriched where attempt_id is null),
      'release_eligible',(select count(*) from enriched where release_eligible=true),
      'item_analyzed_attempts',(select count(distinct attempt_id) from retained),
      'item_data_available',exists(select 1 from retained),
      'verified_item_attempts',(select count(distinct attempt_id) from retained where verified),
      'unverified_reference_items',(select count(*) from retained where not verified),
      'graded_or_released',(select count(*) from enriched where status in ('GRADED','RELEASED')),
      'score_analyzed_attempts',(select count(*) from score_finalish),
      'passed',(select count(*) from score_finalish s cross join exam_cfg e left join public.buklod_quiz_live_sessions ls on ls.id=s.live_session_id where public.buklod_quiz_transmuted_percent_v1(s.total_score,s.max_score)>=coalesce(ls.pass_percent,e.pass_percent)),
      'not_passed',(select count(*) from score_finalish s cross join exam_cfg e left join public.buklod_quiz_live_sessions ls on ls.id=s.live_session_id where public.buklod_quiz_transmuted_percent_v1(s.total_score,s.max_score)<coalesce(ls.pass_percent,e.pass_percent)),
      'pass_percent',(select pass_percent from exam_cfg)
    ),
    'items',(select value from items),
    'notice',case
      when not exists(select 1 from retained) then 'No item-level response data is retained for this section. Recorded scores remain available; item answers and item statistics will not be fabricated.'
      when exists(select 1 from retained where not verified) then 'Historical response statistics use recorded outcomes; current question references are not verified and option analysis is withheld.'
      when (select count(distinct attempt_id) from retained)<(select count(*) from enriched where attempt_id is not null and status<>'STARTED') then 'Item analytics includes only attempts with retained response data. Some historical score-only records are excluded from item statistics.'
      else 'Item analytics uses retained response rows from the latest official attempts.' end
  ) into v_result;
  return v_result;
end;
$function$;
CREATE FUNCTION public.buklod_quiz_section_analytics_v1(p_exam_id uuid,p_section_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$ SELECT public.buklod_quiz_section_analytics_v2(p_exam_id,p_section_id); $fn$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_class_review_queue_v2(p_exam_id uuid, p_section_id uuid)
 RETURNS TABLE(section_id uuid, section_name text, attempt_id uuid, student_user_id uuid, display_name text, response_id uuid, question_id uuid, question_type text, prompt text, points numeric, answer_text text, manual_score numeric, feedback text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_quiz_is_examiner(v_actor) then raise exception 'Examiner access required.'; end if;
  if not exists(
    select 1
    from public.buklod_quiz_exams e
    where e.id=p_exam_id and e.owner_user_id=v_actor
  ) then
    raise exception 'Exam owner access required.';
  end if;

  return query
  select
    a.section_id,
    s.name::text,
    a.id,
    a.student_user_id,
    coalesce(rst.display_name,p.full_name,p.username,'BUKLOD Student')::text,
    r.id,
    q.id,
    q.question_type::text,
    q.prompt::text,
    q.points,
    case
      when r.answer is null then ''
      when jsonb_typeof(r.answer)='string' then r.answer #>> '{}'
      else r.answer::text
    end::text,
    coalesce(r.manual_score,case when proof.response_id is not null then sug.suggested_score end),
    coalesce(nullif(btrim(r.feedback::text),''), case when proof.response_id is not null then sug.feedback::text end)
  from public.buklod_quiz_attempts a
  join public.buklod_quiz_sections s
    on s.id=a.section_id and s.exam_id=a.exam_id
  join public.buklod_quiz_responses r
    on r.attempt_id=a.id
  join lateral private.buklod_quiz_review_reference_r19(a.id) q on q.id=r.question_id
  left join public.buklod_quiz_roster rst
    on rst.exam_id=a.exam_id
   and rst.section_id=a.section_id
   and rst.student_user_id=a.student_user_id
  left join public.profiles p
    on p.id=a.student_user_id
  left join public.buklod_quiz_review_suggestions sug
    on sug.response_id=r.id
   and sug.created_by=v_actor
  left join public.buklod_quiz_trusted_review_suggestions proof on proof.response_id=sug.response_id and proof.job_id=sug.job_id
    and proof.snapshot=jsonb_build_object('suggestion',to_jsonb(sug),'capture_digest',private.buklod_quiz_review_capture_r19(r.id),'version',19)
  where a.exam_id=p_exam_id
    and a.section_id=p_section_id
    and a.status='NEEDS_REVIEW'
    and upper(q.question_type) in ('SHORT_TEXT','ESSAY','ENUMERATION','MANUAL')
    and r.manual_score is null
    and coalesce(r.needs_review,false)=true
  order by
    lower(coalesce(rst.surname,p.surname,'')),
    lower(coalesce(rst.first_name,p.first_name,'')),
    a.attempt_no,
    q.sort_order,
    q.id;
end
$function$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_class_review_queue_v1(p_exam_id uuid, p_section_id uuid)
 RETURNS TABLE(attempt_id uuid, response_id uuid, student_user_id uuid, display_name text, section_name text, question_id uuid, prompt text, question_type text, points numeric, answer_text text, manual_score numeric, feedback text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    a.id,
    rr.id,
    a.student_user_id,
    coalesce(
      public.buklod_quiz_profile_display_name_v1(a.student_user_id),
      nullif(trim(ro.display_name), ''),
      'BUKLOD Student'
    )::text,
    sx.name,
    q.id,
    q.prompt,
    q.question_type,
    q.points,
    rr.answer #>> '{}',
    rr.manual_score,
    rr.feedback
  from public.buklod_quiz_attempts a
  join public.buklod_quiz_responses rr on rr.attempt_id = a.id
  join lateral private.buklod_quiz_review_reference_r19(a.id) q on q.id=rr.question_id
  join public.buklod_quiz_roster ro
    on ro.exam_id = a.exam_id
   and ro.section_id = a.section_id
   and ro.student_user_id = a.student_user_id
  left join public.profiles p on p.id = a.student_user_id
  join public.buklod_quiz_sections sx
    on sx.id = a.section_id and sx.exam_id = a.exam_id
  join public.buklod_quiz_exams e on e.id = a.exam_id
  where a.exam_id = p_exam_id
    and a.section_id = p_section_id
    and e.owner_user_id = (select auth.uid())
    and public.buklod_quiz_is_examiner(auth.uid()) and rr.manual_score is null and rr.needs_review = true
    and a.status = 'NEEDS_REVIEW'
  order by
    lower(coalesce(nullif(trim(p.surname), ''), ro.surname, '')),
    lower(coalesce(nullif(trim(p.first_name), ''), ro.first_name, '')),
    lower(coalesce(public.buklod_quiz_profile_display_name_v1(a.student_user_id), ro.display_name, '')),
    a.attempt_no,
    q.sort_order
$function$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_review_queue_v1(p_exam_id uuid)
 RETURNS TABLE(attempt_id uuid, response_id uuid, student_user_id uuid, display_name text, section_name text, question_id uuid, prompt text, question_type text, points numeric, answer_text text, manual_score numeric, feedback text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select a.id,r.id,a.student_user_id,ro.display_name,s.name,q.id,q.prompt,q.question_type,q.points,r.answer#>>'{}',r.manual_score,r.feedback from public.buklod_quiz_attempts a join public.buklod_quiz_responses r on r.attempt_id=a.id join lateral private.buklod_quiz_review_reference_r19(a.id) q on q.id=r.question_id join public.buklod_quiz_roster ro on ro.exam_id=a.exam_id and ro.section_id=a.section_id and ro.student_user_id=a.student_user_id join public.buklod_quiz_sections s on s.id=ro.section_id join public.buklod_quiz_exams e on e.id=a.exam_id where a.exam_id=p_exam_id and e.owner_user_id=auth.uid() and r.needs_review=true and a.status='NEEDS_REVIEW' and r.manual_score is null and public.buklod_quiz_is_examiner(auth.uid()) order by s.sort_order,lower(ro.surname),lower(ro.first_name),a.attempt_no,q.sort_order $function$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_review_queue_v2(p_exam_id uuid, p_section_id uuid)
 RETURNS TABLE(attempt_id uuid, response_id uuid, student_user_id uuid, display_name text, surname text, first_name text, section_id uuid, section_name text, question_id uuid, prompt text, question_type text, points numeric, answer_text text, manual_score numeric, feedback text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    a.id,
    r.id,
    a.student_user_id,
    ro.display_name,
    ro.surname,
    ro.first_name,
    s.id,
    s.name,
    q.id,
    q.prompt,
    q.question_type,
    q.points,
    r.answer#>>'{}',
    r.manual_score,
    r.feedback
  from public.buklod_quiz_attempts a
  join public.buklod_quiz_responses r on r.attempt_id=a.id
  join lateral private.buklod_quiz_review_reference_r19(a.id) q on q.id=r.question_id
  join public.buklod_quiz_roster ro
    on ro.exam_id=a.exam_id
   and ro.section_id=a.section_id
   and ro.student_user_id=a.student_user_id
  join public.buklod_quiz_sections s
    on s.id=a.section_id
   and s.exam_id=a.exam_id
  join public.buklod_quiz_exams e on e.id=a.exam_id
  where a.exam_id=p_exam_id
    and a.section_id=p_section_id
    and e.owner_user_id=(select auth.uid())
    and r.needs_review=true
    and a.status='NEEDS_REVIEW' and r.manual_score is null and public.buklod_quiz_is_examiner(auth.uid())
  order by lower(coalesce(nullif(ro.surname,''),nullif(ro.display_name,''),'zzzz')),
           lower(coalesce(ro.first_name,'')),
           lower(coalesce(ro.display_name,'')),
           a.attempt_no,
           q.sort_order
$function$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_my_released_attempt_answers_v1(p_attempt_id uuid)
 RETURNS TABLE(question_no integer, question_type text, prompt text, options jsonb, points numeric, answer_text text, correct_answer_text text, awarded_score numeric, feedback text, explanation text, show_correct boolean, show_explanation boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE a public.buklod_quiz_attempts%ROWTYPE; p public.buklod_quiz_release_preferences%ROWTYPE; s public.buklod_quiz_live_sessions%ROWTYPE; can_answers boolean; can_correct boolean; can_explain boolean;
BEGIN
 SELECT x.* INTO a FROM public.buklod_quiz_attempts x WHERE x.id=p_attempt_id AND x.student_user_id=auth.uid() AND x.status='RELEASED';
 IF NOT FOUND THEN RAISE EXCEPTION 'Released result not found'; END IF;
 SELECT pref.* INTO p FROM public.buklod_quiz_release_preferences pref WHERE pref.attempt_id=a.id;
 SELECT ls.* INTO s FROM public.buklod_quiz_live_sessions ls WHERE ls.id=a.live_session_id;
 can_answers:=coalesce(p.show_answers,s.show_answers_after_release,false);
 can_correct:=coalesce(p.show_answers,s.show_correct_after_release,false);
 can_explain:=coalesce(p.show_rationale,s.show_explanations_after_release,false);
 IF NOT can_answers THEN RAISE EXCEPTION 'Faculty did not enable answer review'; END IF;
 -- No seeding, recompute, or synthetic answer rows. Historical answer keys withheld if not frozen.
 RETURN QUERY SELECT row_number() over(order by coalesce(aq.display_order,q.sort_order),q.id)::integer,
 coalesce(snap.question_type,q.question_type),coalesce(snap.prompt,q.prompt),
 case when snap.question_id is not null then snap.options else null end,
 aq.points,coalesce(r.answer#>>'{}',''),
 case when can_correct and snap.question_id is not null and aq.question_id is not null then coalesce(snap.correct_answer#>>'{}','') else '' end,
 coalesce(r.manual_score,r.objective_score),r.feedback,
 case when can_explain and snap.question_id is not null and aq.question_id is not null then snap.explanation else null end,
 (can_correct and snap.question_id is not null and aq.question_id is not null),
 (can_explain and snap.question_id is not null and aq.question_id is not null)
 FROM public.buklod_quiz_responses r JOIN public.buklod_quiz_questions q ON q.id=r.question_id AND q.exam_id=a.exam_id
 LEFT JOIN public.buklod_quiz_attempt_questions aq ON aq.attempt_id=a.id AND aq.question_id=r.question_id
 LEFT JOIN public.buklod_quiz_live_question_snapshots snap ON snap.session_id=a.live_session_id AND snap.question_id=r.question_id
 WHERE r.attempt_id=a.id AND r.student_user_id=a.student_user_id
 AND (aq.question_id IS NOT NULL OR NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempt_questions x WHERE x.attempt_id=a.id))
 ORDER BY coalesce(aq.display_order,q.sort_order),q.id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_my_results_v2()
 RETURNS TABLE(attempt_id uuid, exam_title text, section_name text, attempt_no integer, earned_score numeric, integrity_deduction_total numeric, total_score numeric, max_score numeric, released_at timestamp with time zone, pass_percent numeric, violation_count integer, violations jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select a.id,e.title::text,s.name::text,a.attempt_no,
    (coalesce(a.objective_score,0)+coalesce(a.manual_score,0))::numeric,
    coalesce((select sum(d.deduction_points) from public.buklod_quiz_integrity_deductions d where d.attempt_id=a.id),0)::numeric,
    a.total_score,a.max_score,a.released_at,coalesce(ls.pass_percent,e.pass_percent),
    case when coalesce(pref.show_violations,false) then public.buklod_quiz_integrity_incident_count_v1(a.id) else 0 end,
    case when coalesce(pref.show_violations,false) then coalesce((
      select jsonb_agg(jsonb_build_object(
        'event_type',i.event_type,'label',i.violation_label,'count',i.event_count,
        'first_at',i.first_event_at,'last_at',i.last_event_at,
        'deduction_points',coalesce(d.deduction_points,0),'deduction_note',d.deduction_note
      ) order by i.last_event_at desc,i.event_type)
      from public.buklod_quiz_integrity_incident_rows_v1(a.id) i
      left join lateral(
        select sum(x.deduction_points)::numeric deduction_points,
          nullif(string_agg(x.note,' | ' order by x.event_type) filter(where x.note is not null),'') deduction_note
        from public.buklod_quiz_integrity_deductions x
        where x.attempt_id=a.id and (
          (i.event_type='TAB_HIDDEN' and x.event_type in ('TAB_HIDDEN','APP_EXIT_OR_BACKGROUND'))
          or (i.event_type<>'TAB_HIDDEN' and x.event_type=i.event_type)
        )
      ) d on true
    ),'[]'::jsonb) else '[]'::jsonb end
  from public.buklod_quiz_attempts a
  join public.buklod_quiz_exams e on e.id=a.exam_id
  join public.buklod_quiz_sections s on s.id=a.section_id
  left join public.buklod_quiz_live_sessions ls on ls.id=a.live_session_id
  left join public.buklod_quiz_release_preferences pref on pref.attempt_id=a.id
  where a.student_user_id=(select auth.uid()) and a.status='RELEASED'
  order by a.released_at desc
$function$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_class_records_v1(p_exam_id uuid, p_section_id uuid, p_sort text DEFAULT 'SCORE_DESC'::text)
 RETURNS TABLE(section_id uuid, section_name text, student_user_id uuid, surname text, first_name text, display_name text, student_no text, attempt_id uuid, attempt_no integer, attempt_status text, total_score numeric, max_score numeric, score_percent numeric, class_rank bigint, released_at timestamp with time zone, integrity_events integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_sort text := upper(coalesce(p_sort,'SCORE_DESC'));
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_quiz_is_examiner(v_actor) then raise exception 'Examiner access required.'; end if;
  if not exists(select 1 from public.buklod_quiz_exams e where e.id=p_exam_id and e.owner_user_id=v_actor) then
    raise exception 'Exam owner access required.';
  end if;

  return query
  with base as (
    select
      r.section_id,
      s.name::text as section_name,
      r.student_user_id,
      r.surname::text,
      r.first_name::text,
      r.display_name::text,
      r.student_no::text,
      a.id as attempt_id,
      a.attempt_no,
      a.status::text as attempt_status,
      a.total_score,
      a.max_score,
      case when a.status in ('GRADED','RELEASED') and a.total_score between 0 and a.max_score and coalesce(a.max_score,0)>0 then public.buklod_quiz_transmuted_percent_v1(a.total_score,a.max_score) else null end as score_percent,
      a.released_at,
      coalesce(im.supported_incidents,0)::integer as integrity_events
    from public.buklod_quiz_roster r
    join public.buklod_quiz_sections s on s.id=r.section_id and s.exam_id=r.exam_id
    left join lateral (
      select ax.*
      from public.buklod_quiz_attempts ax
      where ax.exam_id=r.exam_id
        and ax.section_id=r.section_id
        and ax.student_user_id=r.student_user_id
        and ax.status<>'VOID'
      order by ax.attempt_no desc,ax.created_at desc,ax.id desc
      limit 1
    ) a on true
    left join lateral (
      select (
        coalesce(m.departure_incidents,0)
        + coalesce(m.copy_attempts,0)
        + coalesce(m.screen_capture_signals,0)
        + coalesce(m.devtools_attempts,0)
        + coalesce(m.context_menu_attempts,0)
      )::integer as supported_incidents
      from public.buklod_quiz_integrity_metrics_v1(a.id) m
    ) im on a.id is not null
    where r.exam_id=p_exam_id and r.section_id=p_section_id and r.status='ACTIVE'
  ), ranked as (
    select b.*,
      case when b.score_percent is null then null::bigint
           else dense_rank() over(order by b.score_percent desc nulls last,b.total_score desc nulls last) end as class_rank
    from base b
  )
  select
    x.section_id,x.section_name,x.student_user_id,x.surname,x.first_name,x.display_name,x.student_no,
    x.attempt_id,x.attempt_no,x.attempt_status,x.total_score,x.max_score,x.score_percent,x.class_rank,x.released_at,x.integrity_events
  from ranked x
  order by
    case when v_sort='NAME_ASC' then lower(coalesce(nullif(x.surname,''),x.display_name)) end asc nulls last,
    case when v_sort='NAME_ASC' then lower(coalesce(x.first_name,'')) end asc nulls last,
    case when v_sort='VIOLATIONS_DESC' then x.integrity_events end desc nulls last,
    case when v_sort='VIOLATIONS_DESC' then x.score_percent end desc nulls last,
    case when v_sort not in ('NAME_ASC','VIOLATIONS_DESC') then x.score_percent end desc nulls last,
    case when v_sort not in ('NAME_ASC','VIOLATIONS_DESC') then x.total_score end desc nulls last,
    lower(coalesce(nullif(x.surname,''),x.display_name)),lower(coalesce(x.first_name,'')),x.student_user_id;
end
$function$;
REVOKE ALL ON FUNCTION public.buklod_quiz_section_analytics_v1(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_section_analytics_v1(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_section_analytics_v2(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_section_analytics_v2(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_record_diagnostics_v1(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_record_diagnostics_v1(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_class_records_v1(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_class_records_v1(uuid,uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_class_review_queue_v1(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_class_review_queue_v1(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_class_review_queue_v2(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_class_review_queue_v2(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_review_queue_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_review_queue_v1(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_review_queue_v2(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_review_queue_v2(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_my_released_attempt_answers_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_my_released_attempt_answers_v1(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_my_results_v2() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_my_results_v2() TO authenticated;


-- Pinned source: IDENTITY_R21 blob 6656cd381b784cef1cee63748fddaa4f010627b1
-- R21 DEV candidate only. MAIN Focus App entitlement remains authoritative.
-- No password/identity copying, no legacy entitlement writes, no public login identifier lookup.
-- Preserve p_user argument name for existing MAIN RPC callers.
CREATE OR REPLACE FUNCTION public.buklod_quiz_faculty_focus_admin_eligible_v1(p_user uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    p_user is not null
    and exists(select 1 from public.profiles p where p.id=p_user and p.is_active is true)
    and exists (
      select 1
      from public.buklod_user_focus_app_entitlements e
      where e.user_id = p_user
        and lower(e.focus_app_code) = 'faculty'
        and e.status = 'ACTIVE'
        and (e.activated_at is null or e.activated_at<=now())
        and (e.expires_at is null or e.expires_at > now())
    )
    and (
      exists (
        select 1
        from public.buklod_education_classrooms c
        where c.faculty_user_id = p_user
          and upper(coalesce(c.status,'')) = 'ACTIVE'
      )
      or exists (
        select 1
        from public.buklod_focus_app_admins a
        where a.user_id = p_user
          and lower(a.focus_app_code) = 'faculty'
      )
    );
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_is_examiner(p_user uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    p_user is not null
    and exists(select 1 from public.profiles p where p.id=p_user and p.is_active is true)
    and ((p_user=auth.uid() and public.buklod_quiz_is_system_admin())
    or (
      exists (
        select 1
        from public.buklod_quiz_examiner_roles r
        where r.user_id = p_user
          and r.is_active = true
      )
      and public.buklod_quiz_faculty_focus_admin_eligible_v1(p_user)
    ));
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_my_capabilities_v1()
 RETURNS TABLE(can_conduct boolean, is_system_admin boolean, display_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_examiner_role boolean := false;
  v_faculty_admin boolean := false;
  v_admin boolean := false;
  v_name text := null;
begin
  if v_uid is null or not exists(select 1 from public.profiles p where p.id=v_uid and p.is_active is true) then
    return query select false, false, null::text;
    return;
  end if;

  select exists(
    select 1
    from public.buklod_quiz_examiner_roles r
    where r.user_id = v_uid
      and r.is_active = true
  ) into v_examiner_role;

  v_faculty_admin := public.buklod_quiz_faculty_focus_admin_eligible_v1(v_uid);
  v_admin := public.buklod_quiz_is_system_admin();

  select coalesce(
    nullif(to_jsonb(p)->>'display_name',''),
    nullif(to_jsonb(p)->>'full_name',''),
    nullif(to_jsonb(p)->>'username','')
  )
  into v_name
  from public.profiles p
  where p.id = v_uid;

  return query
  select public.buklod_quiz_is_examiner(v_uid), v_admin, v_name;
end;
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_examiner_access_status_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_role boolean := false;
  v_entitlement boolean := false;
  v_class_admin boolean := false;
  v_focus_admin boolean := false;
  v_system boolean := false;
  v_cfg public.buklod_focus_app_subscription_config%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select exists(
    select 1 from public.buklod_quiz_examiner_roles r
    where r.user_id=v_uid and r.is_active=true
  ) into v_role;

  select exists(
    select 1 from public.buklod_user_focus_app_entitlements e
    where e.user_id=v_uid
      and lower(e.focus_app_code)='faculty'
      and e.status='ACTIVE'
      and (e.activated_at is null or e.activated_at<=now())
      and (e.expires_at is null or e.expires_at>now())
  ) into v_entitlement;

  select exists(
    select 1 from public.buklod_education_classrooms c
    where c.faculty_user_id=v_uid
      and upper(coalesce(c.status,''))='ACTIVE'
  ) into v_class_admin;

  select exists(
    select 1 from public.buklod_focus_app_admins a
    where a.user_id=v_uid and lower(a.focus_app_code)='faculty'
  ) into v_focus_admin;

  v_system := public.buklod_quiz_is_system_admin() and exists(select 1 from public.profiles p where p.id=v_uid and p.is_active is true);

  select * into v_cfg
  from public.buklod_focus_app_subscription_config
  where focus_app_code='faculty'
  limit 1;

  return jsonb_build_object(
    'can_conduct', public.buklod_quiz_is_examiner(v_uid),
    'is_system_admin', v_system,
    'has_examiner_role', v_role,
    'faculty_entitlement_active', v_entitlement,
    'faculty_admin_ready', (v_class_admin or v_focus_admin),
    'owns_active_faculty_classroom', v_class_admin,
    'explicit_focus_app_admin', v_focus_admin,
    'focus_app_code', 'faculty',
    'display_name', coalesce(v_cfg.display_name,'BUKLOD Faculty'),
    'annual_amount_php', v_cfg.annual_amount_php,
    'billing_interval', v_cfg.billing_interval,
    'purchase_route', '/profile/focus-apps',
    'examiner_requires', 'ACTIVE_FACULTY_FOCUS_APP_PLUS_FACULTY_ADMIN',
    'system_admin_emergency_bypass', true
  );
end;
$function$;
CREATE FUNCTION public.buklod_quiz_claim_main_entry_v1(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE ok boolean;
BEGIN
 IF p_user_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=p_user_id AND p.is_active IS TRUE)
 OR NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=p_user_id) THEN RETURN false; END IF;
 SELECT g.allowed INTO ok FROM public.buklod_quiz_entry_claim_r13(p_user_id) g;
 RETURN coalesce(ok,false);
END;
$fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_claim_main_entry_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_claim_main_entry_v1(uuid) TO service_role;
-- No replacement for legacy resolve_login_identifier or sync_faculty_entitlement.
-- Direct auth and MAIN Focus App access must be used by the standalone client.
REVOKE ALL ON FUNCTION public.buklod_quiz_faculty_focus_admin_eligible_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_faculty_focus_admin_eligible_v1(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_is_examiner(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_is_examiner(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_my_capabilities_v1() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_my_capabilities_v1() TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_examiner_access_status_v1() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_examiner_access_status_v1() TO authenticated;


-- Pinned source: HISTORICAL_R22 blob 61658dedfb1ffc57fb18e0f192baba2df7d325f5
-- R22 DEV candidate. Existing assignments were reconciled read-only:
-- 318 attempts / 29,850 rows; identical IDs, order and assigned points.
-- No historical backfill from mutable question content. No production writes.
-- This path is deliberately not client-enabled before QA and explicit UI confirmation.
CREATE FUNCTION public.buklod_quiz_historical_review_readiness_v1(p_attempt_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE a public.buklod_quiz_attempts%ROWTYPE; actor uuid:=auth.uid();
 n integer; assigned_total numeric; pending integer; unmatched integer; frozen integer;
 obj numeric; man numeric; deduction numeric; consistent boolean;
BEGIN
 IF actor IS NULL OR public.buklod_quiz_is_examiner(actor) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Examiner required' USING ERRCODE='42501'; END IF;
 SELECT t.* INTO a FROM public.buklod_quiz_attempts t JOIN public.buklod_quiz_exams e ON e.id=t.exam_id WHERE t.id=p_attempt_id AND e.owner_user_id=actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'Attempt unavailable' USING ERRCODE='42501'; END IF;
 SELECT count(*)::integer,coalesce(sum(q.points),0) INTO n,assigned_total FROM public.buklod_quiz_attempt_questions q WHERE q.attempt_id=a.id;
 SELECT count(*)::integer INTO frozen FROM public.buklod_quiz_attempt_questions q JOIN public.buklod_quiz_live_question_snapshots s ON s.session_id=a.live_session_id AND s.question_id=q.question_id WHERE q.attempt_id=a.id;
 SELECT count(*) FILTER(WHERE r.needs_review IS TRUE AND r.manual_score IS NULL)::integer,
 count(*) FILTER(WHERE q.question_id IS NULL)::integer,
 coalesce(sum(CASE WHEN r.manual_score IS NULL THEN coalesce(r.objective_score,0) ELSE 0 END),0),coalesce(sum(r.manual_score),0)
 INTO pending,unmatched,obj,man FROM public.buklod_quiz_responses r LEFT JOIN public.buklod_quiz_attempt_questions q ON q.attempt_id=r.attempt_id AND q.question_id=r.question_id WHERE r.attempt_id=a.id;
 SELECT coalesce(sum(d.deduction_points),0) INTO deduction FROM public.buklod_quiz_integrity_deductions d WHERE d.attempt_id=a.id;
 consistent:=obj IS NOT DISTINCT FROM a.objective_score AND man IS NOT DISTINCT FROM a.manual_score AND greatest(0,obj+man-deduction) IS NOT DISTINCT FROM a.total_score;
 RETURN jsonb_build_object('status',a.status,'assigned_items',n,'frozen_items',frozen,'pending_items',pending,
 'assigned_points_match',n>0 AND assigned_total IS NOT DISTINCT FROM a.max_score,'unassigned_response_count',unmatched,'recorded_scores_consistent',consistent,
 'manual_historical_review_eligible',a.status='NEEDS_REVIEW' AND n>0 AND frozen=0 AND pending>0 AND unmatched=0 AND assigned_total IS NOT DISTINCT FROM a.max_score AND consistent,
 'automatic_reference_verified',n>0 AND frozen=n,'reference_notice','Historical question content must be independently confirmed by faculty; do not reconstruct answer keys from current question bank.');
END;
$fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_historical_review_readiness_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_historical_review_readiness_v1(uuid) TO authenticated;

CREATE FUNCTION public.buklod_quiz_approve_historical_review_v1(p_attempt_id uuid,p_reviews jsonb,p_reference_confirmed boolean)
RETURNS TABLE(status text,total_score numeric,max_score numeric,reviewed_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE a public.buklod_quiz_attempts%ROWTYPE; actor uuid:=auth.uid(); ready jsonb; item jsonb; rid uuid; score numeric; cap numeric; n integer; manual_total numeric; deduction numeric; final_total numeric;
BEGIN
 IF actor IS NULL OR public.buklod_quiz_is_examiner(actor) IS DISTINCT FROM true OR p_reference_confirmed IS DISTINCT FROM true THEN RAISE EXCEPTION 'Explicit faculty confirmation of original reference required'; END IF;
 SELECT t.* INTO a FROM public.buklod_quiz_attempts t JOIN public.buklod_quiz_exams e ON e.id=t.exam_id WHERE t.id=p_attempt_id AND e.owner_user_id=actor FOR UPDATE OF t;
 IF NOT FOUND THEN RAISE EXCEPTION 'Attempt unavailable' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.buklod_quiz_responses r WHERE r.attempt_id=a.id ORDER BY r.id FOR UPDATE;
 PERFORM 1 FROM public.buklod_quiz_attempt_questions q WHERE q.attempt_id=a.id ORDER BY q.question_id FOR SHARE;
 ready:=public.buklod_quiz_historical_review_readiness_v1(a.id);
 IF (ready->>'manual_historical_review_eligible')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'Historical attempt requires separate evidence review'; END IF;
 n:=(ready->>'pending_items')::integer;
 IF jsonb_typeof(p_reviews) IS DISTINCT FROM 'array' OR pg_column_size(p_reviews)>2097152 OR jsonb_array_length(p_reviews)<>n THEN RAISE EXCEPTION 'Complete review required'; END IF;
 IF (SELECT count(DISTINCT (x->>'response_id')::uuid) FROM jsonb_array_elements(p_reviews) x)<>n THEN RAISE EXCEPTION 'Duplicate or missing response ID'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_reviews) LOOP
   rid:=(item->>'response_id')::uuid; score:=(item->>'score')::numeric;
   SELECT q.points INTO cap FROM public.buklod_quiz_responses r JOIN public.buklod_quiz_attempt_questions q ON q.attempt_id=r.attempt_id AND q.question_id=r.question_id
   WHERE r.id=rid AND r.attempt_id=a.id AND r.needs_review IS TRUE AND r.manual_score IS NULL AND r.student_user_id=a.student_user_id;
   IF NOT FOUND OR score IS NULL OR score::text IN ('NaN','Infinity','-Infinity') OR score<0 OR score>cap THEN RAISE EXCEPTION 'Invalid historical review score or response'; END IF;
   -- Do not replace an existing objective award with a manual award implicitly.
   IF EXISTS(SELECT 1 FROM public.buklod_quiz_responses r WHERE r.id=rid AND coalesce(r.objective_score,0)<>0) THEN RAISE EXCEPTION 'Existing objective award requires separate review'; END IF;
   UPDATE public.buklod_quiz_responses r SET manual_score=score,feedback=nullif(btrim(left(coalesce(item->>'feedback',''),4000)),''),
   reviewed_by=actor,reviewed_at=now(),needs_review=false,is_correct=CASE WHEN score=cap AND cap>0 THEN true WHEN score=0 THEN false ELSE null END,updated_at=now()
   WHERE r.id=rid AND r.attempt_id=a.id;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.buklod_quiz_responses r WHERE r.attempt_id=a.id AND r.needs_review IS TRUE AND r.manual_score IS NULL) THEN RAISE EXCEPTION 'Pending review remains'; END IF;
 SELECT coalesce(sum(r.manual_score),0) INTO manual_total FROM public.buklod_quiz_responses r WHERE r.attempt_id=a.id;
 SELECT coalesce(sum(d.deduction_points),0) INTO deduction FROM public.buklod_quiz_integrity_deductions d WHERE d.attempt_id=a.id;
 final_total:=greatest(0,a.objective_score+manual_total-deduction);
 IF final_total IS NULL OR final_total>a.max_score OR final_total::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Historical grade outside bounds'; END IF;
 UPDATE public.buklod_quiz_attempts t SET manual_score=manual_total,total_score=final_total,status='GRADED',updated_at=now() WHERE t.id=a.id AND t.status='NEEDS_REVIEW';
 IF NOT FOUND THEN RAISE EXCEPTION 'Attempt changed'; END IF;
 INSERT INTO public.buklod_quiz_audit_log(exam_id,section_id,live_session_id,attempt_id,actor_user_id,action,details)
 VALUES(a.exam_id,a.section_id,a.live_session_id,a.id,actor,'HISTORICAL_MANUAL_REVIEW_CONFIRMED',
 jsonb_build_object('reviewed_count',n,'original_objective_score',a.objective_score,'original_max_score',a.max_score,'previous_total',a.total_score,'new_total',final_total,'reference_confirmed_by_faculty',true));
 RETURN QUERY SELECT t.status,t.total_score,t.max_score,n FROM public.buklod_quiz_attempts t WHERE t.id=a.id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_approve_historical_review_v1(uuid,jsonb,boolean) FROM PUBLIC,anon,authenticated;
-- No automatic approvals, no grants until runtime and UI QA.


-- Pinned source: REGRESSION_R23 blob 9bd7ccf0291f3fd5eb0e423c374146b4f6352209
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


-- Pinned source: FRONTEND_CONTRACT_R24 blob 65d43cbca47dd7fc03734569201f76e66494ca8a
-- R24: deployed R10 frontend contract compatibility, after R23.
-- DEV only; no historical reconstruction or production data changes.
CREATE OR REPLACE FUNCTION public.buklod_quiz_student_questions_v1(p_attempt_id uuid)
RETURNS TABLE(question_id uuid,question_type text,prompt text,options jsonb,points numeric,display_order integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE a public.buklod_quiz_attempts%ROWTYPE; n integer; total numeric;
BEGIN
 SELECT t.* INTO a FROM public.buklod_quiz_attempts t
 JOIN public.buklod_quiz_live_sessions s ON s.id=t.live_session_id AND s.exam_id=t.exam_id AND s.section_id=t.section_id
 JOIN public.buklod_quiz_sections sec ON sec.id=t.section_id AND sec.exam_id=t.exam_id AND sec.archived_at IS NULL
 JOIN public.profiles p ON p.id=t.student_user_id AND coalesce(p.is_active,true)
 JOIN public.buklod_quiz_live_members m ON m.session_id=s.id AND m.student_user_id=t.student_user_id AND m.status='ADMITTED'
 JOIN public.buklod_quiz_roster r ON r.exam_id=t.exam_id AND r.section_id=t.section_id AND r.student_user_id=t.student_user_id AND r.status='ACTIVE'
 WHERE t.id=p_attempt_id AND t.student_user_id=auth.uid() AND t.status='STARTED' AND s.status IN ('LIVE','PAUSED');
 IF NOT FOUND THEN RAISE EXCEPTION 'Active admitted attempt required' USING ERRCODE='42501'; END IF;
 SELECT count(*)::integer,coalesce(sum(aq.points),0) INTO n,total
 FROM public.buklod_quiz_attempt_questions aq WHERE aq.attempt_id=a.id;
 IF n<1 OR total IS DISTINCT FROM a.max_score OR n<>(SELECT count(*) FROM public.buklod_quiz_attempt_questions aq JOIN public.buklod_quiz_live_question_snapshots snap ON snap.session_id=a.live_session_id AND snap.question_id=aq.question_id WHERE aq.attempt_id=a.id)
 THEN RAISE EXCEPTION 'Verified question assignments unavailable; contact faculty'; END IF;
 RETURN QUERY SELECT aq.question_id,snap.question_type::text,snap.prompt::text,snap.options,aq.points,aq.display_order
 FROM public.buklod_quiz_attempt_questions aq
 JOIN public.buklod_quiz_live_question_snapshots snap ON snap.session_id=a.live_session_id AND snap.question_id=aq.question_id
 WHERE aq.attempt_id=a.id ORDER BY aq.display_order;
END;
$fn$;

-- R10 sends explicit faculty-entered/confirmed scores to v1.
-- Delegate to the already tested R19 individual approval; never seed historical assignments.
CREATE OR REPLACE FUNCTION public.buklod_quiz_approve_attempt_review_v1(p_attempt_id uuid,p_reviews jsonb)
RETURNS TABLE(status text,total_score numeric,max_score numeric,reviewed_count integer)
LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $fn$ SELECT * FROM public.buklod_quiz_approve_attempt_review_v2(p_attempt_id,p_reviews); $fn$;

-- Class manual approval is atomic and requires every pending item, within the owned section.
CREATE OR REPLACE FUNCTION public.buklod_quiz_approve_class_review_v1(p_exam_id uuid,p_section_id uuid,p_reviews jsonb)
RETURNS TABLE(approved_attempts integer,reviewed_items integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE actor uuid:=auth.uid(); expected integer; item_count integer; a_id uuid; n integer:=0; reviewed integer:=0; result record;
BEGIN
 IF actor IS NULL OR public.buklod_quiz_is_examiner(actor) IS DISTINCT FROM true OR NOT EXISTS(
 SELECT 1 FROM public.buklod_quiz_exams e JOIN public.buklod_quiz_sections s ON s.exam_id=e.id
 WHERE e.id=p_exam_id AND s.id=p_section_id AND e.owner_user_id=actor)
 THEN RAISE EXCEPTION 'Exam owner and examiner required' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_reviews) IS DISTINCT FROM 'array' OR pg_column_size(p_reviews)>2097152 THEN RAISE EXCEPTION 'Valid review array required'; END IF;
 PERFORM 1 FROM public.buklod_quiz_attempts a WHERE a.exam_id=p_exam_id AND a.section_id=p_section_id AND a.status='NEEDS_REVIEW' ORDER BY a.id FOR UPDATE;
 SELECT count(*)::integer INTO expected FROM public.buklod_quiz_attempts a JOIN public.buklod_quiz_responses r ON r.attempt_id=a.id
 WHERE a.exam_id=p_exam_id AND a.section_id=p_section_id AND a.status='NEEDS_REVIEW' AND r.needs_review IS TRUE AND r.manual_score IS NULL;
 IF jsonb_array_length(p_reviews)<>expected THEN RAISE EXCEPTION 'Class review changed; refresh before approval'; END IF;
 IF expected=0 THEN RETURN QUERY SELECT 0,0; RETURN; END IF;
 IF (SELECT count(DISTINCT (x->>'response_id')::uuid) FROM jsonb_array_elements(p_reviews) x)<>expected OR EXISTS(
 SELECT 1 FROM jsonb_array_elements(p_reviews) x WHERE NOT EXISTS(
 SELECT 1 FROM public.buklod_quiz_attempts a JOIN public.buklod_quiz_responses r ON r.attempt_id=a.id
 WHERE a.id=(x->>'attempt_id')::uuid AND r.id=(x->>'response_id')::uuid AND a.exam_id=p_exam_id AND a.section_id=p_section_id AND a.status='NEEDS_REVIEW' AND r.needs_review IS TRUE AND r.manual_score IS NULL))
 THEN RAISE EXCEPTION 'Duplicate or out-of-scope review item'; END IF;
 FOR a_id IN SELECT DISTINCT (x->>'attempt_id')::uuid FROM jsonb_array_elements(p_reviews) x ORDER BY 1 LOOP
   SELECT * INTO STRICT result FROM public.buklod_quiz_approve_attempt_review_v2(a_id,(SELECT jsonb_agg(x) FROM jsonb_array_elements(p_reviews) x WHERE (x->>'attempt_id')::uuid=a_id));
   IF result.status<>'GRADED' THEN RAISE EXCEPTION 'Class approval incomplete'; END IF;
   n:=n+1; reviewed:=reviewed+result.reviewed_count;
 END LOOP;
 IF reviewed<>expected THEN RAISE EXCEPTION 'Class approval count changed'; END IF;
 RETURN QUERY SELECT n,reviewed;
END;
$fn$;

-- Single manual review must not change a previously finalized grade.
CREATE OR REPLACE FUNCTION public.buklod_quiz_review_response_v1(p_response_id uuid,p_manual_score numeric,p_feedback text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE actor uuid:=auth.uid(); a_id uuid; cap numeric;
BEGIN
 IF actor IS NULL OR public.buklod_quiz_is_examiner(actor) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Examiner access required' USING ERRCODE='42501'; END IF;
 SELECT a.id INTO a_id FROM public.buklod_quiz_responses r JOIN public.buklod_quiz_attempts a ON a.id=r.attempt_id
 JOIN public.buklod_quiz_exams e ON e.id=a.exam_id WHERE r.id=p_response_id AND a.status='NEEDS_REVIEW' AND e.owner_user_id=actor FOR UPDATE OF a;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pending response unavailable' USING ERRCODE='42501'; END IF;
 SELECT q.points INTO cap FROM public.buklod_quiz_responses r CROSS JOIN LATERAL private.buklod_quiz_review_reference_r19(a_id) q
 WHERE r.id=p_response_id AND r.attempt_id=a_id AND r.question_id=q.id AND r.needs_review IS TRUE AND r.manual_score IS NULL AND q.immutable
 FOR UPDATE OF r;
 IF NOT FOUND OR p_manual_score IS NULL OR p_manual_score::text IN ('NaN','Infinity','-Infinity') OR p_manual_score<0 OR p_manual_score>cap THEN RAISE EXCEPTION 'Invalid score or missing verified reference'; END IF;
 UPDATE public.buklod_quiz_responses r SET manual_score=p_manual_score,feedback=nullif(btrim(left(coalesce(p_feedback,''),4000)),''),
 reviewed_by=actor,reviewed_at=now(),needs_review=false,updated_at=now() WHERE r.id=p_response_id;
 PERFORM public.buklod_quiz_compute_attempt_internal(a_id);
 RETURN true;
END;
$fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_student_questions_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_student_questions_v1(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_approve_attempt_review_v1(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_approve_attempt_review_v1(uuid,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_approve_class_review_v1(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_approve_class_review_v1(uuid,uuid,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_review_response_v1(uuid,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_review_response_v1(uuid,numeric,text) TO authenticated;

-- Reject historical or incomplete reference sets rather than silently returning partial AI payload.
CREATE OR REPLACE FUNCTION public.buklod_quiz_review_ai_payload_v2(p_attempt_id uuid)
RETURNS TABLE(response_id uuid,question_type text,question text,max_points numeric,student_answer text,correct_answer text,explanation text,rubric text,capture_digest text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
BEGIN
 IF auth.uid() IS NULL OR public.buklod_quiz_is_examiner(auth.uid()) IS DISTINCT FROM true OR NOT EXISTS(
 SELECT 1 FROM public.buklod_quiz_attempts a JOIN public.buklod_quiz_exams e ON e.id=a.exam_id WHERE a.id=p_attempt_id AND e.owner_user_id=auth.uid())
 THEN RAISE EXCEPTION 'Exam owner and examiner required' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.buklod_quiz_responses r JOIN public.buklod_quiz_attempts a ON a.id=r.attempt_id
 WHERE a.id=p_attempt_id AND a.status='NEEDS_REVIEW' AND r.needs_review IS TRUE AND r.manual_score IS NULL
 AND NOT EXISTS(SELECT 1 FROM private.buklod_quiz_review_reference_r19(a.id) q WHERE q.id=r.question_id AND q.immutable AND upper(q.question_type) IN ('SHORT_TEXT','ESSAY','ENUMERATION','MANUAL')))
 THEN RAISE EXCEPTION 'Original grading reference unavailable; explicit faculty historical review required'; END IF;
 RETURN QUERY SELECT r.id,q.question_type,q.prompt,q.points,
 CASE WHEN jsonb_typeof(r.answer)='string' THEN r.answer#>>'{}' ELSE coalesce(r.answer::text,'') END,
 CASE WHEN jsonb_typeof(q.correct_answer)='string' THEN q.correct_answer#>>'{}' ELSE q.correct_answer::text END,
 q.explanation,q.rubric::text,private.buklod_quiz_review_capture_r19(r.id)
 FROM public.buklod_quiz_responses r JOIN public.buklod_quiz_attempts a ON a.id=r.attempt_id
 CROSS JOIN LATERAL private.buklod_quiz_review_reference_r19(a.id) q
 WHERE r.attempt_id=p_attempt_id AND a.status='NEEDS_REVIEW' AND q.id=r.question_id AND r.needs_review IS TRUE AND r.manual_score IS NULL
 AND q.immutable AND upper(q.question_type) IN ('SHORT_TEXT','ESSAY','ENUMERATION','MANUAL')
 ORDER BY q.sort_order,q.id;
END;
$fn$;

