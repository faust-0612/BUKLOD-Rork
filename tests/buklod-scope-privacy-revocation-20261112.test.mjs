import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const scopedWall = readFileSync('src/components/BuklodExclusiveScopeCommunity.tsx','utf8');
const scopeSQL = readFileSync('supabase/migrations/20261112072440_buklod_scope_post_private_realtime_v1.sql','utf8');
const primarySQL = readFileSync('supabase/migrations/20261112071459_buklod_author_only_post_privacy_realtime_v1.sql','utf8');

test('exclusive scope feed checks canonical post privacy and preserves existing audience authorization',()=>{
  assert.match(primarySQL,/alter policy buklod_scope_social_posts_read/);
  assert.match(primarySQL,/public\.buklod_scope_social_can_access\(scope_id\)/);
  assert.match(primarySQL,/public\.can_view_community_post_v2\(p\.id\)/);
});

test('private scope Realtime topic membership is checked before subscribing',()=>{
  assert.match(scopeSQL,/on realtime\.messages for select to authenticated/);
  assert.match(scopeSQL,/public\.buklod_scope_social_can_access/);
  assert.match(scopeSQL,/'buklod-scope-posts:' \|\| v_old_scope_id::text/);
  assert.match(scopedWall,/config: \{ private: true \}/);
});

test('scoped post revocation evicts other viewers and keeps their author-only post visible to author',()=>{
  assert.match(scopedWall,/visibility_revoked === true/);
  assert.match(scopedWall,/scopeMediaLoadSeqRef\.current \+= 1/);
  assert.match(scopedWall,/String\(post\.id\) !== postId \|\| String\(post\.user_id\) === String\(user\?\.id\)/);
});
