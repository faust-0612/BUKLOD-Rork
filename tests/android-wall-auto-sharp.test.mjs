import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCommunityWallSharpGate } from '../src/lib/communityWallSharpUpgrade.ts';

const renderer = readFileSync('src/components/BuklodCachedMediaImage.android.tsx', 'utf8');
const collage = readFileSync('src/components/BuklodCommunityPhotoCollage.tsx', 'utf8');

test('preview is kept visible until full ORIGINAL has valid decoded dimensions', () => {
  assert.match(renderer, /actual\.painted \? <WallSharpOverlay mediaPath=\{originalPath\}/);
  assert.match(renderer, /opacity: current\.ready \? 1 : 0/);
  assert.match(renderer, /Number\(dimensions\?\.width\) > 0 && Number\(dimensions\?\.height\) > 0/);
  assert.match(renderer, /onError=\{\(\) => finish\(false\)\}/);
  assert.match(renderer, /if \(!current\.url\) return null/);
  assert.match(renderer, /const renderWithUpgrade = \(preview: React\.ReactNode\) => usingPreview \? \(/);
  assert.match(renderer, /<>[\s\S]*?\{preview\}[\s\S]*?<WallSharpOverlay/);
  assert.doesNotMatch(renderer, /<View style=\{style as any\}|const photoStyle =/);
  assert.match(renderer, /style=\{style\}/);
});

test('only Android Wall collage activates preview, fullscreen original stays original', () => {
  assert.match(collage, /useWallPreview/);
  assert.match(renderer, /const usingPreview = !!markedPreviewPath/);
  assert.match(renderer, /const renderWithUpgrade = \(preview: React\.ReactNode\) => usingPreview \?/);
  assert.match(renderer, /initialSource\(identity, path, preferred, useWallPreview\)/);
  assert.match(renderer, /renderer: preferNative \? 'native' : 'expo'/);
  assert.match(renderer, /resolveCommunityMediaUrl\(mediaPath, null\)/);
  assert.match(renderer, /ExpoImage\.getCachePathAsync\(key\)/);
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

test('unmounted queued tile is cancelled before a network request starts', async () => {
  const gate = createCommunityWallSharpGate(1, 1);
  const first = await gate.request().granted;
  const waiting = gate.request();
  waiting.cancel();
  assert.equal(await waiting.granted, null);
  first();
  assert.deepEqual(gate.stats(), { active: 0, queued: 0 });
});
