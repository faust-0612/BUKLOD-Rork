-- Align the recovery eligibility flag with actual target membership requirement.
-- Does not alter attempt rows or membership data.
CREATE OR REPLACE FUNCTION public.buklod_quiz_faculty_unfinished_recovery_v1(p_exam_id uuid, p_section_id uuid, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
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
 (target.id IS NOT NULL AND m.student_user_id IS NOT NULL AND src.status='ENDED'
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
END $function$;
