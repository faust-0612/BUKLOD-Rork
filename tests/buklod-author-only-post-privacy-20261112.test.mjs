import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(path, 'utf8');
const primary = read('supabase/migrations/20261112071459_buklod_author_only_post_privacy_realtime_v1.sql');
const scope = read('supabase/migrations/20261112072440_buklod_scope_post_private_realtime_v1.sql');
const wall = read('src/app/(tabs)/buklod.tsx');
const marites = read('src/components/BuklodMaritesBoard.tsx');
const scopedWall = read('src/components/BuklodExclusiveScopeCommunity.tsx');

test('author-only is enforced at every public/organization read boundary', () => {
  assert.match(primary, /alter policy "Group\/church posts readable by audience"/);
  assert.match(primary, /alter policy buklod_scope_social_posts_read/);
  assert.match(primary, /public\.can_view_community_post_v2\(id\)/);
  assert.match(primary, /cp\.author_only,false\)=false or cp\.user_id=actor/);
  assert.match(primary, /public\.can_view_community_post_v2\(p\.id\)/);
});

test('privacy-change broadcast contains revocation information without post content', () => {
  assert.match(primary, /'visibility_revoked', v_visibility_revoked/);
  assert.match(primary, /'post_id', v_post_id/);
  assert.doesNotMatch(primary, /'body',\s*(new|old)\./);
  assert.match(scope, /on realtime\.messages for select to authenticated/);
  assert.match(scope, /public\.buklod_scope_social_can_access/);
  assert.match(scope, /realtime\.send\(/);
  assert.match(scope, /'buklod-scope-posts:' \|\| v_old_scope_id/);
});

test('wall, Marites and scoped screens evict revoked rows before refetch', () => {
  assert.match(wall, /privacyRevokedPostIdsRef\.current\.add\(postId\)/);
  assert.match(wall, /communityLoadSeqRef\.current\+=1/);
  assert.match(wall, /setPosts\(onlyVisiblePosts\(cachedPosts\)\)/);
  assert.match(wall, /visibility_revoked===true/);
  assert.match(marites, /setStories\(current => current\.filter\(keepStory\)\)/);
  assert.match(marites, /maritesMemory\.set\(cacheKey/);
  assert.match(scopedWall, /config: \{ private: true \}/);
  assert.match(scopedWall, /scopeMediaLoadSeqRef\.current \+= 1/);
});
