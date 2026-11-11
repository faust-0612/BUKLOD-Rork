import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = file => readFileSync(file, 'utf8');

test('shared mobile header retains status bar, logo, notifications, and smaller scroll mode', () => {
  const tabs = source('src/app/(tabs)/_layout.tsx');
  assert.match(tabs, /paddingTop: insets\.top/);
  assert.match(tabs, /scrollCompact \? 42 : 52/);
  assert.match(tabs, /buklod-main-canonical\.png/);
  assert.match(tabs, /subscribeBuklodDashboardScroll/);
  assert.match(tabs, /unreadCount > 0/);
  assert.match(tabs, /BuklodHeaderSponsor/);
  assert.match(tabs, /Platform\.OS === 'web' \? 5 : 0/);
});

test('scroll-driven encouragement remains visible on primary tabs and never duplicates desktop header', () => {
  const context = source('src/components/BuklodDashboardContextBar.tsx');
  const bar = source('src/components/BuklodPublicDailyMessageBar.tsx');
  assert.match(context, /compact=\{scrollCompact\}/);
  assert.match(context, /if \(dailyMessageInDesktopHeader\) \{[\s\S]*?return null/);
  assert.match(bar, /numberOfLines=\{compact \? 1 : 2\}/);
  assert.match(bar, /showFaithContent && !compact/);
  assert.match(bar, /verse\.reference/);
});

test('Wall, Home, Connect, Profile, Cluster, and Organization report scroll without replacing feeds', () => {
  const mapping = [
    ['src/app/(tabs)/buklod.tsx', 'wall'],
    ['src/app/(tabs)/hub.tsx', 'home'],
    ['src/app/(tabs)/messages.tsx', 'connect'],
    ['src/app/(tabs)/me.tsx', 'profile'],
    ['src/components/BuklodScopeHomeDashboard.tsx', 'scope'],
    ['src/components/BuklodExclusiveScopeCommunity.tsx', 'scope'],
    ['src/app/scope/index.tsx', 'scope'],
  ];
  for (const [file, route] of mapping) {
    assert.ok(source(file).includes("reportBuklodDashboardScroll('"+route+"'"), file);
  }
  const coordinator = source('src/lib/buklodDashboardScroll.ts');
  assert.match(coordinator, /offset > 38 : offset > 112/);
  assert.match(source('src/components/BuklodScopedDashboardHeader.tsx'), /subscribeBuklodDashboardScroll/);
  const wall = source('src/app/(tabs)/buklod.tsx');
  assert.match(wall, /maintainVisibleContentPosition=\{\{ disabled: true \}\}/);
  assert.match(wall, /onRefresh=\{refreshCommunity186L\}/);
});

test('all Wall shortcuts remain accessible and route to existing features', () => {
  const links = source('src/components/BuklodWallQuickLinks.tsx');
  for (const label of ['Open My Bible', 'Community Wall', 'Open BUKLOD IGPAT videos', 'Open 702 DZAS Radio'])
    assert.ok(links.includes(label), label);
  for (const route of ['/bible/read?source=my_bible', '/igpat', '/personal-home/radio'])
    assert.ok(links.includes(route), route);
  assert.match(links, /onCommunityPress/);
});
