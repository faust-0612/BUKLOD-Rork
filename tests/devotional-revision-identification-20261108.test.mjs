import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const target=read('src/lib/buklodFormationNotificationTarget.ts');
const inbox=read('src/app/devotional/submissions.tsx');
const reflection=read('src/app/reflection/[id].tsx');
const word=read('src/app/word/index.tsx');
const detail=read('src/app/devotional/[id].tsx');
const notification=read('src/app/notifications/index.tsx');
const producer=read('supabase/migrations/20261108063000_devotional_revision_notification_context_r1.sql');

test('old DAILY_DEVOTION outcome notices route to the learner submission, not a generic report',()=>{
 for(const kind of ['formation_needs_improvement','formation_approved'])
  assert.ok(target.includes("'"+kind+"'"));
 assert.match(target,/itemKind === 'DAILY_DEVOTION'/);
 assert.match(target,/clean\(data\.submission_id\) \|\| itemId/);
 assert.match(target,/\/devotional\/submissions\?\$\{query\.toString\(\)\}/);
 const personal=target.slice(target.indexOf("itemKind === 'DAILY_DEVOTION'"),target.indexOf("itemKind === 'DAILY_READING'"));
 assert.doesNotMatch(personal,/scopeId: scopeId \|\| null/);
});
test('an exact notification submission is checked against own-user RLS, not a similar devotional',()=>{
 assert.match(inbox,/\.eq\('user_id', uid\)\.eq\('id', requestedId\)/);
 assert.match(inbox,/if \(a\.id === requestedId\) return -1/);
 assert.match(inbox,/if \(!requestedId|const focusedFound/);
 assert.match(inbox,/Hindi nakita ang eksaktong submission/);
 assert.match(inbox,/devotional_title_snapshot/);
 assert.match(inbox,/admin_note/);
 assert.match(inbox,/KAILANGANG I-REVISE/);
 assert.match(inbox,/REVISE THIS DEVOTIONAL/);
 assert.match(inbox,/params: \{ id: row\.devotional_id, submissionId: row\.id \}/);
});
test('revision restores only matching devotional original answers and prevents cross-revision',()=>{
 assert.match(reflection,/\.eq\('user_id', user\.id\)\.eq\('devotional_id', id\)/);
 assert.match(reflection,/if \(targetId && submitted\.data\?\.id !== targetId\)/);
 assert.match(reflection,/setReflection\(review\?\.reflection_snapshot/);
 assert.match(reflection,/setApplication\(review\?\.application_snapshot/);
 assert.match(reflection,/existing\?\.status === 'rejected'/);
 assert.match(reflection,/RESUBMIT REVISED DEVOTIONAL/);
 assert.match(reflection,/locked = existing\?\.status === 'approved' \|\| existing\?\.status === 'pending_admin'/);
 assert.match(reflection,/complete_my_devotional_v2/);
 assert.match(reflection,/submissionId: result\.submission_id/);
});
test('word and devotional detail expose a permanent revision history',()=>{
 assert.match(word,/My Devotional Submissions · Check Revisions/);
 assert.match(word,/router\.push\('\/devotional\/submissions'/);
 assert.match(detail,/MY DEVOTIONAL SUBMISSIONS \/ REVISIONS/);
});
test('old notification titles are enriched only by own canonical DB submissions',()=>{
 assert.match(notification,/\.eq\('user_id',user\.id\)\.in\('id',ids\)/);
 assert.match(notification,/Revision needed — /);
 assert.match(notification,/Approved — /);
 assert.match(notification,/Under review — /);
 assert.match(notification,/resolveBuklodNotificationTarget/);
});
test('new notifications include exact title, approval id and submission id without touching admin reports',()=>{
 assert.match(producer,/v_row\.item_kind='DAILY_DEVOTION'/);
 assert.match(producer,/s\.id=v_row\.item_id and s\.user_id=v_row\.learner_id/);
 assert.match(producer,/devotional_title_snapshot/);
 assert.match(producer,/v_member_payload \|\| jsonb_build_object/);
 assert.match(producer,/'submission_id',v_row\.item_id/);
 assert.match(producer,/\/devotional\/submissions\?submissionId=/);
 assert.match(producer,/Revision needed: /);
 assert.match(producer,/formation:rejected:user:/);
 assert.match(producer,/formation:report:cluster-admin:/);
 assert.match(producer,/buklod_cluster_submission_admin_ids_v1/);
});
test('no fake rewards or duplicated submission table',()=>{
 assert.doesNotMatch(inbox,/insert\s+into|buklod_points_ledger|\.update\(/i);
 assert.doesNotMatch(producer,/create\s+table|alter\s+table|drop\s+table/i);
 assert.doesNotMatch(reflection,/admin_review_devotional_bayanihan/);
});
