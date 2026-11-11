import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const wall = readFileSync(new URL('../src/app/(tabs)/buklod.tsx', import.meta.url), 'utf8');
test('Android share does not navigate to or auto-publish an unrelated post', () => {
  assert.match(wall, /pendingSharedCommentGif187A\.current = \{ uri, ownerId: accountId \}/);
  assert.match(wall, /Tap Comments on the post you want/);
  assert.match(wall, /const openComments=/);
  assert.match(wall, /setCommentMedia\(attachGif/);
});
test('comment navigation retains existing draft, reply, and loading guard', () => {
  assert.match(wall, /const saved=commentDraftsRef\.current\.get/);
  assert.match(wall, /setReplyTo\(saved\?\.reply\?\?null\)/);
  assert.match(wall, /await loadComments\(String\(post\.id\)\)/);
  assert.match(wall, /commentLoadSeqRef\.current/);
});
