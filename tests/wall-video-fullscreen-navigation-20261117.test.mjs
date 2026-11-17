import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(path.join(root, file), 'utf8');
const wall = read('src/app/(tabs)/buklod.tsx');
const player = read('src/components/CommunityVideo.tsx');

test('tapped Public Wall video opens viewer even when video playlist is temporarily stale', () => {
  assert.ok(wall.includes('const target=index>=0?wallVideoPosts[index]:tappedPost;'));
  assert.ok(wall.includes('if(!target || !communityWallVideoDescriptor(target))return;'));
  assert.match(wall, /openVideoViewer\(\s*String\(item\.id\),item\s*\)/);
  assert.ok(wall.includes('setVideoViewerPosts([target])'));
  assert.ok(wall.includes('setVideoViewerOpen(true)'));
});

test('Public Wall fullscreen navigation keeps a reversible viewer route', () => {
  assert.match(wall, /visible=\{videoViewerOpen\}/);
  assert.match(wall, /onRequestClose=\{\s*closeVideoViewer\s*\}/);
  assert.match(wall, /accessibilityLabel="Close full screen video"/);
});

test('Android video tap remains usable with inactive preview and native surface', () => {
  assert.match(player, /if \(onOpenFullscreen\) \{\s*onOpenFullscreen\(\);\s*return;/);
  assert.match(player, /pointerEvents="none"\s*player=\{player\}/);
  assert.match(player, /onPress=\{onOpenFullscreen && !fullscreen \? openInlineFullscreen : togglePlayback\}/);
  assert.match(player, /accessibilityLabel="Open video full screen"\s*onPress=\{openInlineFullscreen\}/);
  assert.match(player, /onPress=\{\(\) => setFillFrame\(current => !current\)\}/);
  assert.match(player, /onAdEvent=\{\(event\) =>/);
});
