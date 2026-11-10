import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('Android high-traffic Wall and IGPAT cadence is bounded and env-overridable', () => {
  const policy = read('src/lib/buklodAdMonetizationPolicy.android.ts');
  assert.match(policy, /COMMUNITY_AD_MIN_LEADING =[\s\S]*?: 4;/);
  assert.match(policy, /COMMUNITY_AD_INTERVAL_MIN =[\s\S]*?: 4;/);
  assert.match(policy, /COMMUNITY_AD_INTERVAL_MAX =[\s\S]*?: 6,/);
  assert.match(policy, /REELS_AD_MIN_LEADING =[\s\S]*?: 5;/);
  assert.match(policy, /REELS_AD_INTERVAL_MIN =[\s\S]*?: 5;/);
  assert.match(policy, /REELS_AD_INTERVAL_MAX =[\s\S]*?: 7,/);
  assert.match(policy, /EXPO_PUBLIC_ADS_WALL_INTERVAL_MIN/);
  assert.match(policy, /EXPO_PUBLIC_ADS_REELS_INTERVAL_MIN/);
});

test('IGPAT native ad requests require consent and a narrowly approved feed route', () => {
  const component = read('src/components/BuklodReelsInlineAd.tsx');
  const controller = read('src/lib/buklodGlobalAdController.ts');
  assert.match(component, /const \{ ready, canRequestAds \} = useAds\(\)/);
  assert.match(component, /const sdkReady = ready && canRequestAds/);
  assert.match(component, /isBuklodPassiveAdAllowed\(/);
  assert.match(component, /placementId: 'igpat_reels_inline'/);
  assert.match(component, /if \(cancelled \|\| timedOut\)/);
  assert.doesNotMatch(component, /initializeBuklodAds\(/);
  assert.match(controller, /'\/igpat'/);
  assert.match(controller, /const safeReelsInline =/);
  assert.match(controller, /placement === 'reels' && placementId === 'igpat_reels_inline' && route === '\/igpat'/);
  assert.match(controller, /!isBuklodAdRouteSensitive\(pathname\)/);
  assert.match(controller, /INTERSTITIAL_MIN_EVENT_COUNT/);
});

test('High-traffic dashboards each have first-view and additional native/banner inventory', () => {
  const hub = read('src/app/(tabs)/hub.tsx');
  const profile = read('src/app/(tabs)/me.tsx');
  const scope = read('src/components/BuklodScopeHomeDashboard.tsx');
  const cluster = read('src/components/BuklodClusterHomeCommandCenterImpl.tsx');
  const inbox = read('src/app/(tabs)/messages.tsx');
  for (const id of ['new_home_first_view', 'hub_mid_native']) assert.ok(hub.includes(id));
  assert.match(hub, /BuklodScreenBottomBanner placement="home"/);
  for (const id of ['profile_first_view', 'profile_mid_native']) assert.ok(profile.includes(id));
  assert.match(profile, /BuklodScreenBottomBanner placement="profile"/);
  for (const id of ['organization_scope_home_mid_view', 'cluster_scope_home_mid_view']) assert.ok(scope.includes(id));
  assert.ok(cluster.includes('cluster_command_mid_view'));
  assert.ok(inbox.includes('connect_community_inline_4'));
  assert.ok(inbox.includes('connect_personal_inline_4'));
  assert.match(inbox, /index === 3 && !isSearching/);
  assert.ok(!inbox.includes('BuklodNativeSponsoredCard surface="connect" slotId="thread_'));
  const native = read('src/components/BuklodCommunityInlineAd.android.tsx');
  assert.match(native, /useBuklodAdViewportGate/);
  assert.match(native, /canRequestAds/);
  assert.match(native, /NativeMediaView/);
});

test('Existing interstitial and noncash protections remain unchanged', () => {
  const source = read('src/lib/buklodAdMonetizationPolicy.shared.ts');
  assert.match(source, /INTERSTITIAL_MIN_EVENT_COUNT = 2/);
  const qmp = read('src/app/community-contribution.tsx');
  assert.match(qmp, /Never watch\/click ads/);
});
