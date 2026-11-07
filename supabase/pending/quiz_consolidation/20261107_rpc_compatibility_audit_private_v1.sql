-- BUKLOD Quiz function compatibility inventory: private metadata ONLY.
-- Snapshot full outer join of archived source RPC signatures and current Main catalog.
-- This MUST NOT create, replace, execute, grant, or expose any Quiz RPC.
-- Re-run after source and Main changes; a DIFFERENT body may be intentional.
CREATE TABLE IF NOT EXISTS quiz_migration.buklod_quiz_rpc_compatibility_audit_v1 (
  function_name text NOT NULL,
  identity_arguments text NOT NULL,
  source_sha256 text,
  main_sha256 text,
  comparison text NOT NULL CHECK (comparison IN ('SOURCE_ONLY','MAIN_ONLY','DIFFERENT','MATCH')),
  source_security_definer boolean,
  main_security_definer boolean,
  source_return_type text,
  main_return_type text,
  main_anon_can_execute boolean,
  main_authenticated_can_execute boolean,
  checked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (function_name,identity_arguments)
);
ALTER TABLE quiz_migration.buklod_quiz_rpc_compatibility_audit_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_migration.buklod_quiz_rpc_compatibility_audit_v1 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE quiz_migration.buklod_quiz_rpc_compatibility_audit_v1 FROM PUBLIC, anon, authenticated;

WITH source_functions AS (
  SELECT payload->>'name' AS fn, payload->>'args' AS args,
    payload->>'sha256' AS hash,
    (payload->>'security_definer')::boolean AS secdef,
    payload->>'returns' AS returns
  FROM quiz_migration.buklod_quiz_raw_v1
  WHERE source_table='buklod_quiz_rpc_ddl_v1'
),
main_functions AS (
  SELECT p.proname AS fn, pg_get_function_identity_arguments(p.oid) AS args,
    encode(digest(pg_get_functiondef(p.oid),'sha256'),'hex') AS hash,
    p.prosecdef AS secdef,
    pg_get_function_result(p.oid) AS returns,
    has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
    has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname LIKE 'buklod_quiz_%'
),
paired AS (
  SELECT coalesce(s.fn,m.fn) fn,coalesce(s.args,m.args) args,
    s.hash source_hash,m.hash main_hash,s.secdef source_secdef,
    m.secdef main_secdef,s.returns source_returns,m.returns main_returns,
    m.anon_execute,m.authenticated_execute,
    CASE WHEN s.fn IS NULL THEN 'MAIN_ONLY'
         WHEN m.fn IS NULL THEN 'SOURCE_ONLY'
         WHEN s.hash IS DISTINCT FROM m.hash THEN 'DIFFERENT'
         ELSE 'MATCH' END comparison
  FROM source_functions s FULL OUTER JOIN main_functions m
    ON s.fn=m.fn AND s.args=m.args
)
INSERT INTO quiz_migration.buklod_quiz_rpc_compatibility_audit_v1 (
  function_name, identity_arguments, source_sha256, main_sha256, comparison,
  source_security_definer, main_security_definer, source_return_type,
  main_return_type, main_anon_can_execute, main_authenticated_can_execute, checked_at
)
SELECT fn,args,source_hash,main_hash,comparison,source_secdef,main_secdef,
  source_returns,main_returns,anon_execute,authenticated_execute,now()
FROM paired
ON CONFLICT (function_name,identity_arguments) DO UPDATE SET
  source_sha256=excluded.source_sha256,
  main_sha256=excluded.main_sha256,
  comparison=excluded.comparison,
  source_security_definer=excluded.source_security_definer,
  main_security_definer=excluded.main_security_definer,
  source_return_type=excluded.source_return_type,
  main_return_type=excluded.main_return_type,
  main_anon_can_execute=excluded.main_anon_can_execute,
  main_authenticated_can_execute=excluded.main_authenticated_can_execute,
  checked_at=excluded.checked_at;

-- Expected baseline (2026-11-07): SOURCE_ONLY 24; DIFFERENT 62; MATCH 40;
-- MAIN_ONLY 43. Do not blindly copy 24, overwrite 62, or delete 43.
-- All SECURITY DEFINER functions need individual authorization and RLS review.
