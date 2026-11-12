const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = 'security/sql/quiz_only_revoke_public_ddl_r2_20261112.sql';
const sql = fs.readFileSync(path,'utf8');
const gate = fs.readFileSync('security/sql/tests/quiz_only_public_ddl_r2_postdeploy.sql','utf8');
test('Dedicated Quiz hardening cannot accidentally deploy to Main project', () => {
  assert.match(sql,/QUIZ DEDICATED SUPABASE ONLY: cjtehbfspgimyhifnjon/);
  assert.ok(!path.startsWith('supabase/migrations/'));
  assert.match(sql,/DO NOT APPLY TO BUKLOD MAIN/);
});
test('Preserves public Quiz exams, login and answer RPC permissions', () => {
  assert.match(sql,/REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE %I\.%I FROM PUBLIC, anon, authenticated/);
  assert.match(sql,/ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public/);
  assert.match(sql,/buklod_quiz_save_answer_v1\(uuid,uuid,jsonb\)/);
  assert.match(sql,/buklod_quiz_save_answer_v2\(uuid,uuid,jsonb,text\)/);
  assert.match(sql,/buklod_quiz_resolve_login_identifier_v1\(text\)/);
  assert.match(gate,/Quiz login\/answer RPC grant regression/);
  assert.doesNotMatch(sql,/\bDROP\s+TABLE\b|\bTRUNCATE\s+TABLE\b|\bDELETE\s+FROM\b/i);
});
