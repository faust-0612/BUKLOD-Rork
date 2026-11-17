import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = file => readFileSync(new URL('../'+file, import.meta.url),'utf8');

const wall=read('src/app/(tabs)/buklod.tsx');
const video=read('src/components/CommunityVideo.tsx');
const connect=read('src/components/BuklodConnectThread.tsx');
const cache=read('src/lib/communityVideoPlayback.ts');

test('navigation: fullscreen handoff still honors same signed URL and modal close/back',()=>{
  assert.match(wall,/wallVideoFreshUrls\[postId\]/);
  assert.match(wall,/videoViewerFreshUrls\[/);
  assert.match(wall,/onRequestClose=\{\s*closeVideoViewer\s*\}/);
  assert.match(wall,/videoViewerOpenPendingRef\.current=false;/);
  assert.match(wall,/if\(Platform\.OS==='android'\)\{[\s\S]*?videoViewerOpenPendingRef\.current=true;/);
  assert.match(wall,/Web uses its existing viewer navigation[\s\S]*?setVideoViewerOpen\(true\)/);
  assert.match(wall,/animationType=\{Platform\.OS==='android'\?'none':'fade'\}/);
  assert.match(wall,/setVideoViewerHandoffPostId\(null\)/);
  assert.match(wall,/videoViewerScanSeqRef\.current\+=1/);
  assert.match(wall,/onPlaybackError=\{\(\)=>\{\s*void refreshVideoViewerUrl\(item,fullscreenUri\)/);
});

test('ads: IMA and native companion/Reels ad placements have not been bypassed',()=>{
  assert.match(video,/if \(imaEligible && active\)/);
  assert.match(video,/<ImaCommunityVideo/);
  assert.match(video,/buildBuklodImaAdTagUrl/);
  assert.match(wall,/<BuklodVideoCompanionAd/);
  assert.match(wall,/<BuklodReelsInlineAd/);
  assert.match(wall,/videoViewerAdsEnabled/);
  assert.match(cache,/kind === 'google-ima'/);
  assert.match(cache,/reuseAcrossSignedUrlRotation: false/);
  assert.doesNotMatch(video,/isBuklodImaNativeAvailable\(\)\s*=\s*false/);
});

test('connect: own-send and older paging preserved while a gesture owns scroll',()=>{
  assert.match(connect,/followOwnSendRef\.current = true/);
  assert.match(connect,/pendingOlderAnchorRef\.current = null/);
  assert.match(connect,/connectOlderPrependScrollOffset\(anchor, height\)/);
  assert.match(connect,/userDraggingRef\.current \|\| userMomentumRef\.current/);
  assert.match(connect,/markVisibleRoomRead\('open'\)/);
  assert.match(connect,/nearBottomRef\.current = true/);
  assert.match(connect,/overScrollMode="never"/);
});
