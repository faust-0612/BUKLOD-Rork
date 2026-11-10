import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const web=readFileSync(new URL('../src/gemini-live.js',import.meta.url),'utf8');
test('Main one-time email-OTP handoff is consumed without manual sign-in',()=>{
  assert.match(web,/buklod_classroom_token_hash/);
  assert.match(web,/history\.replaceState\(\{\},'',location\.pathname\+location\.search/);
  assert.match(web,/db\.auth\.verifyOtp\(\{token_hash:ssoHandoff\.hash,type:'email'\}\)/);
  assert.match(web,/data\.user\.id!==ssoHandoff\.userId/);
  assert.match(web,/if\(ssoHandoff\)await consumeMainDoorHandoff\(\)/);
});
test('Student-only accounts cannot enter Faculty View and dual-role switch clears private caches',()=>{
  assert.match(web,/desiredMode==='STUDENT' \? flags\?\.student===true/);
  assert.match(web,/assigned\.authorizedFaculty=desiredMode==='FACULTY'/);
  assert.match(web,/window\.switchPersona=mode=>/);
  assert.match(web,/cache=new Map\(\)/);
  assert.match(web,/buklod_classroom_launcher_access_v1/);
  assert.match(web,/buklod_classroom_student_released_grade_items_v2/);
});
test('Formal acknowledgments use authenticated student identity and idempotent DB conflict handling',()=>{
  assert.match(web,/window\.acknowledgeFormalNotice=noticeId=>/);
  assert.match(web,/buklod_education_notice_acknowledgments/);
  assert.match(web,/onConflict:'notice_id,user_id',ignoreDuplicates:true/);
  assert.match(web,/I ACKNOWLEDGE/);
  assert.match(web,/n\.requires_ack/);
});
test('Faculty official notice posting uses verified account and requires confirmation',()=>{
  assert.match(web,/window\.openRealNotice=\(\)=>/);
  assert.match(web,/isFaculty\(\)/);
  assert.match(web,/realNoticeForm/);
  assert.match(web,/created_by:activeUser\.id/);
  assert.match(web,/f\.get\('confirm'\)!=='on'/);
});
test('No privileged service key or login refresh-token handoff in browser',()=>{
  assert.doesNotMatch(web,/sb_secret_|service_role/);
  assert.doesNotMatch(web,/db\.auth\.setSession\(/);
  assert.doesNotMatch(web,/refresh_token=.*encodeURIComponent/);
});
