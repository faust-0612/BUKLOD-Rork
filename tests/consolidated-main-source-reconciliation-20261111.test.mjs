import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root),'utf8');
test('RC preserves Main audio coexistence while using Supabase-only video writes',()=>{
  const video=read('src/components/CommunityVideo.tsx');
  assert.match(video,/audioMixingMode = 'mixWithOthers'/);
  const uploader=read('src/lib/uploadCommunityVideoFile.ts');
  assert.match(uploader,/BUKLOD_SUPABASE_ONLY_VIDEO_UPLOAD_R1/);
  assert.doesNotMatch(uploader,/registerPendingAwsWallVideo\s*\(|uploadAwsWallVideo\s*\(/);
  assert.match(uploader,/Platform\.OS !== 'web' && isJpeg && existingBytes > 0 && existingBytes <= 2/);
  assert.match(uploader,/Platform\.OS === 'web' && isJpeg && existingBytes > 0 && existingBytes <= 12/);
});
test('RC preserves upload-time player cleanup and PTT web audio safety',()=>{
  const igpat=read('src/app/igpat/create.tsx');
  assert.match(igpat,/Video preview paused during upload/);
  const web=read('src/app/igpat/index.web.tsx');
  assert.match(web,/audioMixingMode = 'mixWithOthers'/);
  const native=read('src/app/igpat/index.tsx');
  assert.match(native,/useScreenFocused/);
  assert.match(native,/screenFocused && !!item\.media_url/);
});
test('RC uses canonical finance snapshot and retains detailed month-close blockers',()=>{
  const admin=read('src/app/admin/economy-operations.tsx');
  assert.match(admin,/loadCanonicalAdminEconomy/);
  assert.match(admin,/getBuklodFinanceMonthCloseBlockers/);
  assert.match(admin,/monthCloseBlockers\.join/);
  assert.match(admin,/requestSerial\.current/);
  const qmp=read('src/app/community-contribution.tsx');
  assert.doesNotMatch(qmp,/requestCommunityContributionReview/);
  const manifest=JSON.parse(read('.buklod/scopes/nov11-consolidated-rc.json'));
  assert.equal(manifest.releaseMode,'consolidated-main-rc');
  assert.equal(manifest.productionPublishAuthorized,false);
});
