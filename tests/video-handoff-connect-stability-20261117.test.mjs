import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../'+path, import.meta.url),'utf8');

test('Wall detach precedes fullscreen mount; expo player reuse excludes IMA',()=>{
  const wall=read('src/app/(tabs)/buklod.tsx');
  const video=read('src/components/CommunityVideo.tsx');
  assert.match(wall,/suspendedForFullscreen=\{videoViewerHandoffPostId===postId\}/);
  assert.match(wall,/videoViewerOpenPendingRef\.current=true;[\s\S]*?setVideoViewerHandoffPostId\(postId\)/);
  assert.match(wall,/useEffect\(\(\)=>\{[\s\S]*?setVideoViewerOpen\(true\)/);
  assert.match(video,/if \(!mountPlayer \|\| props\.suspendedForFullscreen\)/);
  assert.match(video,/if \(imaEligible && active\)/);
  assert.match(video,/Platform\.OS === 'android' && props\.handoffEnabled && props\.playbackKey/);
});

test('video poster remains until a decoded frame, without removing ads or bounded cache',()=>{
  const video=read('src/components/CommunityVideo.tsx');
  assert.match(video,/onFirstFrameRender=\{\(\) => \{/);
  assert.match(video,/\(posterSource \|\| posterUri\) && !firstFrameRendered/);
  assert.match(video,/COMMUNITY_VIDEO_CACHE_BUDGET_BYTES/);
  assert.match(video,/minBufferForPlayback: 2\.5/);
  assert.match(video,/preferredForwardBufferDuration: 20/);
  assert.match(video,/degradedNetwork=\{degraded\}/);
  assert.match(video,/BuklodImaVideo/);
});

test('handoff lease has explicit bounded release and same-URI isolation',()=>{
  const src=read('src/lib/communityVideoHandoff.ts');
  assert.match(src,/HANDOFF_RELEASE_MS = 500/);
  assert.match(src,/ORPHAN_RELEASE_MS = 3000/);
  assert.match(src,/\$\{identity\}\\u0000\$\{uri\}/);
  assert.match(src,/lease\.player\.release\(\)/);
});

test('Connect initial scroll is a single layout-frame adjustment',()=>{
  const src=read('src/components/BuklodConnectThread.tsx');
  const block=src.slice(src.indexOf('const scheduleInitialAnchor ='),src.indexOf('const applyHistoryPage ='));
  assert.match(block,/requestAnimationFrame\(\(\) => \{/);
  assert.equal((block.match(/scrollToEnd/g)||[]).length,1);
  assert.doesNotMatch(block,/setTimeout/);
  assert.match(src,/pendingOlderAnchorRef\.current = null/);
  assert.match(src,/userDraggingRef\.current \|\| userMomentumRef\.current/);
});
