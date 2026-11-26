import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=(p)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Founder is sole routine human oversight; academic results automatic',()=>{
 const q=JSON.parse(source('src/data/academy/bahlIso21001ControlRegister.json'));
 assert.equal(q.human_oversight_policy.per_learner_manual_approval,false);
 assert.equal(q.human_oversight_policy.independent_iso_audit_still_required,true);
 assert.equal(q.certification_claim_allowed,false);
});
test('Admin UI cannot manually approve Academy SALIKSIK or grant UC',()=>{
 const admin=source('src/app/admin/academy-research-review.tsx');
 assert.doesNotMatch(admin,/buklod_academy_review_research_v1|p_approved|Verify & grant UC|Review evidence/);
 const migrate=source('supabase/migrations/20261124033000_buklod_academy_automatic_research_faculty_v2.sql');
 assert.match(migrate,/drop function if exists public\.buklod_academy_review_research_v1/);
});
test('Student submissions auto-trigger the reviewer, recover saved pending work',()=>{
 const ui=source('src/app/academy/research.tsx');
 assert.match(ui,/buklod_academy_submit_research_v1/);
 assert.match(ui,/buklod-academy-research-ai-v2/);
 assert.match(ui,/action:'review'/);
 assert.match(ui,/buklod_academy_my_research_v2/);
 assert.match(ui,/REWORK/);
});
test('Capstone dual automatic evaluation is fail closed for incomplete or conflicting evidence',()=>{
 const edge=source('supabase/functions/buklod-academy-research-ai-v2/index.ts');
 assert.match(edge,/SECOND independent adversarial evaluator/);
 assert.match(edge,/checked\.total>=cfgRule\.passScore/);
 assert.match(edge,/Math\.min\(total,secondary\.score\)/);
 assert.match(edge,/await release\(\)/);
 assert.match(edge,/new_uc:0/);
});
test('No pretend ISO certification nor premature Academy deployment',()=>{
 const q=JSON.parse(source('src/data/academy/bahlIso21001ControlRegister.json'));
 assert.equal(q.quality_claim_allowed,false);
 assert.equal(q.readiness_release_gate,'FAIL_CLOSED_UNTIL_VERIFIED');
 const sql=source('supabase/migrations/20261124020000_buklod_university_internal_academic_r1.sql');
 assert.match(sql,/enabled boolean not null default false/);
});
