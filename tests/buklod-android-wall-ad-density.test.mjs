import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(path, 'utf8');

test('Android Wall ad opportunities are closer without changing base policy', () => {
  const android = read('src/lib/buklodAdMonetizationPolicy.android.ts');
  const shared = read('src/lib/buklodAdMonetizationPolicy.shared.ts');
  assert.ok(android.includes('COMMUNITY_AD_MIN_LEADING'));
  assert.ok(android.includes(': 5;'));
  assert.ok(android.includes(': 6;'));
  assert.ok(android.includes(': 9,'));
  assert.ok(android.includes('EXPO_PUBLIC_ADS_WALL_MIN_CONTENT_BEFORE_FIRST_AD'));
  assert.ok(shared.includes('COMMUNITY_AD_MIN_LEADING = intEnv'));
});

test('Public and managed Walls already support the same genuine native media ad rows', () => {
  const wall = read('src/app/(tabs)/buklod.tsx');
  const managed = read('src/components/BuklodExclusiveScopeCommunity.tsx');
  const native = read('src/components/BuklodCommunityInlineAd.android.tsx');
  assert.ok(wall.includes('buildCommunityFeedWithInlineAds'));
  assert.ok(wall.includes('<BuklodCommunityInlineAd'));
  assert.ok(managed.includes('buildCommunityFeedWithInlineAds'));
  assert.ok(managed.includes('<BuklodCommunityInlineAd'));
  assert.ok(native.includes('<NativeMediaView'));
  assert.ok(native.includes('NativeAdEventType.IMPRESSION'));
});
