import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const layout = read('src/app/(tabs)/_layout.tsx');
const tabs = read('src/components/BuklodAndroidDashboardTabs.tsx');
const nativeNav = read('src/components/BuklodPersistentBottomNav.tsx');
const scoped = read('src/providers/BuklodScopeProvider.tsx');
const ads = read('src/components/BuklodCommunityInlineAd.android.tsx');
const adWarmup = read('src/components/BuklodDashboardAdWarmup.android.tsx');
const guard = read('src/components/BuklodCanonicalNavigationGuard.tsx');

test('Android uses persistent tab screens while web and iOS keep verified Stack', () => {
  assert.match(layout, /Platform\.OS === 'android' \? \(\s*<BuklodAndroidDashboardTabs/);
  assert.match(layout, /\) : \(\s*<Stack/);
  assert.match(layout, /animation: 'none'/);
  assert.match(tabs, /<Tabs\s/);
  assert.match(tabs, /tabBar=\{\(\) => null\}/);
  assert.match(tabs, /backBehavior="history"/);
  assert.match(tabs, /detachInactiveScreens/);
  assert.match(tabs, /lazy: true/);
  assert.match(tabs, /freezeOnBlur: true/);
  assert.match(tabs, /animation: 'none'/);
  assert.doesNotMatch(tabs, /router\.prefetch\(|NativeAd\.createForAdRequest/);
  assert.equal((layout.match(/\{workspaceStack\}/g) ?? []).length, 1);
});

test('all existing primary dashboard routes are stable; no double bottom bar', () => {
  for (const route of ['buklod', 'home', 'hub', 'messages', 'me', 'learn']) {
    assert.ok(tabs.includes('<Tabs.Screen name="' + route + '"'), route);
  }
  assert.match(tabs, /showPrayer \? <Tabs.Screen name="prayer"/);
  for (const route of ["'/hub'", "'/clusters'", "'/buklod'", "'/messages'", "'/me'"]) {
    assert.ok(nativeNav.includes(route), route);
  }
  assert.match(nativeNav, /buklodInstantNavigate\(/);
  assert.match(nativeNav, /await selectScope\(publicScope\.scope_id\)/);
  assert.match(scoped, /activeScopeRef\.current = target;\s*setActiveScope\(target\)/);
  assert.match(guard, /scopedWorkspacePathForGlobalRoute/);
});

test('ad and media focus protections remain effective when routes stay mounted', () => {
  assert.match(ads, /useFocusEffect\(useCallback/);
  assert.match(ads, /screenFocusRef\.current = false/);
  assert.match(ads, /if \(firstView\)/);
  assert.match(adWarmup, /MAX_WARM_CREATIVES = 2/);
  assert.match(adWarmup, /isBuklodPassiveAdAllowed/);
  const wall = read('src/app/(tabs)/buklod.tsx');
  const connect = read('src/app/(tabs)/messages.tsx');
  assert.match(wall, /useFocusEffect/);
  assert.match(connect, /useFocusEffect/);
  assert.match(layout, /<BuklodDashboardAdWarmup \/>/);
});
