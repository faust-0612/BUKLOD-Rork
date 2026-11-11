import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = p => readFileSync(p,'utf8');

test('Cluster and Organization headers respond to scoped scrolling and preserve safe-area', () => {
  const h = read('src/components/BuklodScopedDashboardHeader.tsx');
  assert.match(h, /scopedTopInset = Platform\.OS === 'web' && viewportWidth >= 1200/);
  assert.match(h, /subscribeBuklodDashboardScroll/);
  assert.match(h, /scrollCompact && \{minHeight:46,paddingVertical:3\}/);
  assert.match(h, /scopeName/);
  assert.match(h, /BuklodDashboardCustomizer/);
});

test('Scoped Home, Community and Connect keep their lists and route-authorized behavior', () => {
  for (const p of [
    'src/components/BuklodScopeHomeDashboard.tsx',
    'src/components/BuklodExclusiveScopeCommunity.tsx',
    'src/app/scope/index.tsx',
  ]) assert.ok(read(p).includes("reportBuklodDashboardScroll('scope'"),p);
  const screen = read('src/app/scope/index.tsx');
  assert.match(screen, /resetBuklodDashboardScroll\('scope'\)/);
  assert.match(screen, /resolution\.access !== 'authorized'/);
  const feed = read('src/components/BuklodExclusiveScopeCommunity.tsx');
  assert.match(feed, /viewabilityConfigCallbackPairs/);
  assert.match(feed, /<FlatList<any>/);
});
