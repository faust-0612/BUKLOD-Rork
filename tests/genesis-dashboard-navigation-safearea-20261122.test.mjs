import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const layout = read('src/app/(tabs)/_layout.tsx');
const context = read('src/components/BuklodDashboardContextBar.tsx');
const home = read('src/app/(tabs)/hub.tsx');
const profile = read('src/app/(tabs)/me.tsx');

test('Genesis status bar protects Home/Profile routes without touching auth, managed scopes or production routing', () => {
  assert.match(layout, /!desktopWebShell \? <SwipeDashboardHeader \/> : null/);
  assert.match(layout, /const headerTopInset = genesisPreview && Platform\.OS === 'android'/);
  assert.ok(layout.includes('StatusBar.currentHeight'));
  assert.ok(!layout.includes('genesisDashboardTopInset'));
  for (const guard of ["if (!session)", "if (requiresAcceptance)", "if (!profile)", "pathname === '/home'", "BuklodAndroidDashboardTabs"]) {
    assert.ok(layout.includes(guard), 'Protected navigation gate: ' + guard);
  }
  assert.match(layout, /!desktopWebShell \? <SwipeDashboardHeader \/> : null/);
});

test('Embedded encouragement follows Home and Profile scroll and keeps existing tab reporting', () => {
  assert.ok(home.includes("reportBuklodDashboardScroll('home'"));
  assert.ok(profile.includes("reportBuklodDashboardScroll('profile'"));
  assert.ok(home.indexOf('<ScrollView') < home.indexOf('<BuklodPublicDailyMessageBar forceVisible embedded />'));
  assert.ok(profile.indexOf('<ScrollView') < profile.indexOf('<BuklodPublicDailyMessageBar forceVisible embedded />'));
  assert.match(context, /profileRoute \|\| homeRoute/);
  assert.ok(home.includes('BuklodScreenBottomBanner'));
  assert.ok(profile.includes('BuklodScreenBottomBanner'));
});
