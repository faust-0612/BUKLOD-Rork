import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const wall=read('src/app/(tabs)/buklod.tsx');
const player=read('src/components/CommunityVideo.tsx');
const effects=read('src/components/BuklodFlyingVideoReactions.tsx');
const swipe=read('src/lib/buklodFullscreenVideoSwipe.ts');

test('player and paused poster recognize fullscreen vertical swipe while retaining tap',()=>{
 assert.match(player,/function VideoTapSurface/);
 assert.match(player,/<GestureDetector gesture=\{gesture\}>\{tap\}<\/GestureDetector>/);
 assert.match(player,/onFullscreenSwipe=\{onFullscreenSwipe\}/);
 assert.match(player,/onPress=\{onOpenFullscreen && !fullscreen \? openInlineFullscreen : togglePlayback\}/);
 assert.match(player,/\.activeOffsetY\(\[-16,16\]\)/);
 assert.match(swipe,/Math\.abs\(translationY\) < 46/);
 assert.match(swipe,/Math\.abs\(translationX\) > Math\.abs\(translationY\) \* 0\.75/);
});
test('details swipes page the same feed but sponsored ads keep own interaction',()=>{
 assert.match(wall,/<GestureDetector gesture=\{videoViewerDetailsPan\}>/);
 assert.match(wall,/pointerEvents="box-none"/);
 assert.match(wall,/onFullscreenSwipe=\{swipeVideoViewer\}/);
 assert.match(wall,/if\(!videoViewerOpen \|\| videoViewerActiveIsAd\)return/);
 assert.match(wall,/videoViewerListRef\.current\?\.scrollToIndex\(\{index:next,animated:true\}\)/);
 assert.match(wall,/<BuklodReelsInlineAd/);
 assert.match(wall,/openComments\(\s*activePost\s*\)/);
});
test('flying reactions are local, bounded, and never block buttons or ads',()=>{
 assert.match(wall,/current\.slice\(-3\)/);
 assert.match(wall,/if\(activePost\.my_reaction!==key\)showVideoViewerFlyingReaction/);
 assert.match(wall,/setVideoViewerFlyingReactions\(\[\]\)/);
 assert.match(effects,/pointerEvents="none"/);
 assert.match(effects,/useNativeDriver:true/);
 assert.match(effects,/duration:1180/);
 assert.match(effects,/animation\.stop\(\)/);
 assert.doesNotMatch(effects,/supabase|fetch\(|setInterval\(/);
});

test('fullscreen navigation retains close/back and Wall media URL reuse',()=>{
 assert.match(wall,/onRequestClose=\{\s*closeVideoViewer\s*\}/);
 assert.match(wall,/videoViewerOpenPendingRef\.current=false/);
 assert.match(wall,/wallVideoFreshUrls\[postId\]/);
 assert.match(wall,/onPlaybackError=\{\(\)=>\{\s*void refreshVideoViewerUrl\(item,fullscreenUri\)/);
});
