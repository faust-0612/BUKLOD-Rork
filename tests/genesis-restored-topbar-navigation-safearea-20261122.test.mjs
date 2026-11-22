import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const layout = read('src/app/(tabs)/_layout.tsx');
const context = read('src/components/BuklodDashboardContextBar.tsx');
const home = read('src/app/(tabs)/hub.tsx');
const profile = read('src/app/(tabs)/me.tsx');

test('BUKLOD shared top bar returns to Genesis mobile with working menu, search and notifications', () => {
  assert.match(layout, /!desktopWebShell \? <SwipeDashboardHeader \/> : null/);
  assert.match(layout, /<BuklodNavigationSideMenu visible=\{navigationMenuOpen\}/);
  assert.match(layout, /accessibilityLabel="Open navigation menu"/);
  assert.match(layout, /onPress=\{\(\) => setNavigationMenuOpen\(true\)\}/);
  assert.match(layout, /accessibilityLabel="Find a BUKLOD feature"/);
  assert.match(layout, /router\.push\('\/feature-search' as any\)/);
  assert.match(layout, /router\.push\([\s\S]*?'\/notifications' as any/);
  assert.match(layout, /buklod-main-canonical\.png/);
  assert.match(layout, /<BuklodHeaderSponsor/);
  assert.match(layout, /unreadCount > 0/);
});

test('one status-bar inset is owned by the restored header; Genesis Android fallback works', () => {
  assert.match(layout, /const headerTopInset = genesisPreview && Platform\.OS === 'android'/);
  assert.match(layout, /Math\.max\(insets\.top, StatusBar\.currentHeight \?\? 0\)/);
  assert.match(layout, /paddingTop: headerTopInset/);
  assert.match(layout, /minHeight: \(scrollCompact \? 48 : 56\) \+ headerTopInset/);
  assert.doesNotMatch(layout, /genesisDashboardTopInset/);
  assert.ok(layout.includes('BuklodAndroidDashboardTabs'));
  assert.ok(layout.includes('BuklodDashboardAdWarmup'));
});

test('scrollable daily encouragement and desktop single-header policy are preserved', () => {
  assert.ok(context.includes('messagesRoute || communityRoute || profileRoute || homeRoute'));
  assert.ok(home.includes('<BuklodPublicDailyMessageBar forceVisible embedded />'));
  assert.ok(profile.includes('<BuklodPublicDailyMessageBar forceVisible embedded />'));
  assert.ok(home.includes('new_home_first_view'));
  assert.ok(profile.includes('profile_first_view'));
  assert.ok(home.includes('BuklodScreenBottomBanner'));
  assert.ok(profile.includes('BuklodScreenBottomBanner'));
  assert.ok(layout.includes('!isGenesisPreviewBuild() ? <BuklodDashboardContextBar /> : null'));
});

test('session, compliance, managed scope and production route guards are not bypassed', () => {
  for(const token of ["if (!session)", "if (requiresAcceptance)", "if (!profile)", "if (pathname === '/home')", "isBuklodScopedWorkspacePath(pathname)"]) {
    assert.ok(layout.includes(token), token);
  }
  assert.ok(layout.includes('shouldUseBuklodPublicDesktopShell'));
  assert.ok(layout.includes('shouldUseBuklodDesktopPublicFeed'));
});
