import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/20261111152500_buklod_mutual_engagement_r4.sql',import.meta.url),'utf8');
test('rollout is opt-in and never modifies historical balances or QMP/BCU',()=>{
 assert.match(sql,/enabled boolean NOT NULL DEFAULT false/i);
 assert.match(sql,/VALUES\(1,false,now\(\)\)/);
 assert.doesNotMatch(sql,/(UPDATE|DELETE)\s+public\.buklod_points_ledger/i);
 assert.doesNotMatch(sql,/INSERT INTO private\.buklod_community_qmp_events/i);
 assert.doesNotMatch(sql,/UPDATE private\.buklod_r36_economy_policy_versions/i);
});
test('progressive verified likes and comment counts, monotonic creator settlement',()=>{
 for(const n of [5,10,25,50,100,250,500])assert.ok(sql.includes('v_likes>='+n));
 for(const n of [5,10,25,50,100,250])assert.ok(sql.includes('v_comments>='+n));
 assert.match(sql,/qualification_state='qualified'/);
 assert.match(sql,/v_target_cp := greatest\(/);
 assert.match(sql,/least\(600,\s*5 \+/);
 assert.match(sql,/r4:creator-impact:/);
 assert.match(sql,/v_cp_source_key :=/);
});
test('commenter milestone and three-user support chain use caps, idempotency and real replies',()=>{
 assert.match(sql,/WHEN v_likes>=25 THEN 10 WHEN v_likes>=10 THEN 5/);
 assert.match(sql,/v_comment_count<3 OR v_participants<2 OR v_turns<1/);
 assert.match(sql,/v_already>=2/);
 assert.match(sql,/20-v_today/);
 assert.match(sql,/60-v_day,300-v_week/);
 assert.match(sql,/ON CONFLICT\(user_id,source_key\) DO NOTHING/i);
 assert.match(sql,/AFTER INSERT ON public\.comment_reactions/i);
});
