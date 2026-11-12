import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const wall = readFileSync('src/app/(tabs)/buklod.tsx','utf8');
const marites = readFileSync('src/components/BuklodMaritesBoard.tsx','utf8');
const scoped = readFileSync('src/components/BuklodExclusiveScopeCommunity.tsx','utf8');
const shared = readFileSync('src/lib/buklodPublicCommunityRealtime.ts','utf8');

test('main Wall privacy revocation changes only feed state, not routing', () => {
  assert.match(wall,/const privacyRevokedPostIdsRef=useRef\(new Set<string>\(\)\)/);
  assert.match(wall,/communityLoadSeqRef\.current\+=1; \/\/ Cancel stale in-flight feed responses/);
  assert.match(wall,/setPosts\(current=>current\.filter/);
  assert.match(wall,/setVideoViewerPosts\(current=>current\.filter/);
});

test('privacy revocation does not replace normal debounced Wall reload', () => {
  assert.match(wall,/const requestReload = \(\) => \{/);
  assert.match(wall,/\}, 900\);/);
  assert.match(wall,/subscribeBuklodPublicPostChanges\(\(change\) => \{/);
  assert.match(wall,/requestReload\(\);\s*\}\);/);
});

test('screens share one public post event topic rather than replacing realtime subscriptions',()=>{
  assert.match(shared,/acquireSharedRealtimeSubscription/);
  assert.match(shared,/\.channel\('buklod:public-community:posts'/);
  assert.match(wall,/subscribeBuklodPublicPostChanges\(\(change\)/);
  assert.match(marites,/subscribeBuklodPublicPostChanges\(\(change\)/);
  assert.match(scoped,/subscribeBuklodPublicPostChanges\(\(change\)/);
  assert.doesNotMatch(wall,/\.channel\(\s*'buklod:public-community:posts'/);
  assert.doesNotMatch(marites,/\.channel\(\s*'buklod:public-community:posts'/);
  assert.doesNotMatch(scoped,/\.channel\(\s*'buklod:public-community:posts'/);
});
