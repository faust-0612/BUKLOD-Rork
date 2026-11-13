import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const wall = read('src/app/(tabs)/buklod.tsx');
const target = read('src/lib/buklodCommentGifTarget.ts');

test('Keyboard GIF returns to preview in same comment, without alert or auto-post', () => {
 assert.match(wall, /await stageSharedCommentGif/);
 assert.match(wall, /await getActiveCommentGifTarget/);
 assert.match(wall, /void openComments\(post\)/);
 assert.match(wall, /setCommentMediaPreview\(uri\)/);
 assert.match(wall, /setCommentMedia\(attachGif\?/);
 assert.match(wall, /submitCommunityComment\(\)/);
 assert.doesNotMatch(wall, /Alert\.alert\('GIF ready for comment'/);
 assert.doesNotMatch(wall, /Alert\.alert\('GIF comment', 'GIF attached/);
});
test('Automatic restoration is bounded and account scoped', () => {
 assert.match(target, /MAX_AGE_MS = 5 \* 60 \* 1000/);
 assert.match(target, /age < 0 \|\| age > MAX_AGE_MS/);
 assert.match(target, /target\?\.ownerId === ownerId\.trim\(\)/);
 assert.match(wall, /commentAccountIdRef\.current !== accountId/);
 assert.match(wall, /pendingSharedCommentGif187A\.current\?\.uri !== uri/);
 assert.match(wall, /forgetActiveCommentGifTarget/);
});
test('Unavailable target uses nonblocking explicit selection', () => {
 assert.match(wall, /sharedGifAwaitingTarget && \(/);
 assert.match(wall, /setSharedGifAwaitingTarget\(true\)/);
 assert.match(wall, /pendingSharedCommentGif187A\.current = \{ uri, ownerId: accountId \}/);
 assert.match(wall, /GIF posting is not available in Community/);
});
