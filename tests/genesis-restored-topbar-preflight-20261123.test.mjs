import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('Genesis Android header is visible with safe-area inset, without a duplicate context bar', () => {
  const tab = read('src/app/(tabs)/_layout.tsx');
  assert.match(tab, /!desktopWebShell \? <SwipeDashboardHeader \/> : null/);
  assert.equal((tab.match(/<SwipeDashboardHeader \/>/g) ?? []).length, 1);
  assert.match(tab, /const headerTopInset = genesisPreview && Platform\.OS === 'android'/);
  assert.match(tab, /paddingTop: headerTopInset/);
  assert.match(tab, /!isGenesisPreviewBuild\(\) \? <BuklodDashboardContextBar \/> : null/);
  assert.match(tab, /<BuklodDashboardAdWarmup \/>/);
  assert.match(tab, /freezeOnBlur: true/);
});
test('immersive game/reels/conversation cannot create a duplicate global nav or overlay', () => {
  const nav = read('src/components/BuklodNavSafeShell.tsx');
  assert.match(nav, /!immersiveIgpat && !immersiveConversation && rawNavOccupied > 0 && !immersiveArena/);
  assert.match(nav, /normalizeBuklodPathname\(pathname\) === '\/games\/empire-arena'/);
  assert.equal((nav.match(/<BuklodPersistentBottomNav \/>/g) ?? []).length, 1);
  assert.match(nav, /worldReturnEligible/);
  assert.match(nav, /normalizedPath !== '\/buklod-map'/);
});
test('map preflight and both map-first contracts track the restored header instead of hiding it', () => {
  const preflight = read('scripts/genesis-map-reconstruction-preflight.mjs');
  for (const p of [
    'tests/genesis-world-navigation-regression-20261121.test.mjs',
    'tests/season2-map-first-conso-intake-20261121.test.mjs',
  ]) {
    assert.match(read(p), /!desktopWebShell \\? <SwipeDashboardHeader \\/> : null/);
  }
  assert.match(preflight, /headerTopInset/);
  assert.match(preflight, /!desktopWebShell \\? <SwipeDashboardHeader/);
  assert.doesNotMatch(preflight, /!desktopWebShell && !isGenesisPreviewBuild/);
});
