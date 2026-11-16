import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../'+p, import.meta.url), 'utf8');
const w=read('.github/workflows/buklod-nov16-compact-art-ads-staging-release.yml');

test('signed Android staging is the only release destination',()=>{
 for(const token of [
  'release/nov16-compact-art-ads-staging132',
  'integration/nov16-compact-art-ads-prewarm-staging-rc',
  'Release source must match independently checked candidate exactly',
  'Engineering Accountability',
  'BUKLOD Compact Layout Source QA (No OTA)',
  'BUKLOD Character R31-R40 Recovery QA',
  'BUKLOD Performance R1 QA',
  'BUKLOD Main - Report Door and Legacy Integration PR QA',
  'tests/dashboard-ad-navigation-prewarm-20261116.test.mjs',
  'tests/buklod-ads-appwide-permanent-lock-20261111.test.mjs',
  'tests/ad-dashboard-focus-performance-20261116.test.mjs',
  'expo export --platform android',
  'update --channel staging-user --platform android',
  'productionUnchanged',
  'physicalDeviceVerified:false'
 ]) assert.ok(w.includes(token),token);
 assert.doesNotMatch(w,/update --channel production|build --profile production|submit --platform android/);
});
test('cannot roll back a staging update that has advanced since the verified art release',()=>{
 assert.match(w,/EXPECTED_STAGE_UPDATE_ID: 01a1e498-a8f0-7fc8-93fe-7662526d086d/);
 assert.match(w,/Staging baseline advanced: reconcile before another OTA/);
 assert.match(w,/runtimeVersion,'1\.3\.2'/);
 assert.match(w,/android\.package,'org\.mzbministry\.buklod\.staging'/);
 assert.match(w,/sourceSha:process\.env\.GITHUB_SHA/);
});
test('dashboard warmup uses no hidden native ad view or synthetic impressions',()=>{
 const s=read('src/components/BuklodDashboardAdWarmup.android.tsx');
 assert.ok(s.includes('MAX_WARM_CREATIVES = 2'));
 assert.ok(s.includes('NativeAd.createForAdRequest'));
 assert.ok(s.includes('isBuklodPassiveAdAllowed'));
 assert.ok(s.includes('reserveBuklodPassiveAdRequest'));
 assert.doesNotMatch(s,/\bNativeAdView\b|['"]ad_impression['"]|['"]ad_rendered['"]/);
});
