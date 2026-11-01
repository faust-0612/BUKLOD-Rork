import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WALL_PREVIEW_LAYER_Z_INDEX, wallOriginalLayerZIndex } from '../src/lib/communityWallPhotoDisplayGate.ts';

const collage = readFileSync('src/components/BuklodCommunityPhotoCollage.tsx', 'utf8');
const renderer = readFileSync('src/components/BuklodCachedMediaImage.android.tsx', 'utf8');

test('single portrait photos use Wall cover fit, not forced letterboxing', () => {
  const one = collage.slice(collage.indexOf('if (count === 1) {'), collage.indexOf('const visible = photos.slice(0, 4)'));
  assert.match(one, /contentFit=\{contentFit\}/);
  assert.doesNotMatch(one, /preserveSinglePhotoAspectRatio\s*\?\s*'contain'/);
  assert.match(one, /onPress=\{\(\) => onPressPhoto\?\.\(0, photos\)\}/);
  assert.match(collage, /Math\.min\(\s*520,/);
});

test('full-quality transparent originals can paint without occluded display callback', () => {
  assert.equal(WALL_PREVIEW_LAYER_Z_INDEX, 1);
  assert.equal(wallOriginalLayerZIndex(false), 2);
  assert.equal(wallOriginalLayerZIndex(true), 2);
  assert.equal((renderer.match(/backgroundColor: 'transparent', opacity: 1, zIndex: wallOriginalLayerZIndex\(current.ready\)/g) || []).length, 2);
  assert.match(renderer, /<ExpoImage\s+pointerEvents="none"\s+key=\{'sharp-expo:/);
  assert.match(renderer, /<NativeImage[\s\S]*?key=\{'sharp-native:/);
  assert.match(renderer, /shouldRevealWallOriginal\(\{/);
  assert.match(renderer, /onDisplay=\{\(\) => \{/);
  assert.doesNotMatch(renderer, /opacity: current.ready \? 1 : 0/);
});

test('compact photo viewer retains reactions and Save without obscuring zoom', () => {
  const wall=readFileSync('src/app/(tabs)/buklod.tsx','utf8');
  const actions=wall.slice(wall.indexOf('const renderViewerPhotoActions='),wall.indexOf('const openPhotoViewer='));
  assert.match(actions,/flexDirection:'row',alignItems:'center',gap:10/);
  assert.match(actions,/compact\s+showSummary=\{false\}/);
  assert.doesNotMatch(actions,/React to this photo/);
  assert.match(actions,/accessibilityLabel="View all photo reactions"/);
  assert.match(actions,/openReactionDetails\(photo\)/);
  assert.match(actions,/saveCommunityPhoto\(photo\)/);
  assert.match(wall,/\{!viewerZoomed&&renderViewerPhotoActions\(\)\}/);
  const styles=readFileSync('src/app/(tabs)/buklodCommunityStyles.ts','utf8');
  assert.match(styles,/communityViewerActions:\{[\s\S]*?paddingVertical:6/);
});
