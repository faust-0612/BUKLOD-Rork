import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const wf = readFileSync('.github/workflows/buklod-nov18-scoped-video-staging-ota.yml','utf8');
const manifest=JSON.parse(readFileSync('.buklod/scopes/nov18-scoped-video-staging-ota-release.json','utf8'));
const RC='543c36245717cf77d4c8bc614609fc2fe91b3ef4';
const BRANCH='release/nov18-consolidated-scoped-video-staging132';

test('release is only an explicitly authorized Android staging branch; no production action',()=>{
  assert.equal(manifest.contractVersion,2);
  assert.equal(manifest.frozenRcSourceSha,RC);
  assert.equal(manifest.releaseAuthorized,true);
  assert.equal(manifest.target.package,'org.mzbministry.buklod.staging');
  assert.equal(manifest.target.runtime,'1.3.2');
  assert.equal(manifest.target.channel,'staging-user');
  assert.match(wf,/branches:\s*\n\s*- release\/nov18-consolidated-scoped-video-staging132/);
  assert.match(wf,/github\.ref == 'refs\/heads\/release\/nov18-consolidated-scoped-video-staging132'/);
  assert.match(wf,/RC_SOURCE: 543c36245717cf77d4c8bc614609fc2fe91b3ef4/);
  assert.match(wf,/group: buklod-staging-user-android-ota/);
  assert.doesNotMatch(wf,/eas(?:-cli@[^\s]*)? update --channel production|eas update --branch production|build --profile production|eas submit/);
  assert.doesNotMatch(wf,/BUKLOD_APP_TARGET:\s*classroom/);
});

test('unreviewed product changes and missing exact-head RC checks block publication',()=>{
  assert.match(wf,/Only three release metadata paths may differ/);
  assert.match(wf,/Exact RC head changed/);
  assert.match(wf,/Required RC CI not successful/);
  assert.match(wf,/BUKLOD Performance R1 QA/);
  assert.match(wf,/Engineering Accountability/);
  assert.match(wf,/BUKLOD Compact Layout Source QA/);
  assert.match(wf,/BUKLOD Real Recent Comment QA/);
  assert.match(wf,/BUKLOD Main - Report Door and Legacy Integration PR QA/);
  assert.match(wf,/git diff --exit-code "\$APK_SOURCE" "\$GITHUB_SHA" -- app\.config\.js eas\.json package-lock\.json/);
  assert.match(wf,/a\.deepEqual\(current\.dependencies,original\.dependencies/);
  assert.match(wf,/npx tsc --noEmit/);
  assert.match(wf,/npm run character:contract/);
  assert.match(wf,/npm run compact:contract/);
  assert.match(wf,/tests\/scoped-community-video-sidecar-recovery\.test\.mjs/);
  assert.match(wf,/tests\/buklod-ads-appwide-permanent-lock-20261111\.test\.mjs/);
  assert.match(wf,/expo export --platform android/);
});

test('preview environment, native APK fingerprint and production nonmutation must be read independently',()=>{
  assert.match(wf,/eas-cli@27\.9\.0 build:view/);
  assert.match(wf,/bc4be208-bfb0-42f3-95cb-358353d0600f/);
  assert.match(wf,/verifyBuild\(build\)/);
  assert.match(wf,/verifyChannels\(/);
  assert.match(wf,/manifest\('production'\)/);
  assert.match(wf,/production changed during staging OTA/i);
  assert.match(wf,/update --channel staging-user --platform android --environment preview --skip-bundler/);
  assert.match(wf,/BUKLOD_NOV18_CONSO_STAGING_/);
  assert.match(wf,/update:view/);
  assert.match(wf,/manifest\('staging-user'\)/);
  assert.match(wf,/physicalDeviceVerified:\s*false/);
  assert.match(wf,/actions\/upload-artifact@v4/);
});

test('Scope media and optional ML Kit fallback are preserved; no new release dependency',()=>{
  const scoped=readFileSync('src/components/BuklodExclusiveScopeCommunity.tsx','utf8');
  const henry=readFileSync('src/lib/buklodHenryTranslation.ts','utf8');
  assert.match(scoped,/const videoMedia = scopedCommunityVideoMedia\(item\)/);
  assert.match(scoped,/posterUri=\{videoMedia\.preview_url \?\? null\}/);
  assert.match(scoped,/<BuklodVideoCompanionAd/);
  assert.match(henry,/native-unavailable/);
  assert.match(henry,/requireOptionalNativeModule fails safely/);
  assert.deepEqual(
    manifest.allowedPaths.slice().sort(),
    ['.github/workflows/buklod-nov18-scoped-video-staging-ota.yml',
     '.buklod/scopes/nov18-scoped-video-staging-ota-release.json',
     'tests/nov18-scoped-video-staging-ota-release.test.mjs'].sort()
  );
});
