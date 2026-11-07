-- Quiz 19 historical tables -> Main column types. READ-ONLY.
-- Extra Main columns with defaults must be handled on INSERT, not this cast.
-- All 19 source table payloads are materialized and encoded; a cast error
-- aborts the SELECT before return. No DB writes.
BEGIN READ ONLY;
SET LOCAL statement_timeout='90000ms';
SELECT 'buklod_quiz_attempt_allowances'::text AS source_table,
count(*)::bigint source_rows,
coalesce(sum(octet_length(to_jsonb(casted)::text)),0)::bigint inspected_encoded_bytes
FROM quiz_migration.buklod_quiz_raw_v1 r
CROSS JOIN LATERAL jsonb_populate_record(NULL::public.buklod_quiz_attempt_allowances,r.payload) casted
WHERE r.source_table='buklod_quiz_attempt_allowances'
UNION ALL
SELECT 'buklod_quiz_attempts'::text AS source_table,
count(*)::bigint source_rows,
coalesce(sum(octet_length(to_jsonb(casted)::text)),0)::bigint inspected_encoded_bytes
FROM quiz_migration.buklod_quiz_raw_v1 r
CROSS JOIN LATERAL jsonb_populate_record(NULL::public.buklod_quiz_attempts,r.payload) casted
WHERE r.source_table='buklod_quiz_attempts'
UNION ALL
SELECT 'buklod_quiz_audit_log'::text AS source_table,
count(*)::bigint source_rows,
coalesce(sum(octet_length(to_jsonb(casted)::text)),0)::bigint inspected_encoded_bytes
FROM quiz_migration.buklod_quiz_raw_v1 r
CROSS JOIN LATERAL jsonb_populate_record(NULL::public.buklod_quiz_audit_log,r.payload) casted
WHERE r.source_table='buklod_quiz_audit_log'
UNION ALL
SELECT 'buklod_quiz_documents'::text AS source_table,
count(*)::bigint source_rows,
coalesce(sum(octet_length(to_jsonb(casted)::text)),0)::bigint inspected_encoded_bytes
FROM quiz_migration.buklod_quiz_raw_v1 r
CROSS JOIN LATERAL jsonb_populate_record(NULL::public.buklod_quiz_documents,r.payload) casted
WHERE r.source_table='buklod_quiz_documents'
UNION ALL
SELECT 'buklod_quiz_events'::text AS source_table,
count(*)::bigint source_rows,
coalesce(sum(octet_length(to_jsonb(casted)::text)),0)::bigint inspected_encoded_bytes
FROM quiz_migration.buklod_quiz_raw_v1 r
CROSS JOIN LATERAL jsonb_populate_record(NULL::public.buklod_quiz_events,r.payload) casted
WHERE r.source_table='buklod_quiz_events'
UNION ALL
SELECT 'buklod_quiz_examiner_roles'::text AS source_table,
count(*)::bigint source_rows,
coalesce(sum(octet_length(to_jsonb(casted)::text)),0)::bigint inspected_encoded_bytes
FROM quiz_migration.buklod_quiz_raw_v1 r
CROSS JOIN LATERAL jsonb_populate_record(NULL::public.buklod_quiz_examiner_roles,r.payload) casted
WHERE r.source_table='buklod_quiz_examiner_roles'
UNION ALL
SELECT 'buklod_quiz_exams'::text AS source_table,
count(*)::bigint source_rows,
coalesce(sum(octet_length(to_jsonb(casted)::text)),0)::bigint inspected_encoded_bytes
FROM quiz_migration.buklod_quiz_raw_v1 r
CROSS JOIN LATERAL jsonb_populate_record(NULL::public.buklod_quiz_exams,r.payload) casted
WHERE r.source_table='buklod_quiz_exams'
UNION ALL
SELECT 'buklod_quiz_integrity_deduction_rules'::text AS source_table,
count(*)::bigint source_rows,
coalesce(sum(octet_length(to_jsonb(casted)::text)),0)::bigint inspected_encoded_bytes
FROM quiz_migration.buklod_quiz_raw_v1 r
CROSS JOIN LATERAL jsonb_populate_record(NULL::public.buklod_quiz_integrity_deduction_rules,r.payload) casted
WHERE r.source_table='buklod_quiz_integrity_deduction_rules'
UNION ALL
SELECT 'buklod_quiz_live_members'::text AS source_table,
count(*)::bigint source_rows,
coalesce(sum(octet_length(to_jsonb(casted)::text)),0)::bigint inspected_encoded_bytes
FROM quiz_migration.buklod_quiz_raw_v1 r
CROSS JOIN LATERAL jsonb_populate_record(NULL::public.buklod_quiz_live_members,r.payload) casted
WHERE r.source_table='buklod_quiz_live_members'
UNION ALL
SELECT 'buklod_quiz_live_sessions'::text AS source_table,
count(*)::bigint source_rows,
coalesce(sum(octet_length(to_jsonb(casted)::text)),0)::bigint inspected_encoded_bytes
FROM quiz_migration.buklod_quiz_raw_v1 r
CROSS JOIN LATERAL jsonb_populate_record(NULL::public.buklod_quiz_live_sessions,r.payload) casted
WHERE r.source_table='buklod_quiz_live_sessions'
UNION ALL
SELECT 'buklod_quiz_main_entry_gate'::text AS source_table,
count(*)::bigint source_rows,
coalesce(sum(octet_length(to_jsonb(casted)::text)),0)::bigint inspected_encoded_bytes
FROM quiz_migration.buklod_quiz_raw_v1 r
CROSS JOIN LATERAL jsonb_populate_record(NULL::public.buklod_quiz_main_entry_gate,r.payload) casted
WHERE r.source_table='buklod_quiz_main_entry_gate'
UNION ALL
SELECT 'buklod_quiz_offline_leases'::text AS source_table,
count(*)::bigint source_rows,
coalesce(sum(octet_length(to_jsonb(casted)::text)),0)::bigint inspected_encoded_bytes
FROM quiz_migration.buklod_quiz_raw_v1 r
CROSS JOIN LATERAL jsonb_populate_record(NULL::public.buklod_quiz_offline_leases,r.payload) casted
WHERE r.source_table='buklod_quiz_offline_leases'
UNION ALL
SELECT 'buklod_quiz_questions'::text AS source_table,
count(*)::bigint source_rows,
coalesce(sum(octet_length(to_jsonb(casted)::text)),0)::bigint inspected_encoded_bytes
FROM quiz_migration.buklod_quiz_raw_v1 r
CROSS JOIN LATERAL jsonb_populate_record(NULL::public.buklod_quiz_questions,r.payload) casted
WHERE r.source_table='buklod_quiz_questions'
UNION ALL
SELECT 'buklod_quiz_release_preferences'::text AS source_table,
count(*)::bigint source_rows,
coalesce(sum(octet_length(to_jsonb(casted)::text)),0)::bigint inspected_encoded_bytes
FROM quiz_migration.buklod_quiz_raw_v1 r
CROSS JOIN LATERAL jsonb_populate_record(NULL::public.buklod_quiz_release_preferences,r.payload) casted
WHERE r.source_table='buklod_quiz_release_preferences'
UNION ALL
SELECT 'buklod_quiz_responses'::text AS source_table,
count(*)::bigint source_rows,
coalesce(sum(octet_length(to_jsonb(casted)::text)),0)::bigint inspected_encoded_bytes
FROM quiz_migration.buklod_quiz_raw_v1 r
CROSS JOIN LATERAL jsonb_populate_record(NULL::public.buklod_quiz_responses,r.payload) casted
WHERE r.source_table='buklod_quiz_responses'
UNION ALL
SELECT 'buklod_quiz_review_jobs'::text AS source_table,
count(*)::bigint source_rows,
coalesce(sum(octet_length(to_jsonb(casted)::text)),0)::bigint inspected_encoded_bytes
FROM quiz_migration.buklod_quiz_raw_v1 r
CROSS JOIN LATERAL jsonb_populate_record(NULL::public.buklod_quiz_review_jobs,r.payload) casted
WHERE r.source_table='buklod_quiz_review_jobs'
UNION ALL
SELECT 'buklod_quiz_review_suggestions'::text AS source_table,
count(*)::bigint source_rows,
coalesce(sum(octet_length(to_jsonb(casted)::text)),0)::bigint inspected_encoded_bytes
FROM quiz_migration.buklod_quiz_raw_v1 r
CROSS JOIN LATERAL jsonb_populate_record(NULL::public.buklod_quiz_review_suggestions,r.payload) casted
WHERE r.source_table='buklod_quiz_review_suggestions'
UNION ALL
SELECT 'buklod_quiz_roster'::text AS source_table,
count(*)::bigint source_rows,
coalesce(sum(octet_length(to_jsonb(casted)::text)),0)::bigint inspected_encoded_bytes
FROM quiz_migration.buklod_quiz_raw_v1 r
CROSS JOIN LATERAL jsonb_populate_record(NULL::public.buklod_quiz_roster,r.payload) casted
WHERE r.source_table='buklod_quiz_roster'
UNION ALL
SELECT 'buklod_quiz_sections'::text AS source_table,
count(*)::bigint source_rows,
coalesce(sum(octet_length(to_jsonb(casted)::text)),0)::bigint inspected_encoded_bytes
FROM quiz_migration.buklod_quiz_raw_v1 r
CROSS JOIN LATERAL jsonb_populate_record(NULL::public.buklod_quiz_sections,r.payload) casted
WHERE r.source_table='buklod_quiz_sections';
COMMIT;
