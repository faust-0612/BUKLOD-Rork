import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const read = path => readFileSync(new URL('../' + path, import.meta.url),'utf8');
const config = read('src/lib/supabase.ts');
const access = read('supabase/functions/buklod-ptt-access/index.ts');
const captions = read('supabase/functions/buklod-ptt-captions/index.ts');
const expectedHeaders = [
  'authorization','x-client-info','apikey','content-type','x-buklod-client',
  'x-supabase-client-platform','x-supabase-client-platform-version',
  'x-supabase-client-runtime','x-supabase-client-runtime-version',
];

test('browser custom header must be explicitly allowed in BOTH PTT Edge Functions', () => {
  assert.match(config, /'x-buklod-client'/);
  for (const [name, source] of [['access',access],['captions',captions]]) {
    const headers = source.match(/"Access-Control-Allow-Headers":\s*"([^"]+)"/)?.[1];
    assert.ok(headers, name + ': explicit allow headers missing');
    const declared = headers.split(',').map(x=>x.trim().toLowerCase());
    for (const required of expectedHeaders) assert.ok(declared.includes(required), name + ': missing ' + required);
    assert.match(source, /"Access-Control-Allow-Origin":\s*"\*"/);
    assert.match(source, /"Access-Control-Allow-Methods":\s*"POST, OPTIONS"/);
    assert.match(source, /req\.method === "OPTIONS"/);
    assert.match(source, /buklod_scope_memberships/);
    assert.match(source, /auth\.getUser\(\)/);
  }
});

test('membership authorization and call identity checks remain in access function', () => {
  assert.match(access, /membership_status/);
  assert.match(access, /"ACTIVE"/);
  assert.match(access, /PTT_SCOPE_NOT_AUTHORIZED/);
  assert.match(access, /validChannel/);
  assert.match(access, /callIdFor/);
  assert.match(access, /stream\.generateUserToken/);
});

test('captions continue to enforce membership before changing channel-wide transcription', () => {
  assert.match(captions, /membership_status/);
  assert.match(captions, /if \(!membership\)/);
  assert.match(captions, /startClosedCaptions/);
  assert.match(captions, /stopClosedCaptions/);
});
