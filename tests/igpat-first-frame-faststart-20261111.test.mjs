import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const native = readFileSync('src/app/igpat/index.tsx', 'utf8');
const web = readFileSync('src/app/igpat/index.web.tsx', 'utf8');
const warmFeed = readFileSync('src/lib/igpat/warmFeed.ts', 'utf8');

function playerBody(source) {
  const start = source.indexOf('function IgpatVideo(');
  const end = source.indexOf('function ActionButton(', start);
  assert.ok(start >= 0 && end > start, 'isolated IGPAT video component must exist');
  return source.slice(start, end);
}

test('Android: only the active reel creates a VideoView surface while the next player may preload', () => {
  const body = playerBody(native);
  assert.match(body, /const player = useVideoPlayer\(source,/);
  assert.match(body, /\{active \? \(\s*<VideoView/);
  assert.match(body, /onFirstFrameRender=\{handleFirstFrameRender\}/);
  assert.match(body, /if \(active && !pausedByUser\) player\.play\(\);\s*else player\.pause\(\);/);
  assert.match(native, /index === activeIndex \|\| index === nextPlayableIndex/);
  assert.match(native, /!isReelsFeedInlineAdRow\(item\)/);
  assert.match(native, /const nextPlayableIndex = \(dataSaver \|\| weakSignal\) \? -1/);
});

test('Native buffer policy prefers first-frame startup without shortening weak-network safety buffers', () => {
  const body = playerBody(native);
  assert.match(body, /minBufferForPlayback: 0\.75, preferredForwardBufferDuration: 12/);
  assert.match(body, /minBufferForPlayback: 1\.5, preferredForwardBufferDuration: 16/);
  assert.match(body, /\[conservativeBuffer, player\]/);
  assert.match(native, /conservativeBuffer=\{dataSaver \|\| weakSignal\}/);
  assert.match(body, /playbackActivatedAtRef\.current = Date\.now\(\)/);
  assert.match(body, /stage: 'video_startup'/);
  assert.match(body, /elapsedMs: Date\.now\(\) - playbackActivatedAtRef\.current/);
});

test('Android and web hide loading only on rendered first frame; stalled clips offer direct play', () => {
  for (const source of [native, web]) {
    const body = playerBody(source);
    assert.match(body, /const \[firstFrameUri, setFirstFrameUri\]/);
    assert.match(body, /active && firstFrameUri !== uri/);
    assert.match(body, /setTimeout\(\(\) => setShowTapHint\(true\), 3000\)/);
    assert.match(body, /showTapHint \? 'TAP TO PLAY' : 'OPENING VIDEO'/);
    assert.match(body, /if \(firstFrameUri !== uri\) \{\s*setPausedByUser\(false\);\s*try \{ player\.play\(\); \} catch \{\}/);
    assert.match(source, /initialNumToRender=\{2\}/);
    assert.match(source, /updateCellsBatchingPeriod=\{40\}/);
  }
  assert.match(playerBody(web), /\{active \? \(\s*<VideoView/);
  assert.match(playerBody(web), /onFirstFrameRender=\{\(\) => setFirstFrameUri\(uri\)\}/);
});

test('IGPAT keeps private access, bounded warm feed, advertising and quick-edit invariants', () => {
  assert.match(native, /createSignedUrl\(row\.media_path, SIGNED_URL_TTL_SECONDS\)/);
  assert.match(web, /createSignedUrl\(row\.media_path, SIGNED_URL_TTL_SECONDS\)/);
  assert.match(warmFeed, /const MAX_AGE_MS = 8 \* 60 \* 1000/);
  assert.match(warmFeed, /if \(!userId\) return null/);
  assert.match(native, /BuklodReelsInlineAd/);
  assert.match(native, /onLoadStateChange=/);
  assert.match(web, /parseIgpatQuickEdit/);
  assert.match(web, /trimStart/);
  assert.match(web, /trimEnd/);
});
