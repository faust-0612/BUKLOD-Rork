import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Daily Reading keeps its exact record link and Daily Devotion/Lesson use reviewer-secured summary',()=>{
 const t=read('src/lib/buklodFormationNotificationTarget.ts');
 assert.match(t,/daily-reading\/\$\{encodeURIComponent\(itemId\)\}/);
 assert.match(t,/normalizedKind === 'formation_submission_report'/);
 assert.match(t,/itemKind === 'DAILY_DEVOTION' \|\| itemKind === 'LESSON'/);
 assert.match(t,/faith-monitoring\/submission\/'/);
});
test('Exact viewer calls scope-authorized RPC, validates UUID, and does not bypass private submission RLS',()=>{
 const s=read('src/app/scope/faith-monitoring/submission/[approvalId].tsx');
 assert.match(s,/buklod_scope_formation_submission_history_v2/);
 assert.match(s,/uuid\.test\(id\)\|\|!uuid\.test\(scopeId\)/);
 assert.match(s,/found\.item_id!==itemId/);
 assert.match(s,/Reviewer comments on the exact submission are not enabled/);
 assert.match(s,/openMemberConnect/);
 assert.doesNotMatch(s,/\.from\('devotional_reward_submissions'\)/);
});
