import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(file, 'utf8');
const marker = JSON.parse(read('.buklod/scopes/nov12-full-conso-wall-production-marker-20261112.json'));

test('one exact RC tree and production package/runtime precede marker', () => {
  assert.equal(marker.sourceMergeSha, 'cdbd561c3487563eb12b2f8f171af0037a0060fd');
  assert.equal(marker.baseRef, marker.sourceMergeSha);
  assert.equal(marker.rc.sourceHead, '723140ac1d5bd22999abd6fd2c5e85420db80f8a');
  assert.equal(marker.rc.sourceTree, '2a249986a66cc5cc939d14b251e9efd25471828e');
  assert.equal(marker.rc.compiledAndroidWebRun, 43197258585);
  assert.equal(marker.rc.androidBundleFiles, 263);
  assert.equal(marker.rc.webBundleFiles, 255);
  assert.equal(marker.rc.requiredChecksPassed, 4);
  assert.equal(marker.target.channel, 'production');
  assert.equal(marker.target.androidPackage, 'org.mzbministry.buklod');
  assert.equal(marker.target.androidVersionCode, 30);
  assert.equal(marker.target.runtimeVersion, '1.3.2');
  assert.equal(marker.target.easProjectId, '23dad7d0-389a-406e-8dec-08965dab85d8');
});

test('canonical Android and Web release workflows are prefix-gated and immutable', () => {
  const android = read('.github/workflows/production_android_ota.yml');
  const web = read('.github/workflows/production_web_deploy.yml');
  assert.equal(marker.releasePrefix, 'BUKLOD_CONSOLIDATED_PROD_20261108');
  for (const workflow of [android, web]) {
    assert.match(workflow, /startsWith\(github\.event\.head_commit\.message, 'BUKLOD_CONSOLIDATED_PROD_20261108'\)/);
    assert.match(workflow, /ref: \$\{\{ github\.sha \}\}/);
    assert.doesNotMatch(workflow, /^  workflow_dispatch:/m);
  }
  assert.match(android, /node scripts\/android-ota-rc\.cjs freeze/);
  assert.match(android, /node scripts\/android-ota-rc\.cjs published/);
  assert.match(android, /eas-cli@latest update --channel production --platform android/);
  assert.match(web, /eas-cli@latest deploy --prod --export-dir dist/);
});

test('one metadata and regression test pair, while player, big ad and finance remain protected', () => {
  assert.deepEqual(marker.allowedPaths, [
    '.buklod/scopes/nov12-full-conso-wall-production-marker-20261112.json',
    'tests/nov12-full-conso-wall-production-marker-20261112.test.mjs',
  ]);
  assert.equal(marker.knownPending.enforceQuiz, false);
  assert.equal(marker.backend.bsocGptEdgeVersion, 8);
  assert.deepEqual(marker.backend.privacyLiveMigrationVersions, ['20261112071459','20261112072440']);
  assert.match(read('src/components/BuklodCommunityInlineAd.android.tsx'), /FEED_AD_CARD_HEIGHT = 392/);
  assert.match(read('src/components/CommunityVideo.tsx'), /BuklodImaVideo/);
  assert.match(read('src/lib/buklodGlobalAdController.ts'), /canRetainBuklodLoadedNativeCreative/);
  assert.match(read('src/components/BuklodCommunitySponsoredAd.tsx'), /PAID SPONSORSHIP/);
});
