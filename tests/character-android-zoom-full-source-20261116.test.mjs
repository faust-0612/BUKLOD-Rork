import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const native = fs.readFileSync(
  path.join(root, 'src/components/points/BuklodProgressiveCharacterArt.android.tsx'),
  'utf8',
);
const webPath = path.join(root, 'src/components/points/BuklodProgressiveCharacterArt.tsx');
const selectorPath = path.join(root, 'src/components/points/BuklodProgressiveCharacterSelector.tsx');

test('Android full-screen art has its own renderer without changing approved web UI', () => {
  assert.ok(fs.existsSync(webPath), 'approved R31 web renderer must remain');
  assert.ok(fs.existsSync(selectorPath), 'approved R31 selector must remain');
  assert.match(native, /ANDROID_ZOOM_FULL_SOURCE_20261116/);
  assert.match(native, /NATIVE_SPRITE_WIDTH = 4940/);
  assert.match(native, /NATIVE_CELL_WIDTH = NATIVE_SPRITE_WIDTH \/ 20/);
  assert.match(native, /safeLevel - 1/);
  for (const id of ['phan', 'quin', 'van', 'christian', 'lhen']) {
    assert.ok(native.includes('assets/images/characters/' + id + '_r26.jpg'));
  }
});

test('enlarged view uses full-source decode; small views keep cheap path with failure fallback', () => {
  assert.match(native, /height >= FULL_SOURCE_MIN_HEIGHT/);
  assert.match(native, /fullSource && !fullSourceFailed/);
  assert.match(native, /<ExpoImage/);
  assert.match(native, /contentFit="fill"/);
  assert.match(native, /allowDownscaling=\{false\}/);
  assert.match(native, /priority="high"/);
  assert.match(native, /cachePolicy="memory-disk"/);
  assert.match(native, /<NativeImage/);
  assert.match(native, /resizeMethod="scale"/);
  assert.match(native, /onError=\{\(\) => setFullSourceFailed\(true\)\}/);
  assert.match(native, /\[characterId, safeLevel, fullSource\]/);
});

test('zoom still crops Christian level 3, not an adjacent sheet frame', () => {
  const spriteWidth = 4940, levels = 20, rowHeight = 508, zoomHeight = 500;
  const cell = spriteWidth / levels;
  const scale = zoomHeight / rowHeight;
  const displayedCellWidth = Math.round(cell * scale);
  const levelThreeLeft = Math.round(-((3 - 1) * cell * scale));
  assert.equal(cell, 247);
  assert.equal(displayedCellWidth, 243);
  assert.equal(levelThreeLeft, -486);
  assert.ok(displayedCellWidth * levels > 4000);
});

test('enlarged collectible art decodes original image without changing list thumbnails', () => {
  const item = fs.readFileSync(path.join(root, 'src/components/points/BuklodCollectibleArt.tsx'), 'utf8');
  assert.match(item, /const expanded = size >= 200/);
  assert.match(item, /allowDownscaling=\{!expanded\}/);
  assert.match(item, /priority=\{expanded \? 'high' : 'normal'\}/);
  assert.match(item, /collectibleArtworkUri\(characterId, level, itemIndex\)/);
  assert.match(item, /cachePolicy="memory-disk"/);
});
