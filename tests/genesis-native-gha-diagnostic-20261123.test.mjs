import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditLocalNative} from '../scripts/genesis-native-local-only-gate.mjs';

const workflow = readFileSync(new URL('../.github/workflows/genesis-native-gha-diagnostic-20261123.yml',import.meta.url),'utf8');

test('GitHub runner cannot target production and only compiles exact isolated DEV source',()=>{
  assert.match(workflow,/dev\/genesis-native-gha-diagnostic-20261123/g);
  assert.match(workflow,/github\.repository == 'faust-0612\/BUKLOD-Rork'/);
  assert.match(workflow,/startsWith\(github\.event\.head_commit\.message, 'GENESIS_NATIVE_GHA_DIAG:'\)/);
  assert.match(workflow,/persist-credentials: false/);
  assert.match(workflow,/permissions:\s*\n\s*contents: read/);
  assert.match(workflow,/timeout-minutes: 16/);
  assert.match(workflow,/cancel-in-progress: true/);
  assert.doesNotMatch(workflow,/^\s*(?:release|pull_request|schedule|workflow_run):/m);
});

test('Android compile uses supported fixed Java, SDK, AGP-compatible Gradle; never assembles or uploads APK',()=>{
  const project = readFileSync(new URL('../native-genesis/android/build.gradle.kts',import.meta.url),'utf8');
  const module = readFileSync(new URL('../native-genesis/android/app/build.gradle.kts',import.meta.url),'utf8');
  assert.match(project,/com\.android\.application"\) version "8\.11\.1"/);
  assert.match(module,/compileSdk = 36/);
  assert.match(module,/applicationId = "org\.mzbministry\.buklod\.genesis\.nativeapp"/);
  assert.match(module,/org\.godotengine:godot:4\.7\.2\.stable/);
  assert.match(module,/androidx\.fragment:fragment:1\.9\.1/);
  assert.match(module,/androidx\.core:core-splashscreen:1\.2\.0/);
  for(const token of ["java-version: '17'","gradle-version: '8.14.3'","platforms;android-36","build-tools;35.0.0",":app:compileDebugKotlin",":app:compileDebugJavaWithJavac",":app:processDebugMainManifest"])
    assert.ok(workflow.includes(token), token);
  assert.doesNotMatch(workflow,/\b(?:assembleRelease|assembleDebug|upload-artifact|download-artifact|expo\s+run|eas\s+build|vercel|gradlew\s+publish)\b/i);
  assert.doesNotMatch(workflow,/GENESIS_NATIVE_KEYSTORE_|GENESIS_NATIVE_STAGING_SUPABASE_PUBLISHABLE_KEY|secrets\./i);
});

test('Incomplete app must remain blocked regardless of a successful native source compile',async()=>{
  const result = await auditLocalNative(new URL('..',import.meta.url).pathname,{env:{},checkTools:false});
  assert.equal(result.ok,false);
  for(const code of ['BACKEND_NOT_ISOLATED','UNVERIFIED_APP_FEATURE','INSUFFICIENT_NATIVE_GAME_ASSETS'])
    assert.ok(result.errors.some(x=>x.startsWith(code)),code);
});
