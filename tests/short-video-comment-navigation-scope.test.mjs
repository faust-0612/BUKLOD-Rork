import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const read = file => readFileSync(file, 'utf8');
const commentMedia = read('src/lib/buklodCommentMediaBody.ts');
const composer = read('src/components/BuklodCommunityCommentComposer.tsx');
const validation = read('src/lib/buklodCommentVideoValidation.ts');
const uploader = read('src/lib/buklodCommentVideo.ts');
const bubble = read('src/components/BuklodCommunityCommentBubble.tsx');
const player = read('src/components/BuklodCommentVideoAttachment.tsx');
const playback = read('src/lib/buklodCommentVideoPlaybackSignal.ts');
const preview = read('src/components/BuklodCommunityCommentPreview.tsx');
const publicWall = read('src/app/(tabs)/buklod.tsx');
const scopeWall = read('src/components/BuklodExclusiveScopeCommunity.tsx');

test('comment body remains backwards compatible with legacy photo and GIF tags', () => {
  assert.match(commentMedia, /'image'\s*\|\s*'gif'\s*\|\s*'video'/);
  assert.match(commentMedia, /v1:\(image\|gif\|video\)/);
  assert.match(commentMedia, /encodeBuklodCommentMediaBody/);
  assert.match(commentMedia, /parseBuklodCommentMediaBody/);
  assert.match(preview, /isVideo/);
  assert.match(preview, /Short video.*Tap to play/);
});
test('public navigation and scoped comments use existing auth-bound comment RPC with private video path', () => {
  assert.match(publicWall, /uploadBuklodCommentVideo\(/);
  assert.match(publicWall, /user\.id\+'\/comment-video-'/);
  assert.match(publicWall, /add_buklod_post_comment_v4/);
  assert.match(scopeWall, /uploadBuklodCommentVideo\(/);
  assert.match(scopeWall, /scope\/\$\{scope\.scope_id\}\/\$\{user\.id\}\/comment-video-/);
  assert.match(scopeWall, /buklod_scope_social_add_comment_v1/);
  assert.match(scopeWall, /onScrollBeginDrag=\{stopBuklodCommentVideos\}/);
  assert.match(publicWall, /onScrollBeginDrag=\{stopBuklodCommentVideos\}/);
});
test('video selection validates 30-second, 25 MiB maximum and keeps picker lightweight', () => {
  assert.match(validation, /BUKLOD_COMMENT_VIDEO_MAX_SECONDS\s*=\s*30/);
  assert.match(validation, /BUKLOD_COMMENT_VIDEO_MAX_BYTES\s*=\s*25\s*\*\s*1024\s*\*\s*1024/);
  assert.match(validation, /durationSeconds\s*>\s*BUKLOD_COMMENT_VIDEO_MAX_SECONDS/);
  assert.match(validation, /sizeBytes\s*>\s*BUKLOD_COMMENT_VIDEO_MAX_BYTES/);
  assert.match(composer, /videoMaxDuration:\s*30/);
  assert.match(composer, /inspectBuklodCommentVideoSelection/);
  assert.doesNotMatch(composer, /from ['"]@\/lib\/buklodCommentVideo['"]/);
  assert.match(uploader, /validateBuklodCommentVideoMetadata/);
  assert.match(uploader, /uploadCommunityVideoFile\(/);
  assert.match(uploader, /generateWallPreview:\s*false/);
});
test('short video is manual playback, scoped signed URL recovery and scrolling stops playback', () => {
  assert.match(bubble, /resignCommunityMediaUrl/);
  assert.match(bubble, /BuklodCommentVideoAttachment/);
  assert.match(player, /useVideoPlayer/);
  assert.match(player, /onRetry/);
  assert.match(player, /AppState\.addEventListener/);
  assert.match(player, /onPress=.*setActive\(true\)/);
  assert.match(playback, /stopBuklodCommentVideos/);
  assert.match(playback, /subscribeBuklodCommentVideoStop/);
});
