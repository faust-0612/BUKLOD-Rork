import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync('src/components/BuklodCommunityCommentBubble.tsx', 'utf8');

test('Android does not truncate comment options in Alert.alert', () => {
  assert.match(src, /dialogMode === 'actions'/);
  assert.match(src, /<ScrollView[\\s\\S]*?actions\\.map\\(action =>/);
  assert.doesNotMatch(src, /Alert\\.alert\\(\\s*'Comment'/);
  for (const action of ['Reply', 'Copy Text', 'React', 'Edit', 'Delete', 'Report', 'Visit Profile', 'View Details']) {
    assert.ok(src.includes("label: '" + action + "'"), action + ' is missing');
  }
});

test('own comment can be edited/deleted; moderators can delete but server remains authoritative', () => {
  assert.match(src, /const isAuthor = Boolean\\(currentUserId && comment\\.user_id === currentUserId\\)/);
  assert.match(src, /const canEdit = isAuthor/);
  assert.match(src, /const canDelete = isAuthor \\|\\| Boolean\\(comment\\.can_manage\\)/);
  assert.match(src, /\\.\\.\\.\\(canDelete \\? \\[\\{/);
  assert.match(src, /await onDelete\\(\\)/);
  assert.match(src, /if \\(deleteBusy\\) return/);
  assert.match(src, /setDeleteError\\(error\\?\\.message/);
  assert.doesNotMatch(src, /supabase\\.from\\(/);
});

test('comment actions are discoverable and share one Android modal', () => {
  assert.match(src, /accessibilityLabel="More comment actions"/);
  assert.match(src, /setDialogMode\\('delete'\\)/);
  assert.match(src, /accessibilityLabel="Confirm delete comment"/);
  assert.match(src, /dialogMode === 'details'/);
  assert.equal((src.match(/<Modal\\b/g) || []).length, 1);
});
