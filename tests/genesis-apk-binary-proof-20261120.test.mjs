import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectSignedApk} from '../scripts/genesis-verify-signed-apk.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sig='Verifies\nVerified using v2 scheme (APK Signature Scheme v2): true\nSigner #1 certificate SHA-256 digest: '+('a'.repeat(64));
const badging="package: name='org.mzbministry.buklod.staging' versionCode='123' versionName='2.0.0'\n";
const entries=['arm64-v8a','armeabi-v7a','x86','x86_64'].map(x=>'lib/'+x+'/libapp.so').concat('assets/index.android.bundle').join('\n');
test('actual staged EAS APK proof validates correct package, v2/v3 signer and every Android ABI',()=>{
  const out=inspectSignedApk(badging,sig,entries);
  assert.equal(out.actualPackage,'org.mzbministry.buklod.staging');
  assert.equal(out.actualVersionCode,123);
  assert.equal(out.actualVersionName,'2.0.0');
  assert.equal(out.verifiedAbis.length,4);
  assert.equal(out.signingCertificateSha256,'a'.repeat(64));
  assert.throws(()=>inspectSignedApk(badging.replace('.staging',''),sig,entries),/isolated Genesis staging package/);
  assert.throws(()=>inspectSignedApk(badging.replace('2.0.0','1.3.6'),sig,entries),/Genesis native app version/);
  assert.throws(()=>inspectSignedApk(badging,sig,entries.replace('assets/index.android.bundle','')),/embedded Android JS bundle/);
  assert.throws(()=>inspectSignedApk(badging,sig,entries.replace('lib/x86_64/libapp.so','')),/missing native ABI x86_64/);
  assert.throws(()=>inspectSignedApk(badging,sig.replace('true','false'),entries),/signature required/);
  assert.throws(()=>inspectSignedApk(badging,sig.replace('Signer #1','Signer #2')+'\n'+sig,entries),/missing or ambiguous/);
});
test('signed staging workflow downloads and verifies actual artifact with no automatic release',()=>{
  const wf=read('.github/workflows/genesis-season2-staging-release-apk-20261120.yml');
  assert.match(wf,/node scripts\/genesis-verify-signed-apk\.mjs --receipt=/);
  assert.match(wf,/actions\/upload-artifact@v4/);
  assert.match(wf,/EAS APK receipt exists; NOT an installed-device or OTA verification|Staging APK EAS receipt exists; NOT an installed-device or OTA verification/);
  assert.doesNotMatch(wf,/eas-cli[^\n]*update --/);
  assert.doesNotMatch(wf,/--profile production/);
  const script=read('scripts/genesis-verify-signed-apk.mjs');
  assert.match(script,/sourceSha\.toLowerCase\(\)/);
  assert.match(script,/apksigner/);
  assert.match(script,/APK download over size cap/);
  assert.match(script,/nativeDeviceQA:'PENDING'/);
  assert.match(script,/otaPublished:false/);
});

test('EAS uppercase FINISHED status is normalized before APK verification',()=>{
 const source=read('scripts/genesis-verify-signed-apk.mjs');
 assert.match(source,/String\(receipt\.status\)\.toLowerCase\(\)/);
 assert.match(source,/GENESIS_APK_SOURCE_SHA\|\|process\.env\.GITHUB_SHA/);
});
