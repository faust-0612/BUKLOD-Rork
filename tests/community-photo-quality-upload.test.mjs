import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');

test('Community photo upload preserves high-quality JPEG sources up to 25 MiB', () => {
  const limits = read('src/lib/buklodCommunityMediaLimits.ts');
  const upload = read('src/lib/uploadCommunityVideoFile.ts');
  assert.match(limits, /COMMUNITY_PHOTO_MAX_SIZE_BYTES = 25 \* 1024 \* 1024/);
  assert.match(upload, /existingBytes <= COMMUNITY_PHOTO_MAX_SIZE_BYTES/);
  assert.match(upload, /!longestEdge \|\| longestEdge <= 2048/);
  assert.match(upload, /Math\.max\(dimensions\.width, dimensions\.height\) > 2048/);
  assert.match(upload, /compress: 0\.86/);
  assert.match(upload, /sizeBytes > COMMUNITY_PHOTO_MAX_SIZE_BYTES/);
});

test('Community photo originals use resumable TUS uploads while previews remain optional', () => {
  const upload = read('src/lib/uploadCommunityVideoFile.ts');
  const photoFlow = upload.slice(upload.indexOf('export async function uploadCommunityPhotoFile'), upload.indexOf('/* Legacy compatibility only'));
  assert.match(photoFlow, /failureLabel: 'Photo'[\s\S]*?preferResumable: true/);
  assert.match(photoFlow, /failureLabel: 'Photo preview'[\s\S]*?preferResumable: false/);
  const tus = read('src/lib/uploadCommunityResumableTus.ts');
  assert.match(tus, /BUKLOD_TUS_CHUNK_SIZE_BYTES = 6 \* 1024 \* 1024/);
  assert.match(tus, /recoverOffset/);
  assert.match(tus, /signedUploadToken\?: string/);
  assert.match(tus, /'x-signature': signedUploadToken/);
});

test('public, anonymous and edited Community photos share the 25 MiB contract', () => {
  const anonymous = read('src/lib/buklodCommunityAnonymousMedia.ts');
  const marites = read('src/lib/buklodMaritesBoard.ts');
  const edit = read('src/lib/buklodCommunityPostOwnerActions.ts');
  const edge = read('supabase/functions/buklod-community-ai/index.ts');
  assert.match(anonymous, /prepared.sizeBytes > COMMUNITY_PHOTO_MAX_SIZE_BYTES/);
  assert.match(anonymous, /shouldUseResumableUpload\(prepared.sizeBytes\)/);
  assert.match(anonymous, /signedUploadToken: signedToken/);
  assert.match(edge, /signed_token: signed.token/);
  assert.match(edge, /ANONYMOUS_COMMUNITY_PHOTO_MAX_BYTES = 25 \* 1024 \* 1024/);
  assert.match(edge, /size > ANONYMOUS_COMMUNITY_PHOTO_MAX_BYTES/);
  // AI moderation input has its own bounded payload budget; it does not cap upload/storage size.
  assert.match(edge, /data\\.size > 5 \\* 1024 \\* 1024/);
  assert.match(edge, /createSignedUrl\(path, 300, \{/);
  assert.match(edge, /image\.byteLength > 5 \* 1024 \* 1024/);
  assert.doesNotMatch(edge, /data\.size > 5 \* 1024 \* 1024/);
  assert.match(edit, /uploadCommunityPhotoFile\(/);
  assert.match(marites, /uploadCommunityPhotoFile\(/);
  assert.doesNotMatch(marites, /5 \* 1024 \* 1024|width: 1600|encodeMaritesPhotoBase64/);
  assert.doesNotMatch(edit, /5 \* 1024 \* 1024|width: 1600|base64-arraybuffer/);
});

test('all social photo RPCs accept the same 25 MiB photo contract', () => {
  const migration = read('supabase/migrations/20261104130000_community_photo_quality_upload_r1.sql');
  assert.match(migration, /set_buklod_post_media_v5\(uuid,jsonb\)/);
  assert.match(migration, /'5242880'/);
  assert.match(migration, /'26214400'/);
  assert.match(migration, /'5 MB or smaller'/);
  assert.match(migration, /'25 MB or smaller'/);
  assert.match(migration, /refusing an unsafe automatic rewrite/);
  assert.match(migration, /p_media_size_bytes>5242880/);
  assert.match(migration, /p_media_size_bytes>26214400/);
  assert.match(migration, /Anonymous photos are limited to 25 MB/);
  assert.match(migration, /create_buklod_community_living_post_v2/);
  assert.match(migration, /set_buklod_post_media_v1/);
  assert.match(migration, /set_buklod_post_media_v4/);
  assert.match(migration, /set_buklod_post_media_v6/);
  assert.match(migration, /create_buklod_dugtong_v1/);
  assert.match(migration, /send_direct_message_v3/);
  assert.match(migration, /file_size_limit=26214400/);
  assert.match(migration, /Photo exceeds 25 MB/);
  assert.match(migration, /Maximum of 10 photos per post/);
  assert.match(migration, /p_media_size_bytes>26214400/);
  assert.match(migration, /Anonymous photos are limited to 25 MB/);
  const wrapper = read('supabase/migrations/20261103223601_community_wall_video_preview_sidecars_r1.sql');
  assert.match(wrapper, /public\.set_buklod_post_media_v5\(p_post_id, v_clean\)/);
});

test('new photo upload contract is part of the production OTA gate', () => {
  const workflow = read('.github/workflows/production_android_ota.yml');
  assert.match(workflow, /node --test tests\/community-photo-quality-upload\.test\.mjs/);
});
