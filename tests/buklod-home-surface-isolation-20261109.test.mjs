import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = file => readFileSync(file, 'utf8');
const homeRegistry = read('src/lib/buklodHomeSurfaces.ts');
const layout = read('src/app/(tabs)/_layout.tsx');
const hub = read('src/app/(tabs)/hub.tsx');
const scope = read('src/components/BuklodScopeHomeDashboard.tsx');
const cluster = read('src/components/BuklodClusterHomeCommandCenterImpl.tsx');
const bahay = read('src/components/home/BuklodBahayHome.tsx');
const picker = read('src/components/BuklodContributionDestinationPicker.tsx');
const economy = read('src/app/bayanihan/index.tsx');
const preview = read('src/components/BuklodCommunityContributionCard.tsx');
const detail = read('src/app/community-contribution.tsx');

test('four Home surfaces have canonical names and old public home redirects', () => {
  for (const name of ['PUBLIC_HUB', 'SCOPE_HOME', 'FAMILY_HOME', 'RETIRED_PUBLIC_HOME']) {
    assert.match(homeRegistry, new RegExp(name));
  }
  assert.match(homeRegistry, /\/\(tabs\)\/hub/);
  assert.match(homeRegistry, /\/personal-home/);
  assert.match(layout, /pathname === '\/home'/);
  assert.match(layout, /\/\(tabs\)\/hub/);
  assert.match(hub, /BUKLOD Hub/);
});

test('household and scope dashboards never mount account wallet', () => {
  assert.doesNotMatch(bahay, /BuklodUnifiedEarningsHomeCard|BuklodScopeFundHomeCard|BuklodCommunityContributionCard/);
  assert.doesNotMatch(scope, /BuklodUnifiedEarningsHomeCard/);
  assert.doesNotMatch(cluster, /BuklodUnifiedEarningsHomeCard/);
  assert.match(scope, /BuklodScopeFundHomeCard/);
  assert.match(cluster, /BuklodScopeFundHomeCard/);
});

test('destination chooser uses active membership and server-side authoritative RPC', () => {
  assert.match(economy, /BuklodContributionDestinationPicker/);
  assert.match(picker, /buklod_scope_memberships/);
  assert.match(picker, /membership_status', 'ACTIVE'/);
  assert.match(picker, /set_my_buklod_community_destination_v3/);
  assert.match(picker, /selectedScopeId/);
  assert.match(picker, /lockedUntil/);
  assert.match(picker, /eligibleToSelect/);
  assert.match(picker, /CONFIRM CONTRIBUTION DESTINATION/);
  assert.doesNotMatch(picker, /insert\(.*community_designations|update\(.*community_designations/);
});

test('gross AdMob financial breakdown is not exposed in personal user screens', () => {
  assert.match(preview, /YOUR ESTIMATED REVENUE SHARE/);
  assert.match(detail, /YOUR EARNINGS/);
  assert.doesNotMatch(preview, /AdMob estimate \(100%\)|Community pool \(|full AdMob revenue/);
  assert.doesNotMatch(detail, /ESTIMATED ADMOB REVENUE · 100% BREAKDOWN|Total app estimated revenue|Calculation: your QMP/);
});
