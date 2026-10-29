-- BUKLOD_QUIZ_ASSESSMENT_ITEM_ANALYSIS_R1
-- DEV ONLY: review / QA before installation; this is a read-only faculty RPC.
-- Scores are descriptive, NEVER proof of cheating.
CREATE OR REPLACE FUNCTION public.buklod_quiz_exam_item_quality_v1(p_exam_id uuid)
RETURNS TABLE (
  question_id uuid,
  question_no integer,
  question_type text,
  answered_count bigint,
  correct_percent numeric,
  discrimination_index numeric,
  item_review_flag text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  WITH authorized_exam AS (
    SELECT e.id FROM public.buklod_quiz_exams e
    WHERE e.id=p_exam_id
      AND e.owner_user_id=(SELECT auth.uid())
      AND public.buklod_quiz_is_examiner((SELECT auth.uid()))
  ), latest AS (
    SELECT DISTINCT ON (a.student_user_id)
      a.id AS attempt_id,a.exam_id,a.student_user_id,
      (coalesce(a.objective_score,0)+coalesce(a.manual_score,0))::numeric AS raw_points
    FROM public.buklod_quiz_attempts a
    JOIN authorized_exam ae ON ae.id=a.exam_id
    WHERE a.status IN ('GRADED','RELEASED')
    ORDER BY a.student_user_id,a.attempt_no DESC,a.created_at DESC
  ), item_samples AS (
    SELECT q.id AS question_id,q.sort_order AS question_no,q.question_type,
      r.is_correct,
      percent_rank() OVER (
        PARTITION BY q.id
        ORDER BY (l.raw_points-coalesce(r.objective_score,r.manual_score,0))
      ) AS adjusted_class_rank
    FROM latest l
    JOIN public.buklod_quiz_questions q ON q.exam_id=l.exam_id AND q.is_active=true
    JOIN public.buklod_quiz_responses r ON r.attempt_id=l.attempt_id AND r.question_id=q.id
    WHERE q.question_type IN ('MCQ','TRUE_FALSE')
      AND r.is_correct IS NOT NULL
  ), per_item AS (
    SELECT s.question_id,s.question_no,s.question_type,
      count(*) AS answered_count,
      round(100*avg((s.is_correct)::int),1) AS correct_percent,
      CASE WHEN count(*) >= 15 THEN round(
        avg((s.is_correct)::int) FILTER (WHERE s.adjusted_class_rank>=.73)
        - avg((s.is_correct)::int) FILTER (WHERE s.adjusted_class_rank<=.27),3
      ) ELSE NULL::numeric END AS discrimination_index
    FROM item_samples s
    GROUP BY s.question_id,s.question_no,s.question_type
  )
  SELECT
    p.question_id,p.question_no,p.question_type,p.answered_count,p.correct_percent,p.discrimination_index,
    CASE
      WHEN p.answered_count<15 THEN 'LOW_SAMPLE_REVIEW_ONLY'
      WHEN p.discrimination_index<0 THEN 'NEGATIVE_DISCRIMINATION_REVIEW_KEY_OR_WORDING'
      WHEN p.correct_percent<20 THEN 'VERY_DIFFICULT_REVIEW_COVERAGE_AND_CLARITY'
      WHEN p.correct_percent>95 THEN 'VERY_EASY_REVIEW_COGNITIVE_TARGET'
      ELSE 'NO_AUTOMATIC_ITEM_FLAG'
    END::text
  FROM per_item p
  ORDER BY p.question_no,p.question_id;
$function$;
REVOKE ALL ON FUNCTION public.buklod_quiz_exam_item_quality_v1(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_exam_item_quality_v1(uuid) TO authenticated;
-- Faculty action: examine flagged items, source citation, alternative answers and student feedback.
-- Never auto-change an answer key, grade, or accuse an individual based on this heuristic.
