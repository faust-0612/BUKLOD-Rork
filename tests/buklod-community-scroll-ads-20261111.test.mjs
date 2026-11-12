import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';

const read = path => readFileSync(path, 'utf8');
const source = read('src/lib/buklodAdPlacements.ts');
const sourceNoImports = source
  .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*/gm, '')
  .replace(/^export\s+\{[\s\S]*?\};\s*/m, '');
const runnable = stripTypeScriptTypes(sourceNoImports, { mode: 'strip' }).replace(/^export\s+/gm, '');
const placements = vm.runInNewContext(
  runnable + '\n({ buildCommunityFeedWithInlineAds, isCommunityFeedInlineAdRow })',
  {
    COMMUNITY_AD_MIN_LEADING: 5,
    COMMUNITY_AD_INTERVAL_MIN: 6,
    COMMUNITY_AD_INTERVAL_MAX: 9,
    COMMUNITY_AD_INTERVAL: 7,
    REELS_AD_MIN_LEADING: 8,
    REELS_AD_INTERVAL_MIN: 8,
    REELS_AD_INTERVAL_MAX: 12,
    REELS_AD_INTERVAL: 10,
    String,
    Number,
    Math,
    Boolean,
    Array,
  },
);

test('Community ad marker IDs are stable across append/pagination without replacing post IDs', () => {
  const posts = Array.from({length: 24}, (_,i) => ({ id: 'p'+(i+1) }));
  const before = placements.buildCommunityFeedWithInlineAds(posts.slice(0,16));
  const after = placements.buildCommunityFeedWithInlineAds(posts);
  const rows = after.filter(placements.isCommunityFeedInlineAdRow);
  assert.ok(rows.length >= 2);
  assert.equal(new Set(after.map(r=>r.id)).size, after.length);
  assert.deepEqual(
    JSON.stringify(before),
    JSON.stringify(after.slice(0,before.length)),
  );
  const remainingPosts = after.filter(row=>!placements.isCommunityFeedInlineAdRow(row));
  assert.equal(remainingPosts.length, posts.length);
  // VM arrays are from a different realm; compare canonical ID values.
  assert.equal(JSON.stringify(remainingPosts.map(p=>p.id)), JSON.stringify(posts.map(p=>p.id)));
});

test('scroll ad slots can mount before visibility without bypassing viewport and fallback gates', () => {
  const publicWall=read('src/app/(tabs)/buklod.tsx');
  const scopeWall=read('src/components/BuklodExclusiveScopeCommunity.tsx');
  for(const wall of [publicWall,scopeWall]) {
    const ad = wall.slice(wall.indexOf('<BuklodCommunityInlineAd'));
    assert.ok(ad.includes('slotId={item.id}'));
    assert.doesNotMatch(ad.slice(0,300), /active=\{isAdActive\(item\.id\)\}/);
  }
  const native=read('src/components/BuklodCommunityInlineAd.android.tsx');
  assert.match(native,/const canAttempt =[\s\S]{0,140}active &&[\s\S]{0,140}routeSafe/);
  assert.match(native,/eligible \|\| hasLoadedCreative/);
  assert.match(native,/const currentlyVisible =/);
  assert.match(native,/!currentlyVisible/);
  assert.match(native,/reserveBuklodPassiveAdRequest\(placementId, requestKey\)/);
});



test('Android Wall preloads a nearby native creative before the user scrolls onto it', () => {
  const native=read('src/components/BuklodCommunityInlineAd.android.tsx');
  const viewport=read('src/lib/buklodAdViewport.ts');
  assert.match(native, /preloadDistanceScreens: surface === 'wall'/);
  assert.match(native, /eligible \|\| hasLoadedCreative \|\| \(surface === 'wall' && nearby && prepare\)/);
  assert.match(native, /onLayout=\{sample\}/);
  assert.match(viewport, /preloadDistanceScreens\?: number/);
  assert.match(viewport, /y < window\.height \+ margin/);
  assert.match(viewport, /return \{ ref, eligible, nearby, sample \}/);
  assert.match(viewport, /const SETTLE_MS = 400/);
});

test('prefetch does not count fake ad impressions or bypass fallback viewport eligibility', () => {
  const native=read('src/components/BuklodCommunityInlineAd.android.tsx');
  assert.match(native, /if \(!nativeAd \|\| nativeRendered\.current \|\| !currentlyVisible \|\| !eligible\) return/);
  assert.match(native, /NativeAdEventType\.IMPRESSION/);
  assert.match(native, /onAdImpression=/);
  assert.match(native, /!currentlyVisible/);
  assert.match(native, /reserveBuklodPassiveAdRequest\(placementId, requestKey\)/);
  assert.match(native, /surface === 'wall' && Boolean\(slotId\) && !firstView/);
});


test('selects only one upcoming NativeAd for memory-safe prefetch', () => {
  const hook=read('src/hooks/useBuklodCommunityAdViewability.ts');
  const publicWall=read('src/app/(tabs)/buklod.tsx');
  const scopedWall=read('src/components/BuklodExclusiveScopeCommunity.tsx');
  const native=read('src/components/BuklodCommunityInlineAd.android.tsx');
  assert.match(hook, /let nextAd: string \| null = null/);
  assert.match(hook, /for \(let index = furthestVisible \+ 1/);
  assert.match(hook, /nextAd = row\.id/);
  assert.match(hook, /setPreloadAdSlotId\(/);
  assert.match(publicWall, /prepare=\{preloadAdSlotId === item\.id\}/);
  assert.match(scopedWall, /prepare=\{preloadAdSlotId === item\.id\}/);
  assert.match(native, /nearby && prepare/);
});
