import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(path,'utf8');
const threads=read('src/app/admin/bsoc-conversations.tsx');
const notes=read('src/app/admin/bsoc-notifications.tsx');
const priority=read('src/lib/buklodAdminPriorityPolicy.ts');

test('priority and BSOC notifications navigate to same authorized case without route injection',()=>{
 assert.match(threads,/caseId:routeCaseId/);
 assert.match(threads,/case_id:legacyCaseId/);
 assert.match(threads,/isValidBdocCaseId\(routeCaseId\)/);
 assert.match(notes,/bsocCaseRoute\(raw\)/);
 assert.match(priority,/isValidBdocCaseId/);
 assert.match(threads,/isBsoCaseId\(requestedCaseId\)/);
});

test('older linked cases have a permission-checked fallback without losing BSOC triage',()=>{
 assert.match(threads,/if\(!canRead\|\|!queueLoaded/);
 assert.match(threads,/if\(!isSystemAdmin\)/);
 assert.match(threads,/\.from\('user_feedback'\)/);
 assert.match(threads,/\.eq\('id',requestedCaseId\)\.maybeSingle\(\)/);
 assert.match(threads,/triageBsoCase\(selected\)/);
 assert.match(threads,/bsoReplyDraft/);
 assert.match(threads,/selected\.status==='closed'/);
 assert.match(threads,/currentCase\.current!==caseId/);
});

test('no premature closing, account leak, or uncontrolled notification edits',()=>{
 assert.match(threads,/previousUserRef\.current===user\?\.id/);
 assert.match(threads,/requestSequence\.current\+=1/);
 assert.match(notes,/if\(!allowed\)return;/);
 assert.match(notes,/\.is\('read_at',null\)/);
 assert.doesNotMatch(notes,/\.from\('user_feedback'\)[\s\S]{0,160}\.update/);
 assert.doesNotMatch(threads,/status:'resolved'|status:'closed'/);
});
