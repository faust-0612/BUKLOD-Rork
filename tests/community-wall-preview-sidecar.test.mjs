import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  communityWallPreviewOriginalPath as tag,
  communityWallPreviewPath as preview,
} from '../src/lib/communityWallPreviewPath.ts';

test('verified sidecar path derives only from a new tagged original', () => {
  const old = 'user-123/post-1761739020000-1-abc.jpg';
  const tagged = tag(old);
  assert.equal(tagged, 'user-123/post-1761739020000-1-abc-p1.jpg');
  assert.equal(preview(tagged), 'user-123/post-1761739020000-1-abc-p1-preview.jpg');
  assert.equal(preview(old), null);
});

test('scope media keeps authorized folder identity and preview naming', () => {
  const old = 'scope/scope-id/user-id/post-1761739020000-0-x.jpg';
  const tagged = tag(old);
  assert.equal(tagged, 'scope/scope-id/user-id/post-1761739020000-0-x-p1.jpg');
  assert.equal(preview(tagged), 'scope/scope-id/user-id/post-1761739020000-0-x-p1-preview.jpg');
});

test('never guess a preview for old, comments, arbitrary, or AWS media', () => {
  for (const path of [
    'user-id/comment-photo-123.jpg',
    'user-id/moment-123.jpg',
    'user-id/post-123.jpg',
    'scope/s/user/comment-photo-1.jpg',
    'aws:wall/123/photo.jpg',
    'https://something/file.jpg',
    'user-id/post-123-p1-preview.jpg',
  ]) assert.equal(preview(path), null);
  assert.equal(tag('user-id/comment-photo-123.jpg'), null);
  assert.equal(tag('user-id/post-123-p1-preview.jpg'), null);
});

const uploader = readFileSync('src/lib/uploadCommunityVideoFile.ts','utf8');
const native = readFileSync('src/components/BuklodCachedMediaImage.android.tsx','utf8');
const generic = readFileSync('src/components/BuklodCachedMediaImage.tsx','utf8');
const collage = readFileSync('src/components/BuklodCommunityPhotoCollage.tsx','utf8');
const publicWall = readFileSync('src/app/(tabs)/buklod.tsx','utf8');
const scopeWall = readFileSync('src/components/BuklodExclusiveScopeCommunity.tsx','utf8');

test('sidecars are capped, small, and native-only, with original resolution retained', () => {
  assert.match(uploader,/if \(Platform\.OS === 'web'\) return null/);
  assert.match(uploader,/for \(const side of \[480, 320\]\)/);
  assert.match(uploader,/sizeBytes <= 125 \* 1024/);
  assert.match(uploader,/compress: side === 480 \? 0\.56 : 0\.48/);
  assert.match(uploader,/const prepared = await prepareCommunityJpegUri\(uri\)/);
});

test('sidecar upload must succeed before original gets marked preview-capable', () => {
  const a=uploader.indexOf('await uploadCommunityBinaryFile({\n          path: previewPath');
  const b=uploader.indexOf('actualPath = taggedOriginal');
  const c=uploader.indexOf('await uploadCommunityBinaryFile({\n    path: actualPath');
  assert.ok(a>=0 && b>a && c>b);
  assert.match(uploader,/catch \{\n        \/\/ Fall back to the unmarked original/);
  assert.match(uploader,/return \{ sizeBytes: prepared\.sizeBytes, path: actualPath \}/);
});

test('new Wall uploads publish actual path only after both original and preview handling', () => {
  assert.match(publicWall,/wallPreview: true/);
  assert.match(scopeWall,/wallPreview: true/);
  assert.match(publicWall,/media_path:uploadedPhoto\.path/);
  assert.match(scopeWall,/media_path: uploadedPhoto\.path/);
  assert.doesNotMatch(publicWall,/media_path:uploadedPhoto\.previewPath/);
});

test('native collage uses preview, viewer continues to open unmodified original', () => {
  assert.match(collage,/useWallPreview/g);
  assert.match(collage,/onPressPhoto\?\.\(index, photos\)/);
  assert.match(native,/communityWallPreviewPath\(originalPath\)/);
  assert.match(native,/const usingPreview = !!markedPreviewPath &&[\\s\\S]*?failedPreviewFor !== originalPath &&[\\s\\S]*?paintedOriginalPathRef\\.current !== originalPath/);
  assert.match(native,/const preferred = usingPreview \? '' : String\(uri \?\? ''\)\.trim\(\)/);
  assert.match(native,/if \(usingPreview\) \{[\s\S]*?setFailedPreviewFor\(originalPath\)/);
  assert.match(native,/30_000/);
  assert.match(generic,/useWallPreview\?: boolean/);
  assert.doesNotMatch(generic,/communityWallPreviewPath\(/);
});

test('previous no-masking/progress guards and private signed access are preserved', () => {
  assert.match(native,/decideAndroidPhotoRecovery/);
  assert.match(native,/cachePolicy="memory-disk"/);
  assert.match(native,/resignCommunityMediaUrl\(path\)/);
  assert.doesNotMatch(native,/loadingOverlay|recyclingKey=/);
  assert.doesNotMatch(native,/getPublicUrl|\/object\/public\//);
});

test('preview Storage policy remains private and delegates to canonical original visibility', () => {
  const sql = readFileSync('supabase/migrations/20261029130900_community_wall_preview_storage_authorization_v1.sql','utf8');
  assert.match(sql,/on storage\.objects for select to authenticated/);
  assert.match(sql,/bucket_id = 'community-media'/);
  assert.match(sql,/public\.can_view_buklod_community_media_path_v1\(/);
  assert.match(sql,/regexp_replace\(name, '-p1-preview/);
  assert.doesNotMatch(sql,/to anon|using \(true\)|public\.getPublicUrl/);
});
