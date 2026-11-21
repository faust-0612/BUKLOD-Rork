-- Focused read-only database contract for BUKLOD Quiz PDF/Word AI generation.
-- Generated items use these existing fields; keep compatibility with the dedicated
-- Quiz database. This test changes no data and is not a schema migration.
BEGIN;
DO $quiz_contract$
DECLARE
  missing_count integer;
BEGIN
  WITH expected(table_name, column_name) AS (
    VALUES
      ('buklod_quiz_exams','id'),
      ('buklod_quiz_exams','owner_user_id'),
      ('buklod_quiz_exams','exam_language'),
      ('buklod_quiz_documents','id'),
      ('buklod_quiz_documents','exam_id'),
      ('buklod_quiz_documents','owner_user_id'),
      ('buklod_quiz_documents','storage_path'),
      ('buklod_quiz_documents','mime_type'),
      ('buklod_quiz_questions','id'),
      ('buklod_quiz_questions','exam_id'),
      ('buklod_quiz_questions','prompt'),
      ('buklod_quiz_questions','options'),
      ('buklod_quiz_questions','correct_answer'),
      ('buklod_quiz_questions','explanation'),
      ('buklod_quiz_questions','source_pages'),
      ('buklod_quiz_questions','source_document_id'),
      ('buklod_quiz_questions','is_active'),
      ('buklod_quiz_questions','sort_order'),
      ('buklod_quiz_live_sessions','exam_id'),
      ('buklod_quiz_live_sessions','status'),
      ('buklod_quiz_attempts','exam_id'),
      ('buklod_quiz_attempts','status')
  )
  SELECT count(*) INTO missing_count
  FROM expected e
  LEFT JOIN information_schema.columns c
    ON c.table_schema='public'
   AND c.table_name=e.table_name
   AND c.column_name=e.column_name
  WHERE c.column_name IS NULL;
  IF missing_count > 0 THEN
    RAISE EXCEPTION 'BUKLOD Quiz Edge contract missing % required database columns',missing_count;
  END IF;
END;
$quiz_contract$;
ROLLBACK;
