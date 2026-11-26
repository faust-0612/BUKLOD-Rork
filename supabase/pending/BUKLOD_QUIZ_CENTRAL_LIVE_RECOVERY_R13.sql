-- DEV only. Requires functional and concurrency QA. Do not apply to production.
-- Restore faculty room v3 and unfinished recovery without replacing existing MAIN RPCs.

CREATE FUNCTION public.buklod_quiz_faculty_live_room_v3(p_session_id uuid)
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
    coalesce((select count(*)::int from public.buklod_quiz_responses r where r.attempt_id=a.id and r.answer is not null and r.answer<>'null'::jsonb and r.answer<>'""'::jsonb),0),
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
    order by x.attempt_no desc,x.created_at desc,x.id desc
    limit 1
  ) a on true
  where ls.id=p_session_id
    and ls.faculty_user_id=(select auth.uid())
    and e.owner_user_id=(select auth.uid())
    and public.buklod_quiz_is_examiner((select auth.uid()))
    and sec.exam_id=ls.exam_id
    and m.status<>'REMOVED'
  order by lower(coalesce(p.surname,p.full_name,'')),lower(coalesce(p.first_name,'')),m.joined_at
$function$;
REVOKE ALL ON FUNCTION public.buklod_quiz_faculty_live_room_v3(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_faculty_live_room_v3(uuid) TO authenticated;

CREATE FUNCTION public.buklod_quiz_faculty_unfinished_recovery_v1(p_exam_id uuid, p_section_id uuid, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(attempt_id uuid, student_user_id uuid, student_name text, attempt_no integer, source_session_id uuid, source_join_code text, source_room_status text, roster_status text, saved_answer_rows bigint, selected_question_count integer, max_score numeric, current_live_session_id uuid, current_live_code text, current_member_status text, can_recover_to_current boolean, reason text, total_matching bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_actor uuid := (select auth.uid());
BEGIN
 IF v_actor IS NULL OR NOT public.buklod_quiz_is_examiner(v_actor)
  OR NOT EXISTS(SELECT 1 FROM public.buklod_quiz_exams e
    JOIN public.buklod_quiz_sections sx ON sx.id=p_section_id AND sx.exam_id=e.id
    WHERE e.id=p_exam_id AND e.owner_user_id=v_actor)
 THEN RAISE EXCEPTION 'Exam section owner and examiner access required.' USING errcode='42501'; END IF;

 RETURN QUERY
 SELECT a.id,a.student_user_id,coalesce(r.display_name,'Unknown')::text,a.attempt_no,
 src.id,src.join_code,src.status::text,r.status::text,
 (SELECT count(*) FROM public.buklod_quiz_responses rsp WHERE rsp.attempt_id=a.id),
 private.buklod_quiz_attempt_question_count_r1(a.id),a.max_score,
 target.id,target.join_code,m.status::text,
 (target.id IS NOT NULL AND m.status='ADMITTED' AND r.status='ACTIVE' AND src.status='ENDED'
   AND NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempts z WHERE z.live_session_id=target.id AND z.student_user_id=a.student_user_id AND z.status<>'VOID')
   AND src.question_snapshot_hash IS NOT DISTINCT FROM target.question_snapshot_hash
   AND (coalesce(src.settings_snapshot->>'question_selection_mode','')<>'SNAPSHOT_R1' OR nullif(src.question_snapshot_hash,'') IS NOT NULL)
   AND NOT EXISTS(SELECT 1 FROM public.buklod_quiz_responses rsp WHERE rsp.attempt_id=a.id)
   AND private.buklod_quiz_attempt_question_count_r1(a.id)=target.question_count
   AND coalesce(a.max_score,0)=coalesce(target.total_score_target,0)
   AND coalesce(src.settings_snapshot->>'question_selection_mode','')
       =coalesce(target.settings_snapshot->>'question_selection_mode','')
   AND NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempts other
     WHERE other.exam_id=a.exam_id AND other.student_user_id=a.student_user_id
       AND other.status='STARTED' AND other.id<>a.id)),
 CASE
 WHEN src.status<>'ENDED' THEN 'Source session is not ended'
 WHEN EXISTS(SELECT 1 FROM public.buklod_quiz_responses rsp WHERE rsp.attempt_id=a.id) THEN 'Review saved answers first'
 WHEN target.id IS NULL THEN 'No live target room for this class'
 WHEN r.status IS DISTINCT FROM 'ACTIVE' THEN 'Active class roster required'
 WHEN m.status IS DISTINCT FROM 'ADMITTED' THEN 'Student has no entry in the target room; authorized rejoin first'
 WHEN private.buklod_quiz_attempt_question_count_r1(a.id)<>target.question_count
   OR coalesce(a.max_score,0)<>coalesce(target.total_score_target,0) THEN 'Exam structure differs'
 WHEN coalesce(src.settings_snapshot->>'question_selection_mode','')
       <>coalesce(target.settings_snapshot->>'question_selection_mode','') THEN 'Assignment mode differs'
 WHEN EXISTS(SELECT 1 FROM public.buklod_quiz_attempts z WHERE z.live_session_id=target.id AND z.student_user_id=a.student_user_id AND z.status<>'VOID') THEN 'Target room already has an attempt'
 WHEN src.question_snapshot_hash IS DISTINCT FROM target.question_snapshot_hash OR (coalesce(src.settings_snapshot->>'question_selection_mode','')='SNAPSHOT_R1' AND nullif(src.question_snapshot_hash,'') IS NULL) THEN 'Question snapshot cannot be verified'
 WHEN EXISTS(SELECT 1 FROM public.buklod_quiz_attempts other WHERE other.exam_id=a.exam_id AND other.student_user_id=a.student_user_id AND other.status='STARTED' AND other.id<>a.id) THEN 'Another unfinished attempt exists'
 ELSE 'Eligible for faculty-authorized recovery; existing attempt and answers preserved' END,
 count(*) over()
 FROM public.buklod_quiz_attempts a
 JOIN public.buklod_quiz_live_sessions src ON src.id=a.live_session_id AND src.exam_id=a.exam_id
 LEFT JOIN public.buklod_quiz_roster r ON r.exam_id=a.exam_id AND r.student_user_id=a.student_user_id AND r.section_id=a.section_id
 LEFT JOIN LATERAL (
   SELECT ls.* FROM public.buklod_quiz_live_sessions ls
   WHERE ls.exam_id=a.exam_id AND ls.section_id=a.section_id AND ls.status='LIVE'
     AND ls.faculty_user_id=v_actor ORDER BY ls.created_at DESC,ls.id DESC LIMIT 1
 ) target ON true
 LEFT JOIN public.buklod_quiz_live_members m ON m.session_id=target.id AND m.student_user_id=a.student_user_id
 WHERE a.exam_id=p_exam_id AND a.section_id=p_section_id AND a.status='STARTED'
   AND src.status='ENDED'
 ORDER BY a.created_at DESC,a.attempt_no DESC
 LIMIT greatest(1,least(coalesce(p_limit,50),100))
 OFFSET greatest(0,least(coalesce(p_offset,0),10000));
END $function$;
REVOKE ALL ON FUNCTION public.buklod_quiz_faculty_unfinished_recovery_v1(uuid,uuid,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_faculty_unfinished_recovery_v1(uuid,uuid,integer,integer) TO authenticated;

CREATE FUNCTION public.buklod_quiz_faculty_recover_unfinished_v1(p_current_session_id uuid, p_student_user_id uuid, p_minutes integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_actor uuid := (select auth.uid());
 v_session public.buklod_quiz_live_sessions%rowtype;
 v_member public.buklod_quiz_live_members%rowtype;
 v_old public.buklod_quiz_attempts%rowtype;
 v_result jsonb;
 v_minutes int;
BEGIN
 IF v_actor IS NULL OR NOT public.buklod_quiz_is_examiner(v_actor) THEN
   RAISE EXCEPTION 'Examiner access required.' USING errcode='42501'; END IF;
 SELECT * INTO v_session FROM public.buklod_quiz_live_sessions
 WHERE id=p_current_session_id AND faculty_user_id=v_actor AND status='LIVE' FOR UPDATE;
 IF v_session.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.buklod_quiz_exams e WHERE e.id=v_session.exam_id AND e.owner_user_id=v_actor) THEN RAISE EXCEPTION 'A current LIVE room owned by faculty is required.'; END IF;
 SELECT * INTO v_member FROM public.buklod_quiz_live_members
 WHERE session_id=v_session.id AND student_user_id=p_student_user_id FOR UPDATE;
 IF v_member.student_user_id IS NULL OR v_member.status IS DISTINCT FROM 'ADMITTED' THEN
   RAISE EXCEPTION 'Student must first join this room with a valid class code.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.buklod_quiz_roster r
   WHERE r.exam_id=v_session.exam_id AND r.section_id=v_session.section_id
    AND r.student_user_id=p_student_user_id AND r.status='ACTIVE') THEN
   RAISE EXCEPTION 'Student must belong to the current exam class.'; END IF;
 SELECT a.* INTO v_old FROM public.buklod_quiz_attempts a
 JOIN public.buklod_quiz_live_sessions old ON old.id=a.live_session_id
 WHERE a.exam_id=v_session.exam_id AND a.section_id=v_session.section_id
  AND a.student_user_id=p_student_user_id AND a.status='STARTED'
  AND a.live_session_id<>v_session.id AND old.status='ENDED'
  AND old.question_count=v_session.question_count
  AND old.exam_id=v_session.exam_id AND old.section_id=v_session.section_id
  AND old.question_snapshot_hash IS NOT DISTINCT FROM v_session.question_snapshot_hash
  AND (coalesce(old.settings_snapshot->>'question_selection_mode','')<>'SNAPSHOT_R1' OR nullif(old.question_snapshot_hash,'') IS NOT NULL)
  AND coalesce(old.settings_snapshot->>'question_selection_mode','')
      =coalesce(v_session.settings_snapshot->>'question_selection_mode','')
 ORDER BY a.attempt_no DESC,a.created_at DESC LIMIT 1 FOR UPDATE OF a;
 IF EXISTS(SELECT 1 FROM public.buklod_quiz_attempts z WHERE z.live_session_id=v_session.id AND z.student_user_id=p_student_user_id AND z.status<>'VOID') THEN RAISE EXCEPTION 'Target room already has an attempt.'; END IF;
 IF v_old.id IS NULL THEN RAISE EXCEPTION 'No safe unfinished attempt was found.'; END IF;
 IF EXISTS(SELECT 1 FROM public.buklod_quiz_responses r WHERE r.attempt_id=v_old.id) THEN
   RAISE EXCEPTION 'Attempt has saved rows; manual review required before recovery.'; END IF;
 IF coalesce(v_old.max_score,0)<>coalesce(v_session.total_score_target,0)
 OR private.buklod_quiz_attempt_question_count_r1(v_old.id)<>v_session.question_count THEN
   RAISE EXCEPTION 'Exam item count or maximum points mismatch; cannot move attempt.'; END IF;
 IF EXISTS(SELECT 1 FROM public.buklod_quiz_attempts a
   WHERE a.exam_id=v_session.exam_id AND a.student_user_id=p_student_user_id
      AND a.status='STARTED' AND a.id<>v_old.id) THEN
   RAISE EXCEPTION 'Another unfinished attempt exists; manual review required.'; END IF;
 v_minutes:=coalesce(p_minutes,v_session.duration_minutes,30);
 IF v_minutes<1 OR v_minutes>1440 THEN RAISE EXCEPTION 'Recovery duration must be 1 to 1440 minutes.'; END IF;

 v_result:=public.buklod_quiz_live_student_action_v2(v_session.id,p_student_user_id,'REOPEN',v_minutes);
 IF (v_result->>'attempt_id') IS DISTINCT FROM v_old.id::text OR NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempts t WHERE t.id=v_old.id AND t.live_session_id=v_session.id AND t.status='STARTED') THEN
   RAISE EXCEPTION 'Recovered attempt identity mismatch; changes rolled back.'; END IF;
 RETURN v_result || jsonb_build_object('recovery','ENDED_ROOM_ZERO_ANSWER','previous_room',v_old.live_session_id,'preserved_attempt_id',v_old.id);
END $function$;
REVOKE ALL ON FUNCTION public.buklod_quiz_faculty_recover_unfinished_v1(uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
-- Mutation remains service-only/owner-auth gated until actual recovery QA.
