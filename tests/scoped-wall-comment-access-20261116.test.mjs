import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const scoped = readFileSync(new URL('../src/components/BuklodExclusiveScopeCommunity.tsx', import.meta.url), 'utf8');
const loader = readFileSync(new URL('../src/lib/buklodPostCommentPreviews.ts', import.meta.url), 'utf8');

test('scoped recent comment is read in one authorized batch with stale-response protection', () => {
  assert.match(scoped, /fetchBuklodPostCommentPreviews\(/);
  assert.match(scoped, /scopeMediaLoadSeqRef\.current !== loadSeq/);
  assert.match(scoped, /requestedCommentIds\.has\(id\)/);
  assert.match(loader, /\.from\('comments'\)/);
  assert.match(loader, /\.eq\('is_hidden', false\)/);
  assert.doesNotMatch(loader, /service_role|serviceRole/);
});
