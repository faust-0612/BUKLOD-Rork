import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync('src/app/(tabs)/buklod.tsx','utf8');
const load=source.slice(source.indexOf('const loadMoreVideoViewer='),source.indexOf('const openVideoViewer='));
const open=source.slice(source.indexOf('const openVideoViewer='),source.indexOf('const renderCommunityMedia='));

test('fullscreen video fair ranking cannot insert stale account or closed-viewer results',()=>{
 assert.match(source,/videoViewerScanSeqRef\.current\+=1/);
 assert.match(load,/const requestSeq=videoViewerScanSeqRef\.current/);
 assert.match(load,/if\(requestSeq!==videoViewerScanSeqRef\.current\)return;/);
 assert.match(load,/if\(requestSeq!==videoViewerScanSeqRef\.current\)return current/);
 assert.match(source,/\},\[user\?\.id,publicLocationScopeId\]\)/);
});

test('opening a post preserves the tapped video, position, consent and scroll identity',()=>{
 assert.match(open,/setVideoViewerPosts\(\[target\]\)/);
 assert.match(open,/setVideoViewerIndex\(0\)/);
 assert.match(open,/setVideoViewerAdsEnabled\(Platform\.OS==='android' && reelAdsReady && reelAdConsent\)/);
 assert.match(source,/buildReelsFeedWithInlineAds\(videoViewerPosts\)/);
 assert.match(source,/key=\{\s*'video-viewer-'\+\s*videoViewerSession\s*\}/);
});

test('fair exposure does not alter server authorization or expensive autoplay behavior',()=>{
 assert.match(load,/get_buklod_public_community_video_page_v1/);
 assert.match(load,/p_location_scope_id:publicLocationScopeId\?\?null/);
 assert.match(load,/lastCommunityVideoCursor\(rows\)/);
 assert.match(load,/arrangeCommunityVideosForFairExposure\(/);
 assert.match(load,/appendUniqueCommunityVideos\(current,ranked\)/);
 assert.doesNotMatch(load,/random\(\)|order\('random'/);
});
