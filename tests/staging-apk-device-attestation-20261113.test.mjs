import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  STAGING_PACKAGE, parseAdbDevices, parsePackageDetails, parsePackagePaths,
  parseMeminfoPssKb, parseOptions, inspectNativeAttestation,
} from '../scripts/staging-apk-device-attestation.mjs';

function validReport() {
  return {
    package:STAGING_PACKAGE,
    publisher:{
      buildId:'9c0eb308-9a8e-4f34-a5f4-798ae556b7b0',
      sourceSha:'9f412afd71b74e41995a3a1a63e05e72f78b6e39',
      expectedVersionCode:9,expectedVersionName:'1.3.6',
    },
    localSignedApk:{sha256:'a'.repeat(64)},
    installed:{versionCode:9,versionName:'1.3.6',apkCount:1,baseApkSha256:'a'.repeat(64)}
  };
}

test('ADB device parser rejects offline and unauthorized devices', () => {
  assert.deepEqual(parseAdbDevices('List of devices attached\nABC device product:x model:X6852\nDEF offline\nGHI unauthorized\n'), ['ABC']);
  assert.deepEqual(parseAdbDevices('List of devices attached\n'), []);
});
test('Android package parser extracts concrete version and safe installed APK paths', () => {
  const p=parsePackageDetails('Packages:\n  versionCode=9 minSdk=24 targetSdk=36\n  versionName=1.3.6\n');
  assert.deepEqual(p,{versionCode:9,versionName:'1.3.6'});
  assert.deepEqual(parsePackagePaths('package:/data/app/~~X/org.mzbministry.buklod.staging-A/base.apk\n'), ['/data/app/~~X/org.mzbministry.buklod.staging-A/base.apk']);
  assert.deepEqual(parsePackagePaths('package:/data/app/app/base.apk\npackage:/data/app/app/split_config.apk\n').length,2);
  assert.equal(parseMeminfoPssKb('TOTAL PSS:   987,654       TOTAL RSS: 1234\n'),987654);
});
test('native equality can pass but OTA, installed source and backend proof NEVER pass by inference', () => {
  const state=inspectNativeAttestation(validReport());
  assert.equal(state.nativeBinaryMatchesSignedArtifact,true);
  assert.equal(state.verifiedOtaSourceAndUpdateId,false);
  assert.equal(state.verifiedBackendContract,false);
  assert.equal(state.verifiedManualUx,false);
  assert.equal(state.releaseReady,false);
});
test('wrong version, package, number of splits or missing installed bytes fails closed', () => {
  for (const patch of [
    report=>{report.package='org.mzbministry.buklod';},
    report=>{report.installed.versionCode=8;},
    report=>{report.installed.versionName='1.3.5';},
    report=>{report.installed.apkCount=2;},
    report=>{report.installed.baseApkSha256='b'.repeat(64);},
    report=>{report.publisher.sourceSha='UNKNOWN';},
  ]) {
    const v=validReport();patch(v);
    assert.equal(inspectNativeAttestation(v).nativeBinaryMatchesSignedArtifact,false);
  }
});
test('tool only inspects staging package, never performs installs, production app mutations or raw logs', () => {
  const src=fs.readFileSync(new URL('../scripts/staging-apk-device-attestation.mjs',import.meta.url),'utf8');
  const wrapper=fs.readFileSync(new URL('../scripts/RUN_BUKLOD_STAGING_DEVICE_ATTESTATION.ps1',import.meta.url),'utf8');
  assert.match(src,/org\.mzbministry\.buklod\.staging/);
  assert.doesNotMatch(src,/\['(?:shell',)?'(?:install|uninstall|clear|force-stop|am\s+start)'/);
  assert.match(src,/device:\{ model:/);
  assert.match(src,/serialStored:false/);
  assert.match(wrapper,/staging-apk-device-attestation\.mjs/);
  const o=parseOptions(['--apk=/tmp/staging.apk','--build-id=9c0eb308-9a8e-4f34-a5f4-798ae556b7b0','--source=9f412afd71b74e41995a3a1a63e05e72f78b6e39','--version-code=9','--version-name=1.3.6']);
  assert.equal(o.get('apk'),'/tmp/staging.apk');
  assert.throws(()=>parseOptions(['--apk=/tmp/staging.apk']),/Required argument missing/);
});
