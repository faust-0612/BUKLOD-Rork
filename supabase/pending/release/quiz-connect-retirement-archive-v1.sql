-- Preserve exact Dedicated source changes without overwriting live Connect grades.
-- No auth passwords, tokens, keys, or identity mappings are copied.
-- Only postgres can read/write this non-exposed, deny-by-default archive.
SET LOCAL lock_timeout='3s';
CREATE TABLE quiz_migration.buklod_quiz_retirement_delta_v1 (
 source_table text NOT NULL CHECK (source_table IN (
  'buklod_quiz_attempts','buklod_quiz_exams','buklod_quiz_sections',
  'buklod_quiz_live_sessions','buklod_quiz_audit_log','buklod_quiz_main_entry_gate',
  'buklod_quiz_shadow_profiles','buklod_quiz_auth_shadow_refs')),
 row_key uuid NOT NULL,
 payload jsonb NOT NULL CHECK (jsonb_typeof(payload)='object'),
 payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
 captured_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (source_table,row_key,payload_sha256),
 CHECK (payload_sha256=encode(sha256(convert_to(payload::text,'UTF8')),'hex'))
);
ALTER TABLE quiz_migration.buklod_quiz_retirement_delta_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE quiz_migration.buklod_quiz_retirement_delta_v1 FROM PUBLIC,anon,authenticated,service_role;
DO $verify$
BEGIN
 IF NOT (SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid='quiz_migration.buklod_quiz_retirement_delta_v1'::regclass)
 OR EXISTS (SELECT 1 FROM unnest(ARRAY['anon','authenticated','service_role']) r
  WHERE has_table_privilege(r,'quiz_migration.buklod_quiz_retirement_delta_v1','SELECT')
  OR has_table_privilege(r,'quiz_migration.buklod_quiz_retirement_delta_v1','INSERT'))
 THEN RAISE EXCEPTION 'Private retirement archive access gate failed'; END IF;
END
$verify$;
