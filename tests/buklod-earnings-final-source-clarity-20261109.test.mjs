import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(p, 'utf8');
const card = read('src/components/BuklodUnifiedEarningsHomeCard.tsx');
const payout = read('src/app/bayanihan/payout-profile.tsx');
const economy = read('src/app/bayanihan/index.tsx');
const adminReader = read('supabase/migrations/20261109032000_buklod_pf_admin_reward_breakdown_v1.sql');
const home = read('src/app/(tabs)/home.tsx');
const org = read('src/components/BuklodScopeHomeDashboard.tsx');
const cluster = read('src/components/BuklodClusterHomeCommandCenterImpl.tsx');

test('all public/org/cluster Homes show real-money sources and only one cash withdrawal door', () => {
  assert.match(home, /<BuklodUnifiedEarningsHomeCard \/>/);
  assert.match(org, /<BuklodUnifiedEarningsHomeCard scopeId=\{scope.scope_id\}/);
  assert.match(cluster, /<BuklodUnifiedEarningsHomeCard scopeId=\{scope.scope_id\}/);
  assert.match(card, /get_my_buklod_financial_earnings_breakdown_v1/);
  assert.match(card, /loadMyCommunityContribution\(\)/);
  assert.match(card, /get_buklod_scope_revenue_fund_summary_v1/);
  assert.match(card, /router.push\('\/bayanihan\/payout-profile'/);
  assert.doesNotMatch(card, /request_my_buklod_pf_withdrawal_v2/);
});

test('funded lifetime earnings show all four origins independently, without double counting unavailable cash', () => {
  assert.match(card, /Finalized revenue \/ user pool/);
  assert.match(card, /First-line referral revenue/);
  assert.match(card, /One-time referral rewards/);
  assert.match(card, /System Admin funded rewards/);
  assert.match(card, /cash\.lifetime_earned\?\.user_pool_php/);
  assert.match(card, /cash\.lifetime_earned\?\.first_line_php/);
  assert.match(card, /cash\.lifetime_earned\?\.referral_reward_php/);
  assert.match(card, /cash\.lifetime_earned\?\.admin_funded_reward_php/);
  assert.match(card, /cash\.cash_status\?\.available_php|cash\?\.cash_status\?\.available_php/);
  assert.match(card, /reserved and paid cash cannot be requested again/);
  assert.match(adminReader, /'admin_funded_reward_php'/);
  assert.match(adminReader, /'funding_class'='ADMIN_FUNDED_REWARD'/);
  assert.doesNotMatch(card, /Number\(cash\.lifetime_earned\?\.admin_funded_reward_php \?\? 0\)/);
  assert.doesNotMatch(card, /ADMIN_CORRECTION|admin_transfer_buklod_pf_funded_reward_v1/);
});

test('withdrawal confirmation is NOT incorrectly referral-only and excludes unfinalized entitlements', () => {
  assert.doesNotMatch(payout, /Request Full Referral Balance/);
  assert.match(payout, /Request all available finalized cash/);
  assert.match(payout, /requestMyBuklodWithdrawalV3\(profile\)/);
  assert.match(payout, /Partial withdrawal is not allowed/);
  assert.match(payout, /System Admin rewards/);
  assert.match(payout, /Preliminary AdMob estimates/);
  assert.match(payout, /Organization\/Cluster funds/);
  assert.match(economy, /One canonical finalized cash wallet/);
  assert.match(economy, /Estimated AdMob revenue, QMP, Points, pending rewards/);
});

test('cash visibility never treats scope funds or points as personal payout', () => {
  assert.match(card, /Personal account only/);
  assert.match(card, /member-withdrawable|member's personal withdrawal/);
  assert.match(card, /Not finalized, funded, or withdrawable/);
  assert.match(card, /scope_id === scopeId/);
  assert.match(card, /getCommunityRevenueBreakdown\(contribution\)/);
});
