#!/usr/bin/env node
/** Binary acceptance for an EAS --local, remotely KEYSIGNED BUKLOD MAIN APK.
 * Never uploads credentials, publishes OTA, calls Supabase or accepts debug signing.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createReadStream, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectUnifiedSignedApk, EXISTING_EAS_STAGING_CERT_SHA256, STAGING_RUNTIME, STAGING_CHANNEL} from './genesis-library-verify-signed-apk.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const APK_PACK='assets/godot/empire-arena.zip';
function androidTool(name){
  const dir=process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT;
  assert.ok(dir,'Android SDK not available');
  const root=path.join(dir,'build-tools');
  const versions=readdirSync(root).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));
  for(const v of versions){
    const file=path.join(root,v,name);
    try {if(statSync(file).isFile())return file;}catch{}
  }
  throw new Error('Android SDK tool missing: '+name);
}
function run(command,args,options={}){
 return execFileSync(command,args,{encoding:'utf8',timeout:90000,...options});
}
async function hashFile(file){
 const h=createHash('sha256');
 for await(const chunk of createReadStream(file))h.update(chunk);
 return h.digest('hex');
}
export async function verifyLocalSignedStaging(apk,output){
 assert.ok(apk && path.isAbsolute(apk),'Absolute local APK path required');
 const badging=run(androidTool('aapt'),['dump','badging',apk]);
 const signing=run(androidTool('apksigner'),['verify','--verbose','--print-certs',apk]);
 const listing=run('unzip',['-Z','-1',apk]);
 const work=mkdtempSync(path.join(tmpdir(),'buklod-godot-signed-audit-'));
 try{
  const pack=path.join(work,'packed-godot.zip');
  writeFileSync(pack,execFileSync('unzip',['-p',apk,APK_PACK],{
   timeout:90000,maxBuffer:192*1024*1024
  }),{mode:0o600});
  const packEntries=run('unzip',['-Z','-1',pack]);
  const actual=inspectUnifiedSignedApk(badging,signing,listing,packEntries,EXISTING_EAS_STAGING_CERT_SHA256);
  assert.ok(actual.versionCode>=16,'New signed staging versionCode must replace prior 14/15 builds');
  const regenerated=path.join(work,'source-godot.zip');
  execFileSync(process.execPath,[path.join(ROOT,'scripts/build-empire-godot-pack.mjs'),'--out='+regenerated],{
    cwd:ROOT,timeout:120000,stdio:'pipe',maxBuffer:3*1024*1024
  });
  const canonical=await hashFile(regenerated),embedded=await hashFile(pack);
  assert.equal(embedded,canonical,'Local EAS APK Godot archive differs from audited Git SHA');
  const result={
    verification:'LOCAL_EAS_SIGNED_STAGING_APK_VERIFIED_DEVICE_PENDING',
    sourceSha:process.env.GITHUB_SHA,package:actual.package,
    versionName:actual.versionName,versionCode:actual.versionCode,
    signerSha256:actual.certificateSha256,
    runtime:STAGING_RUNTIME,channel:STAGING_CHANNEL,
    buildProfile:'season2-genesis-library-staging',
    apkSha256:await hashFile(apk),
    embeddedGodotSha256:embedded,abis:actual.abis,
    worlds:actual.worlds,arenaSfxCues:actual.arenaSfxCues,
    backend:'EXISTING_MAIN_AUTHORIZED_SUPABASE',
    deviceQA:'NOT_PERFORMED',adMobAndNavigationQA:'NOT_PERFORMED',
    egressQA:'NOT_PERFORMED',rankedSettlementEnabled:false,
    productionChanged:false,otaPublished:false,
    installability:'SIGNATURE_AND_VERSION_CODE_COMPATIBLE_DEVICE_INSTALL_NOT_TESTED',
  };
  assert.match(result.apkSha256,/^[a-f0-9]{64}$/);
  if(output)writeFileSync(output,JSON.stringify(result,null,2)+'\n',{mode:0o600});
  console.log('BUKLOD_LOCAL_EAS_SIGNED_APK_PASS',JSON.stringify(result));
  return result;
 }finally{rmSync(work,{recursive:true,force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const apk=process.argv.find(x=>x.startsWith('--apk='))?.slice(6);
 const output=process.argv.find(x=>x.startsWith('--output='))?.slice(9);
 try{await verifyLocalSignedStaging(apk,output);}catch(e){
   console.error('LOCAL_SIGNED_STAGING_APK_BLOCK:',e?.message||e);
   process.exitCode=1;
 }
}
