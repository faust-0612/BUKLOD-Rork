import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const wall = read('src/app/(tabs)/buklod.tsx');
const composer = read('src/components/BuklodCommunityCommentComposer.tsx');
const picker = read('src/lib/buklodPickCommunityPhotos.ts');
const bubble = read('src/components/BuklodCommunityCommentBubble.tsx');
const upload = read('src/lib/uploadCommunityVideoFile.ts');
const scoped = read('src/components/BuklodExclusiveScopeCommunity.tsx');
const staging = read('src/lib/buklodCommentGifShare.ts');
test('shared GIF selects a comment target instead of root post', () => {
  assert.match(wall, /pendingSharedCommentGif187A/);
  assert.match(wall, /GIF ready for comment/);
  assert.match(wall, /setCommentMedia\(attachGif/);
  assert.match(wall, /incomingShareSignature187A\.current = ''/);
  assert.match(wall, /GIF posting is not available in Community/);
});
test('phone GIF picker preserves animation and accepts local GIF', () => {
  assert.match(picker, /preserveAnimation \? 1 : 0\.85/);
  assert.match(composer, /isPickedGif\(photo\) \? 'gif' : 'image'/);
  assert.match(composer, /Choose GIF from phone/);
  assert.match(wall, /initialMedia\?\.kind==='gif' && isLocalMediaUri/);
});
test('comment GIF storage has bounded size, Android content support and signed display', () => {
  assert.match(upload, /contentType: 'image\/gif'/);
  assert.match(upload, /FileSystem\.copyAsync/);
  assert.match(staging, /FileSystem\.copyAsync/);
  assert.match(wall, /await stageSharedCommentGif/);
  assert.match(upload, /Maximum GIF size is 25 MB/);
  assert.match(bubble, /resolveCommunityMediaUrl\(media\.ref\)/);
  assert.doesNotMatch(bubble, /media\.kind === 'gif' \|\|/);
});

test('scope comments upload phone GIFs to membership-protected paths', () => {
  assert.match(scoped, /originalMedia\?\.kind === 'gif' && isLocalMediaUri/);
  assert.match(scoped, /scope\/\$\{scope\.scope_id\}\/\$\{user\.id\}\/comment-gif-/);
  assert.match(scoped, /await uploadCommunityGifFile\(\{ path, uri: originalMedia\.ref \}\)/);
});
