const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const migration = fs.readFileSync('supabase/migrations/20261112115000_lock_anonymous_admin_rpc_execution_r1.sql', 'utf8');
const sqlProof = fs.readFileSync('supabase/tests/anon_admin_rpc_security_20261112.sql', 'utf8');
const audit = fs.readFileSync('security/sql/audit_anonymous_admin_rpcs.sql', 'utf8');

test('Admin RPC hardening targets only anonymous privileged admin functions and preserves signed-in access', () => {
  assert.match(migration, /p\.proname LIKE 'admin\\_%' ESCAPE '\\'/);
  assert.match(migration, /p\.prosecdef/);
  assert.match(migration, /has_function_privilege\('anon', p\.oid, 'EXECUTE'\)/);
  assert.match(migration, /has_function_privilege\('authenticated', p\.oid, 'EXECUTE'\)/);
  assert.match(migration, /REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role/);
  assert.match(migration, /RAISE EXCEPTION 'BUKLOD security violation/);
  assert.doesNotMatch(migration, /(?:DROP|TRUNCATE|DELETE FROM|UPDATE\s+public\.|ALTER TABLE|CREATE OR REPLACE FUNCTION)\b/i);
});

test('Post-deploy DB proof fails closed on anonymous admin privilege regression and confirms authenticated admin use', () => {
  assert.match(sqlProof, /RAISE EXCEPTION/);
  assert.match(sqlProof, /has_function_privilege\('anon', p\.oid, 'EXECUTE'\)/);
  assert.match(sqlProof, /has_function_privilege\('authenticated',/);
  assert.match(audit, /has_function_privilege\('anon', p\.oid, 'EXECUTE'\)/);
  assert.doesNotMatch(audit, /\b(?:INSERT|UPDATE|DELETE|GRANT|REVOKE)\s+/i);
});
