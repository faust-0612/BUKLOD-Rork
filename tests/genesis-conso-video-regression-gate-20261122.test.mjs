import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('current 2.0.4 OTA source QA and publisher both enforce thumbnail-first video and AdMob/navigation regressions', () => {
  const qa=source('.github/workflows/genesis-library-204-staging-ota-qa.yml');
  const publisher=source('.github/workflows/genesis-library-204-staging-ota-publish.yml');
  for(const workflow of [qa,publisher]) {
    assert.match(workflow,/tests\/video-thumbnail-first-frame-20261122\.test\.mjs/);
    assert.match(workflow,/tests\/genesis-conso-video-regression-gate-20261122\.test\.mjs/);
    assert.match(workflow,/tests\/dashboard-ad-navigation-prewarm-20261116\.test\.mjs/);
    assert.match(workflow,/tests\/ad-dashboard-focus-performance-20261116\.test\.mjs/);
  }
  assert.match(publisher,/2\.0\.4-genesis-library-godot/);
  assert.match(publisher,/c413c1ec2e23f151af0123cefbd4209fbf612d1f/);
  assert.match(publisher,/channel:view production/);
  assert.doesNotMatch(qa,/\beas\s+(?:update|submit|build)\b|\bexpo\s+publish\b/);
});
test('Video gate is linked to a real regression test with first-frame and private preview assertions', () => {
  const checks = source('tests/video-thumbnail-first-frame-20261122.test.mjs');
  assert.match(checks, /onFirstFrameRender/);
  assert.match(checks, /generateWallPreview: true/);
  assert.match(checks, /canPlay/);
});
