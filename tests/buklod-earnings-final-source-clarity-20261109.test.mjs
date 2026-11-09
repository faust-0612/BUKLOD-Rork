import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(p, 'utf8');
const card = read('src/components/BuklodUnifiedEarningsHomeCard.tsx');
const scopeFund = read('src/components/BuklodScopeFundHomeCard.tsx');
const payout = read('src/app/bayanihan/payout-profile.tsx');
const economy = read('src/app/bayanihan/index.tsx');
const adminReader = read('supabase/migrations/20261109032000_buklod_pf_admin_reward_breakdown_v1.sql');
const hub = read('src/app/(tabs)/hub.tsx');
const org = read('src/components/BuklodScopeHomeDashboard.tsx');
const cluster = read('src/components/BuklodClusterHomeCommandCenterImpl.tsx');

test('one personal earnings surface remains separate from all Organization/Cluster funds', () => {
  assert.match(hub, /My Earnings & Contribution Destination/);
  assert.match(org, /<BuklodScopeFundHomeCard/);
  assert.match(cluster, /<BuklodScopeFundHomeCard/);
  assert.doesNotMatch(org, /<BuklodUnifiedEarningsHomeCard/);
  assert.doesNotMatch(cluster, /<BuklodUnifiedEarningsHomeCard/);
  assert.match(card, /get_my_buklod_financial_earnings_breakdown_v1/);
  assert.match(card, /loadMyCommunityContribution\(\)/);
  assert.doesNotMatch(card, /get_buklod_scope_revenue_fund_summary_v1/);
  assert.match(scopeFund, /get_buklod_scope_revenue_fund_summary_v1/);
  assert.doesNotMatch(scopeFund, /get_my_buklod_financial_earnings_breakdown_v1/);
  assert.match(card, /router.push\('\/bayanihan\/payout-profile'/);
  assert.doesNotMatch(card, /request_my_buklod_pf_withdrawal_v2/);
});

test('funded lifetime earnings show four sources without converting historical money into cash', () => {
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
  assert.doesNotMatch(card, /ADMIN_CORRECTION|admin_transfer_buklod_pf_funded_reward_v1/);
});

test('withdrawal excludes estimates, Points and Organization/Cluster funds', () => {
  assert.doesNotMatch(payout, /Request Full Referral Balance/);
  assert.match(payout, /Request all available finalized cash/);
  assert.match(payout, /requestMyBuklodWithdrawalV3\(profile\)/);
  assert.match(payout, /Partial withdrawal is not allowed/);
  assert.match(payout, /System Admin rewards/);
  assert.match(payout, /Preliminary AdMob estimates/);
  assert.match(payout, /Organization\/Cluster funds/);
  assert.match(economy, /One canonical finalized cash wallet/);
});

test('ordinary user wallet never displays platform gross revenue or internal pool percentages', () => {
  assert.match(card, /Personal account only/);
  assert.match(card, /Not finalized, funded, or withdrawable/);
  assert.doesNotMatch(card, /AdMob \(100%\)|Community pool \(/);
  assert.doesNotMatch(card, /scope_id === scopeId|getCommunityRevenueBreakdown/);
});
