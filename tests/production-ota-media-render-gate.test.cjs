const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('production Android OTA runs social media regressions before RC export and freeze', () => {
  const workflow = fs.readFileSync('.github/workflows/production_android_ota.yml', 'utf8');
  const typecheck = workflow.indexOf('npx tsc --noEmit');
  const media = workflow.indexOf('Social photo and video rendering regression suite');
  const exportStep = workflow.indexOf('expo export --platform android --output-dir rc');
  const freezeStep = workflow.indexOf('android-ota-rc.cjs freeze');
  assert.ok(typecheck >= 0 && media > typecheck, 'media suite must run after TypeScript QA');
  assert.ok(exportStep > media && freezeStep > media, 'media suite must gate export and RC freeze');
  for (const path of [
    'tests/unified-social-media-rendering.test.mjs',
    'tests/community-video-persistent-preview.test.mjs',
    'tests/community-video-playback-recovery.test.mjs',
    'tests/community-media-aspect-ratio-20261103.test.mjs',
    'tests/weak-media-rendering.test.cjs',
    'tests/community-media-weak-signal.test.cjs',
    'tests/community-wall-no-blank-photo.test.cjs',
  ]) assert.ok(workflow.includes(path), 'missing OTA regression: ' + path);
});
