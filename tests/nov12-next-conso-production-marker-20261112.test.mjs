import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const marker = JSON.parse(read('.buklod/scopes/nov12-next-conso-production-marker-20261112.json'));

test('only exact four-pass frozen RC and verified current Main source are eligible for production', () => {
  assert.equal(marker.sourceMergeSha, '26641cc3b881f8adcb22b69a53341f361e4bad96');
  assert.equal(marker.baseRef, marker.sourceMergeSha);
  assert.equal(marker.rc.sourceHead, '9924c319324529be7231094cce6a666bb88138ca');
  assert.equal(marker.rc.compiledAndroidWebRun, 43217794214);
  assert.equal(marker.rc.androidBundleFiles, 263);
  assert.equal(marker.rc.webBundleFiles, 255);
  assert.equal(marker.rc.requiredChecksPassed, 4);
  assert.equal(marker.target.androidPackage, 'org.mzbministry.buklod');
  assert.equal(marker.target.androidVersionCode, 30);
  assert.equal(marker.target.runtimeVersion, '1.3.2');
  assert.equal(marker.target.easProjectId, '23dad7d0-389a-406e-8dec-08965dab85d8');
  assert.equal(marker.target.channel, 'production');
  assert.equal(marker.target.web, 'Expo Hosting');
});

test('canonical release is immutable, prefix-gated and never a manual or Vercel shortcut', () => {
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

test('release metadata cannot reapply unrelated runtime, payout or retired IGPAT', () => {
  assert.deepEqual(marker.allowedPaths, [
    '.buklod/scopes/nov12-next-conso-production-marker-20261112.json',
    'tests/nov12-next-conso-production-marker-20261112.test.mjs',
  ]);
  assert.match(read('src/app/(tabs)/hub.tsx'), /Hide Updates & Bulletins/);
  assert.doesNotMatch(read('src/components/BuklodSystemAnnouncementBoard.tsx'), /publicQuizDoor/);
  assert.match(read('src/components/BuklodConnectThread.tsx'), /roomReadFocusedRef/);
  assert.match(read('src/components/BuklodPostMotion.tsx'), /const count=preset==='storm'\?24/);
  assert.match(read('src/components/BuklodCommunityInlineAd.android.tsx'), /FEED_AD_CARD_HEIGHT = 392/);
  assert.match(read('src/components/CommunityVideo.tsx'), /BuklodImaVideo/);
  assert.match(read('src/lib/buklodGlobalAdController.ts'), /canRetainBuklodLoadedNativeCreative/);
});
