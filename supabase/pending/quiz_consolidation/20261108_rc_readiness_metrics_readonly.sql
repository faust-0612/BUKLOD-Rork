-- BUKLOD Quiz RC readiness — aggregate-only, read-only evidence.
-- DO NOT treat PASS as sufficient for release: identity/SSO, end-user RLS,
-- storage bytes, build/runtime parity, exam E2E and rollback are separate gates.
-- Target ONLY: Main BUKLOD Connect (yhanxndaqbmuzbdqlblu).
BEGIN READ ONLY;
WITH
staged AS (
 SELECT count(*) FILTER (WHERE source_table='buklod_quiz_attempts')::bigint attempts,
        count(*) FILTER (WHERE source_table='buklod_quiz_responses')::bigint responses
 FROM quiz_migration.buklod_quiz_raw_v1
),
live AS (
 SELECT (SELECT count(*) FROM public.buklod_quiz_attempts)::bigint attempts,
        (SELECT count(*) FROM public.buklod_quiz_responses)::bigint responses
),
auth_link_columns(tbl,col) AS (
 VALUES ('buklod_quiz_attempts','student_user_id'),
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
),
auth_misses AS (
 SELECT count(*)::bigint missing_references
 FROM quiz_migration.buklod_quiz_raw_v1 r
 JOIN auth_link_columns l ON l.tbl=r.source_table
 LEFT JOIN auth.users u ON u.id::text=r.payload->>l.col
 WHERE nullif(r.payload->>l.col,'') IS NOT NULL AND u.id IS NULL
),
documents AS (
 SELECT count(*)::bigint total,
        count(*) FILTER (WHERE NOT coalesce(main_object_exists,false))::bigint missing,
        count(*) FILTER (WHERE NOT coalesce(content_verified,false))::bigint unverified
 FROM quiz_migration.buklod_quiz_storage_inventory_audit_v1
 WHERE bucket_id='buklod-quiz-source-docs'
),
faculty_grants AS (
 SELECT count(*) FILTER (
   WHERE to_regprocedure(signature) IS NULL
      OR has_function_privilege('anon',to_regprocedure(signature),'EXECUTE')
      OR NOT has_function_privilege('authenticated',to_regprocedure(signature),'EXECUTE')
 )::bigint invalid
 FROM (VALUES
 ('public.buklod_quiz_faculty_live_room_v2(uuid)'),
 ('public.buklod_quiz_live_bulk_action_v2(uuid,text,uuid[])'),
 ('public.buklod_quiz_live_control_v3(uuid,text)')
 ) AS signatures(signature)
)
SELECT staged.attempts AS staged_attempts,live.attempts AS main_live_attempts,
       staged.responses AS staged_responses,live.responses AS main_live_responses,
       auth_misses.missing_references AS unresolved_auth_links,
       documents.total AS source_document_count,documents.missing AS missing_documents,
       documents.unverified AS unverified_document_content,
       faculty_grants.invalid AS invalid_faculty_grants,
       (staged.attempts=live.attempts AND staged.responses=live.responses
        AND auth_misses.missing_references=0
        AND documents.total>0 AND documents.missing=0 AND documents.unverified=0
        AND faculty_grants.invalid=0) AS data_security_preflight_pass,
       'NOT_RELEASE_APPROVAL: RC user tests, live source delta, SSO, runtime parity, rollback required'::text AS release_limit
FROM staged CROSS JOIN live CROSS JOIN auth_misses CROSS JOIN documents CROSS JOIN faculty_grants;
COMMIT;
