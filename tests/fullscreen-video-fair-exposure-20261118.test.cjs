const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const {
  arrangeCommunityVideosForFairExposure,
  appendUniqueCommunityVideos,
  lastCommunityVideoCursor,
  COMMUNITY_VIDEO_DISCOVERY_PAGE_SIZE,
  COMMUNITY_VIDEO_DISCOVERY_LIMIT,
} = require('../src/lib/buklodVideoDiscovery.ts');

const now = Date.parse('2026-11-18T00:00:00Z');
const video = (id, author, reactions = 10, ageHours = 3) => ({
  id, user_id: author, total_reactions: reactions, comment_count: 0,
  created_at: new Date(now - ageHours * 3600000).toISOString(),
});

test('fair fullscreen sorting preserves permission-checked candidates exactly once', () => {
  const input = Object.freeze(Array.from({length: 15}, (_, i) =>
    Object.freeze(video('v' + i, 'creator' + (i % 5), i % 4 ? 10 : 0))));
  const existing = Object.freeze([Object.freeze(video('current', 'creator3'))]);
  const result = arrangeCommunityVideosForFairExposure(existing, input, 'user:session', now);
  assert.equal(result.length, input.length);
  assert.deepEqual(result.map(x => x.id).sort(), input.map(x => x.id).sort());
  assert.deepEqual(arrangeCommunityVideosForFairExposure(existing, input, 'user:session', now), result);
  assert.equal(existing[0].id, 'current');
  assert.equal(input[0].id, 'v0');
});

test('low-engagement posts receive early slots even if server page put them last', () => {
  const input = [
    ...Array.from({length: 10}, (_, i) => video('popular' + i, 'p' + i, 25, 120)),
    ...Array.from({length: 5}, (_, i) => video('under' + i, 'u' + i, 0, 120)),
  ];
  const result = arrangeCommunityVideosForFairExposure([], input, 'viewer:1', now);
  assert.ok(result.slice(0, 6).some(post => post.total_reactions === 0));
  assert.deepEqual(result.map(x => x.id).sort(), input.map(x => x.id).sort());
});

test('recent original creator is cooled down when alternative authors are available', () => {
  const existing = [video('opened', 'repeat', 0)];
  const input = [
    video('r1','repeat',0), video('r2','repeat',0),
    video('a','alpha',0), video('b','beta',0), video('c','gamma',0),
    video('d','delta',0), video('e','epsilon',0),
  ];
  const result = arrangeCommunityVideosForFairExposure(existing,input,'viewer:2',now);
  assert.notEqual(result[0].user_id,'repeat');
  for (let i = 0; i < 4; i++) {
    if (result[i].user_id === 'repeat') {
      assert.equal(result.slice(i+1,i+3).some(p=>p.user_id==='repeat'),false);
    }
  }
});

test('viewer/session rotation varies initial exploration but is deterministic within a session', () => {
  const input = Array.from({length: 15},(_,i)=>video('v'+i,'author'+i,0));
  const samples = new Set(Array.from({length:12},(_,i)=>
    arrangeCommunityVideosForFairExposure([],input,'viewer:'+i,now)[0].id));
  assert.ok(samples.size >= 2);
  assert.deepEqual(
    arrangeCommunityVideosForFairExposure([],input,'viewer:3',now),
    arrangeCommunityVideosForFairExposure([],input,'viewer:3',now),
  );
});

test('new entries append only; no jumps, duplicate posts or pagination cursor drift', () => {
  const existing = [video('opened','owner'),video('watching','watcher')];
  const incoming = [video('watching','watcher'), video('new1','c1',0), video('new2','c2',0)];
  const ranked = arrangeCommunityVideosForFairExposure(existing,incoming,'session',now);
  const appended = appendUniqueCommunityVideos(existing,ranked);
  assert.deepEqual(appended.slice(0,2),existing);
  assert.equal(appended.length,4);
  assert.equal(new Set(appended.map(x=>x.id)).size,4);
  const chronological=[video('newer','a'),video('older','b',0,5)];
  assert.deepEqual(lastCommunityVideoCursor(chronological),
    {id:'older',created_at:chronological[1].created_at});
  assert.equal(COMMUNITY_VIDEO_DISCOVERY_PAGE_SIZE,15);
  assert.equal(COMMUNITY_VIDEO_DISCOVERY_LIMIT,50);
});

test('invalid timestamps and missing creator ids degrade safely without data loss', () => {
  const input=[
    {id:'a',user_id:null,created_at:'bad'},
    {id:'b',user_id:null,total_reactions:NaN,comment_count:-9},
    {id:'b',user_id:null,total_reactions:NaN},
  ];
  assert.equal(arrangeCommunityVideosForFairExposure([],input,'seed',now).length,2);
  assert.deepEqual(arrangeCommunityVideosForFairExposure([],[],'seed',now),[]);
});

test('integration ranks only new videos before untouched sponsored slot insertion', () => {
  const wall=readFileSync('src/app/(tabs)/buklod.tsx','utf8');
  const selection=wall.slice(wall.indexOf('const loadMoreVideoViewer='),wall.indexOf('const openVideoViewer='));
  assert.match(selection,/lastCommunityVideoCursor\(rows\)/);
  assert.match(selection,/arrangeCommunityVideosForFairExposure\(/);
  assert.match(selection,/appendUniqueCommunityVideos\(current,ranked\)/);
  assert.match(selection,/requestSeq!==videoViewerScanSeqRef\.current\)return current/);
  assert.match(wall,/buildReelsFeedWithInlineAds\(videoViewerPosts\)/);
  assert.match(wall,/setVideoViewerPosts\(\[target\]\)/);
  assert.doesNotMatch(selection,/\.insert\(|\.update\(|\.upsert\(/);
});
