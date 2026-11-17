import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('Both feeds keep their existing dashboard scroll and bottom navigation wiring', () => {
  const connect = read('src/app/(tabs)/messages.tsx');
  const wall = read('src/app/(tabs)/buklod.tsx');
  const nav = read('src/app/(tabs)/_layout.tsx');
  assert.match(connect,/reportBuklodDashboardScroll\('connect'/);
  assert.match(wall,/reportBuklodDashboardScroll\('wall'/);
  assert.match(nav,/<Stack.Screen name="messages"/);
  assert.match(nav,/<Stack.Screen name="buklod"/);
  assert.match(connect,/onPressRow=\{\(\) => isPerson/);
  assert.match(connect,/onPressRow=\{\(\) => openCommunityRoom/);
});

test('Search-first feed does not hide bottom scroll clearance or live AdMob', () => {
  const connect=read('src/app/(tabs)/messages.tsx');
  const wall=read('src/app/(tabs)/buklod.tsx');
  assert.match(connect,/useBuklodScrollBottomInset/);
  assert.match(connect,/paddingBottom: scrollBottomInset/);
  assert.match(connect,/BuklodFirstViewAd/);
  assert.match(wall,/BuklodFirstViewAd/);
});
