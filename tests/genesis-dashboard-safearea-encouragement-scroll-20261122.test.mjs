import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = (path) => fs.readFileSync(path, 'utf8');
const layout = source('src/app/(tabs)/_layout.tsx');
const home = source('src/app/(tabs)/hub.tsx');
const profile = source('src/app/(tabs)/me.tsx');
const context = source('src/components/BuklodDashboardContextBar.tsx');
const card = source('src/components/BuklodPublicDailyMessageBar.tsx');

test('Restored Genesis shared top bar owns safe area without double scene inset', () => {
  assert.match(layout, /const headerTopInset = genesisPreview && Platform\.OS === 'android'/);
  assert.match(layout, /Math\.max\(insets\.top, StatusBar\.currentHeight \?\? 0\)/);
  assert.match(layout, /paddingTop: headerTopInset/);
  assert.match(layout, /minHeight: \(scrollCompact \? 48 : 56\) \+ headerTopInset/);
  assert.match(layout, /!desktopWebShell \? <SwipeDashboardHeader \/> : null/);
  assert.doesNotMatch(layout, /genesisDashboardTopInset/);
});

test('Home and Profile own one scrollable daily message each; shared layout does not pin them', () => {
  assert.match(context, /messagesRoute \|\| communityRoute \|\| profileRoute \|\| homeRoute/);
  assert.doesNotMatch(context, /if \(profileRoute\) \{[\s\S]*?<BuklodPublicDailyMessageBar/);
  assert.ok(home.includes('<ScrollView') && home.includes('<BuklodPublicDailyMessageBar forceVisible embedded />'));
  assert.ok(profile.includes('<ScrollView') && profile.includes('<BuklodPublicDailyMessageBar forceVisible embedded />'));
  assert.ok(profile.indexOf('MY OVERALL & MONTHLY RANK') < profile.indexOf('<BuklodPublicDailyMessageBar forceVisible embedded />'));
  assert.ok(home.indexOf('<BuklodPublicDailyMessageBar forceVisible embedded />') < home.indexOf('<BuklodFirstViewAd placement="home"'));
  assert.match(card, /embedded = false/);
  assert.match(card, /embedded && styles\.embeddedShell/);
  assert.match(card, /embeddedShell:\s*\{\s*marginHorizontal: 0,/);
});

test('Desktop header is not duplicated, while ad, rank, wall and navigation contracts remain present', () => {
  assert.match(home, /shouldUseBuklodPublicDesktopShell\('\/hub', width\)/);
  assert.match(profile, /shouldUseBuklodPublicDesktopShell\('\/me', profileWidth\)/);
  for (const required of ['hub_mid_native','new_home_first_view','BuklodScreenBottomBanner','BuklodExecutiveQuickAccess']) assert.ok(home.includes(required), required);
  for (const required of ['MY OVERALL & MONTHLY RANK','BuklodProfilePostCards','profile_mid_native','profile_first_view','BuklodScreenBottomBanner']) assert.ok(profile.includes(required), required);
  assert.ok(layout.includes('BuklodAndroidDashboardTabs') && layout.includes('BuklodDashboardAdWarmup'));
});
