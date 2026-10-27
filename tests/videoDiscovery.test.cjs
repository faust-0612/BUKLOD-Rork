const test = require('node:test');
const assert = require('node:assert/strict');
const {
  selectCommunityVideoRows,
  COMMUNITY_VIDEO_DISCOVERY_PAGE_SIZE,
  COMMUNITY_VIDEO_DISCOVERY_LIMIT,
  COMMUNITY_VIDEO_MAX_SCANS_PER_REQUEST,
} = require('../src/lib/buklodVideoDiscovery.ts');

test('finds primary videos and videos in mixed gallery attachments', () => {
  const rows = [
    {id:'1',media_mime_type:'image/jpeg'},
    {id:'2',media_mime_type:'video/mp4'},
    {id:'3',media_mime_type:null},
    {id:'4',media_mime_type:'image/png'},
  ];
  assert.deepEqual(
    selectCommunityVideoRows(rows,['3']).map(row=>row.id),
    ['2','3'],
  );
  assert.deepEqual(rows.map(row=>row.id),['1','2','3','4']);
});

test('metadata pagination bounds requests and playback list size', () => {
  assert.ok(COMMUNITY_VIDEO_DISCOVERY_PAGE_SIZE <= 40);
  assert.equal(COMMUNITY_VIDEO_DISCOVERY_LIMIT,50);
  assert.ok(COMMUNITY_VIDEO_MAX_SCANS_PER_REQUEST <= 3);
  assert.deepEqual(selectCommunityVideoRows([],[]),[]);
});
