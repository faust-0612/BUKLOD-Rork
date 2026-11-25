import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const lib=fs.readFileSync(new URL('../src/lib/buklodScopeFaithPeriodReport.ts',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../src/components/BuklodFaithPeriodReport.tsx',import.meta.url),'utf8');
const sql=fs.readFileSync(new URL('../supabase/migrations/20261125141800_faith_accomplishment_report_v2.sql',import.meta.url),'utf8');
test('report uses distinct accomplishments not days or points',()=>{
 assert.match(sql,/count\(distinct s.assignment_id\)/); assert.match(sql,/count\(distinct dc.id\)/); assert.match(sql,/count\(distinct p.lesson_id\)/); assert.match(sql,/count\(distinct \(p.book_no,p.chapter_no\)\)/); assert.match(sql,/count\(distinct id\)/); assert.match(sql,/count\(distinct \(m.investigation_id,m.version\)\)/);
});
test('authorization, unavailable sources, and export contracts',()=>{
 assert.match(sql,/auth.uid\(\) is null/);assert.match(sql,/v_report := public.buklod_scope_faith_monitoring_period_v1/);assert.match(sql,/from public,anon/);assert.match(sql,/'children_story_count',null/);
 for(const field of ['reading_approved_count','devotion_completed_count','abaka_completed_count','saliksik_completed_count','children_story_count','bible_chapter_count','children_teaching_count','mentor_session_count','mentee_session_count','mentees_reached_count']) assert.ok(lib.includes('displayAccomplishment(member.'+field+')'));
 assert.match(ui,/ACCOMPLISHMENT_METRICS.map/);assert.match(lib,/Not available/);assert.match(lib,/members.some/);
});
