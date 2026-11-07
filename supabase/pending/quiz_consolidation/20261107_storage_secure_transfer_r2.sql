-- Temporary one-hour BUKLOD Quiz private Storage transfer authorization.
-- Deploy ONLY on Dedicated and Main; no public student data or live Quiz RPCs changed.
-- Never commit bearer tokens or private object paths.
CREATE TABLE IF NOT EXISTS public.buklod_quiz_transfer_gate_r2_20261107 (
 token_sha256 text PRIMARY KEY CHECK (token_sha256 ~ '^[0-9a-f]{64}$'),
 expires_at timestamptz NOT NULL,
 active boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS public.buklod_quiz_transfer_allow_r2_20261107 (
 object_path text PRIMARY KEY,
 expected_size bigint NOT NULL CHECK (expected_size>=0 AND expected_size<=1048576),
 mime_type text NOT NULL DEFAULT 'application/octet-stream',
 status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','VERIFIED')),
 sha256 text,
 verified_at timestamptz
);
ALTER TABLE public.buklod_quiz_transfer_gate_r2_20261107 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buklod_quiz_transfer_gate_r2_20261107 FORCE ROW LEVEL SECURITY;
ALTER TABLE public.buklod_quiz_transfer_allow_r2_20261107 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buklod_quiz_transfer_allow_r2_20261107 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.buklod_quiz_transfer_gate_r2_20261107 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.buklod_quiz_transfer_allow_r2_20261107 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.buklod_quiz_transfer_gate_r2_20261107 TO service_role;
GRANT SELECT,UPDATE ON public.buklod_quiz_transfer_allow_r2_20261107 TO service_role;

-- These temporary public tables have *no* anon/authenticated RLS policies.
-- Authorized Edge workers alone can read them via their server-side service role.
-- Hard limit: 1 MiB per file; paths must exist on the exact allowlist.
-- When transfer and SHA-256 validation finish, deactivate/clear bearer token rows,
-- deploy inert 410 workers, and drop both temporary tables from both projects.
