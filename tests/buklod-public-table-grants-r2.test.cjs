const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const migration = fs.readFileSync('supabase/migrations/20261112130700_revoke_public_ddl_privileges_security_r2.sql','utf8');
const gate = fs.readFileSync('supabase/tests/buklod_public_table_ddl_grants_r2.sql','utf8');

test('Public app roles lose DDL-grade grants that bypass RLS', () => {
  assert.match(migration,/c\.relkind IN \('r','p'\)/);
  assert.match(migration,/REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE %I\.%I FROM PUBLIC, anon, authenticated/);
  assert.match(migration,/ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public/);
  assert.match(migration,/PUBLIC_UNSAFE_DDL_GRANTS/);
  assert.match(migration,/has_table_privilege\('anon',c\.oid,'TRUNCATE'\)/);
  assert.match(migration,/has_table_privilege\('authenticated',c\.oid,'REFERENCES'\)/);
  assert.match(gate,/Unsafe app role table DDL grants remain/);
  assert.match(gate,/Future grant regression monitoring was not installed/);
});
test('Preserve normal DML, server permissions, RLS and finance controls', () => {
  assert.match(migration,/has_table_privilege\('authenticated','public.notifications','UPDATE'\)/);
  assert.match(migration,/has_table_privilege\('authenticated','public.bayanihan_withdrawals','SELECT'\)/);
  assert.match(migration,/has_table_privilege\('service_role','public.bayanihan_withdrawals','TRUNCATE'\)/);
  assert.doesNotMatch(migration,/\bDROP\s+TABLE\b|\bTRUNCATE\s+TABLE\b|\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(migration,/\bALTER\s+TABLE\s+.*\bDISABLE\s+ROW\s+LEVEL\s+SECURITY\b/i);
  assert.doesNotMatch(migration,/\bGRANT\s+ALL\s+ON\s+TABLE\b/i);
  assert.match(gate,/Critical retained table privileges regressed/);
});
