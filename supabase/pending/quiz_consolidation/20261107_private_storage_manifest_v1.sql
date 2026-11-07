-- BUKLOD Quiz private Storage manifest. METADATA ONLY, never file bytes.
-- Do not treat PRESENT_METADATA_MATCH as content-verified or user-access verified.
-- Do not set content_verified=true without comparing downloaded source/target SHA-256.
CREATE TABLE IF NOT EXISTS quiz_migration.buklod_quiz_storage_inventory_audit_v1 (
  bucket_id text NOT NULL,
  object_path text NOT NULL,
  source_size_bytes bigint NOT NULL CHECK(source_size_bytes>=0),
  source_mime_type text,
  source_owner_id text,
  source_updated_at timestamptz,
  main_object_exists boolean NOT NULL DEFAULT false,
  main_size_bytes bigint,
  main_owner_id text,
  status text NOT NULL CHECK (status IN ('COPY_REQUIRED','SIZE_MISMATCH','PRESENT_METADATA_MATCH')),
  owner_id_differs boolean,
  content_verified boolean NOT NULL DEFAULT false,
  checked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(bucket_id,object_path)
);
ALTER TABLE quiz_migration.buklod_quiz_storage_inventory_audit_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_migration.buklod_quiz_storage_inventory_audit_v1 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE quiz_migration.buklod_quiz_storage_inventory_audit_v1 FROM PUBLIC,anon,authenticated;
-- Data loading is intentionally separate from tracked DDL: paths, owner IDs,
-- and document metadata are private and must never be committed to GitHub.
