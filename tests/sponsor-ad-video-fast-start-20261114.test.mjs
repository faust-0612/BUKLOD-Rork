import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sponsoredVideoViewport,SPONSORED_VIDEO_CHECK_MS} from '../src/lib/advertise/sponsoredVideoViewport.ts';

const screen = {width:360,height:780};
const geometry = (y,height=440)=>({x:8,y,width:344,height});
const read = file=>readFileSync(file,'utf8');

test('only the approaching on-screen sponsorship prewarms, with early nonzero visibility',()=>{
  assert.equal(SPONSORED_VIDEO_CHECK_MS,120);
  assert.deepEqual(sponsoredVideoViewport(geometry(1600),screen),{visible:false,near:false});
  assert.deepEqual(sponsoredVideoViewport(geometry(1100),screen),{visible:false,near:true});
  assert.deepEqual(sponsoredVideoViewport(geometry(730),screen),{visible:false,near:true});
  assert.deepEqual(sponsoredVideoViewport(geometry(699),screen),{visible:true,near:true});
  assert.deepEqual(sponsoredVideoViewport(geometry(150),screen),{visible:true,near:true});
  assert.deepEqual(sponsoredVideoViewport(geometry(-1000),screen),{visible:false,near:false});
});
test('offscreen horizontal, invalid measurements and zero-height layouts never open player',()=>{
  assert.deepEqual(sponsoredVideoViewport({...geometry(100),x:390},screen),{visible:false,near:false});
  assert.deepEqual(sponsoredVideoViewport({...geometry(100),width:0},screen),{visible:false,near:false});
  assert.deepEqual(sponsoredVideoViewport({...geometry(100),y:NaN},screen),{visible:false,near:false});
  assert.deepEqual(sponsoredVideoViewport(geometry(100),{width:0,height:780}),{visible:false,near:false});
});
test('preloading has a bounded viewport and the native replay cache preserves original media',()=>{
  const sponsor=read('src/components/BuklodCommunitySponsoredAd.tsx');
  assert.match(sponsor,/useVideoPlayer\(source,/);
  assert.match(sponsor,/useCaching: true/);
  assert.match(sponsor,/videoNear && screenFocused/);
  assert.match(sponsor,/mediaRef\.current\?\.measureInWindow/);
  assert.match(sponsor,/ref=\{mediaRef\} collapsable=\{false\}/);
  assert.match(sponsor,/onLayout=\{\(\) => remeasureVideoRef\.current\(\)\}/);
  assert.match(sponsor,/setInterval\(check, SPONSORED_VIDEO_CHECK_MS\)/);
  assert.match(sponsor,/player\.pause\(\)/);
  assert.match(sponsor,/contentFit="contain"/);
  assert.match(sponsor,/resizeMode="contain"/);
  assert.match(sponsor,/paidSponsorshipCanDisplay/);
  assert.match(sponsor,/requestBuklodAudioFocus\('sponsor-ad'\)/);
  assert.doesNotMatch(sponsor,/setTimeout\(check,350\)|setInterval\(check,900\)/);
  assert.doesNotMatch(sponsor,/resize\(|compress:|quality: 0\./);
});
test('Wall autoplay starts without dwell while AdMob and bounded next-video prebuffer remain unchanged',()=>{
  const hook=read('src/hooks/useBuklodCommunityAdViewability.ts');
  const native=read('src/components/CommunityVideo.tsx');
  const marites=read('src/components/BuklodMaritesBoard.tsx');
  assert.match(hook,/itemVisiblePercentThreshold: 25,\s*minimumViewTime: 0/);
  assert.match(hook,/itemVisiblePercentThreshold: 60,\s*minimumViewTime: 400/);
  assert.match(hook,/Math\.min\(rows\.length, index \+ 4\)/);
  assert.match(native,/useCaching: true/);
  assert.match(native,/COMMUNITY_VIDEO_CACHE_BUDGET_BYTES/);
  assert.match(marites,/useCaching: true/);
  assert.match(marites,/contentFit="contain"/);
});
