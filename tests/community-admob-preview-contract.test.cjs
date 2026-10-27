const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const sql = readFileSync(
  'supabase/migrations/20261027161000_buklod_community_admob_provisional_estimates_v1.sql',
  'utf8',
);
const importer = readFileSync(
  'supabase/functions/buklod-admob-revenue-preview-sync/index.ts',
  'utf8',
);
const client = readFileSync('src/lib/buklodCommunityContributionEconomy.ts', 'utf8');
const card = readFileSync('src/components/BuklodCommunityContributionCard.tsx', 'utf8');
const admin = readFileSync('src/app/admin/economy-operations.tsx', 'utf8');
const schedule = readFileSync('.github/workflows/buklod_admob_provisional_sync.yml', 'utf8');

test('private, noncash preview requires a real current AdMob source and qualified QMP', () => {
  assert.match(sql, /estimate_status','SOURCE_NOT_CONNECTED'/);
  assert.match(sql, /estimate_status','STALE'/);
  assert.match(sql, /v_snapshot\.observed_at<now\(\)-interval '7 days'/);
  assert.match(sql, /v_qmp:=greatest/);
  assert.match(sql, /v_total:=greatest/);
  assert.match(sql, /v_pool:=floor\(v_snapshot\.amount_minor::numeric\*v_bps\/10000\)::bigint/);
  assert.match(sql, /v_share:=case when v_total>0 and v_qmp>0/);
  assert.match(sql, /'estimate_below_cent'/);
  assert.match(client, /get_my_buklod_community_contribution_live_v1/);
  assert.match(client, /if \(!rpcMissing\(error\)\) throw error/);
  assert.match(card, /data\.estimate_below_cent \? 'Below ₱0\.01'/);
});

test('estimates have strict write authorization and cannot automatically pay or finalize money', () => {
  assert.match(sql, /public\.buklod_is_system_admin\(\)/);
  assert.match(sql, /v_mode='OFFICIAL_ADMOB_API' and v_role<>'service_role'/);
  assert.match(sql, /revoke all on private\.buklod_community_admob_estimate_snapshots from public, anon, authenticated/);
  assert.match(sql, /revoke all on function public\.get_my_buklod_community_contribution_live_v1\(\) from public,anon/);
  assert.match(importer, /admin_set_buklod_community_admob_estimate_v1/);
  assert.doesNotMatch(importer, /admin_finalize_buklod|payout_processing|credit_wallet|process_withdrawal/i);
  assert.match(admin, /This does not finalize revenue, fund balances, or unlock withdrawals/);
});

test('official API path scopes to one BUKLOD app and PHP mediation earnings only', () => {
  assert.match(importer, /BUKLOD_ADMOB_APP_ID/);
  assert.match(importer, /mediationReport:generate/);
  assert.match(importer, /dimension: 'APP', matchesAny/);
  assert.match(importer, /currencyCode: 'PHP'/);
  assert.match(importer, /totalMicros \+= BigInt\(micros\)/);
  assert.match(importer, /if \(!token \|\| token !== serviceRole\)/);
  assert.match(schedule, /BUKLOD_ADMOB_SYNC_ENABLED == 'true'/);
});

test('QMP-weighted example: projection is independent from cash entitlement', () => {
  const approximateMinor = (revenueMinor, poolBps, qmp, total) =>
    total > 0 ? Math.floor(Math.floor(revenueMinor * poolBps / 10000) * qmp / total) : null;
  assert.equal(approximateMinor(2000, 3000, 60, 600), 60);
  assert.equal(approximateMinor(2000, 3000, 0, 600), 0);
  assert.equal(approximateMinor(2000, 3000, 60, 0), null);
  const tiny = approximateMinor(1, 3000, 1, 5820);
  assert.equal(tiny, 0);
  assert.equal(tiny < 1 && 1 > 0, true); // < ₱0.01 presentation only
});
