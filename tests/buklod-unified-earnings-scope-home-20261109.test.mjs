import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(path, 'utf8');
const wallet = read('src/components/BuklodUnifiedEarningsHomeCard.tsx');
const migration = read('supabase/migrations/20261109023000_buklod_scope_revenue_fund_visibility_v1.sql');
const home = read('src/app/(tabs)/home.tsx');
const org = read('src/components/BuklodScopeHomeDashboard.tsx');
const cluster = read('src/components/BuklodClusterHomeCommandCenterImpl.tsx');

test('all three Home entry points show the same authenticated user wallet', () => {
  assert.match(home, /<BuklodUnifiedEarningsHomeCard \/>/);
  assert.match(org, /<BuklodUnifiedEarningsHomeCard scopeId=\{scope.scope_id\}/);
  assert.match(cluster, /<BuklodUnifiedEarningsHomeCard scopeId=\{scope.scope_id\}/);
  assert.match(wallet, /useAuth\(\)/);
  assert.match(wallet, /get_my_buklod_financial_earnings_breakdown_v1/);
  assert.match(wallet, /loadMyCommunityContribution\(\)/);
  assert.match(wallet, /get_buklod_scope_revenue_fund_summary_v1/);
  assert.doesNotMatch(wallet, /request_my_buklod_pf_withdrawal_v2/);
});

test('estimated source cannot masquerade as available cash or Organization funds', () => {
  assert.match(wallet, /cash\?\.cash_status\?\.available_php/);
  assert.match(wallet, /contribution\.estimate_below_cent/);
  assert.match(wallet, /Not finalized, funded, or withdrawable/);
  assert.match(wallet, /Personal account only/);
  assert.match(wallet, /CANONICAL_FUNDED_COMMUNITY_LEDGER/);
  assert.match(wallet, /scope_id === scopeId/);
  assert.match(wallet, /router.push\('\/bayanihan\/payout-profile'/);
  assert.doesNotMatch(wallet, /ADMIN_CORRECTION|cash_ledger.*insert|sb_secret_/i);
});

test('scoped fund API enforces current-user membership and never exposes member wallets', () => {
  assert.match(migration, /auth.uid\(\)/);
  assert.match(migration, /buklod_scope_can_access_v1\(p_scope_id,v_actor\)/);
  assert.match(migration, /revoke all on function public.get_buklod_scope_revenue_fund_summary_v1\(uuid\) from public,anon/);
  assert.match(migration, /grant execute on function public.get_buklod_scope_revenue_fund_summary_v1\(uuid\) to authenticated/);
  assert.match(migration, /'member_withdrawal_allowed',false/);
  assert.match(migration, /CANONICAL_FUNDED_COMMUNITY_LEDGER/);
  assert.doesNotMatch(migration, /private\.buklod_pf_cash_ledger|create.*withdrawal|wallet_credit/);
});
