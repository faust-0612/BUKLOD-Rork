import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const ui=read('src/components/points/BuklodPointsRewardsScreen.tsx');
const cards=read('src/lib/buklodPointsAdBonus.ts');
const rewards=read('src/lib/buklodRewards.ts');
test('staging keeps member pending claims READ-ONLY despite live backend URL',()=>{
 assert.match(ui,/const POINTS_STAGING_READ_ONLY = process.env.EXPO_PUBLIC_APP_ENV !== 'production'/);
 assert.match(ui,/disabled=\{POINTS_STAGING_READ_ONLY \|\| claimBusy/);
 assert.match(ui,/if \(!POINTS_STAGING_READ_ONLY\) onClaim\(item\)/);
 const start=ui.indexOf('const claimOne = useCallback');
 const mutate=ui.indexOf('await claimBuklodRewardEvent(card.event_id)',start);
 assert.ok(start>0 && mutate>start);
 const guard=ui.indexOf('if (POINTS_STAGING_READ_ONLY)',start);
 assert.ok(guard>start && guard<mutate,'guard MUST be before first Points mutation');
 assert.match(ui,/STAGING PREVIEW · Pending rewards are view-only/);
 assert.match(ui,/PENDING \+\$\{item\.points\} · PREVIEW/);
 assert.match(ui,/POINTS_STAGING_READ_ONLY \|\| adBusyLedger/);
});
test('new read paths use existing member-bound RLS tables, no new backend API',()=>{
 assert.match(cards,/\.from\('buklod_points_ledger'\)/);
 assert.match(cards,/\.from\('buklod_reward_events'\)/);
 assert.match(cards,/viewerId !== accountId/);
 assert.doesNotMatch(cards,/get_my_buklod_pending_claim_cards_v1/);
 assert.doesNotMatch(rewards,/__buklod_claim_all_eligible__/);
 assert.doesNotMatch(ui,/CLAIM ALL/);
 assert.equal(existsSync('supabase/migrations/20261124014500_buklod_individual_points_claim_rewarded_ssv_v1.sql'),false);
 assert.equal(existsSync('supabase/functions/buklod-admob-points-ssv/index.ts'),false);
});
test('new Google rewarded Points backend remains OFF for staging',()=>{
 assert.match(cards,/process\.env\.EXPO_PUBLIC_APP_ENV === 'production'/);
 assert.match(cards,/if \(!isVerifiedRewardBackendEnabled\)/);
 assert.match(ui,/bonusStatus\?\.enabled && bonusStatus.remaining > 0/);
 assert.match(ui,/if \(POINTS_STAGING_READ_ONLY \|\| adBusyLedger/);
 assert.doesNotMatch(cards,/awardPoints|bayanihan_ledger|buklod_community_qmp_events/);
});
test('full account-scoping and paginated individual reward previews stay intact',()=>{
 assert.match(ui,/key=\{accountId \|\| 'signed-out'\}/);
 assert.match(ui,/loadBuklodClaimCards\(0, accountId\)/);
 assert.match(ui,/loadBuklodClaimCards\(claimCards.length, accountId\)/);
 assert.match(ui,/LOAD MORE INDIVIDUAL REWARDS/);
});
