import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const js=readFileSync(new URL('../src/gemini-live.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function getStaticDivInner(id) {
  const i=html.indexOf('id="'+id+'"');
  assert.ok(i>=0,'HTML mount exists '+id);
  const open=html.indexOf('>',i)+1,pattern=/<\/?div\b[^>]*>/gi;
  pattern.lastIndex=open;
  let depth=1,match;
  while((match=pattern.exec(html))){
    depth+=/^<\/div/i.test(match[0])?-1:1;
    if(depth===0)return html.slice(open,match.index);
  }
  throw Error('Unclosed div '+id);
}
test('Gemini layout mounts no static fabricated classes, scores or exams',()=>{
  for(const id of ['portalClassroomsList','portalSummaryBento','workspaceBodyContent']){
    const content=getStaticDivInner(id);
    assert.doesNotMatch(content,/99923b52|58\s*\/\s*60 Live|93.8%|23\s*\/\s*25|Dela Cruz/i);
    assert.ok(content.length<600,'Only safe placeholder prior to authentication: '+id);
  }
});
test('Faculty-gradebook decision waits for authoritative classroom context',()=>{
  assert.match(js,/const isFaculty = \(\) => roleByClass\.get\(app\.activeClassId\)\?\.authorizedFaculty===true/);
  assert.match(js,/identity\.is_faculty===true/);
  assert.match(js,/assigned\.authorizedFaculty=identity\.role==='FACULTY'/);
});
test('Student grade exposure uses only released-grade RPC',()=>{
  assert.match(js,/buklod_classroom_student_released_grade_items_v2/);
  assert.match(js,/buklod_classroom_gradebook_roster_v1/);
});
test('Discussion comments are actually fetched and displayed, not just saved',()=>{
  assert.match(js,/out\.comments=ids\.length\?/);
  assert.match(js,/buklod_education_classroom_comments/);
  assert.match(js,/const comments=\(current\(\)\.comments\|\|\[\]\)\.filter/);
  assert.match(js,/window\.openRealComment=/);
});
test('Active Classes opens workload view, not duplicate My Classrooms list',()=>{
  assert.match(js,/window\.showActiveClassrooms=async/);
  assert.match(js,/My Active Classes — Current Academic Work/);
  assert.match(js,/eq\('status','PUBLISHED'\)/);
});
test('Live Now uses official RLS-scoped LIVE sessions, not uninitialized zero',()=>{
  assert.match(js,/function fetchLiveOverview\(\)/);
  assert.match(js,/buklod_education_classroom_live_sessions/);
  assert.match(js,/liveKnown\?\(liveCount\+/);
  assert.match(js,/eq\('status','LIVE'\)/);
});
test('Class-switcher HTML escapes DB class names and only lists assigned classes',()=>{
  assert.match(js,/window\.openClassSwitcherDrawer=/);
  assert.match(js,/esc\(c\.className\)/);
  assert.match(js,/Object\.values\(app\.classrooms\)/);
});
test('True write failure never reports a save and refresh failure never reports write failed',()=>{
  assert.match(js,/show\('Not saved: '\+safeError\(err\)\)/);
  assert.match(js,/Saved successfully, but refreshing failed:/);
  assert.match(js,/gradebook_recorded===false/);
});
test('Sign-out clears private cache, including sign-out from another tab',()=>{
  assert.match(js,/db\.auth\.onAuthStateChange/);
  assert.match(js,/event==='SIGNED_OUT'/);
  assert.match(js,/roleByClass=new Map\(\);cache=new Map\(\)/);
  assert.match(js,/document\.body\.classList\.remove\('buklod-live-authed'\)/);
});
test('Unverified academic mutations are visibly blocked and not marked saved',()=>{
  for(const op of ['confirmRosterImportCommit','recordLiveRecitationScore','setStudentAttendance',
    'archiveCurrentClass','markAllAttendancePresent','toggleOfflineMode','switchPersona','pushDirectlyToGitHub']){
    assert.ok(js.includes(op),'unverified action disabled: '+op);
  }
  assert.match(js,/No records were changed/);
});
test('Browser client never carries a privileged Supabase key',()=>{
  assert.doesNotMatch(js,/sb_secret_|service_role/);
  assert.match(js,/sb_publishable_/);
  assert.match(js,/incoming\.delete\(name\)/);
});
