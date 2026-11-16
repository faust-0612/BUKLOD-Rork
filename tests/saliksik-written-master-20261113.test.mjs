import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/20261113221000_saliksik_written_master_reward_r2.sql');
const ui=read('src/app/scope/saliksik.tsx');
const admin=read('src/app/admin/saliksik-library.tsx');
const client=read('src/lib/saliksikClient.ts');
const fixture=read('tests/fixtures/saliksik_pg_integration.sql');
test('Written Master requires 3 substantive essays after all eight verified objective investigations',()=>{
 assert.match(sql,/saliksik_master_submit_v1/);
 assert.match(sql,/v_count<>8 THEN RAISE EXCEPTION 'complete_all_eight_investigations_first'/);
 assert.match(sql,/jsonb_array_length\(p_answers\)<>3/);
 assert.match(sql,/BETWEEN 220 AND 4000/);
 assert.match(sql,/saliksik_master_pending_uniq/);
 assert.match(ui,/WRITTEN MASTER ASSESSMENT/);
 assert.match(client,/saliksikMasterSubmit/);
});
test('Master credit demands human source verification, five-scored rubric, 80 overall and 70 core',()=>{
 assert.match(sql,/p_citations_verified boolean,p_feedback text/);
 assert.match(sql,/five_competency_scores_required/);
 assert.match(sql,/evidence'\)::int>=70/);
 assert.match(sql,/context'\)::int>=70/);
 assert.match(sql,/reasoning'\)::int>=70/);
 assert.match(sql,/v_pass:=\(\(v_grade->>'score'\)::int>=80/);
 assert.match(sql,/self_review_forbidden/);
 assert.match(sql,/saliksik_master' AND r.is_active/);
 assert.match(sql,/VALUES\(a.user_id,'credit',35,'saliksik_master'/);
 assert.match(admin,/SOURCE-VERIFIED WRITTEN ASSESSMENT/);
 assert.match(admin,/I independently checked the citations/);
 assert.match(admin,/RECORD REVIEWED RUBRIC/);
});
test('Collection 50 is awarded only when nine parts including Master passed, exactly once',()=>{
 assert.match(sql,/v_required=9 AND v_earned=9/);
 assert.match(sql,/VALUES\(a.user_id,'credit',50,'saliksik_series'/);
 assert.match(sql,/ON CONFLICT\(user_id,source_key\) DO NOTHING/);
 assert.match(sql,/saliksik_series_mastery/);
 assert.match(fixture,/v_sum<>205 OR v_count<>10 OR v_events<>10/);
 assert.doesNotMatch(client,/from\('buklod_points_ledger'\)\.insert/);
});
test('Written responses and scores are private; Admin source-review queue is protected',()=>{
 assert.match(sql,/saliksik_master_submissions ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON public.saliksik_master_submissions FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/saliksik_admin_master_queue_v1/);
 assert.match(sql,/IF NOT public.is_system_admin\(\) THEN RAISE EXCEPTION 'admin_required'/);
 assert.match(sql,/a.user_id=v_user/);
 assert.match(sql,/reviewed_by=auth.uid\(\)/);
});
