import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(file, 'utf8');

test('post detail interstitial waits for editor navigation and confirmed comment', () => {
  const detail = read('src/app/post/[id].tsx');
  const add = detail.slice(detail.indexOf(' const add=async()=>'), detail.indexOf(' const react=async('));
  assert.ok(add.indexOf('if(error)') > 0);
  assert.ok(add.indexOf('if(error)') < add.indexOf('recordConfirmedCommunityComment(String(user.id))'));
  assert.doesNotMatch(add, /showBuklodAdOpportunity/);
  assert.match(detail, /useFocusEffect\(useCallback\(\(\) => \{/);
  assert.match(detail, /if\(!commentSendInFlightRef\.current && adAccount &&/);
  assert.match(detail, /takePendingCommunityCommentAdBreak\(adAccount\)/);
  assert.match(detail, /showBuklodAdOpportunity\('community_comment_overage'\)/);
});

test('photo comments queue ad after server success but only consume it when sheet closes', () => {
  const wall = read('src/app/(tabs)/buklod.tsx');
  const sheet = wall.slice(wall.indexOf('<BuklodPhotoCommentsSheet'), wall.indexOf('{/* PATCH_161H_COMMENT_DRAWER'));
  assert.match(sheet, /onSaved=\{\(\)=>\{/);
  assert.match(sheet, /recordConfirmedCommunityComment\(String\(user\.id\)\)/);
  assert.match(sheet, /onClose=\{\(\)=>\{/);
  assert.match(sheet, /setPhotoCommentsTarget\(null\)/);
  assert.match(sheet, /takePendingCommunityCommentAdBreak\(adAccount\)/);
  assert.match(sheet, /showBuklodAdOpportunity\('community_comment_overage'\)/);
});

test('interstitial remains optional and globally protected', () => {
  const cadence = read('src/lib/buklodCommunityCommentAdCadence.ts');
  const global = read('src/lib/buklodGlobalAdController.ts');
  const sdk = read('src/lib/buklodAds.ts');
  assert.match(cadence, /COMMUNITY_COMMENT_AD_FREE_ACTIONS = 5/);
  assert.match(cadence, /COMMUNITY_COMMENT_AD_EXTRA_INTERVAL = 5/);
  assert.doesNotMatch(cadence, /points_ledger|claimBuklodRewardEvent|rewardedAd/);
  assert.match(global, /INTERSTITIAL_MIN_EVENT_COUNT/);
  assert.match(global, /!hasInteractionLock\(\)/);
  assert.match(global, /fullScreenReservation/);
  assert.match(sdk, /isBuklodAdLightPassActive\(\)/);
  assert.match(sdk, /initializeBuklodAds\(\)/);
});
