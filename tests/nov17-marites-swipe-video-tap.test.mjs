import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveMaritesStorySwipe as swipe } from '../src/lib/buklodMaritesSwipe.ts';

const board = readFileSync('src/components/BuklodMaritesBoard.tsx','utf8');
const player = readFileSync('src/components/CommunityVideo.tsx','utf8');
const start = { x: 220, y: 200 };

test('Marites swipe advances horizontally but never on vertical scrolling, slow touch or zoom', () => {
  const ctx={ enabled:true, photoCount:0, photoIndex:0, elapsedMs:240 };
  assert.equal(swipe(start,{x:110,y:207},ctx),1);
  assert.equal(swipe(start,{x:350,y:207},ctx),-1);
  assert.equal(swipe(start,{x:170,y:201},ctx),null);
  assert.equal(swipe(start,{x:110,y:340},ctx),null);
  assert.equal(swipe(start,{x:110,y:207},{...ctx,enabled:false}),null);
  assert.equal(swipe(start,{x:110,y:207},{...ctx,elapsedMs:1500}),null);
});

test('photo carousels retain inner horizontal paging except at their edges',()=>{
  const ctx={enabled:true,photoCount:3,photoIndex:1,elapsedMs:210};
  assert.equal(swipe(start,{x:100,y:198},ctx),null);
  assert.equal(swipe(start,{x:340,y:198},ctx),null);
  assert.equal(swipe(start,{x:100,y:198},{...ctx,photoIndex:2}),1);
  assert.equal(swipe(start,{x:340,y:198},{...ctx,photoIndex:0}),-1);
});

test('Marites fullscreen uses swipe and preserves zoom, reactions and media lifecycle',()=>{
  assert.match(board,/onTouchStart=\{event =>/);
  assert.match(board,/onTouchEnd=\{event =>/);
  assert.match(board,/onTouchMove=\{event =>/);
  assert.match(board,/resolveMaritesStorySwipe/);
  assert.match(board,/onMomentumScrollEnd=\{event =>/);
  assert.match(board,/!storyZoomed && !reactionPickerOpen/);
  assert.doesNotMatch(board,/accessibilityLabel="Previous Marites story"/);
  assert.doesNotMatch(board,/accessibilityLabel="Next Marites story"/);
  assert.match(board,/onViewerVisibilityChange\?\.\(true\)/);
  assert.match(board,/onViewerVisibilityChange\?\.\(false\)/);
});

test('regular Wall video taps fullscreen preserving resume; IMA paid ad surface remains untouched',()=>{
  assert.match(player,/onPress=\{onOpenFullscreen && !fullscreen \? openFullscreenFromTap : togglePlayback\}/);
  assert.match(player,/playbackTimeByUri\.set\(playbackIdentity, Number\(player\.currentTime \|\| currentTime \|\| 0\)\)/);
  assert.match(player,/onOpenFullscreen\(\);/);
  assert.match(player,/function ImaCommunityVideo/);
  assert.match(player,/\<BuklodImaVideo/);
  assert.match(player,/onAdEvent=\{\(event\) =>/);
});
