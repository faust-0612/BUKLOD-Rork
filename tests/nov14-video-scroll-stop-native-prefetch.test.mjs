import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('media pause is signaled at scroll start, even when media still visible',()=>{
 const sig=read('src/lib/buklodVideoScrollSignal.ts');
 assert.match(sig,/BUKLOD_VIDEO_SCROLL_IDLE_MS = 180/);
 assert.match(sig,/listener\(true\)/);
 const wall=read('src/app/(tabs)/buklod.tsx');
 assert.match(wall,/noteBuklodVideoScroll\(\)/);
 assert.match(wall,/!videoViewerScrollPaused/);
 assert.match(read('src/components/BuklodMaritesBoard.tsx'),/!scrollPaused/);
 assert.match(read('src/components/BuklodExclusiveScopeCommunity.tsx'),/noteBuklodVideoScroll\(\)/);
 assert.match(read('src/components/BuklodCommunitySponsoredAd.tsx'),/visible=\{screenFocused&&videoVisible&&!scrollPaused\}/);
});
test('real video-frame geometry and next-clip preparation preserve original resolution',()=>{
 const hook=read('src/hooks/useBuklodCommunityAdViewability.ts');
 assert.match(hook,/buklodVisibleVideoArea/);
 assert.match(hook,/itemVisiblePercentThreshold: 1/);
 assert.match(hook,/registerVideoFrame/);
 assert.match(read('src/lib/buklodVideoFrameVisibility.ts'),/video frame/);
 assert.match(read('src/app/(tabs)/buklod.tsx'),/onLayout=\{onVideoFrameLayout\}/);
 assert.match(read('src/components/BuklodMaritesBoard.tsx'),/prepareVideo=\{canPrepareInline/);
 assert.match(read('src/components/BuklodMaritesBoard.tsx'),/player.loop = autoPlay/);
});
test('precache a next native AdMob creative, not a hidden loaded banner or impression',()=>{
 const ad=read('src/components/BuklodCommunityInlineAd.tsx');
 assert.match(ad,/canPrefetchNative/);
 assert.match(ad,/if \(!nativeAd \|\| nativeRendered.current \|\| !eligible\) return;/);
 assert.match(ad,/if \(!eligible \|\| !sdkReady \|\| !online\)/);
 assert.match(read('src/app/(tabs)/buklod.tsx'),/prefetch=\{preloadAdId===item.id\}/);
 assert.match(read('src/components/BuklodExclusiveScopeCommunity.tsx'),/prefetch=\{preloadAdId===item.id\}/);
 assert.match(read('src/app/(tabs)/messages.tsx'),/connect_personal_inline_4" prefetch/);
 assert.match(read('src/app/(tabs)/messages.tsx'),/connect_community_inline_4" prefetch/);
});

test('video frame probes cannot be flattened away by Android native view optimization',()=>{
 const wall=read('src/app/(tabs)/buklod.tsx');
 const scope=read('src/components/BuklodExclusiveScopeCommunity.tsx');
 assert.ok(wall.includes('registerVideoFrame(postId,node)}\\n             collapsable={false}'.replace('\\n','\n')));
 assert.ok(scope.includes('registerVideoFrame(String(item.id),node)}\\n                  collapsable={false}'.replace('\\n','\n')));
});

test('Marites warms one upcoming horizontal clip while holding paused scrollback decoder',()=>{
 const playback=read('src/lib/buklodMaritesPlayback.ts');
 const board=read('src/components/BuklodMaritesBoard.tsx');
 assert.ok(playback.includes('const distance=start-right'));
 assert.ok(playback.includes('return next>=0?next:visible'));
 assert.ok(playback.includes('distance<=cardWidth*2+gap*2'));
 assert.ok(board.includes('if (canPlayInline) setVisibleVideoIndex(selectVisibleMaritesVideo('));
 assert.ok(board.includes('index===preparedVideoIndex || index===visibleVideoIndex'));
 assert.ok(board.includes('noteBuklodVideoScroll(); requestVisibilityMeasurement();'));
});
