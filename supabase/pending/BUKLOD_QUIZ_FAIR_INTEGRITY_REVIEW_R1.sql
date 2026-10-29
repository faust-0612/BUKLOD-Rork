-- BUKLOD_QUIZ_FAIR_INTEGRITY_REVIEW_R1
-- DEV CANDIDATE ONLY. DO NOT APPLY WHILE ANY EXAM IS RUNNING.
-- Non-mutating faculty-only recommendations. Never interprets browser telemetry as proof of misconduct.
-- Deliberately does not touch existing scores, attempts, deductions, or automatic-setting RPCs.
CREATE OR REPLACE FUNCTION public.buklod_quiz_integrity_review_suggestions_v1(p_attempt_id uuid)
RETURNS TABLE (
  event_type text,
  occurrence_count integer,
  classification text,
  suggested_points_if_verified numeric,
  maximum_suggested_total_points numeric,
  auto_deduct_allowed boolean,
  finding text,
  first_event_at timestamptz,
  last_event_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  WITH authorized_attempt AS (
    SELECT a.id, coalesce(a.max_score,e.total_points,0)::numeric AS max_score
    FROM public.buklod_quiz_attempts a
    JOIN public.buklod_quiz_exams e ON e.id = a.exam_id
    WHERE a.id = p_attempt_id
      AND e.owner_user_id = (SELECT auth.uid())
      AND public.buklod_quiz_is_examiner((SELECT auth.uid()))
  ), grouped_events AS (
    SELECT c.event_type,c.event_count,c.first_event_at,c.last_event_at
    FROM authorized_attempt t
    CROSS JOIN LATERAL private.buklod_quiz_canonical_integrity_events_v1(t.id) c
    UNION ALL
    SELECT 'WINDOW_BLUR'::text, count(*)::integer,min(ev.created_at),max(ev.created_at)
    FROM authorized_attempt t
    JOIN public.buklod_quiz_events ev ON ev.attempt_id=t.id AND ev.event_type='WINDOW_BLUR'
    HAVING count(*)>0
  )
  SELECT
    g.event_type,
    g.event_count,
    CASE
      WHEN g.event_type IN (
        'WINDOW_BLUR','CONTEXT_MENU_ATTEMPT','TAB_HIDDEN',
        'APP_EXIT_OR_BACKGROUND','USER_LEFT_EXAM','FULLSCREEN_EXIT'
      ) THEN 'OBSERVATION_ONLY'
      WHEN g.event_type='COPY_ATTEMPT' THEN 'REQUIRES_CORROBORATION'
      ELSE 'FACULTY_REVIEW_REQUIRED'
    END::text AS classification,
    CASE
      WHEN g.event_type='DEVTOOLS_SHORTCUT_ATTEMPT' THEN 2
      WHEN g.event_type='SCREEN_CAPTURE_DETECTED' THEN 3
      WHEN g.event_type='SCREENSHOT_ATTEMPT' THEN 2
      WHEN g.event_type='COPY_ATTEMPT' THEN 1
      ELSE 0
    END::numeric AS suggested_points_if_verified,
    least(5::numeric,round(t.max_score*.05,2)) AS maximum_suggested_total_points,
    false AS auto_deduct_allowed,
    CASE
      WHEN g.event_type='WINDOW_BLUR' THEN 'Ordinary notification, keyboard, UI overlay or browser focus change can cause this event. No deduction.'
      WHEN g.event_type IN ('APP_EXIT_OR_BACKGROUND','TAB_HIDDEN','FULLSCREEN_EXIT','USER_LEFT_EXAM')
        THEN 'A browser or app context change was observed. Notification, call, connectivity and OS behavior are alternatives. Timeline and student explanation required; no automatic deduction.'
      WHEN g.event_type='CONTEXT_MENU_ATTEMPT'
        THEN 'Long press, text selection, accessibility and mobile browser interaction can trigger this. Do not penalize from event count.'
      WHEN g.event_type='COPY_ATTEMPT'
        THEN 'Copy gesture is not proof that exam content was extracted or used. Independently corroborate before considering the stated one-time cap.'
      WHEN g.event_type='DEVTOOLS_SHORTCUT_ATTEMPT'
        THEN 'A shortcut is not proof DevTools opened. Check browser platform and evidence before any faculty-approved deduction.'
      WHEN g.event_type IN ('SCREEN_CAPTURE_DETECTED','SCREENSHOT_ATTEMPT')
        THEN 'A reported capture signal needs independent verification. Browser logging cannot detect a second phone or prove a screenshot was saved.'
      ELSE 'Telemetry only. No grading action without a documented, independently corroborated finding.'
    END::text AS finding,
    g.first_event_at,g.last_event_at
  FROM authorized_attempt t
  JOIN grouped_events g ON true
  ORDER BY
    CASE WHEN g.event_type IN ('SCREEN_CAPTURE_DETECTED','SCREENSHOT_ATTEMPT','DEVTOOLS_SHORTCUT_ATTEMPT') THEN 0 ELSE 1 END,
    g.event_count DESC,g.event_type;
$function$;
REVOKE ALL ON FUNCTION public.buklod_quiz_integrity_review_suggestions_v1(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_integrity_review_suggestions_v1(uuid) TO authenticated;
-- In the Quiz faculty UI show these as PROPOSALS; original Auto Set v3 remains unsafe until replaced after active exams.
-- Default recommended actual deduction = 0. Only faculty may confirm findings after checking timestamps, context,
-- student explanation and independent evidence. Never deduct once per raw UI event.
