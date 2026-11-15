import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const nativeAd = fs.readFileSync('src/components/BuklodCommunityInlineAd.android.tsx', 'utf8');
const eas = JSON.parse(fs.readFileSync('eas.json', 'utf8'));

test('visible Wall ad uses the existing list viewability decision, avoiding a second viewport delay', () => {
  assert.match(nativeAd, /const canShowNativeCreative\s*=\s*eligible\s*\|\|\s*\(surface === 'wall' && !firstView && Boolean\(slotId\) && currentListVisibility\)/);
  assert.match(nativeAd, /if \(nativeAd && !nativeFailed && canShowNativeCreative\)/);
  assert.match(nativeAd, /if \(!nativeAd \|\| nativeRendered\.current \|\| !canShowNativeCreative\) return/);
  assert.doesNotMatch(nativeAd, /if \(nativeAd && !nativeFailed && eligible\)/);
});

test('NativeAd request keeps network, route and prefetch safety gating', () => {
  assert.match(nativeAd, /const adNetworkAvailable = isConnected && isInternetReachable !== false/);
  assert.match(nativeAd, /isBuklodPassiveAdAllowed/);
  assert.match(nativeAd, /const currentlyVisible\s*=/);
  assert.match(nativeAd, /firstView \|\| \(eligible \|\| prefetch \|\| nativeRequestStarted\.current\)/);
});

test('native feature code only builds under separate new QA app identity', () => {
  assert.equal(eas.build['native-lab'].channel, 'native-lab');
  assert.equal(eas.build['native-lab'].env.EXPO_PUBLIC_KINGDOM_NATIVE_LAB, '1');
  assert.equal(eas.build['native-lab'].env.APP_VARIANT, 'native-lab');
  assert.equal(eas.build['staging-user'].channel, 'staging-user');
  assert.equal(eas.build.production.channel, 'production');
  const gradle = fs.readFileSync('modules/buklod-kingdom-lab/android/build.gradle', 'utf8');
  assert.match(gradle, /APP_VARIANT.*native-lab/);
  assert.match(gradle, /BUKLOD_APP_TARGET.*main/);
  const keyboard = fs.readFileSync('modules/buklod-kingdom-lab/android/src/main/java/expo/modules/buklodlab/BuklodLabNativeModule.kt','utf8');
  assert.match(keyboard, /InputConnectionCompat/);
  assert.match(keyboard, /setOnReceiveContentListener/);
  const drive = fs.readFileSync('src/lib/smartDrawer/googleDriveTransport.ts','utf8');
  assert.match(drive, /drive\.file/);
  assert.match(drive, /buklod\.drawer\.encrypted\.v1/);
});
