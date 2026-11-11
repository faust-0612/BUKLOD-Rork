import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const upload = readFileSync('src/lib/uploadCommunityVideoFile.ts', 'utf8');
const tus = readFileSync('src/lib/uploadCommunityResumableTus.ts', 'utf8');
const native = readFileSync('src/app/igpat/create.tsx', 'utf8');
const legacy = readFileSync('src/lib/buklodCommunityPostMedia.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260912024500_igpat_publish_scope_correctness_r10.sql', 'utf8');

test('All new video transfers use private Supabase; never dispatch to AWS based on size', () => {
  const start=upload.indexOf('export async function uploadCommunityVideoFile(');
  const end=upload.indexOf('export async function mapWithConcurrency');
  const video=upload.slice(start,end);
  assert.ok(start>=0 && end>start, 'canonical upload function exists');
  assert.match(upload, /BUKLOD_SUPABASE_ONLY_VIDEO_UPLOAD_R1/);
  assert.doesNotMatch(upload, /from ['"]@\/lib\/buklodAwsWallVideo['"]/);
  assert.doesNotMatch(video, /shouldUseAwsWallVideo|registerPendingAwsWallVideo|uploadAwsWallVideo/);
  assert.match(video, /await uploadCommunityBinaryFile\(\{[\s\S]*?preferResumable: true/);
  assert.match(upload, /supabase\.storage\.from\('community-media'\)/);
});

test('Large uploads stay bounded with exact TUS chunk size and offset recovery', () => {
  assert.match(tus, /BUKLOD_TUS_CHUNK_SIZE_BYTES = 6 \* 1024 \* 1024/);
  assert.match(upload, /shouldUseResumableUpload\(sizeBytes\)/);
  assert.match(tus, /method: 'HEAD'/);
  assert.match(tus, /method: 'PATCH'/);
  assert.match(tus, /x-upsert': 'false'/);
  assert.match(tus, /bucketName: 'community-media'/);
  assert.match(upload, /if \(!sizeBytes\) \{[\s\S]*?Could not determine this video file size/);
  assert.match(upload, /sizeBytes > BUKLOD_VIDEO_MAX_SIZE_BYTES/);
});

test('IGPAT upload path matches server storage.objects existence contract before RPC', () => {
  assert.match(native, /await uploadCommunityVideoFile\(\{/);
  assert.match(native, /\.rpc\('create_buklod_reel_v1'/);
  assert.match(migration, /o\.bucket_id = 'community-media'[\s\S]*?o\.name = p_media_path/);
  assert.match(native, /p_media_path: uploadedPath/);
  assert.match(native, /if \(error\) throw error/);
});

test('Historical AWS references are preserved read-only rather than deleting legacy media', () => {
  assert.match(legacy, /provider === 'AWS' && externalKey/);
  assert.match(legacy, /getAwsWallVideoViewUrl\(/);
  assert.doesNotMatch(upload, /registerPendingAwsWallVideo\(/);
});
