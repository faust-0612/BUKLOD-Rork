import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Founder Academy quality snapshot is secured to System Admin and returns only aggregate counters',()=>{
 const sql=read('supabase/migrations/20261124034000_buklod_academy_quality_overview_v1.sql');
 assert.match(sql,/auth\.uid\(\)/);
 assert.match(sql,/public\.is_system_admin\(\)/);
 assert.match(sql,/security definer set search_path=''/);
 assert.match(sql,/revoke all on function public\.buklod_academy_quality_overview_v1/);
 assert.doesNotMatch(sql,/member_name|paper_text|user_id.*jsonb_build_object/);
 assert.doesNotMatch(sql,/update public\.buklod_university|insert into public\.buklod_university/);
});
test('Admin quality UI monitors metrics and contains no actions to grade or grant credits',()=>{
 const screen=read('src/app/admin/academy-research-review.tsx');
 assert.match(screen,/buklod_academy_quality_overview_v1/);
 assert.match(screen,/Stale AI checks/);
 assert.doesNotMatch(screen,/p_approved|Verify & grant UC|buklod_academy_review_research_v1/);
});
