import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const native = readFileSync('src/app/igpat/index.tsx', 'utf8');
const web = readFileSync('src/app/igpat/index.web.tsx', 'utf8');
const wall = readFileSync('src/components/CommunityVideo.tsx', 'utf8');
const telemetry = readFileSync('src/lib/communityFeedTelemetry.ts', 'utf8');
const policy = readFileSync('src/lib/communityVideoPlayback.ts', 'utf8');

test('Native Reels loads the first signed playable row without waiting for the full feed', () => {
  assert.match(native, /const first = source\.length \? await sign\(source\[0\]\)/);
  assert.match(native, /const seeded = source\.map/);
  assert.match(native, /setRows\(pending\)/);
  assert.match(native, /setRows\(readyRows\)/);
  assert.match(native, /if \(first\?\.media_url \|\| retainedRows\.length === 0/);
  assert.match(native, /void sign\(source\[1\]\)\.then/);
  assert.match(native, /void signIgpatRowsInBatch\(\s*source\.slice\(2\)/);
  assert.match(native, /createSignedUrls\(paths, SIGNED_URL_TTL_SECONDS\)/);
  assert.match(native, /generation === loadGenerationRef\.current/);
  assert.match(native, /return \(\) => \{ loadGenerationRef\.current \+= 1; \}/);
});

test('Native IGPAT warms one next video but excludes inline ad rows and data saver', () => {
  assert.match(native, /const nextPlayableIndex = \(dataSaver \|\| weakSignal\) \? -1/);
  assert.match(native, /!isReelsFeedInlineAdRow\(item\)/);
  assert.match(native, /index === activeIndex \|\| index === nextPlayableIndex/);
  assert.match(native, /active=\{index === activeIndex\}/);
  assert.match(native, /useCaching: true/);
  assert.match(native, /minBufferForPlayback: 1\.5/);
  assert.match(native, /preferredForwardBufferDuration: 16/);
  assert.match(native, /BuklodReelsInlineAd/);
});

test('Web IGPAT preserves quick-edit controls and warms one subsequent video', () => {
  assert.match(web, /const first = source\.length \? await sign\(source\[0\]\)/);
  assert.match(web, /const nextPlayableIndex = \(dataSaver \|\| weakSignal\) \? -1 : activeIndex \+ 1/);
  assert.match(web, /void sign\(source\[1\]\)\.then/);
  assert.match(web, /void signIgpatRowsInBatch\(\s*source\.slice\(2\)/);
  assert.match(web, /index === activeIndex \|\| index === nextPlayableIndex/);
  assert.match(web, /active=\{index === activeIndex\}/);
  assert.match(web, /parseIgpatQuickEdit/);
  assert.match(web, /trimStart/);
  assert.match(web, /trimEnd/);
});

test('HLS-aware fallback and privacy-safe startup/rebuffer metrics keep Wall ad path', () => {
  assert.match(native, /contentType: 'hls'/);
  assert.match(web, /contentType: 'hls'/);
  assert.match(wall, /contentType: 'hls'/);
  assert.match(telemetry, /video_startup/);
  assert.match(telemetry, /video_rebuffer/);
  assert.match(native, /recordCommunityFeedMetric/);
  assert.match(wall, /ImaCommunityVideo/);
  assert.match(wall, /useCaching: true/);
  assert.match(policy, /COMMUNITY_VIDEO_CACHE_BUDGET_BYTES = 256 \* 1024 \* 1024/);
});
