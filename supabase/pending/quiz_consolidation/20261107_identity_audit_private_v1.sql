-- BUKLOD Quiz consolidation: protected reconciliation SNAPSHOT ONLY.
-- Main project: yhanxndaqbmuzbdqlblu. Source data: already staged in quiz_migration.
-- No auth account creation/update, public Quiz table mutation, RPC replacement, or cutover.
-- A matching UUID indicates an identity reconciliation candidate, NOT proof that
-- a production exam or historical grade may be released to that account.
CREATE TABLE IF NOT EXISTS quiz_migration.buklod_quiz_identity_audit_v1 (
  source_user_id uuid PRIMARY KEY,
  matching_main_user_id uuid,
  candidate_email_main_user_id uuid,
  match_status text NOT NULL CHECK (match_status IN (
    'uuid_email_consistent',
    'historical_main_uuid_match',
    'uuid_email_mismatch',
    'email_conflicting_uuid',
    'source_only_no_main',
    'historical_orphan_no_auth'
  )),
  source_auth_snapshot_present boolean NOT NULL,
  main_auth_present boolean NOT NULL,
  source_answer_count bigint NOT NULL DEFAULT 0 CHECK (source_answer_count >= 0),
  source_attempt_count bigint NOT NULL DEFAULT 0 CHECK (source_attempt_count >= 0),
  reconciled_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mapping_candidates_must_be_same_uuid CHECK (
    (match_status IN ('uuid_email_consistent','historical_main_uuid_match')
      AND matching_main_user_id = source_user_id)
    OR
    (match_status NOT IN ('uuid_email_consistent','historical_main_uuid_match')
      AND matching_main_user_id IS NULL)
  )
);
ALTER TABLE quiz_migration.buklod_quiz_identity_audit_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_migration.buklod_quiz_identity_audit_v1 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE quiz_migration.buklod_quiz_identity_audit_v1 FROM PUBLIC, anon, authenticated;

WITH source_auth AS (
  SELECT (payload->>'id')::uuid AS user_id, lower(btrim(payload->>'email')) AS email
  FROM quiz_migration.buklod_quiz_raw_v1
  WHERE source_table='buklod_quiz_auth_shadow_refs'
),
response_history AS (
  SELECT (payload->>'student_user_id')::uuid AS user_id, count(*)::bigint AS answer_count
  FROM quiz_migration.buklod_quiz_raw_v1
  WHERE source_table='buklod_quiz_responses' AND payload->>'student_user_id' IS NOT NULL
  GROUP BY 1
),
attempt_history AS (
  SELECT (payload->>'student_user_id')::uuid AS user_id, count(*)::bigint AS attempt_count
  FROM quiz_migration.buklod_quiz_raw_v1
  WHERE source_table='buklod_quiz_attempts' AND payload->>'student_user_id' IS NOT NULL
  GROUP BY 1
),
all_users AS (
  SELECT user_id FROM source_auth
  UNION SELECT user_id FROM response_history
  UNION SELECT user_id FROM attempt_history
),
classified AS (
  SELECT
    ids.user_id,
    ar.user_id IS NOT NULL AS source_present,
    main_id.id IS NOT NULL AS main_present,
    main_email.id AS email_candidate,
    main_id.id AS exact_main_id,
    CASE
      WHEN ar.user_id IS NOT NULL AND main_id.id IS NOT NULL
        AND ar.email IS NOT DISTINCT FROM lower(btrim(main_id.email))
        THEN 'uuid_email_consistent'
      WHEN ar.user_id IS NULL AND main_id.id IS NOT NULL
        THEN 'historical_main_uuid_match'
      WHEN ar.user_id IS NOT NULL AND main_id.id IS NOT NULL
        THEN 'uuid_email_mismatch'
      WHEN ar.user_id IS NOT NULL AND main_id.id IS NULL AND main_email.id IS NOT NULL
        THEN 'email_conflicting_uuid'
      WHEN ar.user_id IS NOT NULL AND main_id.id IS NULL
        THEN 'source_only_no_main'
      ELSE 'historical_orphan_no_auth'
    END AS status,
    coalesce(r.answer_count,0)::bigint AS answers,
    coalesce(a.attempt_count,0)::bigint AS attempts
  FROM all_users ids
  LEFT JOIN source_auth ar ON ar.user_id=ids.user_id
  LEFT JOIN auth.users main_id ON main_id.id=ids.user_id
  LEFT JOIN auth.users main_email ON ar.email IS NOT NULL
    AND lower(btrim(main_email.email))=ar.email
  LEFT JOIN response_history r ON r.user_id=ids.user_id
  LEFT JOIN attempt_history a ON a.user_id=ids.user_id
)
INSERT INTO quiz_migration.buklod_quiz_identity_audit_v1 (
  source_user_id,matching_main_user_id,candidate_email_main_user_id,
  match_status,source_auth_snapshot_present,main_auth_present,
  source_answer_count,source_attempt_count,reconciled_at
)
SELECT user_id,
  CASE WHEN status IN ('uuid_email_consistent','historical_main_uuid_match')
    THEN exact_main_id ELSE NULL END,
  CASE WHEN email_candidate IS DISTINCT FROM user_id THEN email_candidate ELSE NULL END,
  status,source_present,main_present,answers,attempts,now()
FROM classified
ON CONFLICT(source_user_id) DO UPDATE SET
  matching_main_user_id=excluded.matching_main_user_id,
  candidate_email_main_user_id=excluded.candidate_email_main_user_id,
  match_status=excluded.match_status,
  source_auth_snapshot_present=excluded.source_auth_snapshot_present,
  main_auth_present=excluded.main_auth_present,
  source_answer_count=excluded.source_answer_count,
  source_attempt_count=excluded.source_attempt_count,
  reconciled_at=excluded.reconciled_at;

-- Verification after applying:
-- SELECT match_status,count(*),sum(source_answer_count),sum(source_attempt_count)
-- FROM quiz_migration.buklod_quiz_identity_audit_v1 GROUP BY 1 ORDER BY 1;
-- Fail cutover if ANY statuses require review, or if other cutover gates are open.
-- Do NOT expose this table to Data API or treat a candidate mapping as authorization.
