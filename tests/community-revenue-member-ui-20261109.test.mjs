import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const home = read('src/components/BuklodCommunityContributionCard.tsx');
const details = read('src/app/community-contribution.tsx');
const earnings = read('src/components/BuklodUnifiedEarningsHomeCard.tsx');
const scopeFund = read('src/components/BuklodScopeFundHomeCard.tsx');
const source = read('src/lib/buklodCommunityContributionEconomy.ts');
const admin = read('src/app/admin/economy-operations.tsx');

 test('member screens display personal contributions and estimates, not underlying revenue math', () => {
  assert.match(home, /YOUR ESTIMATED REVENUE SHARE/);
  assert.match(home, /THIS MONTH QMP/);
  assert.match(home, /QUALIFIED CONTENT/);
  assert.match(home, /MEANINGFUL REPLIES/);
  assert.match(home, /NOT WITHDRAWABLE/);
  assert.match(details, /YOUR EARNINGS/);
  assert.match(details, /ESTIMATED REVENUE SHARE|Estimated share/);
  assert.match(earnings, /FINALIZED AVAILABLE CASH/);
  for (const text of [home, details, earnings]) {
    assert.doesNotMatch(text, /AdMob estimate \(100%\)|AdMob \(100%\)|ESTIMATED ADMOB REVENUE|Total app estimated revenue|SEE FULL 100%/);
    assert.doesNotMatch(text, /memberPoolFraction|memberGrossFraction|revenue\.grossMinor|revenue\.poolMinor|data\.estimate_label/);
    assert.doesNotMatch(text, /getCommunityRevenueBreakdown/);
  }
  assert.doesNotMatch(home + details, /SHARE WEIGHT|Share-weight trend|pp share-weight trend/);
});

test('financial source processing and system admin inspection remain intact', () => {
  assert.match(source, /getCommunityRevenueBreakdown/);
  assert.match(admin, /AdMob preliminary estimate/);
  assert.match(earnings, /get_my_buklod_financial_earnings_breakdown_v1/);
  assert.doesNotMatch(earnings, /get_buklod_scope_revenue_fund_summary_v1/);
  assert.match(scopeFund, /get_buklod_scope_revenue_fund_summary_v1/);
  assert.match(earnings, /router.push\('\/bayanihan\/payout-profile'/);
});
