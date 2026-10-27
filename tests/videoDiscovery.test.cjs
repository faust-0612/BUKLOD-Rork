const test = require('node:test');
const assert = require('node:assert/strict');
const {
  lastCommunityVideoCursor,
  appendUniqueCommunityVideos,
  COMMUNITY_VIDEO_DISCOVERY_PAGE_SIZE,
  COMMUNITY_VIDEO_DISCOVERY_LIMIT,
  COMMUNITY_VIDEO_MAX_SCANS_PER_REQUEST,
} = require('../src/lib/buklodVideoDiscovery.ts');

test('keyset cursor uses the final chronologically ordered video row', () => {
  const rows = [
    {id:'a',created_at:'2026-10-27T11:00:00Z'},
    {id:'b',created_at:'2026-10-26T11:00:00Z'},
  ];
  assert.deepEqual(lastCommunityVideoCursor(rows),rows[1]);
  assert.equal(lastCommunityVideoCursor([]),null);
});

test('appends new video entries without duplicate post IDs', () => {
  const result=appendUniqueCommunityVideos(
    [{id:'a'}],
    [{id:'b'},{id:'a'},{id:'c'},{id:'b'}],
  );
  assert.deepEqual(result.map(x=>x.id),['a','b','c']);
});

test('metadata pagination bounds requests and playback list size', () => {
  assert.equal(COMMUNITY_VIDEO_DISCOVERY_PAGE_SIZE,15);
  assert.equal(COMMUNITY_VIDEO_DISCOVERY_LIMIT,50);
  assert.ok(COMMUNITY_VIDEO_MAX_SCANS_PER_REQUEST <= 3);
  assert.equal(appendUniqueCommunityVideos([],Array.from({length:70},(_,i)=>({id:String(i)}))).length,50);
});
