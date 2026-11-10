import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const wall = read('src/app/(tabs)/buklod.tsx');
const native = read('src/app/igpat/index.tsx');
const web = read('src/app/igpat/index.web.tsx');
const cache = read('src/lib/igpat/warmFeed.ts');

test('IGPAT is a sibling button in the public Wall header, not a new bottom-navigation tab', () => {
  const communityAt = wall.indexOf('>\n      COMMUNITY\n');
  const igpatAt = wall.indexOf('BUKLOD_WALL_IGPAT_SIBLING_R1');
  const dzasAt = wall.indexOf('BUKLOD_DZAS_WALL_SHORTCUT_R1');
  assert.ok(communityAt >= 0 && igpatAt > communityAt && dzasAt > igpatAt);
  assert.match(wall.slice(igpatAt, dzasAt), /accessibilityLabel="Open BUKLOD IGPAT videos"/);
  assert.match(wall.slice(igpatAt, dzasAt), /onPress=\{\(\) => router\.push\('\/igpat' as any\)\}/);
  assert.match(wall.slice(igpatAt, dzasAt), /minHeight:42/);
  assert.doesNotMatch(read('src/components/BuklodPersistentBottomNav.tsx'), /key:\s*'igpat'/);
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
    assert.match(source, /if \(!matchingFeed\) setActiveIndex\(0\)/);
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

test('IGPAT still uses progressive signed URLs, bounded signing and gated native advertising', () => {
  for (const source of [native, web]) {
    assert.match(source, /const first = source\.length \? await sign\(source\[0\]\) : null/);
    assert.match(source, /mapWithConcurrency\(source\.slice\(1\), SIGN_CONCURRENCY/);
    assert.match(source, /const SIGN_CONCURRENCY = 4/);
    assert.match(source, /SIGNED_URL_TTL_SECONDS = 1200/);
  }
  assert.match(native, /active=\{index === activeIndex \|\| \(!weakSignal && Math\.abs\(index - activeIndex\) <= 2\)\}/);
});
