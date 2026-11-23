import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

const read = path => readFileSync(path, 'utf8');
const reader = read('src/lib/buklodPointsAdBonus.ts');
const view = read('src/components/points/BuklodPointsRewardsScreen.tsx');
const reward = read('src/lib/buklodRewards.ts');

function createReader({count = 102, orphan = false, member = 'member-one'} = {}) {
  const ledgers = Array.from({ length: count }, (_, i) => ({
    id: 'ledger-' + i,
    points: 5 + i, activity_type: 'community_post',
    description: 'Story ' + i, created_at: '2026-11-24T01:00:00Z',
  }));
  const events = ledgers.slice(0, orphan ? -1 : undefined).map((r,i) => ({
    id: 'event-' + i, source_point_id: r.id,
  }));
  const conditions = [];
  const requests = [];
  const supabase = {
    auth: { getSession: async () => ({
      data: { session: { user: { id: member } } }, error: null,
    }) },
    from(table) {
      requests.push(table);
      const obj = {
        select() { return this; },
        eq(field, value) { conditions.push([table, field, value]); return this; },
        is() { return this; },
        order() { return this; },
        range(start, end) {
          assert.equal(table, 'buklod_points_ledger');
          return Promise.resolve({data: ledgers.slice(start,end+1), error:null});
        },
        in(field, values) {
          assert.equal(table, 'buklod_reward_events');
          assert.equal(field, 'source_point_id');
          return Promise.resolve({data: events.filter(v => values.includes(v.source_point_id)),error:null});
        },
      };
      return obj;
    },
  };
  const a=reader.indexOf('export async function loadBuklodClaimCards(');
  const b=reader.indexOf('const isVerifiedRewardBackendEnabled', a);
  assert.ok(a>=0 && b>a, 'manual claiming reader exists');
  const code = stripTypeScriptTypes(reader.slice(a,b), {mode:'strip'})
    .replace('export async function','async function');
  const load=vm.runInNewContext(code+'\nloadBuklodClaimCards', {supabase,Math,Number,Map,Error,String});
  return {load,conditions,requests};
}
test('list individual claims using existing RLS tables and account ownership', async()=>{
  const {load,conditions,requests}=createReader();
  const first=await load(0,'member-one'), second=await load(100,'member-one');
  assert.equal(first.length,100);
  assert.equal(second.length,2);
  assert.equal(first[0].event_id,'event-0');
  assert.equal(second[1].ledger_id,'ledger-101');
  assert.ok(requests.includes('buklod_points_ledger'));
  assert.ok(requests.includes('buklod_reward_events'));
  assert.ok(conditions.some(([t,k,v])=>t==='buklod_points_ledger'&&k==='user_id'&&v==='member-one'));
  assert.ok(conditions.some(([t,k,v])=>t==='buklod_reward_events'&&k==='user_id'&&v==='member-one'));
  await assert.rejects(()=>load(0,'someone-else'),/Sign in again/);
});
test('orphan reward is not silently dropped',async()=>{
  const {load}=createReader({count:5,orphan:true});
  await assert.rejects(()=>load(0,'member-one'),/Reward records are still syncing/);
});
test('no backend migration or new RPC needed for staging manual claims',()=>{
  assert.doesNotMatch(reader,/get_my_buklod_pending_claim_cards_v1/);
  assert.match(reader,/\.from\('buklod_points_ledger'\)/);
  assert.match(reader,/\.from\('buklod_reward_events'\)/);
  assert.match(reward,/claim_my_buklod_reward_event/);
  assert.doesNotMatch(reward,/claim_all_my_buklod_reward_events_v1/);
  assert.doesNotMatch(view,/CLAIM ALL|__buklod_claim_all_eligible__/);
  assert.match(view,/LOAD MORE INDIVIDUAL REWARDS/);
  assert.ok(!existsSync('supabase/migrations/20261124014500_buklod_individual_points_claim_rewarded_ssv_v1.sql'));
  assert.ok(!existsSync('supabase/functions/buklod-admob-points-ssv/index.ts'));
});
test('staging cannot initiate new rewarded-point RPCs or trust local earned callbacks',()=>{
  assert.match(reader,/process\.env\.EXPO_PUBLIC_APP_ENV === 'production'/);
  assert.match(reader,/process\.env\.EXPO_PUBLIC_POINTS_REWARDED_BONUS_ENABLED === 'true'/);
  assert.match(reader,/if \(!isVerifiedRewardBackendEnabled\)/);
  assert.match(view,/bonusStatus\?\.enabled === true/);
  assert.match(view,/waitForBuklodAdBonus/);
  assert.match(read('src/lib/buklodPointsRewardedAd.ts'),/buklodPointsRewardedAd.native/);
  assert.doesNotMatch(read('src/lib/buklodPointsRewardedAd.native.ts'),/AdEventType.IMPRESSION/);
  assert.doesNotMatch(reader,/awardPoints|creditPoints|bayanihan_ledger|community_qmp/);
});
