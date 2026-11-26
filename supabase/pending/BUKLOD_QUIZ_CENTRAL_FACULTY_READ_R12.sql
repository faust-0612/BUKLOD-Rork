-- DEV candidate only. Restores three read-only faculty RPC contracts.
-- Source: Dedicated deployed definitions; existing MAIN functions not replaced.
-- Apply in a transaction; requires owner/nonowner/anonymous QA before release.

CREATE FUNCTION public.buklod_quiz_faculty_class_inventory_v1(p_exam_id uuid, p_include_archived boolean DEFAULT false)
 RETURNS TABLE(section_id uuid, section_name text, archived_at timestamp with time zone, roster_total bigint, active_students bigint, removed_students bigint, historical_attempts bigint, in_progress_attempts bigint, current_session_id uuid, current_live_status text, current_join_code text, can_archive boolean, matching_active_section_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT public.buklod_quiz_is_examiner((SELECT auth.uid())) OR NOT EXISTS(
    SELECT 1 FROM public.buklod_quiz_exams e
    WHERE e.id=p_exam_id AND e.owner_user_id=(SELECT auth.uid())
  ) THEN RAISE EXCEPTION 'Exam owner and examiner access required.' USING errcode='42501'; END IF;

  RETURN QUERY
  SELECT
    s.id,s.name::text,s.archived_at,
    (SELECT count(*) FROM public.buklod_quiz_roster r WHERE r.exam_id=p_exam_id AND r.section_id=s.id),
    (SELECT count(*) FROM public.buklod_quiz_roster r WHERE r.exam_id=p_exam_id AND r.section_id=s.id AND r.status='ACTIVE'),
    (SELECT count(*) FROM public.buklod_quiz_roster r WHERE r.exam_id=p_exam_id AND r.section_id=s.id AND r.status='REMOVED'),
    (SELECT count(*) FROM public.buklod_quiz_attempts a WHERE a.exam_id=p_exam_id AND a.section_id=s.id),
    (SELECT count(*) FROM public.buklod_quiz_attempts a
       JOIN public.buklod_quiz_live_sessions ls ON ls.id=a.live_session_id
       WHERE a.exam_id=p_exam_id AND a.section_id=s.id AND a.status='STARTED'
       AND a.expires_at>now() AND ls.status IN ('LIVE','PAUSED')),
    l.id,l.status::text,l.join_code,
    NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempts a
       JOIN public.buklod_quiz_live_sessions ls ON ls.id=a.live_session_id
       WHERE a.exam_id=p_exam_id AND a.section_id=s.id AND a.status='STARTED'
       AND a.expires_at>now() AND ls.status IN ('LIVE','PAUSED')),
    (SELECT count(*) FROM public.buklod_quiz_sections other
       WHERE other.exam_id=p_exam_id AND other.id<>s.id AND other.archived_at IS NULL
       AND lower(regexp_replace(other.name,'[-[:space:]]+','','g')) =
           lower(regexp_replace(s.name,'[-[:space:]]+','','g')))
  FROM public.buklod_quiz_sections s
  LEFT JOIN LATERAL (
    SELECT ls.id,ls.status,ls.join_code
    FROM public.buklod_quiz_live_sessions ls
    WHERE ls.exam_id=p_exam_id AND ls.section_id=s.id AND ls.status<>'ENDED'
    ORDER BY ls.created_at DESC,ls.id DESC LIMIT 1
  ) l ON true
  WHERE s.exam_id=p_exam_id AND (coalesce(p_include_archived,false) OR s.archived_at IS NULL)
  ORDER BY s.sort_order,lower(s.name),s.id;
END $function$;
REVOKE ALL ON FUNCTION public.buklod_quiz_faculty_class_inventory_v1(uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_faculty_class_inventory_v1(uuid,boolean) TO authenticated;

CREATE FUNCTION public.buklod_quiz_faculty_class_roster_v1(p_exam_id uuid, p_section_id uuid, p_status text DEFAULT 'ALL'::text, p_search text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(roster_id uuid, student_user_id uuid, display_name text, student_no text, roster_status text, enrolled_at timestamp with time zone, roster_updated_at timestamp with time zone, last_attempt_id uuid, last_attempt_status text, last_attempt_section_name text, last_attempt_at timestamp with time zone, has_running_attempt boolean, total_matching bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_filter text:=upper(trim(coalesce(p_status,'ALL')));
  v_limit integer:=greatest(1,least(coalesce(p_limit,50),100));
  v_offset integer:=greatest(0,least(coalesce(p_offset,0),10000));
  v_search text:=nullif(trim(left(coalesce(p_search,''),80)),'');
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT public.buklod_quiz_is_examiner((SELECT auth.uid())) OR NOT EXISTS(
    SELECT 1 FROM public.buklod_quiz_exams e
    JOIN public.buklod_quiz_sections s ON s.exam_id=e.id
    WHERE e.id=p_exam_id AND e.owner_user_id=(SELECT auth.uid()) AND s.id=p_section_id
  ) THEN RAISE EXCEPTION 'Exam section owner and examiner access required.' USING errcode='42501'; END IF;

  IF v_filter NOT IN ('ALL','ACTIVE','REMOVED','PENDING') THEN
    RAISE EXCEPTION 'Invalid roster status filter.' USING errcode='22023';
  END IF;

  RETURN QUERY
  SELECT r.id,r.student_user_id,r.display_name::text,r.student_no::text,
    r.status::text,r.created_at,r.updated_at,
    last_a.id,last_a.status::text,last_s.name::text,last_a.created_at,
    EXISTS(
      SELECT 1 FROM public.buklod_quiz_attempts run
      JOIN public.buklod_quiz_live_sessions live ON live.id=run.live_session_id
      WHERE run.exam_id=p_exam_id AND run.student_user_id=r.student_user_id
        AND run.status='STARTED' AND run.expires_at>now()
        AND live.status IN ('LIVE','PAUSED')
    ),
    count(*) over()
  FROM public.buklod_quiz_roster r
  LEFT JOIN LATERAL (
    SELECT a.id,a.status,a.section_id,a.created_at FROM public.buklod_quiz_attempts a
    WHERE a.exam_id=p_exam_id AND a.student_user_id=r.student_user_id
    ORDER BY a.attempt_no DESC,a.created_at DESC,a.id DESC LIMIT 1
  ) last_a ON true
  LEFT JOIN public.buklod_quiz_sections last_s ON last_s.id=last_a.section_id
  WHERE r.exam_id=p_exam_id AND r.section_id=p_section_id
    AND (v_filter='ALL' OR r.status=v_filter)
    AND (v_search IS NULL OR
      lower(coalesce(r.display_name,'')) LIKE '%'||lower(v_search)||'%' OR
      lower(coalesce(r.student_no,'')) LIKE '%'||lower(v_search)||'%')
  ORDER BY lower(coalesce(r.surname,'')),lower(coalesce(r.first_name,'')),lower(r.display_name),r.id
  LIMIT v_limit OFFSET v_offset;
END $function$;
REVOKE ALL ON FUNCTION public.buklod_quiz_faculty_class_roster_v1(uuid,uuid,text,text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_faculty_class_roster_v1(uuid,uuid,text,text,integer,integer) TO authenticated;

CREATE FUNCTION public.buklod_quiz_faculty_room_history_v1(p_exam_id uuid, p_section_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(session_id uuid, section_id uuid, section_name text, join_code text, live_status text, created_at timestamp with time zone, started_at timestamp with time zone, ended_at timestamp with time zone, question_count integer, relive_count integer, relive_only_unattempted boolean, is_latest_for_class boolean, can_relive boolean, total_members bigint, removed_members bigint, stranded_unfinished_attempts bigint, total_matching bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 CASE lower(coalesce(x.settings_snapshot->>'relive_only_unattempted','')) WHEN 'true' THEN true WHEN 't' THEN true WHEN '1' THEN true WHEN 'yes' THEN true WHEN 'on' THEN true ELSE false END,
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
END $function$;
REVOKE ALL ON FUNCTION public.buklod_quiz_faculty_room_history_v1(uuid,uuid,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_faculty_room_history_v1(uuid,uuid,integer,integer) TO authenticated;
