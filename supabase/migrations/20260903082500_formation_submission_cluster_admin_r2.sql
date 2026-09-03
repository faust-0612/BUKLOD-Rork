CREATE OR REPLACE FUNCTION public.submit_my_formation_lesson_for_validation_v1(
  p_enrollment_id uuid,
  p_lesson_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_progress_id uuid;
  v_answers jsonb;
  v_reflection text;
  v_answer text;
  v_answer_count integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Kailangang mag-sign in muli bago magsumite.';
  END IF;

  IF p_enrollment_id IS NULL OR p_lesson_id IS NULL THEN
    RAISE EXCEPTION 'Kulang ang impormasyon ng aralin. Buksan muli ang lesson at subukang magsumite.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.track_enrollments e
    JOIN public.learning_lessons l ON l.id = p_lesson_id
    JOIN public.learning_tracks t ON t.id = l.track_id
    WHERE e.id = p_enrollment_id
      AND e.user_id = v_user
      AND e.track_id = l.track_id
      AND t.formation_program IN ('ccp','discipleship','mentoring')
  ) THEN
    RAISE EXCEPTION 'Ang araling ito ay hindi kabilang sa iyong kasalukuyang enrollment.';
  END IF;

  SELECT lp.id
    INTO v_progress_id
    FROM public.lesson_progress lp
   WHERE lp.enrollment_id = p_enrollment_id
     AND lp.lesson_id = p_lesson_id
     AND lp.user_id = v_user
   LIMIT 1;

  IF v_progress_id IS NULL THEN
    RAISE EXCEPTION 'I-save muna ang study bago isumite para sa pagpapatunay.';
  END IF;

  SELECT r.question_answers, r.reflection_text
    INTO v_answers, v_reflection
    FROM public.learning_lesson_responses r
   WHERE r.user_id = v_user
     AND r.enrollment_id = p_enrollment_id
     AND r.lesson_id = p_lesson_id
   ORDER BY r.updated_at DESC
   LIMIT 1;

  IF v_answers IS NULL OR jsonb_typeof(v_answers) <> 'array' THEN
    RAISE EXCEPTION 'Sagutan muna ang lahat ng 4 na tanong sa Quick Check bago isumite.';
  END IF;

  v_answer_count := jsonb_array_length(v_answers);
  IF v_answer_count <> 4 THEN
    RAISE EXCEPTION 'Kumpletuhin ang lahat ng 4 na tanong. Sa ngayon, % lamang ang naka-save.', v_answer_count;
  END IF;

  FOR v_answer IN SELECT value FROM jsonb_array_elements_text(v_answers)
  LOOP
    IF char_length(btrim(coalesce(v_answer,''))) < 10 THEN
      RAISE EXCEPTION 'Ayusin ang bawat sagot bago isumite. Lahat ng 4 na sagot ay kailangang kumpleto.';
    END IF;
  END LOOP;

  IF char_length(btrim(coalesce(v_reflection,''))) < 20 THEN
    RAISE EXCEPTION 'Kumpletuhin ang Personal Reflection bago isumite.';
  END IF;

  UPDATE public.lesson_progress lp
     SET submitted_for_validation_at = now(),
         updated_at = now()
   WHERE lp.id = v_progress_id
     AND lp.user_id = v_user;

  RETURN jsonb_build_object(
    'ok', true,
    'progress_id', v_progress_id,
    'submitted_for_validation_at', now(),
    'answers_found', v_answer_count,
    'status', 'awaiting_cluster_admin'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_formation_track_lesson_status(p_track_id uuid)
RETURNS TABLE(
  lesson_id uuid,
  lesson_number integer,
  studied boolean,
  official_status text,
  attempt_number integer,
  bayanihan_reward numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT
    l.id AS lesson_id,
    l.lesson_number,
    EXISTS (
      SELECT 1
      FROM public.track_enrollments e
      JOIN public.lesson_progress lp
        ON lp.enrollment_id = e.id
       AND lp.lesson_id = l.id
      WHERE e.user_id = (SELECT auth.uid())
        AND e.track_id = p_track_id
    ) AS studied,
    COALESCE(
      latest.review_status,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM public.track_enrollments e2
          JOIN public.lesson_progress lp2
            ON lp2.enrollment_id = e2.id
           AND lp2.lesson_id = l.id
          WHERE e2.user_id = (SELECT auth.uid())
            AND e2.track_id = p_track_id
            AND lp2.submitted_for_validation_at IS NOT NULL
        ) THEN 'awaiting_cluster_admin'
        ELSE 'draft'
      END
    )::text AS official_status,
    COALESCE(latest.attempt_number, 0)::integer AS attempt_number,
    l.bayanihan_reward
  FROM public.learning_lessons l
  LEFT JOIN LATERAL (
    SELECT a.review_status::text AS review_status, a.attempt_number
    FROM public.member_lesson_attempts a
    WHERE a.user_id = (SELECT auth.uid())
      AND a.lesson_id = l.id
    ORDER BY a.attempt_number DESC
    LIMIT 1
  ) latest ON true
  WHERE l.track_id = p_track_id
  ORDER BY l.lesson_number;
$function$;

CREATE OR REPLACE FUNCTION public.pastor_get_learning_validation_queue_v2()
RETURNS TABLE(
  progress_id uuid,
  user_id uuid,
  member_name text,
  church_id uuid,
  church_name text,
  enrollment_id uuid,
  lesson_id uuid,
  lesson_number integer,
  lesson_title text,
  track_title text,
  studied_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  actor uuid := auth.uid();
  v_can boolean := false;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.buklod_scope_role_assignments ra
    JOIN public.buklod_scopes s
      ON s.id = ra.scope_id
     AND s.scope_type = 'CLUSTER'
    JOIN public.buklod_scope_memberships m
      ON m.scope_id = s.id
     AND m.user_id = actor
     AND coalesce(m.membership_status::text, '') = 'ACTIVE'
    WHERE ra.user_id = actor
      AND ra.status = 'ACTIVE'
      AND upper(ra.role_key) IN ('ADMIN','CLUSTER_ADMIN','CLUSTER_HEAD')
      AND public.buklod_scope_is_active_lifecycle(s.id)
  ) INTO v_can;

  IF NOT v_can THEN
    RAISE EXCEPTION 'Cluster Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    lp.id,
    p.id,
    p.full_name,
    p.church_id,
    coalesce(c.name, 'Cluster')::text,
    lp.enrollment_id,
    l.id,
    l.lesson_number,
    l.title,
    t.title,
    lp.submitted_for_validation_at
  FROM public.lesson_progress lp
  JOIN public.profiles p ON p.id = lp.user_id
  LEFT JOIN public.churches c ON c.id = p.church_id
  JOIN public.learning_lessons l ON l.id = lp.lesson_id
  JOIN public.learning_tracks t ON t.id = l.track_id
  JOIN public.track_enrollments e ON e.id = lp.enrollment_id
  WHERE p.is_active = true
    AND lp.submitted_for_validation_at IS NOT NULL
    AND coalesce(p.is_verified, false) = true
    AND t.formation_program IN ('ccp','discipleship','mentoring')
    AND e.user_id = p.id
    AND public.can_validate_formation_member(p.id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.member_lesson_attempts a
      WHERE a.user_id = p.id
        AND a.lesson_id = l.id
        AND a.reset_at IS NULL
        AND a.review_status = 'approved'
    )
  ORDER BY lp.submitted_for_validation_at, p.full_name, t.title, l.lesson_number;
END;
$function$;

CREATE OR REPLACE FUNCTION public.pastor_validate_learning_progress_v2(
  p_progress_id uuid,
  p_pastor_note text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  actor uuid := auth.uid();
  rec record;
  attempt_id uuid;
  legacy_pending_id uuid;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT lp.id, lp.user_id, lp.lesson_id
  INTO rec
  FROM public.lesson_progress lp
  JOIN public.learning_lessons l ON l.id = lp.lesson_id
  JOIN public.learning_tracks t ON t.id = l.track_id
  WHERE lp.id = p_progress_id
    AND lp.submitted_for_validation_at IS NOT NULL
    AND t.formation_program IN ('ccp','discipleship','mentoring');

  IF rec.id IS NULL THEN
    RAISE EXCEPTION 'Formation learning progress not found';
  END IF;

  IF NOT public.can_validate_formation_member(rec.user_id) THEN
    RAISE EXCEPTION 'Only the learner''s Cluster Admin can approve this completion';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.member_lesson_attempts a
    WHERE a.user_id = rec.user_id
      AND a.lesson_id = rec.lesson_id
      AND a.reset_at IS NULL
      AND a.review_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'This lesson is already officially approved';
  END IF;

  SELECT a.id
  INTO legacy_pending_id
  FROM public.member_lesson_attempts a
  WHERE a.user_id = rec.user_id
    AND a.lesson_id = rec.lesson_id
    AND a.reset_at IS NULL
    AND a.review_status = 'pending_admin'
  ORDER BY a.attempt_number DESC
  LIMIT 1;

  IF legacy_pending_id IS NOT NULL THEN
    PERFORM public.admin_review_member_lesson_attempt(
      legacy_pending_id,
      true,
      p_pastor_note
    );
    RETURN legacy_pending_id;
  END IF;

  SELECT public.record_member_lesson_completion(
    rec.user_id,
    rec.lesson_id,
    p_pastor_note
  ) INTO attempt_id;

  RETURN attempt_id;
END;
$function$;
