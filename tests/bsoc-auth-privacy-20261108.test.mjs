import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('BSOC profile permission read assimilates the PostgREST thenable and fails closed', () => {
  const source = read('src/app/(tabs)/me.tsx');
  assert.match(source, /Promise\.resolve\(supabase\.rpc\('buklod_bsoc_can',\{p_permission_key:'bsoc\.support\.read'\}\)\)/);
  assert.match(source, /setBsocAuthorized\(!error&&data===true\)/);
  assert.match(source, /\.catch\(\(\)=>\{if\(live\)setBsocAuthorized\(false\);\}\)/);
  assert.match(source, /return \(\)=>\{live=false;\}/);
});

test('BSOC member chat is private, scoped to the authenticated member and disables closed-case writes', () => {
  const source = read('src/app/support/live.tsx');
  assert.match(source, /\.eq\('user_id',user\.id\)/);
  assert.match(source, /\.eq\('case_id',caseId\)/);
  assert.match(source, /sender_id:uid,sender_kind:'member'/);
  assert.match(source, /cases\.find\(c=>c\.id===caseId\)\?\.status==='closed'/);
  assert.doesNotMatch(source, /service_role|requestGuestSupport|guestIdentifier/);
});

test('DB access controls deny anonymous support reads and bind client writes to auth.uid', () => {
  const migration = read('supabase/migrations/20261107224000_bsoc_direct_support_chat_evidence.sql');
  assert.match(migration, /alter table public\.bsoc_case_messages enable row level security/i);
  assert.match(migration, /alter table public\.bsoc_case_attachments enable row level security/i);
  assert.match(migration, /sender_id=\(select auth\.uid\(\)\)/);
  assert.match(migration, /uploader_id=\(select auth\.uid\(\)\)/);
  assert.match(migration, /revoke all on public\.bsoc_case_messages from anon/i);
  assert.match(migration, /revoke all on public\.bsoc_case_attachments from anon/i);
  assert.match(migration, /false,262144000/);
});
