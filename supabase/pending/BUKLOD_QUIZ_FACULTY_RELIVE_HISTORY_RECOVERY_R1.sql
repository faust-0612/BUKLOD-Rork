-- BUKLOD QUIZ RELIVE HISTORY + TARGETED RECOVERY R1
-- Adds owner-only historical room discovery and explicit, auditable student recovery.
-- Does NOT automatically relive rooms, transfer attempts, modify grades, or retake anyone.
-- Designed for the independent Quiz frontend to bind to Manage Live Session > History.
CREATE OR REPLACE FUNCTION public.buklod_quiz_faculty_room_history_v1(
 p_exam_id uuid,
 p_section_id uuid DEFAULT NULL,
 p_limit integer DEFAULT 50,
 p_offset integer DEFAULT 0
)
RETURNS TABLE(
 session_id uuid,section_id uuid,section_name text,
 join_code text,live_status text,created_at timestamptz,started_at timestamptz,ended_at timestamptz,
 question_count integer,relive_count integer,relive_only_unattempted boolean,
 is_latest_for_class boolean,can_relive boolean,
 total_members bigint,removed_members bigint,
 stranded_unfinished_attempts bigint,total_matching bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_actor uuid := (select auth.uid());
BEGIN
 IF v_actor IS NULL
   OR NOT public.buklod_quiz_is_examiner(v_actor)
   OR NOT EXISTS(SELECT 1 FROM public.buklod_quiz_exams e WHERE e.id=p_exam_id AND e.owner_user_id=v_actor)
 THEN RAISE EXCEPTION 'Exam owner and examiner access required.' USING errcode='42501'; END IF;
 IF p_section_id IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM public.buklod_quiz_sections sx WHERE sx.id=p_section_id AND sx.exam_id=p_exam_id
 ) THEN RAISE EXCEPTION 'Section is not part of this exam.' USING errcode='22023'; END IF;

 RETURN QUERY
 WITH rooms AS (
 SELECT ls.*,sx.name::text AS section_name,sx.archived_at AS section_archived,
   row_number() over(partition by ls.section_id order by ls.created_at desc,ls.id desc) AS rank_in_class
 FROM public.buklod_quiz_live_sessions ls
 JOIN public.buklod_quiz_sections sx ON sx.id=ls.section_id AND sx.exam_id=ls.exam_id
 WHERE ls.exam_id=p_exam_id AND ls.faculty_user_id=v_actor
   AND (p_section_id IS NULL OR ls.section_id=p_section_id)
 )
 SELECT x.id,x.section_id,x.section_name,x.join_code,x.status::text,
 x.created_at,x.started_at,x.ended_at,x.question_count,
 CASE WHEN coalesce(x.settings_snapshot->>'relive_count','') ~ '^[0-9]{1,5}$'
   THEN (x.settings_snapshot->>'relive_count')::int ELSE 0 END,
 coalesce((x.settings_snapshot->>'relive_only_unattempted')::boolean,false),
 (x.rank_in_class=1),
 (x.status='ENDED' AND x.section_archived IS NULL
   AND NOT EXISTS(SELECT 1 FROM public.buklod_quiz_live_sessions other
    WHERE other.exam_id=x.exam_id AND other.section_id=x.section_id AND other.id<>x.id
      AND other.status<>'ENDED')),
 (SELECT count(*) FROM public.buklod_quiz_live_members lm WHERE lm.session_id=x.id),
 (SELECT count(*) FROM public.buklod_quiz_live_members lm WHERE lm.session_id=x.id AND lm.status='REMOVED'),
 (SELECT count(*) FROM public.buklod_quiz_attempts a WHERE a.live_session_id=x.id AND a.status='STARTED'
   AND NOT EXISTS(SELECT 1 FROM public.buklod_quiz_responses r WHERE r.attempt_id=a.id
     AND r.answer IS NOT NULL AND r.answer<>'null'::jsonb)),
 count(*) over()
 FROM rooms x ORDER BY x.created_at DESC,x.id DESC
 LIMIT greatest(1,least(coalesce(p_limit,50),100))
 OFFSET greatest(0,least(coalesce(p_offset,0),10000));
END $fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_faculty_room_history_v1(uuid,uuid,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_faculty_room_history_v1(uuid,uuid,integer,integer) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.buklod_quiz_faculty_unfinished_recovery_v1(
 p_exam_id uuid,p_section_id uuid,
 p_limit integer DEFAULT 50,p_offset integer DEFAULT 0
)
RETURNS TABLE(
 attempt_id uuid,student_user_id uuid,student_name text,attempt_no integer,
 source_session_id uuid,source_join_code text,source_room_status text,
 roster_status text,saved_answer_rows bigint,
 selected_question_count integer,max_score numeric,
 current_live_session_id uuid,current_live_code text,current_member_status text,
 can_recover_to_current boolean,reason text,total_matching bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
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
 (target.id IS NOT NULL AND src.status='ENDED'
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
 WHEN m.student_user_id IS NULL THEN 'Student has no entry in the target room; authorized rejoin first'
 WHEN private.buklod_quiz_attempt_question_count_r1(a.id)<>target.question_count
   OR coalesce(a.max_score,0)<>coalesce(target.total_score_target,0) THEN 'Exam structure differs'
 WHEN coalesce(src.settings_snapshot->>'question_selection_mode','')
       <>coalesce(target.settings_snapshot->>'question_selection_mode','') THEN 'Assignment mode differs'
 ELSE 'Eligible for faculty-authorized recovery; existing attempt and answers preserved' END,
 count(*) over()
 FROM public.buklod_quiz_attempts a
 JOIN public.buklod_quiz_live_sessions src ON src.id=a.live_session_id AND src.exam_id=a.exam_id
 LEFT JOIN public.buklod_quiz_roster r ON r.exam_id=a.exam_id AND r.student_user_id=a.student_user_id
 LEFT JOIN LATERAL (
   SELECT ls.* FROM public.buklod_quiz_live_sessions ls
   WHERE ls.exam_id=a.exam_id AND ls.section_id=a.section_id AND ls.status='LIVE'
     AND ls.faculty_user_id=v_actor ORDER BY ls.created_at DESC LIMIT 1
 ) target ON true
 LEFT JOIN public.buklod_quiz_live_members m ON m.session_id=target.id AND m.student_user_id=a.student_user_id
 WHERE a.exam_id=p_exam_id AND a.section_id=p_section_id AND a.status='STARTED'
   AND src.status='ENDED'
 ORDER BY a.created_at DESC,a.attempt_no DESC
 LIMIT greatest(1,least(coalesce(p_limit,50),100))
 OFFSET greatest(0,least(coalesce(p_offset,0),10000));
END $fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_faculty_unfinished_recovery_v1(uuid,uuid,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_faculty_unfinished_recovery_v1(uuid,uuid,integer,integer) TO authenticated,service_role;

-- One intentional faculty action = atomic readmission then existing audited REOPEN.
-- If REOPEN rejects, the readmission is rolled back with the whole call.
CREATE OR REPLACE FUNCTION public.buklod_quiz_faculty_recover_unfinished_v1(
 p_current_session_id uuid,p_student_user_id uuid,p_minutes integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
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
 IF v_session.id IS NULL THEN RAISE EXCEPTION 'A current LIVE room owned by faculty is required.'; END IF;
 SELECT * INTO v_member FROM public.buklod_quiz_live_members
 WHERE session_id=v_session.id AND student_user_id=p_student_user_id FOR UPDATE;
 IF v_member.student_user_id IS NULL THEN
   RAISE EXCEPTION 'Student must first join this room with a valid class code.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.buklod_quiz_roster r
   WHERE r.exam_id=v_session.exam_id AND r.section_id=v_session.section_id
    AND r.student_user_id=p_student_user_id) THEN
   RAISE EXCEPTION 'Student must belong to the current exam class.'; END IF;
 SELECT a.* INTO v_old FROM public.buklod_quiz_attempts a
 JOIN public.buklod_quiz_live_sessions old ON old.id=a.live_session_id
 WHERE a.exam_id=v_session.exam_id AND a.section_id=v_session.section_id
  AND a.student_user_id=p_student_user_id AND a.status='STARTED'
  AND a.live_session_id<>v_session.id AND old.status='ENDED'
  AND old.question_count=v_session.question_count
  AND coalesce(old.settings_snapshot->>'question_selection_mode','')
      =coalesce(v_session.settings_snapshot->>'question_selection_mode','')
 ORDER BY a.attempt_no DESC,a.created_at DESC LIMIT 1 FOR UPDATE OF a;
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

 IF v_member.status<>'ADMITTED' THEN
  PERFORM public.buklod_quiz_live_student_action_v2(v_session.id,p_student_user_id,'READMIT',NULL);
 END IF;
 v_result:=public.buklod_quiz_live_student_action_v2(v_session.id,p_student_user_id,'REOPEN',v_minutes);
 IF v_result->>'attempt_id'<>v_old.id::text THEN
   RAISE EXCEPTION 'Recovered attempt identity mismatch; changes rolled back.'; END IF;
 RETURN v_result || jsonb_build_object('recovery','ENDED_ROOM_ZERO_ANSWER','previous_room',v_old.live_session_id,'preserved_attempt_id',v_old.id);
END $fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_faculty_recover_unfinished_v1(uuid,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_faculty_recover_unfinished_v1(uuid,uuid,integer) TO authenticated,service_role;
