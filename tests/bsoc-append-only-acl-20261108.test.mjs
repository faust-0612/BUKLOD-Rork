import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const sql = readFileSync('supabase/migrations/20261108031000_bsoc_chat_append_only_permissions.sql','utf8');
const member = readFileSync('src/app/support/live.tsx','utf8');
const agent = readFileSync('src/app/admin/bsoc-conversations.tsx','utf8');
test('live BSOC messages and attachments have only RLS-scoped SELECT/INSERT for members', () => {
  assert.match(sql, /REVOKE ALL ON TABLE public\.bsoc_case_messages,[\s\S]*public\.bsoc_case_attachments FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT SELECT, INSERT ON TABLE public\.bsoc_case_messages,[\s\S]*public\.bsoc_case_attachments TO authenticated/);
  assert.match(sql, /has_table_privilege\('authenticated','public\.bsoc_case_messages','TRUNCATE'\)/);
  assert.match(sql, /has_table_privilege\('authenticated','public\.bsoc_case_attachments','TRUNCATE'\)/);
  assert.match(member, /\.from\('bsoc_case_messages'\)\.insert\(/);
  assert.match(member, /\.from\('bsoc_case_attachments'\)\.insert\(/);
  assert.match(agent, /\.from\('bsoc_case_messages'\)\.insert\(/);
  assert.doesNotMatch(member, /\.from\('bsoc_case_messages'\)\.update\(/);
  assert.doesNotMatch(agent, /\.from\('bsoc_case_messages'\)\.delete\(/);
});
