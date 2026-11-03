import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');

test('Wall uploads generate bounded durable posters only when explicitly requested', () => {
  const upload = read('src/lib/uploadCommunityVideoFile.ts');
  const preview = read('src/lib/communityVideoPreview.ts');
  assert.match(upload, /generateWallPreview = false/);
  assert.match(upload, /generateCommunityVideoPreview\(uri\)/);
  assert.match(upload, /failureLabel: 'Video preview'/);
  assert.match(upload, /return await uploadPreview\(\)/);
  assert.match(upload, /register_buklod_video_preview_v1/);
  assert.match(preview, /COMMUNITY_VIDEO_PREVIEW_MAX_BYTES = 125_000/);
  assert.match(preview, /communityVideoUploadPreviewPath/);
  assert.match(preview, /communityVideoPostPreviewPath/);
  assert.match(preview, /\[320, 0\.40\]/);
  assert.match(preview, /generateThumbnailsAsync\(\[frameTime\]/);
});

test('public and scoped Wall upload flows attach preview metadata through the shared media pipeline', () => {
  const publicWall = read('src/app/(tabs)/buklod.tsx');
  const scopedWall = read('src/components/BuklodExclusiveScopeCommunity.tsx');
  const media = read('src/lib/buklodCommunityPostMedia.ts');
  assert.match(publicWall, /generateWallPreview:true/);
  assert.match(publicWall, /persistCommunityVideoPoster/);
  assert.match(publicWall, /wallVideo\.post\?\.user_id/);
  assert.match(scopedWall, /generateWallPreview: true/);
  assert.match(scopedWall, /persistCommunityVideoPoster/);
  assert.match(scopedWall, /item\.user_id \?\?/);
  assert.match(media, /set_buklod_post_media_v7/);
  assert.match(media, /Poster metadata is optional/);
  assert.match(media, /set_buklod_post_media_v5',[\s\S]*?fallbackItems/);
  assert.match(media, /get_buklod_post_media_v4/);
  assert.match(media, /const isVideo = mediaMime\.startsWith/);
  assert.match(media, /resolveCommunityMediaUrl\(previewPath/);
});

test('native and web feed players render durable posters and native playback can lazily backfill old videos', () => {
  const native = read('src/components/CommunityVideo.tsx');
  const web = read('src/components/CommunityVideo.web.tsx');
  assert.match(native, /posterUri/);
  assert.match(native, /onPosterGenerated\?: \(thumbnail: unknown\) => void \| Promise<unknown>/);
  assert.match(native, /onPosterGenerated\?\.\(first\)/);
  assert.match(native, /<ExpoImage[\s\S]*?source=\{\{ uri: posterUri \}\}/);
  assert.match(web, /poster: posterUri \|\| undefined/);
  assert.match(web, /onPosterGenerated\(objectUrl\)/);
});

test('video preview migration enforces exact post visibility and keeps storage private', () => {
  const sql = read('supabase/migrations/20261103223601_community_wall_video_preview_sidecars_r1.sql');
  assert.match(sql, /enable row level security/);
  assert.match(sql, /can_view_community_post_v2\(post_id\)/);
  assert.match(sql, /buklod_wall_video_preview_object_read/);
  assert.match(sql, /as restrictive[\s\S]*?for delete/);
  assert.match(sql, /register_buklod_video_preview_v1/);
  assert.match(sql, /125000/);
  assert.match(sql, /set_buklod_post_media_v7/);
  assert.doesNotMatch(sql, /create or replace function public\.set_buklod_post_media_v6/);
  assert.match(sql, /get_buklod_post_media_v4/);
  assert.doesNotMatch(sql, /to anon[\s\S]{0,120}grant select/i);
});

test('scope video support retains the existing exact scope membership gate', () => {
  const sql = read('supabase/migrations/20261103223601_community_wall_video_preview_sidecars_r1.sql');
  assert.match(sql, /split_part\(v_path, '\/', 1\) <> 'scope'/);
  assert.match(sql, /buklod_scope_social_can_access\(v_scope_id\)/);
  assert.match(sql, /'video\/mp4'.*'video\/quicktime'.*'video\/webm'/);
});
