import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const trigger = read('.github/workflows/buklod-authorized-production-20261107.yml');
const android = read('.github/workflows/production_android_ota.yml');
const web = read('.github/workflows/production_web_deploy.yml');
const config = read('app.config.js');
const runtimeGate = read('scripts/android-ota-rc.cjs');

test('one-shot promotion only runs from explicitly authorized main source update', () => {
  assert.match(trigger, /branches: \[main\]/);
  assert.match(trigger, /paths: \[\.github\/workflows\/buklod-authorized-production-20261107\.yml\]/);
  assert.match(trigger, /startsWith\(github\.event\.head_commit\.message, 'release\(buklod\): one-time prod OTA and web 2026-11-07'\)/);
  assert.match(trigger, /test "\$GITHUB_REF" = "refs\/heads\/main"/);
  assert.match(trigger, /test "\$head" = "\$GITHUB_SHA"/);
  assert.doesNotMatch(trigger, /npx eas-cli|npx eas update|npx eas deploy/,
    'One-shot trigger must use original release workflows, never publish directly');
});

test('original Android and Expo Web production workflows are dispatched exactly once', () => {
  assert.match(trigger, /"production_android_ota\.yml\|BUKLOD\/Android production OTA"/);
  assert.match(trigger, /"production_web_deploy\.yml\|BUKLOD\/Expo Hosting production web"/);
  assert.match(trigger, /for entry in/);
  assert.match(trigger, /\$api\/actions\/workflows\/\$workflow\/dispatches/);
  assert.match(trigger, /if \[ "\$code" != 204 \]/);
  assert.match(android, /workflow_dispatch:/);
  assert.match(web, /workflow_dispatch:/);
  assert.match(android, /concurrency:/);
  assert.match(web, /concurrency:/);
});

test('release result is never marked success until required actual publish step succeeded', () => {
  assert.match(trigger, /workflow_run:/);
  assert.match(trigger, /types: \[completed\]/);
  assert.match(trigger, /final_step="Publish exact frozen Android RC"/);
  assert.match(trigger, /final_step="Deployment status"/);
  assert.match(trigger, /\$api\/actions\/runs\/\$run_id\/jobs\?per_page=100/);
  assert.match(trigger, /\[ "\$conclusion" = success \] && \[ "\$final_result" = success \]/);
  assert.match(trigger, /state=failure/);
  assert.match(android, /node scripts\/android-ota-rc\.cjs published/);
  assert.match(web, /sha256sum -c web-rc-sha256\.txt/);
  assert.match(web, /npx eas-cli@latest deploy --prod/);
});

test('locked BUKLOD V28 native 1.3.2 and Main Expo Hosting targets cannot drift', () => {
  assert.match(config, /runtimeVersion: isClassroom \? '1\.3\.0' : '1\.3\.2'/);
  assert.match(config, /org\.mzbministry\.buklod/);
  assert.match(runtimeGate, /const runtime = '1\.3\.2'/);
  assert.match(runtimeGate, /const pinnedV28 = '2f26645e50e8e079ebf09f3999aacfc506ae7651'/);
  assert.match(runtimeGate, /assertNativeExpoConfigCompatible/);
  assert.match(android, /node scripts\/android-ota-rc\.cjs baseline/);
  assert.match(android, /node scripts\/android-ota-rc\.cjs verify/);
  assert.match(web, /EXPECTED_MAIN_URL='https:\/\/yhanxndaqbmuzbdqlblu\.supabase\.co'/);
  assert.match(web, /test "\$\(git ls-remote origin refs\/heads\/main/);
});

test('one-time production authorization YAML cannot be invalidated by colon in commit title', () => {
  assert.match(trigger, /^\s+if: >-\s*\n\s+github\.event_name == 'push' &&\s*\n\s+\(?startsWith\(github\.event\.head_commit\.message, 'release\(buklod\): one-time prod OTA and web 2026-11-07'\)/m);
  assert.doesNotMatch(trigger, /^\s+if: [^\n]*release\(buklod\): one-time prod OTA and web/m);
});

test('Android recovery only dispatches Android, never republishes already verified Expo Hosting web', () => {
  assert.match(trigger, /startsWith\(github\.event\.head_commit\.message, 'release\(buklod\): Android OTA recovery 2026-11-07'\)/);
  assert.match(trigger, /'release\(buklod\): Android OTA recovery 2026-11-07'\)\s*\n\s*targets=\("production_android_ota\.yml\|BUKLOD\/Android production OTA"\)/);
  assert.match(trigger, /'release\(buklod\): one-time prod OTA and web 2026-11-07'\)\s*\n\s*targets=\("production_android_ota\.yml\|BUKLOD\/Android production OTA" "production_web_deploy\.yml\|BUKLOD\/Expo Hosting production web"\)/);
  assert.match(trigger, /for entry in "\$\{targets\[@\]\}"; do/);
  assert.match(trigger, /test "\$head" = "\$GITHUB_SHA"/);
});
