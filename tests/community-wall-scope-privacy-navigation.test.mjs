import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');

test('Public and scoped Wall owner privacy is protected by a shared author RPC', () => {
  const publicWall = read('src/app/(tabs)/buklod.tsx');
  const scopedWall = read('src/components/BuklodExclusiveScopeCommunity.tsx');
  const ownerActions = read('src/lib/buklodCommunityPostOwnerActions.ts');
  const sql = read('supabase/migrations/20260914095500_buklod_community_anonymous_identity_hardening_r2.sql');
  assert.match(publicWall, /setCommunityPostAuthorOnly\(/);
  assert.match(scopedWall, /onToggleAuthorOnly=\{\s*item\.is_owner/);
  assert.match(scopedWall, /onDelete=\{\s*canManage/);
  assert.match(ownerActions, /set_buklod_community_post_author_only_v1/);
  assert.match(sql, /Only the author can change visibility for this post/);
});

test('Android modal privacy confirmation and cancel cannot disclose a post accidentally', () => {
  const menu = read('src/components/BuklodContentOverflowMenu.tsx');
  assert.match(menu, /confirmAction === 'delete'/);
  assert.match(menu, /setConfirmAction\('public'\)/);
  assert.match(menu, /setConfirmAction\(null\)/);
  assert.match(menu, /Make this post public\?/);
  assert.match(menu, /await action\(\)/);
  assert.match(menu, /actionInFlightRef\.current/);
  assert.equal((menu.match(/<Modal\b/g) || []).length, 1);
});

test('Scope delete retains viewport and video edit retains its original media', () => {
  const scope = read('src/components/BuklodExclusiveScopeCommunity.tsx');
  const actions = read('src/lib/buklodCommunityPostOwnerActions.ts');
  const marites = read('src/components/BuklodMaritesBoard.tsx');
  assert.match(scope, /current\.filter\(post => post\.id !== item\.id\)/);
  assert.match(actions, /if \(input\.photos === undefined\) \{/);
  assert.match(actions, /return \{ body \};/);
  assert.match(marites, /allowPhotoEdit=\{!Boolean\(story\.video_uri\)\}/);
});
