import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');

test('Android Wall feed NativeAd fallback waits for current row visibility', () => {
  const android = read('src/components/BuklodCommunityInlineAd.android.tsx');
  const viewability = read('src/hooks/useBuklodCommunityAdViewability.ts');

  assert.ok(android.includes('useBuklodCommunityInlineVisibility(slotId)'));
  assert.ok(android.includes("surface !== 'wall' || firstView || !slotId || currentListVisibility"));
  assert.ok(android.includes('!canAttempt ||\n      !currentlyVisible ||\n      !nativeFailed'));
  assert.ok(android.includes('if (!bannerFailed || !adNetworkAvailable || !currentlyVisible) return;'));
  assert.ok(android.includes('currentlyVisible,'));
  assert.ok(viewability.includes('visibleCommunityInlineIds.has(slotId)'));
  assert.ok(viewability.includes('publishVisibleCommunityInlineIds(new Set(incoming))'));
});

test('first-view and non-Wall sponsored surfaces bypass the feed-row registry', () => {
  const android = read('src/components/BuklodCommunityInlineAd.android.tsx');
  assert.ok(android.includes("surface !== 'wall' || firstView || !slotId || currentListVisibility"));
});
