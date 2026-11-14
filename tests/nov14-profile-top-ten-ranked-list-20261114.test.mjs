import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseBuklodProfileTopTen} from '../src/lib/buklodProfileRankings.ts';
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const row = (rank, n, points = 100) => ({rank_position: rank, user_id: id(n), full_name: 'Member ' + n, total_points: points});

test('only real server rank positions 1–10 display, sorted and not invented from array order',()=>{
 const result=parseBuklodProfileTopTen([row('3',3,40),row('1',1,150),row('2',2,100)]);
 assert.deepEqual(result?.map(r=>r.rank_position),[1,2,3]);
 assert.equal(result?.[0].total_points,150);
 assert.equal(parseBuklodProfileTopTen([])?.length,0,'never fabricate missing ranks 4–10');
});
test('refuse corrupt, duplicate, negative, out-of-Top-10 or untrusted rankings',()=>{
 for(const value of [null,{},[row(11,1)],[row(0,1)], [row(1,1),row(1,2)],
   [row(1,1),row(2,1)],[{...row(1,1),total_points:-1}],
   [{...row(1,1),rank_position:'1.5'}],
   [{...row(1,1),user_id:'not-a-uuid'}],
   Array.from({length:11},(_,i)=>row(i+1,i+1))])
  assert.equal(parseBuklodProfileTopTen(value),null,JSON.stringify(value)?.slice(0,120));
});
test('Profile uses existing authenticated bounded Points RPC, on-focus refresh and account isolation',()=>{
 const view=read('src/components/BuklodProfileTopTenRankings.tsx');
 const me=read('src/app/(tabs)/me.tsx');
 assert.match(view,/\.rpc\('get_buklod_points_leaderboard'/);
 assert.ok(view.includes('p_period: period'));
 assert.ok(view.includes('p_limit: 10'));
 assert.ok(view.includes('p_church_id: null'));
 assert.ok(view.includes('viewerId !== userId'));
 assert.ok(view.includes('useFocusEffect(useCallback'));
 assert.ok(view.includes('active = false'));
 assert.ok(view.includes('12000'));
 assert.ok(view.includes('Retry ranking'));
 assert.ok(view.includes('parseBuklodProfileTopTen(response?.data)'));
 assert.ok(view.includes('item.rank_position'));
 assert.ok(view.includes('item.total_points.toLocaleString'));
 assert.ok(view.includes('Only server-qualified members appear'));
 assert.match(me,/<BuklodProfileTopTenRankings userId=\{profile\.id\}/);
 assert.ok(me.indexOf('<BuklodProfileTopTenRankings')<me.indexOf('<BuklodNativeSponsoredCard'));
 assert.doesNotMatch(view,/service_role|SUPABASE_SERVICE_ROLE|index\s*\+\s*1/);
});
