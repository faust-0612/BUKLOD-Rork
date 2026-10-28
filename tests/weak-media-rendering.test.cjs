const test = require('node:test');
const assert = require('node:assert/strict');
const read = path => require('node:fs').readFileSync(path, 'utf8');

test('degraded prefetch avoids a background request flood', () => {
  const network = read('src/lib/buklodNetworkQuality.ts');
  assert.ok(network.includes("return { concurrency: 1, burst: 2 }"));
  assert.ok(network.includes("return { concurrency: 0, burst: 0 }"));
  assert.ok(read('src/lib/communityMediaPrefetch.ts').includes("ExpoImage.prefetch(item.uri, 'disk')"));
});
test('photo encoding bounds dimensions without upscaling', () => {
  const upload = read('src/lib/uploadCommunityVideoFile.ts');
  assert.ok(upload.includes('existingBytes <= 2 * 1024 * 1024'));
  assert.ok(upload.includes('Math.max(dimensions.width, dimensions.height) > 1440'));
  assert.ok(upload.includes('compress: 0.82'));
  assert.ok(upload.includes('preferResumable: true'));
});
test('Marites photo tiles cache to disk and show missing-image feedback', () => {
  const collage = read('src/components/BuklodMaritesPhotoCollage.tsx');
  assert.ok(collage.includes('Image as ExpoImage'));
  assert.ok(collage.includes('cachePolicy="disk"'));
  assert.ok(collage.includes('Larawan hindi ma-load'));
});
test('Marites video playback caches native remote streams only', () => {
  const board = read('src/components/BuklodMaritesBoard.tsx');
  assert.ok(board.includes("Platform.OS !== 'web'"));
  assert.ok(board.includes('useCaching: true'));
  assert.ok(board.includes('useVideoPlayer(source'));
  assert.ok(board.includes('index === visibleVideoIndex'));
});
