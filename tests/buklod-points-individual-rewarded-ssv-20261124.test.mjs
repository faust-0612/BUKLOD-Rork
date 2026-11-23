import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

const read = (path) => readFileSync(path, 'utf8');
const screen = read('src/components/points/BuklodPointsRewardsScreen.tsx');
const rewards = read('src/lib/buklodRewards.ts');
const points = read('src/lib/buklodPointsAdBonus.ts');
const native = read('src/lib/buklodPointsRewardedAd.native.ts');
const web = read('src/lib/buklodPointsRewardedAd.web.ts');
const sql = read('supabase/migrations/20261124014500_buklod_individual_points_claim_rewarded_ssv_v1.sql');
const webhook = read('supabase/functions/buklod-admob-points-ssv/index.ts');

test('manual individual claim is the only current Points screen path', () => {
  assert.match(screen, /claimBuklodRewardEvent\(card\.event_id\)/);
  assert.match(screen, /onClaim=\{\(card\)/);
  assert.match(screen, /loadBuklodClaimCards/);
  assert.match(screen, /LOAD MORE INDIVIDUAL REWARDS/);
  assert.doesNotMatch(screen, /CLAIM ALL|__buklod_claim_all_eligible__|claimBuklodRewardGroup\(/);
  assert.doesNotMatch(rewards, /claim_all_my_buklod_reward_events_v1|CLAIM_ALL_COMPAT_EVENT_ID/);
  assert.match(sql, /get_my_buklod_pending_claim_cards_v1/);
  assert.match(sql, /join public\.buklod_reward_events e/);
  assert.match(sql, /e\.user_id=v_uid/);
  assert.match(sql, /l\.claim_state='pending'/);
});

test('verified optional ad never gates manual claim or fakes a client-side balance', () => {
  assert.match(screen, /await claimBuklodRewardEvent\(card\.event_id\)/);
  assert.match(screen, /await showBuklodAdOpportunity\('points_claim_success'\)/);
  assert.match(screen, /if \(await waitForBuklodAdBonus\(session\.nonce\)\)/);
  assert.match(native, /serverSideVerificationOptions: \{ userId, customData: nonce \}/);
  assert.match(native, /isBuklodRewardedAdAllowed\('rewarded_generic'\)/);
  assert.match(native, /rewardInFlight = false/);
  assert.match(native, /AdEventType\.ERROR/);
  assert.match(native, /RewardedAdEventType\.EARNED_REWARD/);
  assert.match(web, /shown: false, earned: false/);
  assert.doesNotMatch(native, /buklod_points_ledger|awardPoints|creditPoints/);
  assert.doesNotMatch(points, /insert\(|upsert\(|update\(/);
});

test('bonus defaults disabled and remains entirely outside QMP/cash settlement', () => {
  assert.match(sql, /enabled boolean not null default false/);
  assert.match(sql, /reward_points integer not null default 5/);
  assert.match(sql, /daily_limit integer not null default 20/);
  assert.match(sql, /buklod_ad_points_one_credit_per_activity/);
  assert.match(sql, /status='credited'/);
  assert.match(sql, /buklod_is_official_system_admin/);
  assert.match(sql, /source_point_id=p_source_point_id/);
  assert.match(sql, /l\.activity_type <> 'admob_rewarded_bonus'/);
  assert.match(sql, /'admob_rewarded_bonus'/);
  assert.match(sql, /'claimed'/);
  assert.match(sql, /grant execute on function public\.confirm_buklod_ad_points_bonus_ssv_v1\(uuid,uuid,text\)/);
  assert.match(sql, /to service_role/);
  assert.doesNotMatch(sql, /insert into (?:private\.)?buklod_community_qmp|insert into (?:public\.)?bayanihan_ledger/i);
});

test('Google SSV needs unmodified signed payload, exact unit, nonce and replay protection', () => {
  assert.match(webhook, /GOOGLE_KEYS_URL/);
  assert.match(webhook, /crypto\.subtle\.verify/);
  assert.match(webhook, /new TextEncoder\(\)\.encode\(match\[1\]\)/);
  assert.match(webhook, /params\.getAll\(name\)\.length !== 1/);
  assert.match(webhook, /adUnit !== expectedUnit/);
  assert.match(webhook, /verifyGoogleSsvUrl\(new URL\(request\.url\)\)/);
  assert.match(webhook, /confirm_buklod_ad_points_bonus_ssv_v1/);
  assert.match(sql, /p_transaction_id/);
  assert.match(sql, /transaction_id text unique/);
  assert.match(sql, /v_attempt\.status='credited' and v_attempt\.transaction_id=p_transaction_id/);
  assert.match(sql, /expires_at <= now\(\)/);
});

test('DER ECDSA signature is converted to WebCrypto P1363 correctly', () => {
  const start = webhook.indexOf('export function derSignatureToP1363(');
  const end = webhook.indexOf('async function getGoogleKeys():', start);
  assert.ok(start >= 0 && end > start);
  const code = stripTypeScriptTypes(webhook.slice(start, end), { mode: 'strip' })
    .replace('export function', 'function');
  const converter = vm.runInNewContext(code + '\nderSignatureToP1363');
  const encodeInteger = (v) => {
    let i = 0; while (i < v.length - 1 && v[i] === 0) i++;
    let val = v.slice(i);
    if (val[0] & 0x80) val = Uint8Array.from([0, ...val]);
    return Uint8Array.from([2, val.length, ...val]);
  };
  const p1363 = new Uint8Array(64);
  for (let i = 0; i < 64; i++) p1363[i] = (i * 7 + 17) % 256;
  p1363[0] = 0x80; p1363[32] = 0x90;
  const r = encodeInteger(p1363.slice(0,32));
  const s = encodeInteger(p1363.slice(32,64));
  const der = Uint8Array.from([0x30, r.length+s.length, ...r, ...s]);
  assert.deepEqual([...converter(der)], [...p1363]);
  assert.throws(() => converter(Uint8Array.from([0x30,1,0])), /DER|INTEGER/);
});
