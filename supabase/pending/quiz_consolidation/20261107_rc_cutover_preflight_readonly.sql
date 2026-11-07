-- BUKLOD Quiz Dedicated -> Main RC cutover gate (READ-ONLY; NOT APPLIED).
-- Source-of-truth historical data is staged in quiz_migration.buklod_quiz_raw_v1.
-- Runs only after an explicit verified RC deployment, identity exception
-- resolution, Storage SHA-256 checks, and source writes freeze/reconciliation.
-- Expected to FAIL on Main production as of 2026-11-07.
BEGIN READ ONLY;

DO $contract$
DECLARE
  v_unmatched_refs bigint;
  v_unverified_docs bigint;
  v_missing_docs bigint;
  v_live_attempts bigint;
  v_live_responses bigint;
  v_staged_attempts bigint;
  v_staged_responses bigint;
  v_wrong_faculty_privs int;
BEGIN
  WITH expected_auth_links(tbl,col) AS (
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
  SELECT count(*) INTO v_unmatched_refs
  FROM quiz_migration.buklod_quiz_raw_v1 r
  JOIN expected_auth_links l ON l.tbl=r.source_table
  LEFT JOIN auth.users u ON u.id::text=r.payload->>l.col
  WHERE nullif(r.payload->>l.col,'') IS NOT NULL
    AND u.id IS NULL;

  IF v_unmatched_refs<>0 THEN
    RAISE EXCEPTION 'RC BLOCK: % staged Auth FK references have no safe Main user match. Never autoassign across accounts.',v_unmatched_refs;
  END IF;

  SELECT count(*) FILTER(WHERE NOT coalesce(content_verified,false)),
         count(*) FILTER(WHERE NOT main_object_exists)
  INTO v_unverified_docs,v_missing_docs
  FROM quiz_migration.buklod_quiz_storage_inventory_audit_v1
  WHERE bucket_id='buklod-quiz-source-docs';

  IF v_unverified_docs<>0 OR v_missing_docs<>0 THEN
    RAISE EXCEPTION 'RC BLOCK: % private source documents missing in Main; % not SHA-256 verified.',v_missing_docs,v_unverified_docs;
  END IF;

  SELECT count(*) INTO v_live_attempts FROM public.buklod_quiz_attempts;
  SELECT count(*) INTO v_live_responses FROM public.buklod_quiz_responses;
  SELECT count(*) INTO v_staged_attempts FROM quiz_migration.buklod_quiz_raw_v1
    WHERE source_table='buklod_quiz_attempts';
  SELECT count(*) INTO v_staged_responses FROM quiz_migration.buklod_quiz_raw_v1
    WHERE source_table='buklod_quiz_responses';

  IF v_live_attempts<>v_staged_attempts OR v_live_responses<>v_staged_responses THEN
    RAISE EXCEPTION 'RC BLOCK: live/staged row parity: attempts %/% responses %/%',
      v_live_attempts,v_staged_attempts,v_live_responses,v_staged_responses;
  END IF;

  SELECT count(*) INTO v_wrong_faculty_privs FROM (
    VALUES
     ('public.buklod_quiz_faculty_live_room_v2(uuid)'),
     ('public.buklod_quiz_live_bulk_action_v2(uuid,text,uuid[])'),
     ('public.buklod_quiz_live_control_v3(uuid,text)')
  ) AS f(signature)
  WHERE to_regprocedure(f.signature) IS NULL
     OR has_function_privilege('anon',to_regprocedure(f.signature),'EXECUTE')
     OR NOT has_function_privilege('authenticated',to_regprocedure(f.signature),'EXECUTE');

  IF v_wrong_faculty_privs<>0 THEN
    RAISE EXCEPTION 'RC BLOCK: % faculty RPC EXECUTE grants differ from Dedicated auth-only baseline.',v_wrong_faculty_privs;
  END IF;

  IF position('buklod_quiz_live_start_attempt_v3_core' IN
      pg_get_functiondef('public.buklod_quiz_live_start_attempt_v3(uuid,text)'::regprocedure))=0
    OR position('buklod_quiz_attempt_questions' IN
      pg_get_functiondef('public.buklod_quiz_student_questions_v1(uuid)'::regprocedure))=0
  THEN
    RAISE EXCEPTION 'RC BLOCK: Main student live-start and question view are not using attempt snapshots.';
  END IF;

  RAISE NOTICE 'RC data/security/schema preflight passed: attempts=% responses=%',v_live_attempts,v_live_responses;
END
$contract$;

COMMIT;

-- Passing this SQL does NOT replace end-to-end Quiz student/faculty tests,
-- historic referential integrity checks, source-delta freeze verification,
-- Production OTA compatibility, or rollback readiness.
