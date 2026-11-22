import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Genesis consolidated source QA always runs thumbnail-first video regression before OTA eligibility', () => {
  const workflow = source('.github/workflows/genesis-all-updates-conso-qa-20261122.yml');
  assert.match(workflow, /BUKLOD Genesis ALL-UPDATES Conso Staging Source QA \(NO PUBLISH\)/);
  assert.match(workflow, /tests\/video-thumbnail-first-frame-20261122\.test\.mjs/);
  assert.match(workflow, /tests\/genesis-conso-video-regression-gate-20261122\.test\.mjs/);
  assert.match(workflow, /tests\/dashboard-ad-navigation-prewarm-20261116\.test\.mjs/);
  assert.match(workflow, /tests\/ad-dashboard-focus-performance-20261116\.test\.mjs/);
  assert.match(workflow, /EXPECTED_NATIVE_RELEASE_HOLD: old 2\.0 signed APK cannot receive SOS R3 OTA/);
  assert.doesNotMatch(workflow, /eas update --branch|eas update --channel|npx expo publish/);
});

test('Video gate is linked to a real regression test with first-frame and private preview assertions', () => {
  const checks = source('tests/video-thumbnail-first-frame-20261122.test.mjs');
  assert.match(checks, /onFirstFrameRender/);
  assert.match(checks, /generateWallPreview: true/);
  assert.match(checks, /canPlay/);
});
