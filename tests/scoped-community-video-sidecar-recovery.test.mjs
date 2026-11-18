import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const scope = readFileSync('src/components/BuklodExclusiveScopeCommunity.tsx', 'utf8');
const hook = readFileSync('src/hooks/useBuklodCommunityAdViewability.ts', 'utf8');

function runtimeHelpers() {
  // Execute the two pure helpers from the shipped TSX source, without mocks
  // for React, Supabase, AdMob or expo-video.
  const start = scope.indexOf('function scopedCommunityVideoMedia(');
  const end = scope.indexOf('function isScopedReelPost(', start);
  assert.ok(start > 0 && end > start, 'video selection helpers must exist');
  const source = scope.slice(start, end)
    .replace('post: SocialPost', 'post')
    .replace('post: SocialPost,', 'post,')
    .replace('failed: NonNullable<ReturnType<typeof scopedCommunityVideoMedia>>', 'failed')
    .replace('nextUrl: string', 'nextUrl')
    .replace('): SocialPost {', ') {');
  return runInNewContext(
    source + '\n({ scopedCommunityVideoMedia, replaceScopedCommunityVideoUrl })'
  );
}

test('new scope video is playable from sidecar even when legacy media columns are null', () => {
  const { scopedCommunityVideoMedia } = runtimeHelpers();
  const post = {
    id: 'post-a',
    body: 'Shared a video.',
    media_path: null,
    media_url: null,
    media_mime_type: null,
    media_items: [
      { media_position: 0, media_path: 'aws:obj-a', media_mime_type: 'video/mp4',
        media_url: 'https://signed.example/video-a', preview_url: 'https://signed.example/poster-a' },
      { media_position: 1, media_path: 'scope/photo.jpg', media_mime_type: 'image/jpeg',
        media_url: 'https://signed.example/photo-a' },
    ],
  };
  const video = scopedCommunityVideoMedia(post);
  assert.equal(video.media_path, 'aws:obj-a');
  assert.equal(video.media_url, 'https://signed.example/video-a');
  assert.equal(video.preview_url, 'https://signed.example/poster-a');
});

test('legacy video still reads top-level media and does not classify photo posts as video', () => {
  const { scopedCommunityVideoMedia } = runtimeHelpers();
  const legacy = { media_path: 'scope/a.mp4', media_mime_type: 'video/mp4',
    media_url: 'https://signed.example/a' };
  assert.equal(scopedCommunityVideoMedia(legacy).media_url, legacy.media_url);
  assert.equal(scopedCommunityVideoMedia({
    media_path: 'scope/a.jpg', media_mime_type: 'image/jpeg', media_url: 'https://signed.example/a'
  }), null);
});

test('signed URL retry updates only the matching sidecar video and preserves photos', () => {
  const { scopedCommunityVideoMedia, replaceScopedCommunityVideoUrl } = runtimeHelpers();
  const post = {
    media_path: null, media_mime_type: null, media_url: null,
    media_items: [
      { media_path: 'aws:key', media_mime_type: 'video/mp4', media_url: 'old' },
      { media_path: 'scope/photo.jpg', media_mime_type: 'image/jpeg', media_url: 'photo' },
    ],
  };
  const failed = scopedCommunityVideoMedia(post);
  const updated = replaceScopedCommunityVideoUrl(post, failed, 'new');
  assert.equal(updated.media_items[0].media_url, 'new');
  assert.equal(updated.media_items[1].media_url, 'photo');
  assert.equal(updated.media_url, null);
  assert.equal(replaceScopedCommunityVideoUrl(updated, failed, 'stale').media_items[0].media_url, 'new');
  assert.equal(post.media_items[0].media_url, 'old');
});

test('render uses sidecar video/poster and safe on-demand recovery without touching AdMob viewability', () => {
  assert.match(scope, /const videoMedia = scopedCommunityVideoMedia\(item\)/);
  assert.match(scope, /\{!!videoMedia\?\.media_url &&\s*isVideo && \(/);
  assert.match(scope, /uri=\{\s*videoMedia\.media_url\s*\}/);
  assert.match(scope, /posterUri=\{videoMedia\.preview_url \?\? null\}/);
  assert.match(scope, /onPlaybackError=\{\(\) => \{\s*void recoverScopedWallVideo\(item\)/);
  assert.match(scope, /isVideo && !videoMedia\?\.media_url/);
  assert.match(scope, /recoverScopedWallVideo\(item, true\)/);
  assert.match(scope, /loadCommunityPostMediaByPostIds\(\s*\[postId\], \{ forceFreshVideoUrls: true \}/);
  assert.match(scope, /getAwsWallVideoViewUrl\(postId, awsKey, true\)/);
  assert.match(scope, /resignCommunityMediaUrl\(mediaPath\)/);
  assert.match(scope, /videoRefreshInFlightRef\.current\.has\(postId\)/);
  assert.doesNotMatch(scope, /\{!!item\.media_url &&\s*isVideo && \(/);
  assert.match(hook, /post\.media_items\.find\(\(media\) =>/);
  assert.match(hook, /setPreloadVideoPostId/);
  assert.match(scope, /<BuklodVideoCompanionAd/);
  assert.match(scope, /height=\{\s*470\s*\}\s*fitFrame\s*autoPlay/);
});
