import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = file => readFileSync(file,'utf8');
const base = read('.github/workflows/production_android_ota.yml');
const workflow = read('.github/workflows/mentor-submit-only-prod-ota-20261120.yml');
const release = read('scripts/android-ota-rc-mentor-20261120.cjs');
const guard = read('scripts/mentor-hotfix-release-guard-20261120.cjs');
const screen = read('src/app/faith/mentor-evidence.tsx');

test('one-screen-only workflow retains ALL canonical production quality and publication steps', () => {
  const steps = [...base.matchAll(/^      - name: (.+)$/gm)].map(m=>m[1]);
  for (const name of steps) {
    assert.ok(workflow.includes(`      - name: ${name}`), `Production gate missing: ${name}`);
  }
  for (const token of [
    'Check Season 2 production embargo before build',
    'Verify app-wide AdMob policy before production OTA',
    'Verify AdMob fill diagnostics and source-backed Finance gate',
    'AdMob startup, Reels feed, scope, fallback and recovery regression suite',
    'Home map Google Maps handoff and enlarged search regression',
    'Verify production baseline and runtime',
    'Freeze verified RC',
    'Publish exact frozen Android RC',
    'Archive publication evidence',
    'node --test tests/mentor-report-submit-feedback-20261120.test.mjs',
  ]) assert.ok(workflow.includes(token), `Missing contract ${token}`);
});

test('publisher triggers on isolated branch and exact release marker only, not main or staging', () => {
  assert.match(workflow, /branches: \[release\/mentor-submit-pinned-baseline-20261120\]/);
  assert.match(workflow, /startsWith\(github\.event\.head_commit\.message, 'BUKLOD_MENTOR_SUBMIT_ONLY_PROD_20261120:'\)/);
  assert.doesNotMatch(workflow, /branches: \[main\]/);
  assert.match(workflow,/group: buklod-production-android-ota/);
  assert.match(workflow,/git ls-remote origin refs\/heads\/release\/mentor-submit-pinned-baseline-20261120/);
  assert.match(workflow,/eas-cli@latest update --channel production --platform android --environment production --input-dir rc --skip-bundler/);
  assert.doesNotMatch(workflow,/workflow_dispatch:/);
  assert.match(guard,/ISOLATED MENTOR RELEASE BLOCKED/);
  assert.match(guard,/season2\.runtimeEvidence\(\)/);
  assert.match(guard,/assert\.equal\(record\.productionAuthorized,true\)/);
  assert.match(guard,/assert\.equal\(record\.season2ProductionAuthorized,false\)/);
  assert.match(guard,/assert\.equal\(record\.backendMutationAuthorized,false\)/);
  assert.match(guard,/assert\.equal\(record\.nativeBuildAuthorized,false\)/);
});

test('verified 2026-11-19 production identity, immutable RC hash, ABI and exact file scope cannot be bypassed', () => {
  assert.match(release,/01a1f3f0-11f0-7ba7-a0d2-8dbebdf97ae3/);
  assert.match(release,/unFUenZWw5gY5LAIPwwtyn8dlSV8j_NhAWoXbyCzQII/);
  assert.match(release,/assert\.equal\(before\.launchAsset\.hash,pinnedProductionBundleHash/);
  assert.match(release,/releaseRecord\.preReleaseSourceSha/);
  assert.match(guard,/record\.preReleaseSourceSha/);
  assert.match(release,/0a4f0b2b849f24b46b4a0643a6cc55ae539d5cdf/);
  assert.match(release,/assert\.equal\(before\.id,pinnedProductionUpdateId/);
  assert.match(release,/assert\.equal\(live\.id, update\.id/);
  assert.match(release,/assert\.equal\(live\.launchAsset\.hash, bundleHash/);
  assert.match(release,/assertNativeRuntimeCompatible\(/);
  assert.match(release,/assertApprovedCompactScriptOnly\(/);
  assert.match(release,/assert\.deepEqual\(inventory\('rc'\), rc\.files/);
  assert.match(release,/HEAD:src\/app\/faith\/mentor-evidence\.tsx/);
  assert.match(release,/06451c37b8072b224ef4da900d7ea62e6fc7ddd4/);
  assert.match(release,/HEAD\^','HEAD'/);
  assert.match(release,/\.buklod\/releases\/mentor-submit-only-prod-20261120\.json/);
  assert.match(screen,/Review requirements to submit/);
  assert.match(screen,/'report_my_mentor_teaching_with_details_r3'/);
});
