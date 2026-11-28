import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const migration=read('supabase/migrations/20261126113000_children_teaching_verified_sessions_v1.sql'),report=read('supabase/migrations/20261126113100_faith_children_teaching_report_v3.sql'),ui=read('src/app/faith/children-teaching.tsx'),door=read('src/components/BuklodChildrenTeachingDoor.tsx');
test('private adult evidence is opt-in and separate from child reader',()=>{
 assert.match(migration,/values\(true,false\)/);
 assert.match(migration,/2097152,array\['image\/jpeg'\]/);
 assert.match(migration,/revoke all on private.buklod_children_teaching_sessions from public,anon,authenticated/);
 assert.match(door,/EXPO_PUBLIC_CHILDREN_TEACHING_ENABLED/);
 assert.match(ui,/no identifying details of children/);
 assert.doesNotMatch(read('src/app/children-stories/[id].tsx'),/ChildrenTeachingDoor|children-teaching-evidence/);
 assert.doesNotMatch(ui,/showBuklodAdOpportunity|rewarded/i);
});
test('server checks unique photo, story-day, private pending award and notification',()=>{
 assert.match(migration,/pg_advisory_xact_lock/);
 assert.match(migration,/unique\(user_id,story_id,session_date\)/);
 assert.match(migration,/unique\(user_id,photo_etag\)/);
 assert.match(migration,/reflect_len not between 20 and 1000/);
 assert.match(migration,/l.claim_state='pending'/);
 assert.match(migration,/not public.is_system_admin\(\)/);
 assert.match(migration,/buklod_notify_faith_accomplishment_v1\(actor,'CHILDREN_TEACHING'/);
 assert.match(ui,/upsert:false/);
});
test('report v3 retains exact v2 authorization and counts scope sessions',()=>{
 assert.match(report,/buklod_scope_faith_monitoring_period_v2\(p_scope_id,p_period,p_anchor_date\)/);
 assert.match(report,/count\(distinct t.id\)/);
 assert.match(report,/t.scope_id=any\(scopes\)/);
 assert.match(read('src/lib/buklodScopeFaithPeriodReport.ts'),/buklod_scope_faith_monitoring_period_v3/);
 assert.match(read('supabase/tests/faith_named_notification_release_gate_20261125.sql'),/submit_my_children_teaching_v1/);
});

test('disabled teaching report does not invent zero and retains historical records',()=>{
 assert.match(report,/count\(distinct t.id\)>0 or v_enabled then count\(distinct t.id\) else null/);
 assert.match(report,/children_teaching_count'\)::integer,0\)>0/);
 assert.match(report,/members_with_activity',active_count/);
});
