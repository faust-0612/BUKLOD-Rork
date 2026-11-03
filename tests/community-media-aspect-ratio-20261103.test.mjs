import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { communitySinglePhotoFrame, communityVideoFrameHeight } from '../src/lib/communityMediaPresentation.ts';
const photoSource=readFileSync('src/components/BuklodCommunityPhotoCollage.tsx','utf8');
const videoSource=readFileSync('src/components/CommunityVideo.tsx','utf8');
test('normal portrait, square and landscape photos remain edge-to-edge',()=>{
 assert.deepEqual(communitySinglePhotoFrame(400,0.8),{height:500,contentFit:'cover'});
 assert.deepEqual(communitySinglePhotoFrame(400,1),{height:400,contentFit:'cover'});
 assert.deepEqual(communitySinglePhotoFrame(400,1.6),{height:250,contentFit:'cover'});
});
test('extreme tall and panoramic photos preserve all pixels in bounded cards',()=>{
 assert.deepEqual(communitySinglePhotoFrame(400,0.5),{height:640,contentFit:'contain'});
 assert.deepEqual(communitySinglePhotoFrame(400,2.5),{height:220,contentFit:'contain'});
});
test('video frame follows decoded track ratio within bounds',()=>{
 assert.equal(communityVideoFrameHeight(400,16/9),225);
 assert.equal(communityVideoFrameHeight(400,1),400);
 assert.equal(communityVideoFrameHeight(400,9/16),620);
 assert.equal(communityVideoFrameHeight(0,9/16,380),380);
});
test('recycled photo tile cannot inherit previous image dimensions',()=>{
 assert.ok(photoSource.includes('singleAspect?.identity === photoIdentity'));
 assert.match(photoSource,/identity: photoIdentity, ratio: nextRatio/);
});
test('video renderer reads the actual track and reacts to track changes',()=>{
 assert.match(videoSource,/player\.availableVideoTracks/);
 assert.match(videoSource,/'videoTrackChange'/);
 assert.match(videoSource,/communityVideoFrameHeight\(measuredWidth, videoAspectRatio, height\)/);
 assert.ok(videoSource.includes("fullscreen || preserveAspectRatio ? 'contain' : 'cover'"));
});
