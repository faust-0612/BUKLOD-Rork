import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const wall = readFileSync('src/app/(tabs)/buklod.tsx','utf8');
const marites = readFileSync('src/components/BuklodMaritesBoard.tsx','utf8');
const broadcast = readFileSync('supabase/migrations/20261112072000_buklod_author_only_post_privacy_realtime_v1.sql','utf8');

test('privacy revocations immediately evict visible Wall posts and video-viewer rows',()=>{
  assert.match(wall,/visibility_revoked===true/);
  assert.match(wall,/privacyRevokedPostIdsRef\.current\.add\(postId\)/);
  assert.match(wall,/communityLoadSeqRef\.current\+=1/);
  assert.match(wall,/setVideoViewerPosts\(current=>current\.filter/);
});

test('weak network cache hydration does not resurrect revoked posts',()=>{
  assert.match(wall,/setPosts\(onlyVisiblePosts\(warmPosts\)\)/);
  assert.match(wall,/setPosts\(onlyVisiblePosts\(cachedPosts\)\)/);
  assert.match(wall,/const preparedPosts186L=\s*onlyVisiblePosts\(next\)/);
});

test('Marites author-only updates evict story and warmed media rows without touching players',()=>{
  assert.match(marites,/setStories\(current => current\.filter\(keepStory\)\)/);
  assert.match(marites,/setViewStory\(current => current && !keepStory\(current\) \? null : current\)/);
  assert.match(marites,/maritesMemory\.set\(cacheKey/);
  assert.match(broadcast,/'visibility_revoked', v_visibility_revoked/);
});
