import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifiedLegacyWallPreviewPath as indexed } from '../src/lib/communityWallPreviewPath.ts';

const source = readFileSync('src/lib/buklodCommunityPostMedia.ts','utf8');
const native = readFileSync('src/components/BuklodCachedMediaImage.android.tsx','utf8');
const generic = readFileSync('src/components/BuklodCachedMediaImage.tsx','utf8');
const collage = readFileSync('src/components/BuklodCommunityPhotoCollage.tsx','utf8');
const sql = readFileSync('supabase/migrations/20261029211000_wall_legacy_preview_backfill_r1.sql','utf8');
const cron = readFileSync('supabase/migrations/20261029213000_wall_legacy_preview_runner_r1.sql','utf8');
const worker = readFileSync('supabase/functions/buklod-wall-preview-backfill/index.ts','utf8');

test('legacy index accepts only deterministic preview matching the original', () => {
 const orig='scope/scope-id/user-id/post-123.jpg';
 assert.equal(indexed(orig,'scope/scope-id/user-id/post-123-legacy-preview.jpg'),
  'scope/scope-id/user-id/post-123-legacy-preview.jpg');
 assert.equal(indexed(orig,'scope/scope-id/another-id/post-123-legacy-preview.jpg'),null);
 assert.equal(indexed(orig,'scope/scope-id/user-id/post-234-legacy-preview.jpg'),null);
 assert.equal(indexed('user/post-123-p1.jpg','user/post-123-p1-legacy-preview.jpg'),null);
 assert.equal(indexed('user/post-123.jpg',null),null);
 assert.equal(indexed('user/photo-album-987.jpg','user/photo-album-987-legacy-preview.jpg'),
 'user/photo-album-987-legacy-preview.jpg');
 assert.equal(indexed('user/photo-album-987.jpg','user/unrelated-legacy-preview.jpg'),null);
});

test('media RPC v3 preserves v2 fallback and attaches no new unsigned URLs', () => {
 assert.match(source,/rpc\('get_buklod_post_media_v3'/);
 assert.match(source,/rpc\('get_buklod_post_media_v2'/);
 assert.ok(source.indexOf('get_buklod_post_media_v3') < source.indexOf('get_buklod_post_media_v2'));
 assert.match(source,/preview_path\?: string \| null/);
 assert.match(source,/if \(!isMissingRpcError\(String\(v3.error/);
});

test('only Android Wall tiles use indexed preview, fullscreen retains original media', () => {
 assert.match(collage,/preview_path\?: string \| null/);
 assert.match(collage,/previewPath=\{photos\[0\]\.preview_path\}/);
 assert.match(collage,/previewPath=\{photo\.preview_path\}/);
 assert.match(collage,/onPressPhoto\?\.\(index, photos\)/);
 assert.match(native,/verifiedLegacyWallPreviewPath\(originalPath, previewPath\)/);
 assert.match(native,/const preferred = usingPreview \? '' : String\(uri \?\? ''\)\.trim\(\)/);
 assert.match(native,/if \(usingPreview\) \{/);
 assert.match(native,/setFailedPreviewFor\(originalPath\)/);
 assert.match(generic,/previewPath\?: string \| null/);
 assert.doesNotMatch(generic,/verifiedLegacyWallPreviewPath/);
});

test('preview Storage and metadata RLS require existing original permissions', () => {
 assert.match(sql,/enable row level security/);
 assert.match(sql,/grant select on public\.community_wall_legacy_previews to authenticated/);
 assert.match(sql,/public\.buklod_storage_object_select_allowed_v1\('community-media',original_path\)/);
 assert.match(sql,/public\.buklod_storage_object_select_allowed_v1\('community-media',i\.original_path\)/);
 assert.doesNotMatch(sql,/to anon|using\s*\(true\)/i);
 assert.match(sql,/get_buklod_post_media_v3/);
 const extended = readFileSync('supabase/migrations/20261029220500_wall_legacy_all_photo_paths_r1.sql','utf8');
 assert.match(extended,/exists \(select 1 from storage\.objects o where o\.bucket_id='community-media' and o\.name=src\.path\)/);
 assert.match(extended,/buklod_storage_object_select_allowed_v1\('community-media',i\.original_path\)/);

 assert.match(source,/get_buklod_post_media_v2/); // compatibility remains in client
});

test('backfill only uses service-role internally and never deletes originals', () => {
 assert.match(worker,/SUPABASE_SERVICE_ROLE_KEY/);
 assert.match(worker,/x-buklod-backfill-token/);
 assert.match(worker,/buklod_legacy_preview_worker_auth_v1/);
 assert.match(worker,/buklod_legacy_preview_claim_v1/);
 assert.match(worker,/jpeg-js@0\.4\.4/);
 assert.match(worker,/original_path: path, preview_path: previewPath/);
 assert.doesNotMatch(worker,/\.remove\(|\.delete\(|getPublicUrl|upsert: true/);
 assert.match(worker,/preview_bytes: previewBytes/);
});

test('queue is bounded with 3 attempts, hard expiry and automatic unschedule', () => {
 assert.match(sql,/q\.attempts<3/);
 assert.match(sql,/leased_until=now\(\)\+interval '5 minutes'/);
 assert.match(sql,/next_attempt_at=now\(\)\+interval '15 minutes'/);
 assert.match(cron,/v_bytes>48000000/);
 assert.match(cron,/for v_i in 1\.\.4 loop/);
 assert.match(cron,/cron\.unschedule\('buklod_legacy_preview_backfill_r1'\)/);
 assert.match(cron,/v_exp<=now\(\)/);
});

test('no prior photo renderer masking regressions', () => {
 assert.match(native,/decideAndroidPhotoRecovery/);
 assert.doesNotMatch(native,/loadingOverlay|recyclingKey=/);
 assert.match(native,/cachePolicy="memory-disk"/);
 assert.match(native,/setTimeout\(\(\) => resolve\(null\), 800\)/);
});
