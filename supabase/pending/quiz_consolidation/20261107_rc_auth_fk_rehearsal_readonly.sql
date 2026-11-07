-- BUKLOD Quiz Main Auth FK stage check (read only). No personal data or
-- actual UUID/email is selected; only counts are returned.
-- Two currently unresolved historical identities must remain quarantined;
-- NEVER remap based on names or email without account ownership proof.
BEGIN READ ONLY;
SET LOCAL statement_timeout='25000ms';
WITH expected_auth_fks(source_table,auth_column) AS (
 VALUES
 ('buklod_quiz_attempts','student_user_id'),
 ('buklod_quiz_documents','owner_user_id'),
 ('buklod_quiz_events','student_user_id'),
 ('buklod_quiz_examiner_roles','granted_by'),
 ('buklod_quiz_examiner_roles','user_id'),
 ('buklod_quiz_exams','owner_user_id'),
 ('buklod_quiz_integrity_deductions','applied_by'),
 ('buklod_quiz_questions','created_by'),
 ('buklod_quiz_responses','reviewed_by'),
 ('buklod_quiz_responses','student_user_id'),
 ('buklod_quiz_roster','student_user_id'),
 ('buklod_quiz_section_join_overrides','granted_by'),
 ('buklod_quiz_section_join_overrides','student_user_id')
)
SELECT e.source_table,e.auth_column,
 count(*) FILTER(WHERE nullif(r.payload->>e.auth_column,'') IS NOT NULL)::bigint as non_null_links,
 count(*) FILTER(WHERE nullif(r.payload->>e.auth_column,'') IS NOT NULL AND u.id IS NULL)::bigint as missing_main_user_links,
 count(DISTINCT r.payload->>e.auth_column) FILTER(
   WHERE nullif(r.payload->>e.auth_column,'') IS NOT NULL AND u.id IS NULL
 )::bigint as distinct_unmatched_ids
FROM expected_auth_fks e
LEFT JOIN quiz_migration.buklod_quiz_raw_v1 r ON r.source_table=e.source_table
LEFT JOIN auth.users u ON u.id::text=r.payload->>e.auth_column
GROUP BY e.source_table,e.auth_column
ORDER BY e.source_table,e.auth_column;
COMMIT;
