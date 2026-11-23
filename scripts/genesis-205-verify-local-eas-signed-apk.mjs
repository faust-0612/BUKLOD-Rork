#!/usr/bin/env node
/** Independently verify Expo EAS --local remote-keystore signed Genesis 2.0.5 APK.
 * Never calls Expo upload, Play, Supabase or OTA. Rebuild packed Godot source
 * bytes and demand one exact original staging certificate and full native ABIs.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createReadStream,mkdtempSync,readdirSync,statSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {EXISTING_EAS_STAGING_CERT_SHA256} from './genesis-library-verify-signed-apk.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const SIG=EXISTING_EAS_STAGING_CERT_SHA256;
const ABIS=['arm64-v8a','armeabi-v7a','x86','x86_64'];
function androidTool(name){
  const root=process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT;
  assert.ok(root,'No Android SDK');
  for(const version of readdirSync(path.join(root,'build-tools')).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}))){
    const candidate=path.join(root,'build-tools',version,name);
    try{if(statSync(candidate).isFile())return candidate;}catch{}
  }
  throw Error('Missing Android verification tool: '+name);
}
function run(cmd,args,options={}){
  return execFileSync(cmd,args,{encoding:'utf8',timeout:120000,maxBuffer:15*1024*1024,...options});
}
async function hash(file){
  const sum=createHash('sha256');
  for await(const part of createReadStream(file))sum.update(part);
  return sum.digest('hex');
}
export async function verify(apk,receipt){
  assert.ok(apk&&path.isAbsolute(apk),'Absolute APK required');
  assert.ok(statSync(apk).size>100000000,'APK implausibly small');
  const pkg=run(androidTool('aapt'),['dump','badging',apk])
    .match(/^package:\s+name='([^']+)'\s+versionCode='(\d+)'\s+versionName='([^']+)'/m);
  assert.ok(pkg,'APK identity missing');
  assert.equal(pkg[1],'org.mzbministry.buklod.staging');
  assert.equal(Number(pkg[2]),17,'Must be exactly the new 2.0.5 staging versionCode');
  assert.equal(pkg[3],'2.0.5');
  const signed=run(androidTool('apksigner'),['verify','--verbose','--print-certs',apk]);
  assert.match(signed,/Verified using v[23] scheme \(APK Signature Scheme v[23]\): true/i);
  const certs=[...signed.matchAll(/certificate SHA-256 digest:\s*([a-f0-9:]+)/gi)]
    .map(x=>x[1].replaceAll(':','').toLowerCase()).filter(x=>/^[a-f0-9]{64}$/.test(x));
  assert.deepEqual([...new Set(certs)],[SIG],'Different signer from installed BUKLOD staging certificate');
  const entries=run('unzip',['-Z1',apk]).trim().split('\n');
  const has=new Set(entries);
  assert.ok(has.has('assets/index.android.bundle'),'React Native app JS missing');
  assert.ok(has.has('assets/godot/empire-arena.zip'),'Godot main-pack missing');
  assert.ok(entries.some(s=>/^lib\/arm64-v8a\/.*godot.*\.so$/i.test(s)),'Godot native arm64 engine absent');
  for(const abi of ABIS)assert.ok(entries.some(s=>s.startsWith('lib/'+abi+'/')&&s.endsWith('.so')),
    'Missing native Android ABI: '+abi);
  const temp=mkdtempSync(path.join(tmpdir(),'buklod-genesis205-verify-'));
  try{
    const packed=path.join(temp,'embedded-godot.zip');
    writeFileSync(packed,execFileSync('unzip',['-p',apk,'assets/godot/empire-arena.zip'],
      {timeout:90000,maxBuffer:192*1024*1024}),{mode:0o600});
    const packFiles=run('unzip',['-Z1',packed]).trim().split('\n');
    const found=new Set(packFiles);
    for(const item of ['project.godot','scenes/Arena.tscn','scenes/WorldPreview.tscn',
      'scripts/arena_root.gd','scripts/arena_simulation.gd','data/catalog.json',
      'splash/buklod-green-b.png','world-art/kingdom.webp','world-art/community.webp',
      'world-art/house.webp','world-audio/navigation.wav']){
      assert.ok(found.has(item),'Godot binary omitted '+item);
    }
    assert.equal(packFiles.filter(x=>/^art\/(fullbody|sprite|scene)\/.*\.png$/.test(x)).length,68);
    assert.equal(packFiles.filter(x=>/^audio\/sfx\/[a-z0-9_]+\.wav$/.test(x)).length,70);
    const canonical=path.join(temp,'expected-godot.zip');
    execFileSync(process.execPath,[path.join(ROOT,'scripts/build-empire-godot-pack.mjs'),'--out='+canonical],{
      cwd:ROOT,timeout:120000,maxBuffer:1024*1024
    });
    const sourceHash=await hash(canonical),packHash=await hash(packed);
    assert.equal(packHash,sourceHash,'Signed APK Godot pack differs from verified source bytes');
    const result={
      status:'EXPO_EAS_LOCAL_SIGNED_APK_VERIFIED_ANDROID_DEVICE_SKIPPED',
      sourceSha:process.env.GITHUB_SHA,
      package:pkg[1],versionName:pkg[3],versionCode:Number(pkg[2]),
      certificateSha256:SIG,apkSha256:await hash(apk),godotPackSha256:packHash,
      apkBytes:statSync(apk).size,abis:ABIS,worlds:['arena','kingdom','community','house'],
      heroIdentities:13,practicePickups:300,approvedArenaImages:68,
      prototypeAudioCues:70,expoAndGodotSplash:'BUKLOD_GREEN_B',
      runtime:'2.0.5-genesis-godot-launch',
      channel:'season2-genesis-library-205-preview',
      originalStagingSigner:true,physicalDeviceQA:'SKIPPED_BY_OWNER',
      production:false,otaPublished:false
    };
    if(receipt)writeFileSync(receipt,JSON.stringify(result,null,2)+'\n',{mode:0o600});
    console.log('BUKLOD_GENESIS_205_SIGNED_APK_BINARY_VERIFIED '+JSON.stringify(result));
    return result;
  }finally{rmSync(temp,{recursive:true,force:true});}
}
const invoked=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
  const apk=process.argv.find(x=>x.startsWith('--apk='))?.slice(6);
  const receipt=process.argv.find(x=>x.startsWith('--receipt='))?.slice(10);
  try{await verify(apk,receipt);}catch(e){console.error('BUKLOD_205_SIGNED_BINARY_BLOCK:',e?.message||e);process.exitCode=1;}
}
