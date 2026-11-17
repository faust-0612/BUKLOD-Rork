import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const w=readFileSync('.github/workflows/buklod-nov17-current-main-consolidated-staging-ota.yml','utf8');
const scope=JSON.parse(readFileSync('.buklod/scopes/nov17-current-main-consolidated-staging-release.json','utf8'));
const source='47eefd0c685f0c639227e9a887b1e1dda29b05e7';

test('staging OTA requires exact canonical source, no feature change and frozen branch',()=>{
  assert.equal(scope.baseRef,source);
  assert.match(w,/RELEASE_MAIN_SHA: 47eefd0c685f0c639227e9a887b1e1dda29b05e7/);
  assert.match(w,/release\/nov17-main-verified-consolidated-rc132/);
  assert.match(w,/git merge-base --is-ancestor "\$RELEASE_MAIN_SHA" "\$GITHUB_SHA"/);
  assert.match(w,/git diff --exit-code "\$RELEASE_MAIN_SHA" "\$GITHUB_SHA" -- src\//);
  assert.match(w,/Main moved during staged release/);
  assert.match(w,/Exact reviewed main fixes missing/);
});

test('staging publisher verifies runtime, authenticated APK and never targets production',()=>{
  assert.match(w,/APP_VARIANT: staging/);
  assert.match(w,/EXPO_PUBLIC_APP_ENV: staging/);
  assert.match(w,/channel:view staging-user/);
  assert.match(w,/channel:view production/);
  assert.match(w,/org\.mzbministry\.buklod\.staging/);
  assert.match(w,/runtimeVersion,'1\.3\.2'/);
  assert.match(w,/update --channel staging-user --platform android --environment preview/);
  assert.doesNotMatch(w,/update --channel production|--profile production|eas submit|supabase db push|npx vercel deploy/);
  assert.match(w,/Production changed during staging OTA/);
});

test('source tests, ads, Connect, character art and exactly-once readback are mandatory',()=>{
  for (const check of [
    'Engineering Accountability',
    'BUKLOD Compact Layout Source QA (No OTA)',
    'BUKLOD Character R31-R40 Recovery QA',
    'BUKLOD Performance R1 QA',
    'BUKLOD Nov16 Consolidated Android Bundle QA (No OTA)',
    'tests/connect-latest-scroll-rebound-20261117.test.mjs',
    'tests/connect-scroll-read-cursor-and-ads-isolation-20261117.test.mjs',
    'tests/buklod-wall-ad-stability.test.mjs',
    'tests/dashboard-ad-navigation-prewarm-20261116.test.mjs',
    'tests/nov17-current-main-consolidated-staging-release.test.mjs',
    'Verify public artwork manifest',
    'verifyUpdate',
    'physicalDeviceVerified:false',
  ]) assert.ok(w.includes(check), 'missing protected acceptance: '+check);
  assert.match(w,/BUKLOD_NOV17_MAIN_CONSOLIDATED_/);
  assert.match(w,/existing-group/);
  assert.match(w,/update:view/);
  assert.match(w,/manifest\('staging-user'\)/);
});
