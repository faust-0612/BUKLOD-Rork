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
  assert.deepEqual(remainingPosts.map(p=>p.id),posts.map(p=>p.id));
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

