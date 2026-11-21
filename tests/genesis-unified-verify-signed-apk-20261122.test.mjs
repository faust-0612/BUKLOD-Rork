import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  inspectUnifiedSignedApk, STAGING_PACKAGE, STAGING_VERSION, STAGING_RUNTIME,
  STAGING_CHANNEL, EXPECTED_ABIS, EXISTING_EAS_STAGING_CERT_SHA256
} from '../scripts/genesis-unified-verify-signed-apk.mjs';

const signer='a'.repeat(64);
const badging="package: name='"+STAGING_PACKAGE+"' versionCode='84' versionName='"+STAGING_VERSION+"'";
const signature='Verified using v2 scheme (APK Signature Scheme v2): true\n'
  +'Signer #1 certificate SHA-256 digest: '+signer;
const apk=['assets/index.android.bundle','assets/godot/empire-arena.zip',
  ...EXPECTED_ABIS.map(abi=>'lib/'+abi+'/libgodot_android.so')].join('\n');
const pack=[
  'project.godot','scenes/Arena.tscn','scenes/WorldPreview.tscn',
  'scripts/arena_simulation.gd','scripts/arena_root.gd','scripts/arena_hud.gd',
  'scripts/world_preview.gd','data/catalog.json','art/art_manifest.json',
  'world-art/kingdom.webp','world-art/community.webp','world-art/house.webp',
  'world-audio/navigation.wav','world-audio/build_start.wav',
  'world-audio/build_complete.wav','world-audio/claim.wav',
  ...Array.from({length:52},(_,i)=>'art/fullbody/f'+i+'.png'),
  ...Array.from({length:13},(_,i)=>'art/sprite/s'+i+'.png'),
  ...Array.from({length:3},(_,i)=>'art/scene/m'+i+'.png'),
].join('\n');
const inspect=(b=badging,s=signature,a=apk,p=pack,cert=signer)=>
  inspectUnifiedSignedApk(b,s,a,p,cert);

test('verified signed unified Godot APK requires exactly one existing EAS staging signer',()=>{
  const result=inspect();
  assert.equal(result.package,STAGING_PACKAGE);
  assert.equal(result.versionName,STAGING_VERSION);
  assert.equal(result.certificateSha256,signer);
  assert.deepEqual(result.worlds,['arena','kingdom','community','house']);
  assert.throws(()=>inspect(badging,signature,apk,pack,''),/pinned existing EAS/);
  assert.throws(()=>inspect(badging,signature,apk,pack,'b'.repeat(64)),/Signing certificate differs/);
  assert.throws(()=>inspect(badging,signature+'\nSigner #2 certificate SHA-256 digest: '+'b'.repeat(64)),/conflicting signers/);
  assert.throws(()=>inspect(badging,signature.replace('true','false')),/v2\/v3 signing/);
});

test('real binary must preserve native package, app version, all ABIs, Godot and embedded JS',()=>{
  assert.throws(()=>inspect(badging.replace('.staging','')),/not BUKLOD staging/);
  assert.throws(()=>inspect(badging.replace(STAGING_VERSION,'2.0.2')),/version differs/);
  assert.throws(()=>inspect(badging,signature,apk.replace('assets/index.android.bundle','')),/JS bundle missing/);
  assert.throws(()=>inspect(badging,signature,apk.replace('assets/godot/empire-arena.zip','')),/pack missing/);
  assert.throws(()=>inspect(badging,signature,apk.replace('lib/x86/libgodot_android.so','')),/ABI x86/);
  assert.throws(()=>inspect(badging,signature,apk.replace('lib/arm64-v8a/libgodot_android.so','lib/arm64-v8a/libother.so')),/Godot engine missing/);
});

test('native release includes all four worlds and complete 68 approved art assets',()=>{
  assert.throws(()=>inspect(badging,signature,apk,pack.replace('world-art/house.webp','')),/world-art\/house\.webp/);
  assert.throws(()=>inspect(badging,signature,apk,pack.replace('world-audio/claim.wav','')),/world-audio\/claim\.wav/);
  assert.throws(()=>inspect(badging,signature,apk,pack.replace('art/fullbody/f0.png','')),/68 approved/);
});

test('no signed APK acceptance on receipt-only evidence, production credentials or unpinned signer',()=>{
  const script=readFileSync(new URL('../scripts/genesis-unified-verify-signed-apk.mjs',import.meta.url),'utf8');
  assert.match(script,/STAGING_SIGNING_CERT_SHA256/);
  assert.match(script,/buildRuntime.*STAGING_RUNTIME/);
  assert.match(script,/buildSourceSha.*sha/);
  assert.match(script,/sha256/);
  assert.match(script,/embeddedPackSha256/);
  assert.match(script,/downloadSignedApk/);
  assert.match(script,/apkSignature|apksigner/);
  assert.match(script,/deviceQA:'PENDING'/);
  assert.match(script,/otaPublished:false/);
  assert.equal(STAGING_RUNTIME,'2.0.3-genesis-unified-godot');
  assert.equal(STAGING_CHANNEL,'season2-genesis-unified-preview');
});

test('verified November 20 EAS staging certificate is pinned and no bypassing signed RC gate',()=>{
  assert.equal(EXISTING_EAS_STAGING_CERT_SHA256,
    'b2470c2dfa865dd670293ee283cbb55463faf486af4e33a514c3e843289e41a9');
  const wf=readFileSync(new URL('../.github/workflows/genesis-unified-staging-signed-rc-20261122.yml',import.meta.url),'utf8');
  assert.match(wf,/genesis-unified-signed-stage-preflight\.mjs --signed/);
  assert.match(wf,/genesis-unified-verify-signed-apk\.mjs/);
  assert.match(wf,/STAGING_SIGNING_CERT_SHA256/);
  assert.match(wf,/buildSourceSha:b\.gitCommitHash/);
  assert.match(wf,/buildRuntime:b\.runtime\.version/);
  assert.match(wf,/path: buklod-genesis-unified-verified-apk\.json/);
  assert.doesNotMatch(wf,/eas-cli[^\n]*update --/);
  assert.doesNotMatch(wf,/eas-cli[^\n]*submit --/);
  const hold=JSON.parse(readFileSync(new URL('../.buklod/releases/genesis-unified-signed-rc-hold-20261122.json',import.meta.url),'utf8'));
  assert.equal(hold.signedReleaseReady,false,'No release without fully verified Godot scenes and isolated backend');
  assert.equal(hold.productionUntouched,true);
});
