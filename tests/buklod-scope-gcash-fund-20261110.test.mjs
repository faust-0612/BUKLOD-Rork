import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseScopeContributionMinor,normalizeScopeGcashReference} from '../src/lib/buklodScopeFundAmounts.ts';
const read=p=>readFileSync(p,'utf8');
const sql=read('supabase/migrations/20261110090000_buklod_scope_gcash_contributions_v1.sql');
const cluster=read('src/components/BuklodClusterHomeCommandCenterImpl.tsx');
const org=read('src/components/BuklodScopeHomeDashboard.tsx');
const card=read('src/components/BuklodScopeFundCard.tsx');
const route=read('src/app/scope-fund.tsx');

test('exact pesos conversion preserves two decimal places and prevents large/invalid values',()=>{
  assert.equal(parseScopeContributionMinor('₱100'),null);
  assert.equal(parseScopeContributionMinor('1'),100);
  assert.equal(parseScopeContributionMinor('100.01'),10001);
  assert.equal(parseScopeContributionMinor('100.001'),null);
  assert.equal(parseScopeContributionMinor('0.99'),null);
  assert.equal(parseScopeContributionMinor('1000001'),null);
  assert.equal(parseScopeContributionMinor('-1'),null);
  assert.equal(parseScopeContributionMinor('1e5'),null);
  assert.equal(parseScopeContributionMinor('1000000.00'),100000000);
  assert.equal(normalizeScopeGcashReference(' abc 12345 '),'ABC12345');
  assert.equal(normalizeScopeGcashReference('ab'),null);
});

test('scope cards replace personal payout card without affecting public Home',()=>{
  const home=read('src/app/(tabs)/home.tsx');
  assert.match(home,/<BuklodUnifiedEarningsHomeCard \/>/);
  assert.match(org,/<BuklodScopeFundCard scopeId=\{scope.scope_id\} scopeName=\{scope.name\}/);
  assert.match(cluster,/<BuklodScopeFundCard scopeId=\{scope.scope_id\} scopeName=\{scope.name\}/);
  assert.doesNotMatch(org+cluster,/<BuklodUnifiedEarningsHomeCard/);
  assert.doesNotMatch(card,/\/bayanihan\/payout-profile|MY EARNINGS & WITHDRAWAL/);
  assert.match(card,/get_buklod_scope_gcash_fund_dashboard_v1/);
});

test('report-only GCash flow cannot generate money before independent verification',()=>{
  assert.match(sql,/giving_scope_receivers/);
  assert.match(sql,/Active scope membership required/);
  assert.match(sql,/unique \(receiver_mobile, gcash_reference\)/);
  assert.match(sql,/status text not null default 'REPORTED'/);
  assert.match(sql,/cannot approve your own contribution/);
  assert.match(sql,/giving_can_manage_receiver\(v_report.scope_id,v_actor\)/);
  assert.match(sql,/on conflict\(event_key\) do nothing/);
  assert.match(sql,/MANUAL_GCASH_CONTRIBUTION/);
  assert.match(sql,/revoke all on table private.buklod_scope_gcash_contribution_reports_v1/);
  assert.doesNotMatch(sql,/private\.buklod_pf_cash_ledger|wallet_credit/);
  assert.match(route,/REPORT MY GCASH CONTRIBUTION/);
  assert.match(route,/independently match actual GCash account history/);
});
