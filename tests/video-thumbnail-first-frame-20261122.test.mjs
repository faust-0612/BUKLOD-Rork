import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Wall and fullscreen retain their poster until a real decoded frame; autoplay never shows a startup play badge', () => {
  const video = read('src/components/CommunityVideo.tsx');
  assert.match(video, /onFirstFrameRender=\{\(\) => \{/);
  assert.match(video, /!firstFrameRendered \? \(\s*<View pointerEvents="none" style=\{styles.firstFrameFallback\}/);
  assert.match(video, /\(posterSource \|\| posterUri\) && !firstFrameRendered/);
  assert.match(video, /const centerVisible = firstFrameRendered && playerStatus !== 'error'/);
  assert.match(video, /const showManualPlay = !autoPlay && !fullscreen && !onOpenFullscreen/);
  assert.match(video, /\{showManualPlay \? \(\s*<MaterialCommunityIcons/);
  assert.match(video, /surfaceType="textureView"/);
  assert.match(video, /!preload \|\| posterSource \|\| posterUri/);
  assert.match(video, /player\.generateThumbnailsAsync\(0\.1, \{ maxWidth: 480/);
  assert.match(video, /ImaCommunityVideo/);
  assert.match(video, /COMMUNITY_VIDEO_CACHE_BUDGET_BYTES/);
});

test('Marites cards and fullscreen videos use poster-first texture rendering without a loading scrim or startup play icon', () => {
  const board = read('src/components/BuklodMaritesBoard.tsx');
  assert.match(board, /function MaritesVideoStandby/);
  assert.match(board, /posterUri=\{story.video_preview_uri\}/);
  assert.match(board, /surfaceType="textureView"/);
  assert.match(board, /onFirstFrameRender=\{\(\) => setFirstFrameRendered\(true\)\}/);
  assert.match(board, /poster && !firstFrameRendered/);
  assert.match(board, /canPlay && slow && !firstFrameRendered && status !== 'error'/);
  assert.match(board, /if \(viewStory.video_uri\) return <MaritesQuickVideo[^\n]+autoPlay/);
  assert.match(board, /enabled=\{playbackActive && !playbackBlocked/);
  assert.doesNotMatch(board, /name="play-circle-outline" size=\{44\}/);
  assert.match(board, /subscribeCommunityVideoPoster/);
  assert.match(board, /generateThumbnailsAsync\(0\.1, \{ maxWidth: 480/);
});

test('Quick Video upload uses existing private bounded preview path, not a public thumbnail URL', () => {
  const marites = read('src/lib/buklodMaritesBoard.ts');
  const upload = read('src/lib/uploadCommunityVideoFile.ts');
  const preview = read('src/lib/communityVideoPreview.ts');
  assert.match(marites, /video_preview_uri\?: string \| null/);
  assert.match(marites, /videoItem\?\.preview_url/);
  assert.match(marites, /generateWallPreview: true/);
  assert.match(marites, /preview_path\?: string/);
  assert.match(marites, /publishedVideoPreviewUrl = publishedVideo\?\.preview_url/);
  assert.match(upload, /communityVideoUploadPreviewPath/);
  assert.match(preview, /COMMUNITY_VIDEO_PREVIEW_MAX_BYTES = 125_000/);
});
