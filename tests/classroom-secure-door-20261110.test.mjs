import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const launcher=readFileSync(new URL('../src/app/profile/buklod-classrooms.tsx',import.meta.url),'utf8');
const edge=readFileSync(new URL('../supabase/functions/buklod-classroom-sso-entry-v1/index.ts',import.meta.url),'utf8');
const gate=readFileSync(new URL('../supabase/migrations/20261110063350_buklod_classroom_sso_one_time_rate_gate_v1.sql',import.meta.url),'utf8');
const integrity=readFileSync(new URL('../supabase/migrations/20261110064054_buklod_classroom_comment_thread_integrity_v1.sql',import.meta.url),'utf8');

test('Main retains real student and faculty doors, no raw access or refresh token in URL',()=>{
  assert.match(launcher,/access\.is_student/);
  assert.match(launcher,/access\.is_faculty/);
  assert.match(launcher,/Enter as Student/);
  assert.match(launcher,/Enter as Faculty/);
  assert.match(launcher,/supabase\.functions\.invoke\('buklod-classroom-sso-entry-v1'/);
  assert.match(launcher,/buklod_classroom_token_hash=/);
  assert.match(launcher,/buklod_user_id=/);
  assert.match(launcher,/buklod_mode=/);
  assert.doesNotMatch(launcher,/access_token=|refresh_token=|buklod_handoff=1/);
  assert.doesNotMatch(launcher,/auth\.setSession/);
  assert.match(launcher,/userConfirmed/);
  assert.match(launcher,/modeConfirmed/);
});

test('Edge validates active main auth and Student/Faculty role independently',()=>{
  assert.match(edge,/userClient\.auth\.getUser\(accessToken\)/);
  assert.match(edge,/buklod_classroom_launcher_access_v1/);
  assert.match(edge,/mode === "FACULTY" \? access\?\.is_faculty === true : access\?\.is_student === true/);
  assert.match(edge,/admin\.auth\.admin\.getUserById\(user\.id\)/);
  assert.match(edge,/email_confirmed_at/);
  assert.match(edge,/origin_not_allowed/);
  assert.match(edge,/verify_jwt/);
});

test('Single-use Supabase Auth token hash, not long-lived session or action link in URL',()=>{
  assert.match(edge,/admin\.auth\.admin\.generateLink\(\{/);
  assert.match(edge,/type: "magiclink"/);
  assert.match(edge,/properties\?\.hashed_token/);
  assert.match(edge,/return json\(200/);
  assert.doesNotMatch(edge,/launch_url|session_launch_url|access_token:|refresh_token:/);
});

test('Rate limiter callable ONLY from service role and database row-level security enabled',()=>{
  assert.match(gate,/ENABLE ROW LEVEL SECURITY/);
  assert.match(gate,/REVOKE ALL ON FUNCTION.+FROM PUBLIC, anon, authenticated/);
  assert.match(gate,/GRANT EXECUTE ON FUNCTION.+TO service_role/);
  assert.match(gate,/ON CONFLICT \(user_id\) DO UPDATE/);
});

test('Classroom comments cannot attach foreign, deleted, locked or wrong parent threads',()=>{
  assert.match(integrity,/p\.classroom_id=NEW\.classroom_id/);
  assert.match(integrity,/p\.deleted_at IS NULL AND p\.is_locked=false/);
  assert.match(integrity,/parent\.post_id=NEW\.post_id/);
  assert.match(integrity,/BEFORE INSERT OR UPDATE/);
});
