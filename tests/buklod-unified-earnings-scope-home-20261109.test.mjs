import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(p, 'utf8');
const personal = read('src/components/BuklodUnifiedEarningsHomeCard.tsx');
const scoped = read('src/components/BuklodScopeFundHomeCard.tsx');
const migration = read('supabase/migrations/20261109023000_buklod_scope_revenue_fund_visibility_v1.sql');
const hub = read('src/app/(tabs)/hub.tsx');
const org = read('src/components/BuklodScopeHomeDashboard.tsx');
const cluster = read('src/components/BuklodClusterHomeCommandCenterImpl.tsx');

test('canonical public Hub provides personal Economy navigation, never duplicates scope funds', () => {
  assert.match(hub, /BUKLOD Hub/);
  assert.match(hub, /router.push\('\/bayanihan'/);
  assert.doesNotMatch(hub, /<BuklodScopeFundHomeCard/);
  assert.match(personal, /get_my_buklod_financial_earnings_breakdown_v1/);
  assert.match(personal, /loadMyCommunityContribution\(\)/);
  assert.doesNotMatch(personal, /get_buklod_scope_revenue_fund_summary_v1/);
});

test('Organization and Cluster homes show only membership-scoped fund, never personal wallet', () => {
  assert.match(org, /<BuklodScopeFundHomeCard scopeId=\{scope.scope_id\}/);
  assert.match(cluster, /<BuklodScopeFundHomeCard scopeId=\{scope.scope_id\}/);
  assert.doesNotMatch(org, /<BuklodUnifiedEarningsHomeCard/);
  assert.doesNotMatch(cluster, /<BuklodUnifiedEarningsHomeCard/);
  assert.match(scoped, /get_buklod_scope_revenue_fund_summary_v1/);
  assert.match(scoped, /CANONICAL_FUNDED_COMMUNITY_LEDGER/);
  assert.match(scoped, /member_withdrawal_allowed !== false/);
  assert.doesNotMatch(scoped, /get_my_buklod_financial_earnings_breakdown_v1|loadMyCommunityContribution|AdMob \(100%\)/);
});

test('scoped fund API enforces active membership and never exposes member wallets', () => {
  assert.match(migration, /auth.uid\(\)/);
  assert.match(migration, /buklod_scope_can_access_v1\(p_scope_id,v_actor\)/);
  assert.match(migration, /revoke all on function public.get_buklod_scope_revenue_fund_summary_v1\(uuid\) from public,anon/);
  assert.match(migration, /grant execute on function public.get_buklod_scope_revenue_fund_summary_v1\(uuid\) to authenticated/);
  assert.match(migration, /'member_withdrawal_allowed',false/);
  assert.match(migration, /CANONICAL_FUNDED_COMMUNITY_LEDGER/);
  assert.doesNotMatch(migration, /private\.buklod_pf_cash_ledger|create.*withdrawal|wallet_credit/);
});
