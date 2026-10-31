import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCommunityWallSharpGate } from '../src/lib/communityWallSharpUpgrade.ts';

const renderer = readFileSync('src/components/BuklodCachedMediaImage.android.tsx', 'utf8');
const collage = readFileSync('src/components/BuklodCommunityPhotoCollage.tsx', 'utf8');

test('preview is kept visible until full ORIGINAL has valid decoded dimensions', () => {
  assert.match(renderer, /shouldMountWallOriginalUpgrade\(\{/);
  assert.match(renderer, /<WallSharpOverlay mediaPath=\{originalPath\}/);
  assert.match(renderer, /opacity: 1, zIndex: wallOriginalLayerZIndex\(current.ready\)/);
  assert.match(renderer, /Number\(dimensions\?\.width\) > 0 && Number\(dimensions\?\.height\) > 0/);
  assert.match(renderer, /activeUpgradeRendererRef\.current === 'native'\) finish\(false\)/);
  assert.match(renderer, /if \(!current\.url\) return null/);
  assert.match(renderer, /const renderWithUpgrade = \(preview: React\.ReactNode\) => \(/);
  assert.match(renderer, /<>[\s\S]*?\{preview\}[\s\S]*?<WallSharpOverlay/);
  assert.doesNotMatch(renderer, /<View style=\{style as any\}|const photoStyle =/);
  assert.match(renderer, /style=\{\[\{ backgroundColor: '#EEF3F0' \}, style, usingPreview && \{ zIndex: WALL_PREVIEW_LAYER_Z_INDEX \} \]\}/);
  assert.doesNotMatch(renderer, /<View style=\{style as any\}|const photoStyle =/);
});

test('only Android Wall collage activates preview, fullscreen original stays original', () => {
  assert.match(collage, /useWallPreview/);
  assert.match(renderer, /const usingPreview = !!markedPreviewPath/);
  assert.match(renderer, /shouldMountWallOriginalUpgrade\(\{/);
  assert.match(renderer, /initialSource\(identity, path, preferred, usingPreview\)/);
  assert.match(renderer, /renderer: preferNative \? 'native' : 'expo'/);
  assert.match(renderer, /resolveCommunityMediaUrl\(mediaPath, null\)/);
  assert.match(renderer, /ExpoImage\.getCachePathAsync\(key\)/);
  assert.match(renderer, /setRetryPending\(true\)/);
  assert.match(renderer, /const pause = Math.min\(120_000/);
  assert.match(renderer, /badCacheKeys\.current\.add\(cacheKey\)/);
  assert.doesNotMatch(renderer, /getPublicUrl|\/object\/public\//);
});

test('sharp download gate caps active loads and gives waiting tiles slots', async () => {
  const gate = createCommunityWallSharpGate(2, 2);
  const first = await gate.request().granted;
  const second = await gate.request().granted;
  assert.ok(first && second);
  const third = gate.request(), fourth = gate.request();
  const overflow = await gate.request().granted;
  assert.equal(overflow, null);
  assert.deepEqual(gate.stats(), { active: 2, queued: 2 });
  first();
  const thirdRelease = await third.granted;
  assert.ok(thirdRelease);
  assert.deepEqual(gate.stats(), { active: 2, queued: 1 });
  fourth.cancel();
  assert.equal(await fourth.granted, null);
  thirdRelease();
  second();
  first(); // idempotent release
  assert.deepEqual(gate.stats(), { active: 0, queued: 0 });
});

test('default queue preserves every mounted upgrade even beyond legacy twelve waiting slots', async () => {
  const gate = createCommunityWallSharpGate();
  const release1 = await gate.request().granted;
  const release2 = await gate.request().granted;
  const pending = Array.from({length: 20}, () => gate.request());
  assert.deepEqual(gate.stats(), {active: 2, queued: 20});
  const releases = [];
  for (const request of pending) {
    if (release1 && releases.length === 0) release1();
    else if (release2 && releases.length === 1) release2();
    else releases[releases.length - 2]?.();
    const release = await request.granted;
    assert.ok(release);
    releases.push(release);
  }
  for (const release of releases) release();
  assert.deepEqual(gate.stats(), {active: 0, queued: 0});
});

test('unmounted queued tile is cancelled before a network request starts', async () => {
  const gate = createCommunityWallSharpGate(1, 1);
  const first = await gate.request().granted;
  const waiting = gate.request();
  waiting.cancel();
  assert.equal(await waiting.granted, null);
  first();
  assert.deepEqual(gate.stats(), { active: 0, queued: 0 });
});

test('unindexed legacy originals are rendered directly, not misclassified as native previews', () => {
  assert.match(renderer, /const usingPreview = !!markedPreviewPath/);
  assert.match(renderer, /const path = usingPreview \? markedPreviewPath! : originalPath/);
  assert.match(renderer, /initialSource\(identity, path, preferred, usingPreview\)/);
  assert.match(renderer, /renderer: usingPreview \? 'native' : 'expo'/);
  assert.match(renderer, /onDisplay=\{\(\) => \{/);
});

test('sharp originals do not wait for a preview onLoad/onDisplay', () => {
  const start = renderer.indexOf('const renderWithUpgrade = (preview: React.ReactNode)');
  const stop = renderer.indexOf('if (!actual.url || actual.failed)', start);
  assert.ok(start > 0 && stop > start);
  const flow = renderer.slice(start, stop);
  assert.match(flow, /shouldMountWallOriginalUpgrade/);
  assert.match(flow, /<WallSharpOverlay/);
  assert.doesNotMatch(flow, /actual\.painted \? <WallSharpOverlay/);
  assert.match(renderer, /return renderWithUpgrade\(\s*<Pressable/);
});

test('dynamic 3G gate admits only one original until it finishes', async () => {
  let limit = 1;
  const gate = createCommunityWallSharpGate(2, Infinity, () => limit);
  const first = await gate.request().granted;
  assert.ok(first);
  const second = gate.request();
  assert.deepEqual(gate.stats(), {active:1, queued:1});
  limit = 2;
  first();
  const release = await second.granted;
  assert.ok(release);
  release();
  assert.deepEqual(gate.stats(), {active:0, queued:0});
});

test('preview failure cannot cancel an already queued or downloading original', () => {
  assert.doesNotMatch(renderer, /setFailedPreviewFor/);
  assert.match(renderer, /const usingPreview = !!markedPreviewPath &&/);
  assert.match(renderer, /shouldMountWallOriginalUpgrade\(\{/);
  assert.match(renderer, /const renderWithUpgrade = \(preview: React.ReactNode\) => \(/);
  assert.match(renderer, /if \(usingPreview\) \{[\s\S]*?failed: true/);
});
