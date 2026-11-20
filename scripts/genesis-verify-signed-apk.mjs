#!/usr/bin/env node
/**
 * Verify the actual signed EAS Android APK, not just an EAS build receipt.
 * Intentionally does not install, upload, distribute, sign or publish any APK.
 * Keeps source/runtime evidence distinct from unperformed device acceptance.
 */
import assert from 'node:assert/strict';
import { createReadStream, createWriteStream, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EXPECTED_PACKAGE = 'org.mzbministry.buklod.staging';
const EXPECTED_ABIS = ['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'];
const MAX_APK_BYTES = 1536 * 1024 * 1024; // Bounded inspection only; NOT an app store size approval.
const HEX64 = /^[0-9a-f]{64}$/i;
const SHA40 = /^[0-9a-f]{40}$/i;

export function inspectSignedApk(badging, signature, listing) {
  const pkg = badging.match(/^package:\s+name='([^']+)'\s+versionCode='(\d+)'\s+versionName='([^']+)'/m);
  assert.ok(pkg, 'APK package/version metadata unreadable');
  assert.equal(pkg[1], EXPECTED_PACKAGE, 'APK is not the isolated Genesis staging package');
  assert.ok(Number(pkg[2]) > 0, 'Invalid APK native versionCode');
  assert.equal(pkg[3], '2.0.0', 'APK must have Genesis native app version 2.0.0');
  // SDK build-tools 37 may label the same signer by minSdk/maxSdk interval
  // rather than "Signer #1". Extract ONLY certificate SHA-256 digests from
  // the already-successful apksigner verify --print-certs result, and reject
  // conflicting/missing signer identities (including signing rotations).
  const signers = [...signature.matchAll(/certificate SHA-256 digest:\\s*([a-f0-9:]+)/gi)]
    .map(match => match[1].replace(/:/g, '').toLowerCase())
    .filter(digest => /^[a-f0-9]{64}$/.test(digest));
  const uniqueSigners = [...new Set(signers)];
  assert.equal(uniqueSigners.length, 1, 'APK signing identity is missing or ambiguous');
  assert.ok(/Verified using v2 scheme \(APK Signature Scheme v2\): true|Verified using v3 scheme \(APK Signature Scheme v3\): true/i.test(signature),
    'Verified v2/v3 APK signature required');
  const entries = new Set(listing.split(/\r?\n/));
  assert.ok(entries.has('assets/index.android.bundle'), 'Staging APK missing embedded Android JS bundle');
  for (const abi of EXPECTED_ABIS) {
    assert.ok([...entries].some(n => n.startsWith('lib/' + abi + '/') && n.endsWith('.so')),
      'Universal staging APK missing native ABI ' + abi);
  }
  return {
    actualPackage: pkg[1],
    actualVersionCode: Number(pkg[2]),
    actualVersionName:pkg[3],
    signingCertificateSha256: uniqueSigners[0],
    verifiedAbis: EXPECTED_ABIS,
    signatureVerified: true,
  };
}
async function sha256File(file) {
  const hash = createHash('sha256');
  for await (const data of createReadStream(file)) hash.update(data);
  return hash.digest('hex');
}
function buildTool(sdk, name) {
  const root = path.join(sdk, 'build-tools');
  const versions = readdirSync(root).sort((a,b)=>b.localeCompare(a, undefined, {numeric:true}));
  const resolved = versions.map(v=>path.join(root,v,name)).find(p=>{
    try { return statSync(p).isFile(); } catch { return false; }
  });
  assert.ok(resolved, 'Android SDK build-tools missing ' + name);
  return resolved;
}
async function downloadReceiptApk(receipt, dest) {
  const start = new URL(receipt.artifactUrl);
  assert.equal(start.protocol, 'https:', 'EAS APK URL must use HTTPS');
  assert.ok(['expo.dev','exp.host'].includes(start.hostname) ||
    start.hostname.endsWith('.expo.dev') || start.hostname.endsWith('.exp.host'),
    'Unexpected EAS artifact host');
  const response = await fetch(start, { signal: AbortSignal.timeout(300000) });
  assert.ok(response.ok && response.body, 'Signed APK download failed: ' + response.status);
  assert.equal(new URL(response.url).protocol, 'https:', 'Artifact redirected to non-HTTPS');
  const declared = Number(response.headers.get('content-length') || '0');
  console.log('Original signed EAS staging APK declared bytes:',declared || 'unknown');
  assert.ok(declared <= MAX_APK_BYTES, `APK exceeds 1536 MiB verification download cap: ${declared} bytes`);
  let total = 0;
  await pipeline(Readable.fromWeb(response.body), new Transform({
    transform(chunk, _enc, cb) {
      total += chunk.length;
      cb(total > MAX_APK_BYTES ? new Error('APK download over size cap') : null, chunk);
    }
  }), createWriteStream(dest, { flags: 'wx', mode: 0o600 }));
  assert.ok(total > 100000, 'APK unexpectedly small');
  console.log('Actual signed staging APK downloaded bytes:',total);
}
async function main() {
  const arg = process.argv.find(a=>a.startsWith('--receipt='));
  assert.ok(arg, 'Provide --receipt=PATH');
  const receiptPath=path.resolve(arg.slice(10));
  const receipt=JSON.parse(readFileSync(receiptPath,'utf8'));
  assert.ok(SHA40.test(receipt.sourceSha||''), 'Exact source commit SHA absent');
  assert.equal(receipt.sourceSha.toLowerCase(),String(process.env.GENESIS_APK_SOURCE_SHA||process.env.GITHUB_SHA||'').toLowerCase(),
    'APK receipt SHA differs from checked out native source');
  assert.equal(receipt.expectedPackage,EXPECTED_PACKAGE);
  assert.equal(receipt.expectedRuntime,'2.0.0-genesis-preview');
  assert.equal(receipt.channel,'season2-genesis-preview');
  assert.equal(String(receipt.status).toLowerCase(),'finished');
  const apk='/tmp/buklod-genesis-verified-stage.apk';
  await downloadReceiptApk(receipt,apk);
  const androidHome=process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT;
  assert.ok(androidHome, 'SDK not available to inspect the Android binary');
  const aapt=buildTool(androidHome,'aapt');
  const signer=buildTool(androidHome,'apksigner');
  const badging=execFileSync(aapt,['dump','badging',apk],{encoding:'utf8',timeout:120000,maxBuffer:10*1024*1024});
  const signature=execFileSync(signer,['verify','--verbose','--print-certs',apk],{encoding:'utf8',timeout:120000,maxBuffer:3*1024*1024});
  const listing=execFileSync('unzip',['-Z1',apk],{encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});
  const facts=inspectSignedApk(badging,signature,listing);
  const sha=await sha256File(apk);
  assert.ok(HEX64.test(sha));
  const verified={
    ...receipt, ...facts, apkSha256:sha, apkBytes:statSync(apk).size,
    binaryVerification:'SIGNED_UNIVERSAL_APK_BINARY_VERIFIED_DEVICE_PENDING',
    nativeDeviceQA:'PENDING',
    otaPublished:false,
    statement:'Signature/package/ABI verified. Runtime, installation, AdMob, GIF, codec, PTT and UI still require physical device acceptance.',
  };
  writeFileSync(receiptPath,JSON.stringify(verified,null,2)+'\n');
  console.log('Signed Genesis staging APK verified:',JSON.stringify({
    sourceSha:receipt.sourceSha,apkSha256:sha,apkBytes:verified.apkBytes,
    package:facts.actualPackage,versionCode:facts.actualVersionCode,ABIs:facts.verifiedAbis,
    nativeDeviceQA:'PENDING',OTA:false
  }));
}
const invoked=process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked)main().catch(e=>{console.error('BLOCK APK BINARY ACCEPTANCE:',e.message);process.exitCode=1;});
