import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const mirror = require('../scripts/staging-production-mirror.cjs');

const root = path.resolve(import.meta.dirname, '..');
const config = fs.readFileSync(path.join(root, 'app.config.js'), 'utf8');
const originalEas = fs.readFileSync(path.join(root, 'eas.json'), 'utf8');

function withEnv(values, callback) {
  const original = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  try {
    Object.assign(process.env, values);
    return callback();
  } finally {
    for (const [key,value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

function inTemp(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'buklod-mirror-'));
  try {
    for (const file of ['app.config.js', 'eas.json', 'google-services.production.json']) {
      fs.copyFileSync(path.join(root, file), path.join(dir, file));
    }
    return fn(dir);
  } finally { fs.rmSync(dir, { recursive:true, force:true }); }
}

test('staging mirror derives config from canonical production source without altering any other build profile', () => {
  const patched = mirror.mirrorConfiguration(config, originalEas);
  const before = JSON.parse(originalEas);
  const after = JSON.parse(patched.easJson);
  assert.deepEqual(after.build.production, before.build.production);
  assert.deepEqual(after.build.preview, before.build.preview);
  assert.deepEqual(after.submit, before.submit);
  assert.equal(after.build['staging-user'].channel, 'staging-user');
  assert.equal(after.build['staging-user'].environment, 'production');
  assert.equal(after.build['staging-user'].env.APP_VARIANT, 'staging');
  assert.equal(after.build['staging-user'].env.EXPO_PUBLIC_APP_ENV, 'production');
  assert.equal(after.build['staging-user'].env.EXPO_PUBLIC_ADS_ALLOW_LIVE_IDS, 'false');
  assert.equal(after.build['staging-user'].autoIncrement, undefined);
  assert.match(patched.appConfig, /BUKLOD_STAGING_LIVE_MIRROR/);
  assert.doesNotMatch(config, /versionCode: isStaging \? \(process\.env\.BUKLOD_STAGING_LIVE_MIRROR/);
});

test('mirror preparation is idempotent and retains production logo, splash and runtime identity', () => inTemp(dir => {
  mirror.prepare(dir);
  mirror.prepare(dir);
  const verified = mirror.verify(dir);
  assert.deepEqual(verified, {package: 'org.mzbministry.buklod.staging', runtime: '1.3.2', channel:'staging-user'});
  const transformed = fs.readFileSync(path.join(dir, 'app.config.js'), 'utf8');
  assert.ok(transformed.includes("'./assets/release/app-icon.png'"));
  assert.ok(transformed.includes("'./assets/release/splash-icon.png'"));
  assert.ok(transformed.includes("'./google-services.production.json'"));
}));

test('production-connected staging refuses backend changes and privileged keys', () => {
  const valid = {
    APP_VARIANT: 'staging',
    EXPO_PUBLIC_APP_ENV: 'production',
    BUKLOD_STAGING_LIVE_MIRROR: '1',
    EXPO_PUBLIC_SUPABASE_URL: 'https://yhanxndaqbmuzbdqlblu.supabase.co',
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_public_value',
    EAS_PROJECT_ID: mirror.PROJECT_ID || '23dad7d0-389a-406e-8dec-08965dab85d8',
  };
  withEnv(valid, () => assert.doesNotThrow(mirror.checkBackend));
  withEnv({...valid, EXPO_PUBLIC_SUPABASE_URL:'https://different.supabase.co'}, () =>
    assert.throws(mirror.checkBackend));
  withEnv({...valid, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_secret_not_safe'}, () =>
    assert.throws(mirror.checkBackend));
  withEnv({...valid, APP_VARIANT:'production'}, () =>
    assert.throws(mirror.checkBackend));
});

test('OTA channel guard blocks release to an unrelated EAS branch', () => inTemp(dir => {
  const file=path.join(dir,'channel.txt');
  fs.writeFileSync(file, 'Channel:\nName        staging-user\nBranch           staging-user\nRuntime Version  1.3.2\n');
  assert.doesNotThrow(() => mirror.verifyChannel(file));
  fs.writeFileSync(file, 'Channel:\nName        staging-user\nBranch           production\nRuntime Version  1.3.2\n');
  assert.throws(() => mirror.verifyChannel(file));
}));

test('APK receipt validation requires successful Android EAS artifact', () => inTemp(dir => {
  const file=path.join(dir,'result.json');
  fs.writeFileSync(file, JSON.stringify({id:'c9b532b4-3907-47fb-9d7f-5234defe60b5', status:'FINISHED', artifacts:{buildUrl:'https://expo.dev/artifacts/eas/abc.apk'}}));
  assert.equal(mirror.verifyBuild(file).id, 'c9b532b4-3907-47fb-9d7f-5234defe60b5');
  fs.writeFileSync(file, JSON.stringify({id:'c9b532b4-3907-47fb-9d7f-5234defe60b5', status:'FAILED', artifacts:{}}));
  assert.throws(() => mirror.verifyBuild(file));
}));

test('V28 AAB provenance gate rejects unverified baseline before any staging build', () => {
  const unverified = JSON.parse(fs.readFileSync(path.join(root, 'release/approved-android-baseline.json'), 'utf8'));
  assert.equal(unverified.approvedApkSha256, '');
  assert.throws(() => mirror.assertApprovedV28Record(unverified), /approved|AAB|versionName|versionCode|Missing/);
  assert.throws(() => mirror.assertApprovedV28BinaryBaseline(root), /approved|AAB|versionName|versionCode|Missing/);
});

test('V28 provenance record requires binary digest, build ID, source and native diff evidence', () => {
  const complete = {
    packageName: 'org.mzbministry.buklod',
    runtimeVersion: '1.3.2',
    versionName: '1.3.4',
    versionCode: 28,
    buildSystem: 'local-gradle',
    approvedAabSha256: 'e735885e20f222b03cd91184f7d0fb5281523ec846667b9fb935d50e9ff7c5c2',
    binaryInspectionEvidence: 'Test fixture: not verified from production AAB',
    approvedAabSourceSha: 'b'.repeat(40),
    reconciliationEvidence: 'fixture only: not an approved production AAB',
  };
  assert.doesNotThrow(() => mirror.assertApprovedV28Record(complete));
  assert.throws(() => mirror.assertApprovedV28Record({...complete, runtimeVersion:'1.3.4'}), /runtime/);
  assert.throws(() => mirror.assertApprovedV28Record({...complete, buildSystem:'eas'}), /local Gradle/);
  assert.throws(() => mirror.assertApprovedV28Record({...complete, approvedAabSha256:''}), /SHA-256/);
  assert.throws(() => mirror.assertApprovedV28Record({...complete, approvedAabSourceSha:''}), /source commit/);
  assert.throws(() => mirror.assertApprovedV28Record({...complete, reconciliationEvidence:''}), /parity evidence/);
});
