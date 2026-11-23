import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const owner = read('src/lib/buklodCommunityPostOwnerActions.ts');
const menu = read('src/components/BuklodContentOverflowMenu.tsx');
const wall = read('src/app/(tabs)/buklod.tsx');
const detail = read('src/app/post/[id].tsx');
const scope = read('src/components/BuklodExclusiveScopeCommunity.tsx');
const marites = read('src/components/BuklodMaritesBoard.tsx');

test('editing video caption does not replace or zero-out video media', () => {
  assert.match(owner, /if \(input\.photos === undefined\) \{[\s\S]*?await updateCommunityPost\(input\.postId, body\);[\s\S]*?return \{ body \};/);
  assert.match(owner, /communityPostIsVideo[\s\S]*?media_items\?\.some/);
  assert.doesNotMatch(owner, /\.from\('community_posts'\)\s*\.update\(\{\s*media_path/);
  for (const source of [wall, detail, scope]) {
    assert.match(source, /photos: nextPhotos,/);
    assert.doesNotMatch(source, /photos: nextPhotos \?\? \[\]/);
  }
  assert.match(marites, /allowPhotoEdit=\{!Boolean\(story\.video_uri\)\}/);
});

test('explicitly removing all photos uses owner-checked transactional media RPC', () => {
  assert.match(owner, /if \(uploaded.length\) \{[\s\S]*?attachCommunityPostMedia/);
  assert.match(owner, /set_buklod_post_media_v7/);
  assert.match(owner, /if \(error\) \{\s*\/\/ Fail closed rather than silently retaining deleted photos\.\s*throw error/);
  assert.match(owner, /await updateCommunityPost\(input\.postId, body\);[\s\S]*?const first = uploaded/);
  const sql = read('supabase/migrations/20261103223601_community_wall_video_preview_sidecars_r1.sql');
  assert.match(sql, /Only the post author may attach media/);
  assert.match(sql, /delete from public\.community_post_media where post_id=p_post_id/);
});

test('one Android modal handles editor, menu and confirmations without overlapping dialogs', () => {
  assert.equal((menu.match(/<Modal\b/g) || []).length, 1);
  assert.match(menu, /visible=\{menuOpen \|\| editOpen\}/);
  assert.match(menu, /editOpen \? \(/);
  assert.match(menu, /confirmAction \? \(/);
  assert.match(menu, /setConfirmAction\('delete'\)/);
  assert.match(menu, /setConfirmAction\('public'\)/);
  assert.match(menu, /if \(editBusy \|\| actionBusy \|\| photoBusy\) return/);
  assert.match(menu, /await action\(\)/);
  assert.match(menu, /photosChanged \? editPhotos : undefined/);
  assert.match(menu, /actionInFlightRef\.current/);
  assert.match(menu, /disabled=\{editBusy \|\| photoBusy\}/);
  assert.match(menu, /Write something before saving this post/);
});

test('only owner may alter visibility; scope managers retain scoped delete rights', () => {
  assert.match(scope, /onToggleAuthorOnly=\{\s*item\.is_owner/);
  assert.match(scope, /onDelete=\{\s*canManage/);
  assert.match(scope, /current\.filter\(post => post\.id !== item\.id\)/);
  const sql = read('supabase/migrations/20260914095500_buklod_community_anonymous_identity_hardening_r2.sql');
  assert.match(sql, /Only the author can change visibility for this post/);
  assert.match(sql, /Only the author can edit this post/);
});
