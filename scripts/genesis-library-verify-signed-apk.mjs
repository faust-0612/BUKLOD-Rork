#!/usr/bin/env node
/**
 * Exact-source BUKLOD Genesis unified EAS APK verification.
 * This is inspection ONLY: no EAS build, upload, signing, installation or OTA.
 * Fail closed on a debug/wrongly signed APK, missing Godot worlds or ABI.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createReadStream, createWriteStream, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Readable, Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';

export const STAGING_PACKAGE = 'org.mzbministry.buklod.staging';
export const STAGING_VERSION = '2.0.4';
export const STAGING_RUNTIME = '2.0.4-genesis-library-godot';
// SHA-256 from original EAS staging signed-APK verified receipt (2026-11-20),
// GitHub Actions artifact 14598805245. Public certificate fingerprint, not a secret.
export const EXISTING_EAS_STAGING_CERT_SHA256 = 'b2470c2dfa865dd670293ee283cbb55463faf486af4e33a514c3e843289e41a9';
export const STAGING_CHANNEL = 'season2-genesis-library-preview';
export const EXPECTED_ABIS = ['arm64-v8a','armeabi-v7a','x86','x86_64'];
const SHA256 = /^[a-f0-9]{64}$/i;
const SHA40 = /^[a-f0-9]{40}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_APK_BYTES = 1536 * 1024 * 1024;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACK_ASSET = 'assets/godot/empire-arena.zip';
const AUDIO_CUES = 70;
const REQUIRED_PACK = [
  'project.godot','scenes/Arena.tscn','scenes/WorldPreview.tscn',
  'scripts/arena_simulation.gd','scripts/arena_root.gd','scripts/arena_hud.gd',
  'scripts/world_preview.gd','data/catalog.json','art/art_manifest.json',
  'data/audio_manifest.json','scripts/arena_audio.gd',
  'scripts/arena_library_actors.gd','scripts/arena_library_skills.gd',
  'world-art/kingdom.webp','world-art/community.webp','world-art/house.webp',
  'world-audio/navigation.wav','world-audio/build_start.wav',
  'world-audio/build_complete.wav','world-audio/claim.wav',
];

export function inspectUnifiedSignedApk(badging, signature, apkListing, packListing, expectedSigner) {
  assert.match(expectedSigner || '', SHA256, 'Missing pinned existing EAS staging signing certificate');
  const pkg = badging.match(/^package:\s+name='([^']+)'\s+versionCode='(\d+)'\s+versionName='([^']+)'/m);
  assert.ok(pkg, 'APK package metadata missing');
  assert.equal(pkg[1], STAGING_PACKAGE, 'APK is not BUKLOD staging');
  assert.ok(Number(pkg[2]) > 0, 'Android versionCode must be positive');
  assert.equal(pkg[3], STAGING_VERSION, 'APK version differs from unified Godot build');
  assert.ok(/Verified using v[23] scheme \(APK Signature Scheme v[23]\): true/i.test(signature),
    'APK v2/v3 signing scheme not verified');
  const signers = [...signature.matchAll(/certificate SHA-256 digest:\s*([a-f0-9:]+)/gi)]
    .map(x => x[1].replaceAll(':','').toLowerCase())
    .filter(x => SHA256.test(x));
  const uniqueSigners = [...new Set(signers)];
  assert.equal(uniqueSigners.length, 1, 'APK has missing or conflicting signers');
  assert.equal(uniqueSigners[0], expectedSigner.toLowerCase(),
    'Signing certificate differs from currently installed EAS staging: update would fail');
  const apkEntries = new Set(apkListing.trim().split(/\r?\n/));
  assert.ok(apkEntries.has('assets/index.android.bundle'), 'React Native Android JS bundle missing');
  assert.ok(apkEntries.has(PACK_ASSET), 'Unified Godot pack missing from actual APK');
  for (const abi of EXPECTED_ABIS) {
    assert.ok([...apkEntries].some(x => x.startsWith('lib/'+abi+'/') && /\.so$/.test(x)),
      'Universal APK missing ABI '+abi);
  }
  assert.ok([...apkEntries].some(x => /^lib\/arm64-v8a\/.*godot.*\.so$/i.test(x)),
    'Native arm64 Godot engine missing from actual APK');
  const packed = new Set(packListing.trim().split(/\r?\n/));
  for (const entry of REQUIRED_PACK)
    assert.ok(packed.has(entry), 'Godot native archive missing '+entry);
  assert.equal([...packed].filter(x => /^art\/(fullbody|sprite|scene)\//.test(x)).length, 68,
    'Native pack must carry 68 approved hero/map images');
  assert.equal([...packed].filter(x => /^audio\/sfx\/[a-z0-9_]+\.wav$/.test(x)).length,AUDIO_CUES,
    'Native pack must carry exactly 70 named Arena WAVs');
  return {
    package:pkg[1],versionName:pkg[3],versionCode:Number(pkg[2]),
    certificateSha256:uniqueSigners[0],abis:EXPECTED_ABIS,
    nativeEngine:'Godot 4.7.2',worlds:['arena','kingdom','community','house'],arenaSfxCues:70,
  };
}

function resolveBuildTool(root, name) {
  assert.ok(root, 'Android SDK unavailable');
  const versions = readdirSync(path.join(root,'build-tools')).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));
  for (const version of versions) {
    const file=path.join(root,'build-tools',version,name);
    try { if(statSync(file).isFile()) return file; } catch {}
  }
  throw Error('Android SDK build-tool missing: '+name);
}

async function downloadSignedApk(uri, output) {
  const initial = new URL(uri);
  assert.equal(initial.protocol, 'https:', 'HTTPS EAS APK download required');
  assert.ok(['expo.dev','exp.host'].includes(initial.hostname) ||
    initial.hostname.endsWith('.expo.dev') || initial.hostname.endsWith('.exp.host'),
    'Signed artifact URL must come from Expo');
  const response=await fetch(initial, {signal:AbortSignal.timeout(300000)});
  assert.ok(response.ok && response.body, 'Signed EAS APK unavailable: HTTP '+response.status);
  assert.equal(new URL(response.url).protocol,'https:','Insecure signed artifact redirect');
  const declared=Number(response.headers.get('content-length')||0);
  assert.ok(Number.isFinite(declared) && declared<=MAX_APK_BYTES,'APK exceeds bounded download size');
  let count=0;
  await pipeline(Readable.fromWeb(response.body),new Transform({
    transform(chunk,_encoding,done) {
      count+=chunk.length;
      done(count>MAX_APK_BYTES?new Error('Actual APK exceeds 1536 MiB cap'):null,chunk);
    }
  }),createWriteStream(output,{flags:'wx',mode:0o600}));
  assert.ok(count>100000,'APK is unexpectedly small');
  return count;
}

async function hashFile(file) {
  const h=createHash('sha256');
  for await (const chunk of createReadStream(file)) h.update(chunk);
  return h.digest('hex');
}

export async function verifySignedReceipt(receipt, opts={}) {
  const sha=String(process.env.GITHUB_SHA||'');
  assert.match(sha,SHA40,'Missing checked-out exact source SHA');
  assert.equal(receipt.sourceSha,sha,'EAS build is not from the checked-out source');
  assert.match(receipt.buildId,UUID,'No real EAS build ID');
  assert.equal(String(receipt.status).toLowerCase(),'finished','EAS APK build is not finished');
  assert.equal(receipt.package,STAGING_PACKAGE);
  assert.equal(receipt.runtime,STAGING_RUNTIME);
  assert.equal(receipt.channel,STAGING_CHANNEL);
  assert.equal(receipt.buildProfile,'season2-genesis-library-staging');
  assert.equal(receipt.buildRuntime,STAGING_RUNTIME,'Expo build runtime metadata mismatch');
  assert.equal(receipt.buildSourceSha,sha,'Expo build source metadata mismatch');
  const expectedSigner=String(process.env.STAGING_SIGNING_CERT_SHA256||EXISTING_EAS_STAGING_CERT_SHA256).toLowerCase();
  assert.equal(expectedSigner,EXISTING_EAS_STAGING_CERT_SHA256,
    'Existing staging signer override differs from independently verified original EAS certificate');
  const work=mkdtempSync(path.join(tmpdir(),'buklod-verified-eas-'));
  try {
    const apk=path.join(work,'signed-staging.apk');
    const bytes=await downloadSignedApk(receipt.artifactUrl,apk);
    const sdk=process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT;
    const aapt=resolveBuildTool(sdk,'aapt');
    const apksigner=resolveBuildTool(sdk,'apksigner');
    const badging=execFileSync(aapt,['dump','badging',apk],{encoding:'utf8',timeout:90000});
    const signature=execFileSync(apksigner,['verify','--verbose','--print-certs',apk],{encoding:'utf8',timeout:90000});
    const listing=execFileSync('unzip',['-Z','-1',apk],{encoding:'utf8',timeout:90000});
    const packagedZip=execFileSync('unzip',['-p',apk,PACK_ASSET],{timeout:90000,maxBuffer:192*1024*1024});
    const extracted=path.join(work,'empire-arena.zip');
    writeFileSync(extracted,packagedZip,{mode:0o600});
    const packListing=execFileSync('unzip',['-Z','-1',extracted],{encoding:'utf8',timeout:90000});
    const facts=inspectUnifiedSignedApk(badging,signature,listing,packListing,expectedSigner);
    // Regenerate exactly the canonical pack from this same Git SHA. Every packed byte
    // must match the audited source, not merely the expected asset filenames.
    const expected=path.join(work,'canonical-source.zip');
    execFileSync(process.execPath,[path.join(ROOT,'scripts/build-empire-godot-pack.mjs'),'--out='+expected],
      {cwd:ROOT,timeout:120000,stdio:'pipe',maxBuffer:1024*1024});
    const embeddedHash=await hashFile(extracted);
    assert.equal(embeddedHash,await hashFile(expected),'Signed APK Godot archive differs from exact source');
    const output={
      verification:'EXACT_EAS_SIGNED_UNIFIED_GODOT_APK_VERIFIED_DEVICE_PENDING',
      sourceSha:sha,buildId:receipt.buildId,...facts,
      runtime:STAGING_RUNTIME,channel:STAGING_CHANNEL,buildProfile:receipt.buildProfile,
      signedApkSha256:await hashFile(apk),apkBytes:bytes,embeddedPackSha256:embeddedHash,
      deviceQA:'PENDING',adsAndCallsQA:'PENDING',otaPublished:false,productionChanged:false
    };
    if(opts.output)writeFileSync(opts.output,JSON.stringify(output,null,2)+'\n',{mode:0o600});
    // No EAS download URL in logs; it may contain signed query credentials.
    console.log('Verified signed BUKLOD Genesis staging APK:',JSON.stringify(output));
    return output;
  }finally { rmSync(work,{recursive:true,force:true}); }
}

const invoked=process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
  const inArg=process.argv.find(x=>x.startsWith('--receipt='))?.slice(10);
  const outArg=process.argv.find(x=>x.startsWith('--output='))?.slice(9);
  try{
    assert.ok(inArg&&outArg,'Usage: --receipt=PATH --output=PATH');
    await verifySignedReceipt(JSON.parse(readFileSync(inArg,'utf8')),{output:outArg});
  }catch(err){console.error('BLOCK UNIFIED EAS APK ACCEPTANCE:',err.message);process.exitCode=1;}
}
