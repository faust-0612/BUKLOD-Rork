import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/20261125142000_faith_accomplishment_named_notifications.sql',import.meta.url),'utf8');
test('all available canonical accomplishment pathways have hooks',()=>{
 for(const x of ['buklod_abc_growth_progress','bible_reading_sessions','buklod_children_story_completions','mentor_teaching_sessions','saliksik_mastery','MENTEE_SESSION','MENTOR_SESSION']) assert.ok(sql.includes(x),x);
 assert.ok(sql.includes("new.source in ('free_reading','search','search_reading')"));
 assert.ok(sql.includes("lower(new.status)='approved'"));
 assert.ok(sql.includes('a.submitted_at=new.passed_at'));
 assert.ok(sql.includes('a.reviewed_at=new.passed_at'));
});
test('scope and privacy protections',()=>{
 for(const x of ["m.membership_status='ACTIVE'","peer.membership_status='ACTIVE'","s.scope_type='CLUSTER'","s.id=p_scope","buklod_cluster_submission_admin_ids_v1","a.user_id<>p_user","pg_advisory_xact_lock","from public,anon,authenticated","as a member of","report_only',true"]) assert.ok(sql.includes(x),x);
 assert.doesNotMatch(sql,/insert into public\.buklod_points_ledger|update public\.mentor_teaching_sessions/i);
 assert.ok(sql.includes('CHILDREN_TEACHING: do not install a hook'));
});
