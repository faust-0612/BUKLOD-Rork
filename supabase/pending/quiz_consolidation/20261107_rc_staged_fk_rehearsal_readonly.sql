-- BUKLOD QUIZ | 2026-11-07 staged FK consistency audit
-- READ-ONLY. Does not alter any Main tables or Dedicated source data.
-- Run after the latest source mirror and before any RC import.
-- Every broken_links must equal 0; does NOT replace Auth FK or
-- Storage SHA validation. Parent UUID lookup uses indexed row_key.
-- Group 1/4; independently bounded statement
BEGIN READ ONLY;
SET LOCAL statement_timeout='30000ms';
SELECT 'buklod_quiz_attempt_allowances_live_session_id_fkey'::text check_name, count(*) FILTER(WHERE nullif(c.payload->>'live_session_id','') IS NOT NULL)::bigint checked_links,
 count(*) FILTER(WHERE (nullif(c.payload->>'live_session_id','') IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM quiz_migration.buklod_quiz_raw_v1 p WHERE p.source_table='buklod_quiz_live_sessions' AND p.row_key=jsonb_build_array(c.payload->>'live_session_id')::text))::bigint broken_links
 FROM quiz_migration.buklod_quiz_raw_v1 c WHERE c.source_table='buklod_quiz_attempt_allowances'
UNION ALL
SELECT 'buklod_quiz_attempts_exam_id_fkey'::text check_name, count(*) FILTER(WHERE nullif(c.payload->>'exam_id','') IS NOT NULL)::bigint checked_links,
 count(*) FILTER(WHERE (nullif(c.payload->>'exam_id','') IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM quiz_migration.buklod_quiz_raw_v1 p WHERE p.source_table='buklod_quiz_exams' AND p.row_key=jsonb_build_array(c.payload->>'exam_id')::text))::bigint broken_links
 FROM quiz_migration.buklod_quiz_raw_v1 c WHERE c.source_table='buklod_quiz_attempts'
UNION ALL
SELECT 'buklod_quiz_attempts_live_session_scope_fkey'::text check_name, count(*) FILTER(WHERE nullif(c.payload->>'live_session_id','') IS NOT NULL AND nullif(c.payload->>'exam_id','') IS NOT NULL AND nullif(c.payload->>'section_id','') IS NOT NULL)::bigint checked_links,
 count(*) FILTER(WHERE (nullif(c.payload->>'live_session_id','') IS NOT NULL AND nullif(c.payload->>'exam_id','') IS NOT NULL AND nullif(c.payload->>'section_id','') IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM quiz_migration.buklod_quiz_raw_v1 p WHERE p.source_table='buklod_quiz_live_sessions' AND p.payload->>'id'=c.payload->>'live_session_id' AND p.payload->>'exam_id'=c.payload->>'exam_id' AND p.payload->>'section_id'=c.payload->>'section_id'))::bigint broken_links
 FROM quiz_migration.buklod_quiz_raw_v1 c WHERE c.source_table='buklod_quiz_attempts'
UNION ALL
SELECT 'buklod_quiz_attempts_section_id_fkey'::text check_name, count(*) FILTER(WHERE nullif(c.payload->>'section_id','') IS NOT NULL)::bigint checked_links,
 count(*) FILTER(WHERE (nullif(c.payload->>'section_id','') IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM quiz_migration.buklod_quiz_raw_v1 p WHERE p.source_table='buklod_quiz_sections' AND p.row_key=jsonb_build_array(c.payload->>'section_id')::text))::bigint broken_links
 FROM quiz_migration.buklod_quiz_raw_v1 c WHERE c.source_table='buklod_quiz_attempts'
UNION ALL
SELECT 'buklod_quiz_documents_exam_id_fkey'::text check_name, count(*) FILTER(WHERE nullif(c.payload->>'exam_id','') IS NOT NULL)::bigint checked_links,
 count(*) FILTER(WHERE (nullif(c.payload->>'exam_id','') IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM quiz_migration.buklod_quiz_raw_v1 p WHERE p.source_table='buklod_quiz_exams' AND p.row_key=jsonb_build_array(c.payload->>'exam_id')::text))::bigint broken_links
 FROM quiz_migration.buklod_quiz_raw_v1 c WHERE c.source_table='buklod_quiz_documents'
UNION ALL
SELECT 'buklod_quiz_events_attempt_id_fkey'::text check_name, count(*) FILTER(WHERE nullif(c.payload->>'attempt_id','') IS NOT NULL)::bigint checked_links,
 count(*) FILTER(WHERE (nullif(c.payload->>'attempt_id','') IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM quiz_migration.buklod_quiz_raw_v1 p WHERE p.source_table='buklod_quiz_attempts' AND p.row_key=jsonb_build_array(c.payload->>'attempt_id')::text))::bigint broken_links
 FROM quiz_migration.buklod_quiz_raw_v1 c WHERE c.source_table='buklod_quiz_events';
COMMIT;

-- Group 2/4; independently bounded statement
BEGIN READ ONLY;
SET LOCAL statement_timeout='30000ms';
SELECT 'buklod_quiz_live_members_session_id_fkey'::text check_name, count(*) FILTER(WHERE nullif(c.payload->>'session_id','') IS NOT NULL)::bigint checked_links,
 count(*) FILTER(WHERE (nullif(c.payload->>'session_id','') IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM quiz_migration.buklod_quiz_raw_v1 p WHERE p.source_table='buklod_quiz_live_sessions' AND p.row_key=jsonb_build_array(c.payload->>'session_id')::text))::bigint broken_links
 FROM quiz_migration.buklod_quiz_raw_v1 c WHERE c.source_table='buklod_quiz_live_members'
UNION ALL
SELECT 'buklod_quiz_live_sessions_exam_id_fkey'::text check_name, count(*) FILTER(WHERE nullif(c.payload->>'exam_id','') IS NOT NULL)::bigint checked_links,
 count(*) FILTER(WHERE (nullif(c.payload->>'exam_id','') IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM quiz_migration.buklod_quiz_raw_v1 p WHERE p.source_table='buklod_quiz_exams' AND p.row_key=jsonb_build_array(c.payload->>'exam_id')::text))::bigint broken_links
 FROM quiz_migration.buklod_quiz_raw_v1 c WHERE c.source_table='buklod_quiz_live_sessions'
UNION ALL
SELECT 'buklod_quiz_live_sessions_exam_section_fkey'::text check_name, count(*) FILTER(WHERE nullif(c.payload->>'exam_id','') IS NOT NULL AND nullif(c.payload->>'section_id','') IS NOT NULL)::bigint checked_links,
 count(*) FILTER(WHERE (nullif(c.payload->>'exam_id','') IS NOT NULL AND nullif(c.payload->>'section_id','') IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM quiz_migration.buklod_quiz_raw_v1 p WHERE p.source_table='buklod_quiz_sections' AND p.payload->>'exam_id'=c.payload->>'exam_id' AND p.payload->>'id'=c.payload->>'section_id'))::bigint broken_links
 FROM quiz_migration.buklod_quiz_raw_v1 c WHERE c.source_table='buklod_quiz_live_sessions'
UNION ALL
SELECT 'buklod_quiz_live_sessions_section_id_fkey'::text check_name, count(*) FILTER(WHERE nullif(c.payload->>'section_id','') IS NOT NULL)::bigint checked_links,
 count(*) FILTER(WHERE (nullif(c.payload->>'section_id','') IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM quiz_migration.buklod_quiz_raw_v1 p WHERE p.source_table='buklod_quiz_sections' AND p.row_key=jsonb_build_array(c.payload->>'section_id')::text))::bigint broken_links
 FROM quiz_migration.buklod_quiz_raw_v1 c WHERE c.source_table='buklod_quiz_live_sessions'
UNION ALL
SELECT 'buklod_quiz_offline_leases_attempt_id_fkey'::text check_name, count(*) FILTER(WHERE nullif(c.payload->>'attempt_id','') IS NOT NULL)::bigint checked_links,
 count(*) FILTER(WHERE (nullif(c.payload->>'attempt_id','') IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM quiz_migration.buklod_quiz_raw_v1 p WHERE p.source_table='buklod_quiz_attempts' AND p.row_key=jsonb_build_array(c.payload->>'attempt_id')::text))::bigint broken_links
 FROM quiz_migration.buklod_quiz_raw_v1 c WHERE c.source_table='buklod_quiz_offline_leases'
UNION ALL
SELECT 'buklod_quiz_questions_source_document_id_fkey'::text check_name, count(*) FILTER(WHERE nullif(c.payload->>'source_document_id','') IS NOT NULL)::bigint checked_links,
 count(*) FILTER(WHERE (nullif(c.payload->>'source_document_id','') IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM quiz_migration.buklod_quiz_raw_v1 p WHERE p.source_table='buklod_quiz_documents' AND p.row_key=jsonb_build_array(c.payload->>'source_document_id')::text))::bigint broken_links
 FROM quiz_migration.buklod_quiz_raw_v1 c WHERE c.source_table='buklod_quiz_questions';
COMMIT;

-- Group 3/4; independently bounded statement
BEGIN READ ONLY;
SET LOCAL statement_timeout='30000ms';
SELECT 'buklod_quiz_questions_exam_id_fkey'::text check_name, count(*) FILTER(WHERE nullif(c.payload->>'exam_id','') IS NOT NULL)::bigint checked_links,
 count(*) FILTER(WHERE (nullif(c.payload->>'exam_id','') IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM quiz_migration.buklod_quiz_raw_v1 p WHERE p.source_table='buklod_quiz_exams' AND p.row_key=jsonb_build_array(c.payload->>'exam_id')::text))::bigint broken_links
 FROM quiz_migration.buklod_quiz_raw_v1 c WHERE c.source_table='buklod_quiz_questions'
UNION ALL
SELECT 'buklod_quiz_release_preferences_attempt_id_fkey'::text check_name, count(*) FILTER(WHERE nullif(c.payload->>'attempt_id','') IS NOT NULL)::bigint checked_links,
 count(*) FILTER(WHERE (nullif(c.payload->>'attempt_id','') IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM quiz_migration.buklod_quiz_raw_v1 p WHERE p.source_table='buklod_quiz_attempts' AND p.row_key=jsonb_build_array(c.payload->>'attempt_id')::text))::bigint broken_links
 FROM quiz_migration.buklod_quiz_raw_v1 c WHERE c.source_table='buklod_quiz_release_preferences'
UNION ALL
SELECT 'buklod_quiz_responses_attempt_id_fkey'::text check_name, count(*) FILTER(WHERE nullif(c.payload->>'attempt_id','') IS NOT NULL)::bigint checked_links,
 count(*) FILTER(WHERE (nullif(c.payload->>'attempt_id','') IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM quiz_migration.buklod_quiz_raw_v1 p WHERE p.source_table='buklod_quiz_attempts' AND p.row_key=jsonb_build_array(c.payload->>'attempt_id')::text))::bigint broken_links
 FROM quiz_migration.buklod_quiz_raw_v1 c WHERE c.source_table='buklod_quiz_responses'
UNION ALL
SELECT 'buklod_quiz_responses_question_id_fkey'::text check_name, count(*) FILTER(WHERE nullif(c.payload->>'question_id','') IS NOT NULL)::bigint checked_links,
 count(*) FILTER(WHERE (nullif(c.payload->>'question_id','') IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM quiz_migration.buklod_quiz_raw_v1 p WHERE p.source_table='buklod_quiz_questions' AND p.row_key=jsonb_build_array(c.payload->>'question_id')::text))::bigint broken_links
 FROM quiz_migration.buklod_quiz_raw_v1 c WHERE c.source_table='buklod_quiz_responses'
UNION ALL
SELECT 'buklod_quiz_review_jobs_exam_id_fkey'::text check_name, count(*) FILTER(WHERE nullif(c.payload->>'exam_id','') IS NOT NULL)::bigint checked_links,
 count(*) FILTER(WHERE (nullif(c.payload->>'exam_id','') IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM quiz_migration.buklod_quiz_raw_v1 p WHERE p.source_table='buklod_quiz_exams' AND p.row_key=jsonb_build_array(c.payload->>'exam_id')::text))::bigint broken_links
 FROM quiz_migration.buklod_quiz_raw_v1 c WHERE c.source_table='buklod_quiz_review_jobs'
UNION ALL
SELECT 'buklod_quiz_review_jobs_section_id_fkey'::text check_name, count(*) FILTER(WHERE nullif(c.payload->>'section_id','') IS NOT NULL)::bigint checked_links,
 count(*) FILTER(WHERE (nullif(c.payload->>'section_id','') IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM quiz_migration.buklod_quiz_raw_v1 p WHERE p.source_table='buklod_quiz_sections' AND p.row_key=jsonb_build_array(c.payload->>'section_id')::text))::bigint broken_links
 FROM quiz_migration.buklod_quiz_raw_v1 c WHERE c.source_table='buklod_quiz_review_jobs';
COMMIT;

-- Group 4/4; independently bounded statement
BEGIN READ ONLY;
SET LOCAL statement_timeout='30000ms';
SELECT 'buklod_quiz_review_suggestions_attempt_id_fkey'::text check_name, count(*) FILTER(WHERE nullif(c.payload->>'attempt_id','') IS NOT NULL)::bigint checked_links,
 count(*) FILTER(WHERE (nullif(c.payload->>'attempt_id','') IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM quiz_migration.buklod_quiz_raw_v1 p WHERE p.source_table='buklod_quiz_attempts' AND p.row_key=jsonb_build_array(c.payload->>'attempt_id')::text))::bigint broken_links
 FROM quiz_migration.buklod_quiz_raw_v1 c WHERE c.source_table='buklod_quiz_review_suggestions'
UNION ALL
SELECT 'buklod_quiz_review_suggestions_response_id_fkey'::text check_name, count(*) FILTER(WHERE nullif(c.payload->>'response_id','') IS NOT NULL)::bigint checked_links,
 count(*) FILTER(WHERE (nullif(c.payload->>'response_id','') IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM quiz_migration.buklod_quiz_raw_v1 p WHERE p.source_table='buklod_quiz_responses' AND p.row_key=jsonb_build_array(c.payload->>'response_id')::text))::bigint broken_links
 FROM quiz_migration.buklod_quiz_raw_v1 c WHERE c.source_table='buklod_quiz_review_suggestions'
UNION ALL
SELECT 'buklod_quiz_review_suggestions_job_id_fkey'::text check_name, count(*) FILTER(WHERE nullif(c.payload->>'job_id','') IS NOT NULL)::bigint checked_links,
 count(*) FILTER(WHERE (nullif(c.payload->>'job_id','') IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM quiz_migration.buklod_quiz_raw_v1 p WHERE p.source_table='buklod_quiz_review_jobs' AND p.row_key=jsonb_build_array(c.payload->>'job_id')::text))::bigint broken_links
 FROM quiz_migration.buklod_quiz_raw_v1 c WHERE c.source_table='buklod_quiz_review_suggestions'
UNION ALL
SELECT 'buklod_quiz_roster_exam_id_fkey'::text check_name, count(*) FILTER(WHERE nullif(c.payload->>'exam_id','') IS NOT NULL)::bigint checked_links,
 count(*) FILTER(WHERE (nullif(c.payload->>'exam_id','') IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM quiz_migration.buklod_quiz_raw_v1 p WHERE p.source_table='buklod_quiz_exams' AND p.row_key=jsonb_build_array(c.payload->>'exam_id')::text))::bigint broken_links
 FROM quiz_migration.buklod_quiz_raw_v1 c WHERE c.source_table='buklod_quiz_roster'
UNION ALL
SELECT 'buklod_quiz_roster_section_id_fkey'::text check_name, count(*) FILTER(WHERE nullif(c.payload->>'section_id','') IS NOT NULL)::bigint checked_links,
 count(*) FILTER(WHERE (nullif(c.payload->>'section_id','') IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM quiz_migration.buklod_quiz_raw_v1 p WHERE p.source_table='buklod_quiz_sections' AND p.row_key=jsonb_build_array(c.payload->>'section_id')::text))::bigint broken_links
 FROM quiz_migration.buklod_quiz_raw_v1 c WHERE c.source_table='buklod_quiz_roster'
UNION ALL
SELECT 'buklod_quiz_sections_exam_id_fkey'::text check_name, count(*) FILTER(WHERE nullif(c.payload->>'exam_id','') IS NOT NULL)::bigint checked_links,
 count(*) FILTER(WHERE (nullif(c.payload->>'exam_id','') IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM quiz_migration.buklod_quiz_raw_v1 p WHERE p.source_table='buklod_quiz_exams' AND p.row_key=jsonb_build_array(c.payload->>'exam_id')::text))::bigint broken_links
 FROM quiz_migration.buklod_quiz_raw_v1 c WHERE c.source_table='buklod_quiz_sections';
COMMIT;
