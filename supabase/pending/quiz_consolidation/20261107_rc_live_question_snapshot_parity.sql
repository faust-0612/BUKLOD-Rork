-- BUKLOD Quiz R10 Main DB live-question snapshot alignment.
-- DEV-ONLY pending migration, NOT APPLIED to Production or Main.
-- Requires an isolated RC with seeded 200-question/100-selected exam test,
-- mobile offline-resume, submit/review parity, and full identity reconciliation.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.buklod_quiz_attempt_questions') IS NULL
    OR to_regclass('public.buklod_quiz_live_question_snapshots') IS NULL
    OR to_regclass('public.buklod_quiz_responses') IS NULL
    OR to_regprocedure('public.buklod_quiz_live_start_attempt_v3_core(uuid,text)') IS NULL
    OR to_regprocedure('public.buklod_quiz_seed_attempt_questions_v2(uuid)') IS NULL
    OR to_regprocedure('public.buklod_quiz_student_questions_v1(uuid)') IS NULL
  THEN
    RAISE EXCEPTION 'R10 Main DB snapshot implementation missing; abort';
  END IF;
  IF NOT EXISTS(
      SELECT 1 FROM pg_class
      WHERE oid='public.buklod_quiz_attempt_questions'::regclass
        AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'R10 Main DB attempt question snapshot must keep RLS enabled';
  END IF;
END
$preflight$;

-- Main already contains the newer validated start/seed implementation
-- v3_core + public.buklod_quiz_attempt_questions. The existing v3 wrapper
-- called legacy v1 and displayed the whole bank. Preserve the existing
-- expired-attempt grace branch, but route new attempts through v3_core.
CREATE OR REPLACE FUNCTION public.buklod_quiz_live_start_attempt_v3(
  p_session_id uuid,
  p_device_token text DEFAULT NULL::text
)
RETURNS TABLE(
  attempt_id uuid,
  status text,
  expires_at timestamptz,
  duration_minutes integer,
  one_question_at_a_time boolean,
  no_backtracking boolean,
  section_id uuid,
  section_name text,
  question_count integer,
  total_score_target numeric,
  randomize_choices boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $body$
DECLARE
  a public.buklod_quiz_attempts%ROWTYPE;
BEGIN
  SELECT x.* INTO a
    FROM public.buklod_quiz_attempts x
   WHERE x.live_session_id=p_session_id
     AND x.student_user_id=(SELECT auth.uid())
     AND x.status='STARTED'
   ORDER BY x.attempt_no DESC LIMIT 1;

  IF a.id IS NOT NULL
     AND a.expires_at <= now()
     AND (
       now() <= a.expires_at + interval '2 minutes'
       OR EXISTS(
         SELECT 1 FROM public.buklod_quiz_offline_leases l
         WHERE l.attempt_id=a.id
           AND l.student_user_id=(SELECT auth.uid())
           AND l.used_at IS NULL
           AND l.sync_grace_expires_at > now()
       )
     )
  THEN
    -- Idempotently align any legacy Main attempt to its frozen live snapshot.
    PERFORM public.buklod_quiz_seed_attempt_questions_v2(a.id);

    INSERT INTO public.buklod_quiz_events(
      attempt_id,student_user_id,event_type,event_data
    )
    SELECT a.id,a.student_user_id,'EXPIRED_ATTEMPT_RECOVERY_WINDOW_OPEN',
           jsonb_build_object(
             'expires_at',a.expires_at,'opened_at',now(),'source','LIVE_START_V3'
           )
    WHERE NOT EXISTS(
      SELECT 1 FROM public.buklod_quiz_events e
      WHERE e.attempt_id=a.id
        AND e.event_type='EXPIRED_ATTEMPT_RECOVERY_WINDOW_OPEN'
    );

    RETURN QUERY
    SELECT a.id,a.status,a.expires_at,
      e.duration_minutes,e.one_question_at_a_time,e.no_backtracking,
      ls.section_id,sec.name::text,
      COALESCE(
        NULLIF((SELECT count(*)::integer
                FROM public.buklod_quiz_attempt_questions aq
                WHERE aq.attempt_id=a.id),0),
        NULLIF(ls.question_count,0),
        (SELECT count(*)::integer FROM public.buklod_quiz_questions q
         WHERE q.exam_id=ls.exam_id AND q.is_active=true)
      ),
      COALESCE(
        (SELECT sum(aq.points) FROM public.buklod_quiz_attempt_questions aq
         WHERE aq.attempt_id=a.id),ls.total_score_target,e.total_points
      )::numeric,
      false
    FROM public.buklod_quiz_live_sessions ls
    JOIN public.buklod_quiz_sections sec ON sec.id=ls.section_id
      AND sec.exam_id=ls.exam_id
    JOIN public.buklod_quiz_exams e ON e.id=ls.exam_id
    WHERE ls.id=p_session_id;
    RETURN;
  END IF;

  RETURN QUERY
  WITH started AS (
    SELECT * FROM public.buklod_quiz_live_start_attempt_v3_core(
      p_session_id,p_device_token
    )
  )
  SELECT started.attempt_id,started.status,started.expires_at,
    started.duration_minutes,started.one_question_at_a_time,
    started.no_backtracking,started.section_id,started.section_name,
    COALESCE(
      NULLIF((SELECT count(*)::integer
              FROM public.buklod_quiz_attempt_questions aq
              WHERE aq.attempt_id=started.attempt_id),0),
      NULLIF(ls.question_count,0),
      (SELECT count(*)::integer FROM public.buklod_quiz_live_question_snapshots q
       WHERE q.session_id=ls.id)
    ),
    COALESCE(
      (SELECT sum(aq.points) FROM public.buklod_quiz_attempt_questions aq
       WHERE aq.attempt_id=started.attempt_id),
      ls.total_score_target,e.total_points
    )::numeric,
    false
  FROM started
  JOIN public.buklod_quiz_live_sessions ls ON ls.id=p_session_id
  JOIN public.buklod_quiz_exams e ON e.id=ls.exam_id;
END
$body$;

-- R10 exam client calls this existing function name.
-- If a frozen assignment exists, show *only* those questions and points.
-- If a legacy attempt lacks assignment, keep a compatible fallback.
-- Student authorization and old section-archive behavior remain intact.
CREATE OR REPLACE FUNCTION public.buklod_quiz_student_questions_v1(
  p_attempt_id uuid
)
RETURNS TABLE(
  question_id uuid,
  question_type text,
  prompt text,
  options jsonb,
  points numeric,
  display_order integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $body$
  WITH a AS (
    SELECT x.id,x.exam_id,x.live_session_id,e.randomize_questions
    FROM public.buklod_quiz_attempts x
    JOIN public.buklod_quiz_sections sx
      ON sx.id=x.section_id AND sx.archived_at IS NULL
    JOIN public.buklod_quiz_exams e ON e.id=x.exam_id
    WHERE x.id=p_attempt_id
      AND x.student_user_id=(SELECT auth.uid())
      AND x.status='STARTED'
  ),
  assigned AS (
    SELECT aq.question_id,
      COALESCE(snap.question_type,q.question_type)::text question_type,
      COALESCE(snap.prompt,q.prompt)::text prompt,
      COALESCE(snap.options,q.options) options,
      aq.points::numeric points,
      aq.display_order::integer display_order
    FROM a
    JOIN public.buklod_quiz_attempt_questions aq ON aq.attempt_id=a.id
    JOIN public.buklod_quiz_questions q ON q.id=aq.question_id
    LEFT JOIN public.buklod_quiz_live_question_snapshots snap
      ON snap.session_id=a.live_session_id
     AND snap.question_id=aq.question_id
  ),
  legacy_session AS (
    SELECT snap.question_id,snap.question_type::text,snap.prompt::text,
      snap.options,snap.points::numeric,
      row_number() OVER(
        ORDER BY
          CASE WHEN a.randomize_questions THEN
            md5(snap.question_id::text||':'||a.id::text)
          ELSE lpad(snap.snapshot_order::text,12,'0') END,
          snap.question_id
      )::integer AS display_order
    FROM a JOIN public.buklod_quiz_live_question_snapshots snap
      ON snap.session_id=a.live_session_id
    WHERE NOT EXISTS(
      SELECT 1 FROM public.buklod_quiz_attempt_questions aq
      WHERE aq.attempt_id=a.id
    )
  ),
  legacy_bank AS (
    SELECT q.id AS question_id,q.question_type::text,q.prompt::text,
      q.options,q.points::numeric,
      row_number() OVER(
        ORDER BY CASE WHEN a.randomize_questions THEN
          md5(q.id::text||':'||a.id::text)
        ELSE lpad(q.sort_order::text,12,'0') END,q.id
      )::integer AS display_order
    FROM a JOIN public.buklod_quiz_questions q
      ON q.exam_id=a.exam_id AND q.is_active=true
    WHERE NOT EXISTS(
      SELECT 1 FROM public.buklod_quiz_attempt_questions aq
      WHERE aq.attempt_id=a.id
    )
    AND NOT EXISTS(
      SELECT 1 FROM public.buklod_quiz_live_question_snapshots snap
      WHERE snap.session_id=a.live_session_id
    )
  )
  SELECT * FROM assigned
  UNION ALL SELECT * FROM legacy_session
  UNION ALL SELECT * FROM legacy_bank
  ORDER BY display_order,question_id
$body$;

-- Prevent an attempt with a locked question snapshot from accepting answers
-- to questions never assigned to this attempt. Preserve historical attempts
-- without snapshot assignments, for safe reconciliation.
CREATE OR REPLACE FUNCTION private.buklod_quiz_validate_response_assignment_rc_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $body$
BEGIN
  IF EXISTS(
    SELECT 1 FROM public.buklod_quiz_attempt_questions aq
    WHERE aq.attempt_id=NEW.attempt_id
  ) AND NOT EXISTS(
    SELECT 1 FROM public.buklod_quiz_attempt_questions aq
    WHERE aq.attempt_id=NEW.attempt_id
      AND aq.question_id=NEW.question_id
  ) THEN
    RAISE EXCEPTION 'This question is not assigned to the current attempt.';
  END IF;
  RETURN NEW;
END
$body$;

REVOKE ALL ON FUNCTION private.buklod_quiz_validate_response_assignment_rc_v1()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS buklod_quiz_validate_response_assignment_rc_v1
  ON public.buklod_quiz_responses;
CREATE TRIGGER buklod_quiz_validate_response_assignment_rc_v1
  BEFORE INSERT OR UPDATE OF attempt_id,question_id,answer
  ON public.buklod_quiz_responses
  FOR EACH ROW
  EXECUTE FUNCTION private.buklod_quiz_validate_response_assignment_rc_v1();

DO $verify$
BEGIN
  IF position('buklod_quiz_live_start_attempt_v3_core'
      IN pg_get_functiondef(
        'public.buklod_quiz_live_start_attempt_v3(uuid,text)'::regprocedure)
     )=0
    OR position('buklod_quiz_attempt_questions'
      IN pg_get_functiondef(
        'public.buklod_quiz_student_questions_v1(uuid)'::regprocedure)
      )=0
    OR NOT EXISTS(
      SELECT 1 FROM pg_trigger
      WHERE tgrelid='public.buklod_quiz_responses'::regclass
        AND tgname='buklod_quiz_validate_response_assignment_rc_v1'
        AND NOT tgisinternal
    )
  THEN
    RAISE EXCEPTION 'R10 Main DB question snapshot parity verification failed';
  END IF;
END
$verify$;

COMMIT;
