'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const flow=fs.readFileSync('.github/workflows/buklod-v31-green-b-aab-20261108.yml','utf8');
test('V31 production workflow is one-shot, source-locked, release-only, no OTA/web/Play',()=>{
  assert.match(flow,/BUKLOD_V31_GREEN_B_PRODUCTION_AAB_20261108/);
  assert.match(flow,/git merge-base --is-ancestor 1b1627a72b509d3a1f97c67f85cdf5394040f1b2/);
  assert.match(flow,/git ls-remote origin refs\/heads\/main/);
  assert.match(flow,/--platform android --profile production --non-interactive --wait --json/);
  assert.doesNotMatch(flow,/eas-cli@latest\s+(?:submit|update|deploy)\b/);
  assert.match(flow,/git diff --name-only/);
  assert.match(flow,/versionCode,31/);
  assert.match(flow,/node --test tests\/native-expo-config-compat\.test\.cjs tests\/staging-release-identity-v30-20261108\.test\.cjs tests\/buklod-v31-production-release-identity-20261108\.test\.cjs/);
  assert.doesNotMatch(flow,/node --test [^\n]*tests\/android-v29-runtime-compat-release-20261108\.test\.cjs/);
  assert.match(flow,/versionCode="31"/);
  assert.match(flow,/FOREGROUND_SERVICE_CONNECTED_DEVICE/);
});
test('approved exact green B native resource is pinned before production build',()=>{
  assert.match(flow,/9a4e4a826191d6e310dc26f5c74d4611293ceb17/);
  assert.match(flow,/buklod-main-canonical\.png/);
  assert.match(flow,/adaptiveIcon\.foregroundImage/);
  assert.match(flow,/android\.package,'org\.mzbministry\.buklod'/);
  assert.match(flow,/runtimeVersion,'1\.3\.2'/);
  const config=fs.readFileSync('app.config.js','utf8');
  assert.match(config,/versionCode: isStaging \? undefined : \(isClassroom \? 28 : 30\)/);
  assert.equal(execFileSync('git',['rev-parse','HEAD:assets/release/buklod-main-canonical.png'],{encoding:'utf8'}).trim(),'9a4e4a826191d6e310dc26f5c74d4611293ceb17');
});
