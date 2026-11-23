#!/usr/bin/env node
/** BUKLOD Genesis local-only, NO-EXPO native APK gate.
 * READ ONLY: no downloads, Gradle invocation, publishing, backend calls or cloud services.
 * This intentionally fails on today's Expo-only source until real native migration is done.
 */
import {existsSync, readFileSync, statSync, realpathSync, createReadStream} from 'node:fs';
import {resolve, relative, isAbsolute, join, sep} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const here = fileURLToPath(import.meta.url);
export const PROJECT_ROOT = resolve(here, '../..');
export const NATIVE_APPLICATION_ID = 'org.mzbministry.buklod.genesis.nativeapp';
export const MIN_APK_BYTES = 800_000_000;
const FORBIDDEN_BACKENDS = new Set(['yhanxndaqbmuzbdqlblu','oppswibwjrruxkrpiwej','cjtehbfspgimyhifnjon']);
export const FEATURES = Object.freeze([
 'registration-auth','home-navigation','cluster-scopes','wall-comments-media','connect-ptt-calls',
 'profile-character-ranks','admin-access','admob-lifecycle','notifications','bible-offline',
 'gif-keyboard-send','native-splash','arena-godot-gameplay','kingdom-39-games',
 'world-community-house','character-13-progression','server-reward-authority',
 'offline-recovery','android-lifecycle','media-audio-focus',
]);
const ROLES = Object.freeze({'godot-pack':1,'character-rig':13,'world-scene':39,'audio-approved':70,'splash-art':1});
const read = p => {try {return readFileSync(p,'utf8');} catch {return '';}};
const json = p => {try {return JSON.parse(readFileSync(p,'utf8'));} catch {return null;}};
const inside = (root, p) => {
 const r=relative(root,p);
 return Boolean(r) && r!=='..' && !r.startsWith('..'+sep) && !isAbsolute(r);
};
const validSha = value => /^[0-9a-f]{64}$/.test(value || '');
const commandExists = (cmd, args=['--version']) => {
 try {const r=spawnSync(cmd,args,{encoding:'utf8',timeout:5000,stdio:'pipe'}); return !r.error && r.status===0;} catch{return false;}
};
async function shaFile(p) {
 const h=createHash('sha256');
 for await(const chunk of createReadStream(p,{highWaterMark:1024*1024}))h.update(chunk);
 return h.digest('hex');
}
export async function auditLocalNative(root=PROJECT_ROOT,{env=process.env,checkTools=false,apk=null}={}) {
 const errors=[]; const details={appId:NATIVE_APPLICATION_ID,sourceReady:false,binaryReady:false,assetBytes:0,featureCount:FEATURES.length};
 const fail = x => errors.push(x);
 const nativeRoot=resolve(root,'native-genesis');
 const gradlePath=join(nativeRoot,'android/app/build.gradle.kts');
 const gradlePathGroovy=join(nativeRoot,'android/app/build.gradle');
 const gradle=read(existsSync(gradlePath)?gradlePath:gradlePathGroovy);
 const manifest=read(join(nativeRoot,'android/app/src/main/AndroidManifest.xml'));
 const splash=read(join(nativeRoot,'android/app/src/main/res/values-v31/themes.xml'));
 const localBuild=read(join(nativeRoot,'build-local.sh'));
 const gifPath=join(nativeRoot,'android/app/src/main/java/org/mzbministry/buklod/genesis/nativeapp/GifInputHandler.kt');
 const gifSource=read(gifPath);
 if(!gradle)fail('MISSING_NATIVE_ANDROID_APP: no independent native Android project');
 if(!new RegExp('applicationId\\s*(?:=\\s*)?["\']'+NATIVE_APPLICATION_ID.replaceAll('.','\\.')+'["\']').test(gradle))
   fail('WRONG_NATIVE_APPLICATION_ID: must coexist with production and old staging');
 if(!/org\.godotengine:godot:[0-9]/.test(gradle))fail('MISSING_GODOT_ANDROID_ENGINE: no bundled Godot Android runtime');
 if(!manifest.includes('<manifest')||!manifest.includes('android:exported="false"'))
   fail('ANDROID_COMPONENT_ISOLATION_NOT_PROVED: non-exported Godot Activity required');
 if(!splash.includes('windowSplashScreenAnimatedIcon'))fail('MISSING_ANDROID_12_NATIVE_SPLASH');
 if(!/OnCommitContentListener|onCommitContent/.test(gifSource) || !/image\/gif/.test(gifSource) ||
    !/releasePermission/.test(gifSource))fail('GIF_IME_CONTENT_RECEIPT_NOT_IMPLEMENTED');
 if(!/gradlew/.test(localBuild)||!/(?:godot|GODOT)/.test(localBuild))fail('NO_NATIVE_LOCAL_BUILD_ENTRYPOINT');
 const noCloud=/\b(?:eas\s+build|expo\s+prebuild|expo\s+run|vercel\s+deploy)\b/i;
 const forbidden=/\b(?:expo(?:-router|-modules|-updates|-splash-screen)?|expo\.modules)\b/i;
 for(const [path,value] of [['Gradle',gradle],['AndroidManifest',manifest],['native build',localBuild],['GIF input',gifSource]]) {
   if(forbidden.test(value)||noCloud.test(value))fail('EXPO_OR_CLOUD_DEPENDENCY_IN_NATIVE_SOURCE: '+path);
 }
 const url=env.GENESIS_NATIVE_STAGING_SUPABASE_URL||'';
 const match=/^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/.exec(url);
 if(!match || FORBIDDEN_BACKENDS.has(match[1]))fail('BACKEND_NOT_ISOLATED: separate non-MAIN Supabase project required');
 const key=env.GENESIS_NATIVE_STAGING_SUPABASE_PUBLISHABLE_KEY||'';
 if(!/^sb_publishable_[a-zA-Z0-9_-]{12,}$/.test(key))fail('MISSING_STAGING_PUBLISHABLE_KEY: never embed service role');
 for(const value of [gradle,manifest,localBuild,gifSource]) {
   if(/(?:service_role|sb_secret_)/i.test(value))fail('PRIVILEGED_KEY_REFERENCE_IN_NATIVE_SOURCE');
 }
 const parity=json(join(nativeRoot,'parity.json'));
 if(!parity||parity.schemaVersion!==1||!Array.isArray(parity.features))fail('MISSING_FULL_APP_PARITY_MATRIX');
 else {
  const ids=new Set();
  for(const feature of parity.features){
   if(!feature || ids.has(feature.id)){fail('DUPLICATE_PARITY_FEATURE');continue;}
   ids.add(feature.id);
  }
  for(const id of FEATURES){
   const f=parity.features.find(x=>x.id===id);
   if(!f || f.implemented!==true || f.verified!==true || typeof f.evidencePath!=='string'){
    fail('UNVERIFIED_APP_FEATURE: '+id);continue;
   }
   const evidence=resolve(nativeRoot,f.evidencePath);
   if(!inside(nativeRoot,evidence) || !existsSync(evidence) || !statSync(evidence).isFile() ||
      statSync(evidence).size<100)fail('INVALID_PARITY_EVIDENCE: '+id);
  }
 }
 const assets=json(join(nativeRoot,'approved-assets.json'));
 if(!assets||assets.schemaVersion!==1||!Array.isArray(assets.assets))fail('MISSING_APPROVED_NATIVE_ASSET_MANIFEST');
 else {
  const counts=Object.fromEntries(Object.keys(ROLES).map(role=>[role,0]));
  const visited=new Set();
  const assetsRoot=resolve(nativeRoot,'assets');
  for(const a of assets.assets){
   if(!a || typeof a.path!=='string'|| !Object.hasOwn(ROLES,a.role) || visited.has(a.path)){
    fail('INVALID_OR_DUPLICATE_ASSET_ENTRY');continue;
   }
   visited.add(a.path);
   const p=resolve(assetsRoot,a.path);
   if(!inside(assetsRoot,p)||!validSha(a.sha256) || !a.rightsEvidence ||
      typeof a.rightsEvidence!=='string'){
    fail('UNSAFE_OR_UNLICENSED_ASSET: '+a.path);continue;
   }
   try{
    const real=realpathSync(p);
    if(!inside(assetsRoot,real))throw Error('asset escapes approved folder');
    const s=statSync(real);
    if(!s.isFile() || s.size<1024)throw Error('empty / placeholder asset');
    if(await shaFile(real)!==a.sha256)throw Error('SHA-256 mismatch');
    counts[a.role]++;details.assetBytes+=s.size;
   }catch(e){fail('ASSET_MISSING_OR_TAMPERED: '+a.path+' ('+e.message+')');}
  }
  for(const [role,count] of Object.entries(ROLES))if(counts[role]<count)
   fail('INSUFFICIENT_NATIVE_GAME_ASSETS: '+role+' '+counts[role]+'/'+count);
  details.validAssetsByRole=counts;
 }
 if(checkTools){
  if(!commandExists('java'))fail('LOCAL_JAVA_MISSING');
  if(!commandExists('godot',['--version'])&&!commandExists('godot4',['--version']))fail('LOCAL_GODOT_MISSING');
  if(!env.ANDROID_HOME && !env.ANDROID_SDK_ROOT)fail('ANDROID_SDK_NOT_CONFIGURED');
  if(!existsSync(join(nativeRoot,'android/gradlew')))fail('GRADLE_WRAPPER_MISSING');
 }
 details.sourceReady=errors.length===0;
 if(apk){
  let s;try{s=statSync(resolve(apk));if(!s.isFile())throw Error('not a file');}
  catch{fail('APK_MISSING');}
  if(s && s.size<MIN_APK_BYTES)fail('APK_UNDER_800MB: authentic bytes only, never pad');
  if(s && s.size>=MIN_APK_BYTES){
   details.apkBytes=s.size;
   // A large file alone proves NOTHING. Require Android tooling to check package, signature and embedded Godot.
   const aapt=spawnSync('aapt',['dump','badging',resolve(apk)],{encoding:'utf8',timeout:10000});
   if(aapt.error||aapt.status!==0 || !new RegExp("package: name='"+NATIVE_APPLICATION_ID.replaceAll('.','\\.')+"'").test(aapt.stdout||''))
    fail('APK_IDENTITY_UNVERIFIED');
   const signer=spawnSync('apksigner',['verify','--print-certs',resolve(apk)],{encoding:'utf8',timeout:10000});
   if(signer.error||signer.status!==0)fail('APK_SIGNATURE_UNVERIFIED');
   const expected=(env.GENESIS_NATIVE_SIGNING_CERT_SHA256||'').replaceAll(':','').toLowerCase();
   const reported=(signer.stdout||'').match(/certificate SHA-256 digest:\s*([a-fA-F0-9:]+)/i)?.[1]?.replaceAll(':','').toLowerCase();
   if(!validSha(expected)||reported!==expected)fail('APK_SIGNING_FINGERPRINT_MISMATCH');
   const listing=spawnSync('unzip',['-Z','-1',resolve(apk)],{encoding:'utf8',timeout:10000,maxBuffer:16*1024*1024});
   if(listing.error||listing.status!==0)fail('APK_ARCHIVE_INVALID');
   else {
    const names=(listing.stdout||'').split(/\r?\n/);
    for(const p of ['assets/godot/empire-arena.pck','lib/arm64-v8a/libgodot_android.so'])
     if(!names.includes(p))fail('GODOT_ENGINE_OR_PACK_MISSING_IN_APK: '+p);
   }
  }
  details.binaryReady=errors.length===0;
 }
 return {ok:errors.length===0,errors,details};
}
if(process.argv[1]&&resolve(process.argv[1])===here){
 const args=process.argv.slice(2);
 const val=flag=>args.find(x=>x.startsWith(flag+'='))?.slice(flag.length+1);
 const root=val('--root')||PROJECT_ROOT;
 const result=await auditLocalNative(root,{checkTools:true,apk:val('--apk')||null});
 console.log(JSON.stringify(result,null,2));
 if(!result.ok)process.exitCode=1;
}
