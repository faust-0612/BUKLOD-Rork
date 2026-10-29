-- BUKLOD Quiz: read-only faculty class inventory and all-status roster, 2026-10-29.
-- Adds APIs for a Manage Class UI. No student, roster, attempt or grade is modified.
-- All results are owned-exam only, no anonymous execute.
CREATE OR REPLACE FUNCTION public.buklod_quiz_faculty_class_inventory_v1(
  p_exam_id uuid, p_include_archived boolean DEFAULT false
) RETURNS TABLE(
  section_id uuid,section_name text,archived_at timestamptz,
  roster_total bigint,active_students bigint,removed_students bigint,
  historical_attempts bigint,in_progress_attempts bigint,
  current_session_id uuid,current_live_status text,current_join_code text,
  can_archive boolean,matching_active_section_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
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
    ORDER BY ls.created_at DESC LIMIT 1
  ) l ON true
  WHERE s.exam_id=p_exam_id AND (coalesce(p_include_archived,false) OR s.archived_at IS NULL)
  ORDER BY s.sort_order,lower(s.name),s.id;
END $fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_faculty_class_inventory_v1(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_faculty_class_inventory_v1(uuid,boolean) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.buklod_quiz_faculty_class_roster_v1(
  p_exam_id uuid, p_section_id uuid,
  p_status text DEFAULT 'ALL',p_search text DEFAULT NULL,
  p_limit integer DEFAULT 50,p_offset integer DEFAULT 0
) RETURNS TABLE(
  roster_id uuid,student_user_id uuid,display_name text,student_no text,
  roster_status text,enrolled_at timestamptz,roster_updated_at timestamptz,
  last_attempt_id uuid,last_attempt_status text,last_attempt_section_name text,
  last_attempt_at timestamptz,has_running_attempt boolean,
  total_matching bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
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
    ORDER BY a.attempt_no DESC,a.created_at DESC LIMIT 1
  ) last_a ON true
  LEFT JOIN public.buklod_quiz_sections last_s ON last_s.id=last_a.section_id
  WHERE r.exam_id=p_exam_id AND r.section_id=p_section_id
    AND (v_filter='ALL' OR r.status=v_filter)
    AND (v_search IS NULL OR
      lower(coalesce(r.display_name,'')) LIKE '%'||lower(v_search)||'%' OR
      lower(coalesce(r.student_no,'')) LIKE '%'||lower(v_search)||'%')
  ORDER BY lower(coalesce(r.surname,'')),lower(coalesce(r.first_name,'')),lower(r.display_name),r.id
  LIMIT v_limit OFFSET v_offset;
END $fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_faculty_class_roster_v1(uuid,uuid,text,text,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_faculty_class_roster_v1(uuid,uuid,text,text,integer,integer) TO authenticated,service_role;
