import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/20261118002600_buklod_bible_v4_verified_historical_regrade.sql',import.meta.url),'utf8');
test('historical correction changes only verified incorrect Nehemiah enumerations',()=>{
 assert.match(sql,/where id='v4_h_n05' and kind='enumeration' and reviewed/);
 assert.match(sql,/and submitted_answers \? 'v4_h_n05'/);
 assert.match(sql,/state in \('completed','pending_review'\)/);
 assert.match(sql,/if v_new<=v_old then continue/);
 assert.match(sql,/with ordinality j\(item,ordinal\)/);
 assert.match(sql,/set review_items=v_updated_review/);
 assert.match(sql,/if a\.state='pending_review'/);
});
test('existing completed awards remain idempotent and bounded',()=>{
 assert.match(sql,/private\.buklod_bible_v4_points\(a\.difficulty,v_score\)/);
 assert.match(sql,/coalesce\(v_rule\.max_points_per_event,12\),12/);
 assert.match(sql,/where l\.id=a\.ledger_id and l\.user_id=a\.user_id/);
 assert.match(sql,/on conflict \(user_id,source_key\) do nothing returning id into v_inserted/);
 assert.match(sql,/if v_inserted is null then v_bonus:=0/);
 assert.match(sql,/points_awarded=coalesce\(a\.points_awarded,0\)\+v_bonus/);
 assert.doesNotMatch(sql,/delete from public\.buklod_points_ledger/i);
});
