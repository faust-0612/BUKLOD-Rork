import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const webSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('classroom roster is loaded via the authorized faculty RPC only', () => {
  assert.match(webSource, /db\.rpc\('buklod_classroom_roster_members_v2',\{p_classroom_id:id\}\)/);
  assert.doesNotMatch(webSource, /\.from\('buklod_education_roster_members'\)/);
});
test('visible Back button returns to classes and clears stale module errors', () => {
  assert.match(webSource, /Back to My Classes', 'classes'/);
  assert.match(webSource, /state\.error='';state\.data=\[\];state\.additional=\[\];render\(\)/);
  assert.match(webSource, /state\.classId=''; state\.context=null; state\.overview=null; state\.data=\[\]/);
});
test('deletion uses the guarded, authenticated backend RPC with exact confirmation', () => {
  assert.match(webSource, /deletionNameMatches\(entered, classroomName\)/);
  assert.match(webSource, /canDeleteClass\(\)/);
  assert.match(webSource, /db\.rpc\('buklod_classroom_delete_empty_guarded_v1'/);
  assert.doesNotMatch(webSource, /db\.rpc\('buklod_classroom_delete_empty_v1'/);
});
test('student grade visibility is still limited to released-grade RPC', () => {
  assert.match(webSource, /buklod_classroom_student_released_grade_items_v2/);
});

test('canonical cyan grouped navigation retains real authenticated data flows', () => {
  assert.match(webSource,/const GROUP_TABS = Object\.freeze/);
  for(const g of ['CLASS','WORK','CONNECT','MORE']) assert.match(webSource,new RegExp(g+':'));
  assert.match(webSource,/data-action="group"/);
  assert.match(webSource,/classLink\(state\.classId,id\)/);
  assert.match(webSource,/buklod-classroom-cyan\.svg/);
  assert.doesNotMatch(webSource,/var APP_STATE/);
  assert.doesNotMatch(webSource,/data-bard-client-injected/);
  assert.match(webSource,/db\.auth\.signInWithPassword/);
});
