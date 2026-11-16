import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const w=readFileSync('.github/workflows/buklod-nov17-consolidated-staging-ota.yml','utf8');
test('nov17 Android staging deployment is strictly scoped and never writes to prod',()=>{
  assert.match(w,/branches:\s*\n\s*- release\/nov17-all-recent-rc132/);
  assert.match(w,/github\.ref == 'refs\/heads\/release\/nov17-all-recent-rc132'/);
  assert.match(w,/pulls\/900/);
  assert.match(w,/Exact source PR gate not passing/);
  assert.match(w,/Unreviewed file delta in cumulative Android RC/);
  assert.match(w,/org\.mzbministry\.buklod\.staging/);
  assert.match(w,/runtimeVersion,'1\.3\.2'/);
  assert.match(w,/update --channel staging-user --platform android/);
  assert.match(w,/npx tsc --noEmit/);
  assert.match(w,/expo export --platform android/);
  assert.match(w,/productionUpdateId/);
  assert.match(w,/physicalDeviceVerified:false/);
  assert.doesNotMatch(w,/update --channel production|build --profile production|submit --platform android/);
});
test('nov17 staging release includes gesture, picker and AdMob guarantees',()=>{
  for(const p of ['tests/wall-gallery-navigation-recovery-20261117.test.mjs','tests/nov17-marites-swipe-video-tap.test.mjs','tests/dashboard-ad-navigation-prewarm-20261116.test.mjs','tests/buklod-ads-appwide-permanent-lock-20261111.test.mjs']) assert.ok(w.includes(p),p);
  assert.match(w,/Verify public artwork manifest/);
  assert.match(w,/Verify existing signed staging APK/);
});
