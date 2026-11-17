import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(path.join(root, file), 'utf8');
const lib = read('src/lib/buklodMaritesPlayback.ts');
const marites = read('src/components/BuklodMaritesBoard.tsx');
const androidVideo = read('src/components/CommunityVideo.tsx');
const webVideo = read('src/components/CommunityVideo.web.tsx');

// Execute the actual pure TS helper body with Node built-ins; no RN runtime
// or dependencies are needed for this release-critical gesture contract.
const helper = lib.match(/export function maritesStorySwipeStep\(input: \{[\s\S]*?\}\): -1 \| 0 \| 1 \{([\s\S]*?)\n\}/);
assert.ok(helper, 'Marites pure swipe helper must remain exported');
const swipe = vm.runInNewContext('(function(input) {' + helper[1] + '\n})');
const base = {
  startX: 300, startY: 400, endX: 100, endY: 420,
  elapsedMs: 200, photoCount: 0, photoPage: 0,
  zoomed: false, reacting: false, hasMultipleStories: true,
};

test('Marites swipes between stories only on deliberate horizontal gestures', () => {
  assert.equal(swipe(base), 1);
  assert.equal(swipe({...base, startX: 100, endX: 300}), -1);
  assert.equal(swipe({...base, endX: 260}), 0);
  assert.equal(swipe({...base, endY: 700}), 0);
  assert.equal(swipe({...base, elapsedMs: 900}), 0);
  assert.equal(swipe({...base, zoomed: true}), 0);
  assert.equal(swipe({...base, reacting: true}), 0);
  assert.equal(swipe({...base, hasMultipleStories: false}), 0);
  assert.equal(swipe({...base, endX: NaN}), 0);
});

test('multi-photo paging is not stolen until the carousel edge', () => {
  assert.equal(swipe({...base, photoCount: 3, photoPage: 0}), 0);
  assert.equal(swipe({...base, photoCount: 3, photoPage: 1}), 0);
  assert.equal(swipe({...base, photoCount: 3, photoPage: 2}), 1);
  assert.equal(swipe({...base, photoCount: 3, photoPage: 0,
    startX: 100, endX: 300}), -1);
  assert.equal(swipe({...base, photoCount: 3, photoPage: 1,
    startX: 100, endX: 300}), 0);
});

test('Marites viewer connects swipe input and removes old arrow navigation', () => {
  assert.match(marites, /onTouchStart=\{onStoryTouchStart\}/);
  assert.match(marites, /onTouchEnd=\{onStoryTouchEnd\}/);
  assert.match(marites, /onMomentumScrollEnd=/);
  assert.match(marites, /onTouchCancel=/);
  assert.match(marites, /maritesStorySwipeStep\(\{/);
  assert.doesNotMatch(marites, /fullscreenStoryNav|Use arrows for/);
  assert.match(marites, /onLongPress=\{\(\) =>/);
});

test('inline Android Wall video tap opens fullscreen but viewer tap controls playback', () => {
  assert.match(androidVideo, /onPress=\{onOpenFullscreen && !fullscreen \? openInlineFullscreen : togglePlayback\}/);
  assert.match(androidVideo, /playbackTimeByUri\.set\(/);
  assert.match(androidVideo, /function togglePlayback\(\)/);
  assert.match(androidVideo, /function ImaCommunityVideo\(/);
  assert.match(androidVideo, /onAdEvent=\{/);
});

test('web video opens fullscreen on click or keyboard, retaining controls in viewer', () => {
  assert.match(webVideo, /controls: fullscreen \|\| !onOpenFullscreen/);
  assert.match(webVideo, /onClick: \(\) => \{/);
  assert.match(webVideo, /onKeyDown: \(event: any\) => \{/);
  assert.match(webVideo, /videoRef\.current\?\.pause\(\)/);
  assert.match(webVideo, /soundOn \? 'Turn sound off' : 'Turn sound on'/);
  assert.doesNotMatch(webVideo, /'⛶'/);
});

const publicWall = read('src/app/(tabs)/buklod.tsx');

test('tap-to-fullscreen remains usable on inactive/offscreen Android video previews', () => {
  assert.match(androidVideo, /if \(onOpenFullscreen\) \{\s*onOpenFullscreen\(\);\s*return;\s*\}\s*onRequestPlay\?\.\(\);/);
  assert.match(androidVideo, /pointerEvents="none"\s*player=\{player\}/);
  assert.match(androidVideo, /tapLayer: \{\s*\.\.\.StyleSheet\.absoluteFillObject,\s*zIndex: 1,/);
  assert.match(androidVideo, /accessibilityLabel="Open video full screen"\s*onPress=\{openInlineFullscreen\}/);
  assert.match(androidVideo, /<Text style=\{styles\.fitChoiceText\}>Full screen<\/Text>/);
  assert.match(androidVideo, /onPress=\{\(\) => setFillFrame\(current => !current\)\}/);
});

test('Wall viewer uses the tapped video when async playlist membership lags', () => {
  assert.match(publicWall, /const target=index>=0\?wallVideoPosts\[index\]:tappedPost;/);
  assert.match(publicWall, /if\(!target \|\| !communityWallVideoDescriptor\(target\)\)return;/);
  assert.match(publicWall, /openVideoViewer\(\s*String\(item\.id\),item\s*\)/);
  assert.match(publicWall, /setVideoViewerPosts\(\[target\]\)/);
});
