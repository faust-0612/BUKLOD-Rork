import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const lib=fs.readFileSync(new URL('../src/lib/buklodScopeFaithPeriodReport.ts',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../src/components/BuklodFaithPeriodReport.tsx',import.meta.url),'utf8');
const sql=fs.readFileSync(new URL('../supabase/migrations/20261125141800_faith_accomplishment_report_v2.sql',import.meta.url),'utf8');
test('report uses distinct accomplishments not days or points',()=>{
 assert.match(sql,/count\(distinct s.assignment_id\)/); assert.match(sql,/count\(distinct devotional_id\)/); assert.match(sql,/d.publish_date between v_start and v_end/); assert.match(sql,/count\(distinct actual_date\)/); assert.match(sql,/count\(distinct p.episode_id\)/); assert.match(sql,/count\(distinct p.lesson_id\)/); assert.match(sql,/count\(distinct \(p.book_no,p.chapter_no\)\)/); assert.match(sql,/count\(distinct id\)/); assert.match(sql,/count\(distinct \(m.investigation_id,m.version\)\)/);
});
test('authorization, unavailable sources, and export contracts',()=>{
 assert.match(sql,/auth.uid\(\) is null/);assert.match(sql,/v_report := public.buklod_scope_faith_monitoring_period_v1/);assert.match(sql,/from public,anon/);assert.match(sql,/'children_story_count',null/);
 for(const field of ['reading_approved_count','devotion_completed_count','abaka_completed_count','saliksik_completed_count','children_story_count','bible_chapter_count','children_teaching_count','mentor_session_count','mentee_session_count','mentees_reached_count','kl_chapter_count']) assert.ok(lib.includes('displayAccomplishment(member.'+field+')'));
 assert.match(ui,/ACCOMPLISHMENT_METRICS.map/);assert.match(lib,/Not available/);assert.match(lib,/members.some/);
});

test('children completion source is server verified and deduplicated',()=>{
 const child=fs.readFileSync(new URL('../supabase/migrations/20261125141700_children_story_verified_accomplishments.sql',import.meta.url),'utf8');
 const reader=fs.readFileSync(new URL('../src/app/children-stories/[id].tsx',import.meta.url),'utf8');
 const coordinator=fs.readFileSync(new URL('../src/components/BuklodSyncCoordinator.tsx',import.meta.url),'utf8');
 assert.equal((child.match(/array\[[012,]+\]::smallint\[\]/g)||[]).length,144);
 assert.match(child,/actor is distinct from p_expected_user/);assert.match(child,/p_answers is distinct from expected/);
 assert.match(child,/primary key\(user_id,story_id\)/);assert.match(sql,/count\(distinct c.story_id\)/);
 assert.match(reader,/enqueueOfflineAction\(\{kind:'children_story_completion_v1'/);
 assert.match(coordinator,/data\?\.recorded!==true/);
});

test('formation accomplishments preserve Nov 17 member-attribution policy',()=>{
 assert.match(sql,/join members u on u.uid=s.user_id/);
 assert.match(sql,/coalesce\(f.status,s.status,'PENDING'\)/);
 assert.doesNotMatch(sql,/f0.scope_id=m.scope_id/);
 assert.match(sql,/case f0.status when 'APPROVED' then 0/);
});
