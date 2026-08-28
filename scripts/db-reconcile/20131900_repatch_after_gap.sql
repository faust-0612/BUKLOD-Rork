-- REPATCH SPLICE: restore live-safe money-retired definitions after conflicting migrations.
-- Excludes admin_review_member_lesson_attempt (formation 20100000 owns that workflow).
-- Does NOT re-drop trigger or repair 20131900 history.

BEGIN;

CREATE OR REPLACE FUNCTION public.buklod_award_verification_bayanihan_v1(
  p_user_id uuid,
  p_amount numeric,
  p_source_type text,
  p_source_key text,
  p_source_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_approved_by uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_internal_credit_bayanihan_v1(
  p_user_id uuid,
  p_amount numeric,
  p_source_type text,
  p_description text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_award_verification_points_v1(
  p_user_id uuid,
  p_points integer,
  p_activity_type text,
  p_source_key text,
  p_source_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_awarded_by uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_points IS NULL OR p_points <= 0 THEN
    RETURN;
  END IF;

  IF trim(coalesce(p_source_key, '')) = '' THEN
    RETURN;
  END IF;

  INSERT INTO public.buklod_points_ledger (
    user_id,
    direction,
    points,
    activity_type,
    source_key,
    source_id,
    description,
    awarded_by
  )
  VALUES (
    p_user_id,
    'credit',
    p_points,
    p_activity_type,
    trim(p_source_key),
    p_source_id,
    nullif(trim(coalesce(p_description, '')), ''),
    p_awarded_by
  )
  ON CONFLICT (user_id, source_key) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_payout_daily_bible_rewards_v1(
  p_submission_id uuid,
  p_user_id uuid,
  p_assignment_id uuid,
  p_bible_reference text,
  p_reading_date date,
  p_approved_by uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_assignment_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM public.buklod_award_rule_mapped_points_v1(
    p_user_id,
    'bible_reading',
    'daily_bible:' || p_user_id::text || ':' || p_assignment_id::text,
    p_submission_id,
    'Daily Bible Reading approved: ' ||
      coalesce(p_bible_reference, 'Reading') ||
      ' (' || coalesce(p_reading_date::text, '') || ')',
    p_approved_by
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_payout_learning_progress_rewards_v1(
  p_attempt_id uuid,
  p_learner_id uuid,
  p_lesson_id uuid,
  p_approver_id uuid,
  p_lesson_title text,
  p_approved_by uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  learner_points integer;
  approver_points integer;
  approver uuid := coalesce(p_approver_id, p_approved_by);
  learner_desc text;
  approver_desc text;
BEGIN
  IF p_attempt_id IS NULL OR p_learner_id IS NULL OR p_lesson_id IS NULL THEN
    RETURN;
  END IF;

  learner_desc :=
    'Learning Progress approved: ' || coalesce(p_lesson_title, 'Lesson');

  approver_desc :=
    'Learning Progress verification: ' || coalesce(p_lesson_title, 'Lesson');

  IF to_regclass('public.buklod_verification_rewards_config') IS NOT NULL THEN
    SELECT c.learner_points, c.approver_points
    INTO learner_points, approver_points
    FROM public.buklod_verification_rewards_config c
    WHERE c.activity_code = 'learning_progress_verification'
      AND c.is_active = true;
  END IF;

  IF learner_points IS NULL THEN
    SELECT r.base_points
    INTO learner_points
    FROM public.buklod_point_rules r
    WHERE r.activity_type IN ('learning_progress_verification', 'formation_lesson')
      AND r.is_active = true
    ORDER BY CASE r.activity_type
      WHEN 'learning_progress_verification' THEN 0
      ELSE 1
    END
    LIMIT 1;
  END IF;

  IF learner_points IS NULL OR learner_points <= 0 THEN
    learner_points := 5;
  END IF;

  IF approver_points IS NULL OR approver_points <= 0 THEN
    approver_points := learner_points;
  END IF;

  PERFORM public.buklod_award_verification_points_v1(
    p_learner_id,
    learner_points,
    'learning_progress_verification',
    'verification:learning:learner:' ||
      p_learner_id::text || ':' || p_attempt_id::text,
    p_attempt_id,
    learner_desc,
    p_approved_by
  );

  IF approver IS NOT NULL AND approver <> p_learner_id THEN
    PERFORM public.buklod_award_verification_points_v1(
      approver,
      approver_points,
      'learning_progress_verification',
      'verification:learning:approver:' ||
        approver::text || ':' || p_attempt_id::text,
      p_attempt_id,
      approver_desc,
      p_approved_by
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_mentoring_completion(
  p_submission_id uuid,
  p_approve boolean,
  p_admin_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := (select auth.uid());
  rec record;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'System administrator access required';
  END IF;

  SELECT
    s.*,
    r.title_fil,
    r.stage_code,
    r.release_number
  INTO rec
  FROM public.mentoring_release_submissions s
  JOIN public.mentoring_lesson_releases r
    ON r.id = s.release_id
  WHERE s.id = p_submission_id
  FOR UPDATE OF s;

  IF rec.id IS NULL THEN
    RAISE EXCEPTION 'Mentoring completion submission not found';
  END IF;

  IF rec.status <> 'pending_admin' THEN
    RAISE EXCEPTION 'This mentoring completion has already been reviewed';
  END IF;

  IF p_approve THEN
    UPDATE public.mentoring_release_submissions
    SET
      status = 'approved',
      reviewed_by = actor,
      reviewed_at = now(),
      admin_note = nullif(trim(coalesce(p_admin_note, '')), ''),
      updated_at = now()
    WHERE id = p_submission_id;

    PERFORM public.buklod_award_rule_mapped_points_v1(
      rec.user_id,
      'mentoring_lesson',
      'mentoring_release:' || rec.user_id::text || ':' || rec.release_id::text,
      rec.id,
      'BUKLOD ' || rec.stage_code::text || ' Mentoring: ' || rec.title_fil,
      actor
    );
  ELSE
    UPDATE public.mentoring_release_submissions
    SET
      status = 'rejected',
      reviewed_by = actor,
      reviewed_at = now(),
      admin_note = nullif(trim(coalesce(p_admin_note, '')), ''),
      updated_at = now()
    WHERE id = p_submission_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_devotional_bayanihan(
  p_submission_id uuid,
  p_approve boolean,
  p_admin_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := (select auth.uid());
  rec record;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'System administrator access required';
  END IF;

  SELECT s.*
  INTO rec
  FROM public.devotional_reward_submissions s
  WHERE s.id = p_submission_id
  FOR UPDATE;

  IF rec.id IS NULL THEN
    RAISE EXCEPTION 'Devotional submission not found';
  END IF;

  IF rec.status <> 'pending_admin' THEN
    RAISE EXCEPTION 'This devotional submission has already been reviewed';
  END IF;

  IF p_approve THEN
    UPDATE public.devotional_reward_submissions
    SET
      status = 'approved',
      reviewed_by = actor,
      reviewed_at = now(),
      admin_note = nullif(trim(coalesce(p_admin_note, '')), '')
    WHERE id = p_submission_id;

    PERFORM public.buklod_award_rule_mapped_points_v1(
      rec.user_id,
      'devotional',
      'devotional:' || rec.user_id::text || ':' || rec.devotional_id::text,
      rec.id,
      'Devotional: ' || rec.devotional_title_snapshot,
      actor
    );
  ELSE
    UPDATE public.devotional_reward_submissions
    SET
      status = 'rejected',
      reviewed_by = actor,
      reviewed_at = now(),
      admin_note = nullif(trim(coalesce(p_admin_note, '')), '')
    WHERE id = p_submission_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_evaluate_buklod_points(
  p_user_id uuid,
  p_period_type text,
  p_period_start date,
  p_period_end date,
  p_performance_score numeric,
  p_bayanihan_bonus numeric,
  p_admin_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := (select auth.uid());
  snapshot bigint := 0;
  evaluation_id uuid;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'System Admin access required';
  END IF;

  IF p_period_type NOT IN ('monthly', 'quarterly', 'custom') THEN
    RAISE EXCEPTION 'Invalid evaluation period type';
  END IF;

  IF p_period_start IS NULL
     OR p_period_end IS NULL
     OR p_period_end < p_period_start THEN
    RAISE EXCEPTION 'Invalid evaluation date range';
  END IF;

  IF p_performance_score IS NOT NULL
     AND (p_performance_score < 0 OR p_performance_score > 100) THEN
    RAISE EXCEPTION 'Performance score must be between 0 and 100';
  END IF;

  IF p_bayanihan_bonus IS NULL OR p_bayanihan_bonus < 0 THEN
    RAISE EXCEPTION 'Bayanihan bonus cannot be negative';
  END IF;

  SELECT coalesce(
    sum(
      case
        when l.direction = 'credit' then l.points
        else -l.points
      end
    ),
    0
  )::bigint
  INTO snapshot
  FROM public.buklod_points_ledger l
  WHERE l.user_id = p_user_id
    AND (l.created_at at time zone 'Asia/Manila')::date
      BETWEEN p_period_start AND p_period_end;

  INSERT INTO public.buklod_points_evaluations (
    user_id,
    period_type,
    period_start,
    period_end,
    points_snapshot,
    performance_score,
    bayanihan_bonus,
    admin_note,
    evaluated_by
  )
  VALUES (
    p_user_id,
    p_period_type,
    p_period_start,
    p_period_end,
    snapshot,
    p_performance_score,
    p_bayanihan_bonus,
    nullif(trim(coalesce(p_admin_note, '')), ''),
    actor
  )
  RETURNING id INTO evaluation_id;

  RETURN evaluation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_daily_bible_submission(
  p_submission_id uuid,
  p_approve boolean,
  p_admin_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  rec record;
  actor_is_admin boolean := public.is_system_admin();
  actor_is_pastor boolean := public.has_app_role(actor, 'pastor');
  actor_is_mentor boolean := public.has_capability(actor, 'mentor');
  actor_is_assigned_mentor boolean := false;
  has_bible_photo boolean := false;
  has_reflection_photo boolean := false;
  valid_question_answers integer := 0;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT
    s.*,
    a.bible_reference,
    a.reading_date
  INTO rec
  FROM public.daily_bible_submissions s
  JOIN public.daily_bible_assignments a ON a.id = s.assignment_id
  WHERE s.id = p_submission_id
  FOR UPDATE OF s;

  IF rec.id IS NULL THEN
    RAISE EXCEPTION 'Bible Reading submission not found';
  END IF;

  IF actor_is_mentor THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.mentor_assignments ma
      WHERE ma.mentor_id = actor
        AND ma.disciple_id = rec.user_id
        AND ma.is_active = true
    )
    INTO actor_is_assigned_mentor;
  END IF;

  IF NOT (
    actor_is_admin
    OR (
      actor_is_pastor
      AND actor <> rec.user_id
      AND public.can_validate_formation_member(rec.user_id)
    )
    OR actor_is_assigned_mentor
  ) THEN
    RAISE EXCEPTION 'You are not authorized to review this Bible Reading';
  END IF;

  IF rec.status <> 'pending_admin' THEN
    RAISE EXCEPTION 'This Bible Reading submission has already been reviewed';
  END IF;

  IF rec.bible_photo_path IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM storage.objects o
      WHERE o.bucket_id = 'daily-bible-evidence'
        AND o.name = rec.bible_photo_path
    )
    INTO has_bible_photo;
  END IF;

  IF rec.reflection_photo_path IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM storage.objects o
      WHERE o.bucket_id = 'daily-bible-evidence'
        AND o.name = rec.reflection_photo_path
    )
    INTO has_reflection_photo;
  END IF;

  IF p_approve THEN
    IF rec.question_answers IS NULL
      OR jsonb_typeof(rec.question_answers) <> 'array'
      OR jsonb_array_length(rec.question_answers) <> 4
    THEN
      RAISE EXCEPTION 'Cannot approve: all four Daily Bible questions must be answered';
    END IF;

    SELECT count(*)
    INTO valid_question_answers
    FROM jsonb_array_elements_text(rec.question_answers) q(answer_value)
    WHERE char_length(trim(q.answer_value)) >= 10;

    IF valid_question_answers <> 4 THEN
      RAISE EXCEPTION 'Cannot approve: all four Daily Bible question answers must be complete';
    END IF;

    IF coalesce(char_length(trim(rec.bible_text)), 0) < 20
      AND NOT has_bible_photo
    THEN
      RAISE EXCEPTION 'Cannot approve: Bible passage evidence is missing';
    END IF;

    IF coalesce(char_length(trim(rec.answer_text)), 0) < 20
      AND NOT has_reflection_photo
    THEN
      RAISE EXCEPTION 'Cannot approve: reflection evidence is missing';
    END IF;

    UPDATE public.daily_bible_submissions
    SET
      status = 'approved',
      reviewed_by = actor,
      reviewed_at = now(),
      admin_note = nullif(trim(coalesce(p_admin_note, '')), '')
    WHERE id = p_submission_id;

    PERFORM public.buklod_payout_daily_bible_rewards_v1(
      rec.id,
      rec.user_id,
      rec.assignment_id,
      rec.bible_reference,
      rec.reading_date,
      actor
    );
  ELSE
    UPDATE public.daily_bible_submissions
    SET
      status = 'rejected',
      reviewed_by = actor,
      reviewed_at = now(),
      admin_note = coalesce(
        nullif(trim(coalesce(p_admin_note, '')), ''),
        'Please revise your Bible questions and/or Personal Reflection, then resubmit.'
      )
    WHERE id = p_submission_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_mentor_session(
  p_session_id uuid,
  p_approve boolean,
  p_admin_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := (select auth.uid());
  rec record;
  description_text text;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'System administrator access required';
  END IF;

  SELECT
    s.*,
    l.title AS lesson_title,
    t.formation_program
  INTO rec
  FROM public.mentor_teaching_sessions s
  JOIN public.learning_lessons l ON l.id = s.lesson_id
  JOIN public.learning_tracks t ON t.id = l.track_id
  WHERE s.id = p_session_id
  FOR UPDATE OF s;

  IF rec.id IS NULL THEN
    RAISE EXCEPTION 'Mentor session not found';
  END IF;

  IF rec.status <> 'pending_admin' THEN
    RAISE EXCEPTION 'Session is not awaiting admin approval';
  END IF;

  IF p_approve THEN
    UPDATE public.mentor_teaching_sessions
    SET
      status = 'approved',
      admin_id = actor,
      admin_reviewed_at = now(),
      admin_note = nullif(trim(coalesce(p_admin_note, '')), '')
    WHERE id = p_session_id;

    description_text :=
      CASE
        WHEN rec.formation_program = 'ccp'
          THEN 'Mentor Session - CCP: ' || rec.lesson_title
        WHEN rec.formation_program = 'discipleship'
          THEN 'Mentor Session - Discipleship: ' || rec.lesson_title
        ELSE 'Mentor Session: ' || rec.lesson_title
      END;

    PERFORM public.buklod_award_rule_mapped_points_v1(
      rec.mentor_id,
      'mentor_session',
      'mentor_session:' || rec.id::text,
      rec.id,
      description_text,
      actor
    );
  ELSE
    UPDATE public.mentor_teaching_sessions
    SET
      status = 'rejected',
      admin_id = actor,
      admin_reviewed_at = now(),
      admin_note = nullif(trim(coalesce(p_admin_note, '')), '')
    WHERE id = p_session_id;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
