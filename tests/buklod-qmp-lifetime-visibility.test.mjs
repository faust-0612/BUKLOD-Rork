import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCommunityQmpHistory } from '../src/lib/buklodQmpHistory.ts';

const read = path => readFileSync(path,'utf8');

test('Lifetime QMP is sum across periods; no reset on calendar or payout',()=>{
 const result=parseCommunityQmpHistory({
  lifetime_qmp:105,periods:[
   {period_key:'2026-11',qualified_qmp:0,held_qmp:0,status:'OPEN'},
   {period_key:'2026-10',qualified_qmp:100,held_qmp:2,status:'OPEN'},
   {period_key:'2026-09',qualified_qmp:5,held_qmp:0,status:'OPEN'}
  ]});
 assert.equal(result?.lifetime_qmp,105);
 assert.deepEqual(result?.periods.map(p=>p.qualified_qmp),[0,100,5]);
});

test('Incomplete, invalid or inconsistent QMP history never silently becomes zero',()=>{
 for(const bad of [null,{}, {lifetime_qmp:0}, {lifetime_qmp:50,periods:[]},
  {lifetime_qmp:1,periods:[{period_key:'2026-11',qualified_qmp:-1,held_qmp:0,status:'OPEN'}]},
  {lifetime_qmp:2,periods:[{period_key:'2026-10',qualified_qmp:1,held_qmp:0,status:'OPEN'},
    {period_key:'2026-10',qualified_qmp:1,held_qmp:0,status:'OPEN'}]}]){
  assert.equal(parseCommunityQmpHistory(bad),null);
 }
 assert.deepEqual(parseCommunityQmpHistory({lifetime_qmp:0,periods:[]}),
  {lifetime_qmp:0,periods:[]});
});

test('Private history RPC does not touch monthly settlement and payout logic',()=>{
 const sql=read('supabase/migrations/20261101052000_buklod_qmp_lifetime_read_v1.sql');
 assert.match(sql,/WHERE a.user_id = v_actor/);
 assert.match(sql,/auth.uid\(\)/);
 assert.match(sql,/REVOKE ALL ON FUNCTION/);
 assert.match(sql,/TO authenticated/);
 assert.doesNotMatch(sql,/\b(?:UPDATE|DELETE|TRUNCATE|DROP|INSERT)\s+(?:INTO\s+|FROM\s+)?private\./i);
 assert.doesNotMatch(sql,/\bbuklod_community_user_share_allocations\b/);
 assert.doesNotMatch(sql,/\bbuklod_r38_referral_withdrawals\b/);
});

test('Both contribution screens show real lifetime and historical monthly rows without changing money calculations',()=>{
 const card=read('src/components/BuklodCommunityContributionCard.tsx');
 const detail=read('src/app/community-contribution.tsx');
 const client=read('src/lib/buklodCommunityContributionEconomy.ts');
 assert.match(card,/Lifetime QMP: \{history \? history.lifetime_qmp.toLocaleString\(\) : '—'\}/);
 assert.match(detail,/label="LIFETIME QMP"/);
 assert.match(detail,/QMP HISTORY · ALL MONTHS/);
 assert.match(detail,/history.periods.map\(/);
 assert.match(client,/get_my_buklod_community_qmp_history_v1/);
 assert.match(card,/setHistory\(null\); \/\/ Account-scoped history/);
 assert.match(detail,/historyReport\?\.owner === userId/);
 assert.match(card,/never delay the existing Wall QMP paint/);
 assert.doesNotMatch(card,/setData\(\{[^}]*this_month_qmp:\s*0/);
});
