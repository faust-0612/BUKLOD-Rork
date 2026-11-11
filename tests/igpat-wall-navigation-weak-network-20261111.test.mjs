import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const wall = read('src/app/(tabs)/buklod.tsx');
const native = read('src/app/igpat/index.tsx');
const web = read('src/app/igpat/index.web.tsx');
const cache = read('src/lib/igpat/warmFeed.ts');

test('Retired IGPAT shortcut is absent and Community, DZAS remain accessible', () => {
  const shortcuts = read('src/components/BuklodWallQuickLinks.tsx');
  assert.match(shortcuts, /accessibilityLabel="Community Wall"/);
  assert.match(shortcuts, /accessibilityLabel="Open 702 DZAS Radio"/);
  assert.doesNotMatch(shortcuts, /IGPAT|router\\.push\\('\\/igpat'/);
  assert.match(shortcuts, /minHeight:42/);
  assert.match(wall, /<BuklodWallQuickLinks/);
  assert.doesNotMatch(read('src/components/BuklodPersistentBottomNav.tsx'), /key:\\s*'igpat'/);
});

test('Both IGPAT clients retain account and mode scoped media rather than blanking on failed fetch', () => {
  for (const source of [native, web]) {
    assert.match(source, /getIgpatWarmFeed<IgpatRow>\(user\.id, feedMode, dataSaver\)/);
    assert.match(source, /visibleFeedKeyRef\.current === key/);
    assert.match(source, /const retainedRows = matchingFeed && rowsRef\.current\.length \? rowsRef\.current : warmRows/);
    assert.match(source, /setLoading\(retainedRows\.length === 0\)/);
    assert.match(source, /!matchingFeed && warmRows\.length &&/);
    assert.match(source, /isIgpatWarmFeedFresh\(user\.id, feedMode, dataSaver\)/);
    assert.match(source, /rowsRef\.current = retainedRows;\s*setRows\(retainedRows\);/);
    assert.match(source, /if \(!matchingFeed\) \{\s*rowsRef\.current = warmRows;\s*setRows\(warmRows\);\s*setActiveIndex\(0\);/);
    assert.match(source, /generation !== loadGenerationRef\.current/);
  }
});

test('Weak connectivity prioritizes the current video and recovers once internet returns', () => {
  for (const source of [native, web]) {
    assert.match(source, /classifyNetworkQuality\(\) !== 'normal'/);
    assert.match(source, /networkStatus === 'offline' \|\| networkStatus === 'degraded'/);
    assert.match(source, /dataSaver \|\| weakSignalRef\.current \? DATA_SAVER_LIMIT : NORMAL_LIMIT/);
    assert.match(source, /networkStatusRef\.current === 'offline'/);
    assert.match(source, /networkStatus === 'online' && prefsReady && loadError/);
    assert.match(source, /const nextPlayableIndex = \(dataSaver \|\| weakSignal\) \? -1/);
  }
  assert.match(native, /useCaching: true/);
  assert.match(native, /buildReelsFeedWithInlineAds\(rows\)/);
  assert.match(native, /BuklodReelsInlineAd/);
});

test('Signed URL warm cache expires, remains in memory only and is account isolated', () => {
  assert.match(cache, /const MAX_AGE_MS = 8 \* 60 \* 1000/);
  assert.match(cache, /const MAX_ENTRIES = 6/);
  assert.match(cache, /export function isIgpatWarmFeedFresh\(/);
  assert.match(cache, /maxAgeMs = 45_000/);
  assert.match(cache, /JSON\.stringify\(\[userId, mode, dataSaver \? 'saver' : 'normal'\]\)/);
  assert.match(cache, /now - entry\.storedAt >= MAX_AGE_MS/);
  assert.match(cache, /return entry\.rows\.map\(row => \(\{ \.\.\.row \}\)\)/);
  assert.match(cache, /storedAt: now/);
  assert.doesNotMatch(cache, /AsyncStorage|localStorage|SecureStore|FileSystem/);
  assert.match(cache, /updateIgpatWarmFeedRow/);
});

test('IGPAT signs first visible clip, then next clip, then batched later rows with bounded recovery', () => {
  const batch = read('src/lib/igpat/signBatch.ts');
  for (const source of [native, web]) {
    assert.match(source, /const first = source\.length \? await sign\(source\[0\]\) : null/);
    assert.match(source, /void sign\(source\[1\]\)\.then/);
    assert.match(source, /signIgpatRowsInBatch\(\s*source\.slice\(2\)/);
    assert.match(source, /\.createSignedUrls\(paths, SIGNED_URL_TTL_SECONDS\)/);
    assert.match(source, /SIGNED_URL_TTL_SECONDS = 1200/);
  }
  assert.match(batch, /Math\.min\(2, missing\.length\)/);
  assert.match(batch, /if \(!isCurrent\(\)\) return \[\]/);
  assert.match(batch, /const allowedPaths = new Set\(paths\)/);
  // Preserve the visible-only persistent Reels player.
  assert.match(native, /active=\{active\}/);
  assert.match(native, /prepare=\{!weakSignal && index===activeIndex\+1\}/);
  assert.match(native, /onLoadStateChange/);
});
