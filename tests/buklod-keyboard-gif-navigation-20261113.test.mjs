import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const wall = readFileSync(new URL('../src/app/(tabs)/buklod.tsx', import.meta.url), 'utf8');
const target = readFileSync(new URL('../src/lib/buklodCommentGifTarget.ts', import.meta.url), 'utf8');

test('keyboard GIF restores the exact public Wall comment without routing to post composer', () => {
 assert.match(wall, /getActiveCommentGifTarget\(accountId\)/);
 assert.match(wall, /const reopenCommentWithGif = \(post: any\)/);
 assert.match(wall, /String\(post\?\.id \?\? ''\) !== targetPostId/);
 assert.match(wall, /void openComments\(post\)/);
 assert.match(wall, /loadBuklodNotificationPost\(/);
 assert.doesNotMatch(wall, /Alert\.alert\('GIF ready for comment'/);
});

test('abandoned or different-account comment targets cannot steal a later share', () => {
 assert.match(wall, /forgetActiveCommentGifTarget\(/);
 assert.match(wall, /commentAccountIdRef\.current !== accountId/);
 assert.match(target, /target\?\.ownerId === ownerId\.trim\(\)/);
 assert.match(target, /age > MAX_AGE_MS/);
 assert.match(wall, /setSharedGifAwaitingTarget\(true\)/);
});
