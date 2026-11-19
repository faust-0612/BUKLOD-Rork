#!/usr/bin/env node
/** BUKLOD Genesis: read-only distinction between source, native binary and Android proof.
 * This cannot publish, verify an external attestation itself, or change production.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const MODULES=['@rive-app/react-native','@shopify/react-native-skia','react-native-reanimated','lottie-react-native','expo-audio','expo-updates'];
const SHA40=/^[0-9a-f]{40}$/i;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const read=(root,p)=>fs.readFileSync(path.join(root,p),'utf8');
const json=(root,p)=>JSON.parse(read(root,p));
function configFor(root,environment,preview){
  const keys=['APP_VARIANT','EXPO_PUBLIC_APP_ENV','EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW','BUKLOD_APP_TARGET'];
  const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  try{
    Object.assign(process.env,{APP_VARIANT:environment,EXPO_PUBLIC_APP_ENV:environment,
      EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW:preview?'true':'false',BUKLOD_APP_TARGET:'main'});
    const resolved=require.resolve(path.join(root,'app.config.js'));
    delete require.cache[resolved];
    const result=require(resolved)({config:{}});
    delete require.cache[resolved];
    return result;
  }finally{
    for(const k of keys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}
  }
}
function registryEmpty(source,name){
  return new RegExp('const\\s+'+name+'\\s*:[^\\n]*?=\\s*Object\\.freeze\\(\\s*\\{\\s*\\}\\s*\\)\\s*;').test(source);
}
export function inspectSource(root=ROOT){
  const blockers=[];
  const pkg=json(root,'package.json'),eas=json(root,'eas.json');
  const registry=read(root,'src/features/season2/genesis/genesisAssetRegistry.ts');
  const intro=read(root,'src/components/BuklodMainBrandIntro.tsx');
  const rive=read(root,'src/features/season2/genesis/GenesisRiveCharacter.native.tsx');
  const prod=configFor(root,'production',true);
  const preview=configFor(root,'staging',true);
  const normal=configFor(root,'staging',false);
  const missing=MODULES.filter(x=>!pkg.dependencies?.[x]);
  if(missing.length)blockers.push('Missing source-native modules: '+missing.join(', '));
  const identityOk=prod.android?.package==='org.mzbministry.buklod'&&
    prod.runtimeVersion==='1.3.2'&&
    preview.android?.package==='org.mzbministry.buklod.staging'&&
    preview.runtimeVersion==='2.0.0-genesis-preview'&&normal.runtimeVersion==='1.3.2'&&
    eas.build?.['season2-genesis-preview']?.channel==='season2-genesis-preview'&&
    eas.build?.['season2-genesis-preview']?.env?.EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW==='true'&&
    eas.build?.production?.channel==='production';
  if(!identityOk)blockers.push('Production vs Genesis staging native package/runtime/channel mismatch');
  const rigs=registryEmpty(registry,'APPROVED_RIGS')?'EMPTY':'UNVERIFIED_NONEMPTY';
  const audio=registryEmpty(registry,'APPROVED_AUDIO')?'EMPTY':'UNVERIFIED_NONEMPTY';
  if(rigs==='EMPTY')blockers.push('No approved original 13-character Rive rigs; static artwork fallback only');
  if(audio==='EMPTY')blockers.push('No mastered original Season 2 cinematic audio in approved registry');
  const fallback=rive.includes('fallback??null')&&rive.includes('getGenesisApprovedRig');
  const isolated=intro.includes('isGenesisPreviewBuild()')&&intro.includes('genesisPreview ?');
  if(!fallback)blockers.push('Source rig failure fallback contract missing');
  if(!isolated)blockers.push('Non-production preview gating cannot be confirmed');
  return {
    product:'BUKLOD MAIN',season:'Genesis: Let There Be Light',
    sourceLibrariesDeclared:missing.length===0,nativeModulesInInstalledAPK:'UNVERIFIED',
    production:{package:prod.android?.package,runtime:prod.runtimeVersion},
    preview:{package:preview.android?.package,runtime:preview.runtimeVersion,
      channel:eas.build?.['season2-genesis-preview']?.channel},
    distinctPreviewRuntime:identityOk,previewIsolated:isolated,
    characterRigs:rigs,masteredSeason2Audio:audio,rigFallback:fallback,
    compiledAPK:'UNVERIFIED',deviceGraphicsAudioAdsNavigation:'UNVERIFIED',
    sourceBlockers:blockers,
  };
}
export function inspectRelease(source,receipt){
  const blockers=[...source.sourceBlockers];
  if(!receipt||typeof receipt!=='object'){
    blockers.push('No exact-source native Android build + device acceptance receipt');
  }else{
    if(receipt.sourceSha!==receipt.apkSourceSha||!SHA40.test(receipt.sourceSha||''))
      blockers.push('Exact installed Android source SHA missing/mismatched');
    if(!UUID.test(receipt.easBuildId||'')||
      receipt.androidPackage!==source.preview.package||
      receipt.runtimeVersion!==source.preview.runtime||
      receipt.channel!==source.preview.channel)
      blockers.push('Native build id/package/runtime/channel mismatch');
    if(receipt.nativeModulesVerified!==true||receipt.deviceSceneVerified!==true||
      receipt.deviceAudioVerified!==true||receipt.adMobFirstViewVerified!==true||
      receipt.navigationVerified!==true||receipt.productionUnchangedVerified!==true)
      blockers.push('Real device visual/audio/ads/navigation or production non-mutation evidence missing');
    if(typeof receipt.evidenceUrl!=='string'||!/^https:\/\//.test(receipt.evidenceUrl))
      blockers.push('Externally retrievable acceptance evidence link missing');
  }
  return {eligibleForIndependentReleaseReview:blockers.length===0,blockers,
    note:'Receipt metadata is an assertion to independently inspect, NOT proof of live APK/OTA.'};
}
function cli(){
  const args=process.argv.slice(2);
  const mode=args.find(x=>x.startsWith('--mode='))?.slice(7)||'source';
  if(!['source','release'].includes(mode))throw Error('Use --mode=source or --mode=release');
  const source=inspectSource();
  const evidence=args.find(x=>x.startsWith('--evidence='));
  const receipt=evidence?JSON.parse(fs.readFileSync(evidence.slice(11),'utf8')):null;
  const review=inspectRelease(source,receipt);
  console.log(JSON.stringify({mode,...source,releaseReview:review},null,2));
  if(!source.distinctPreviewRuntime||!source.previewIsolated||!source.sourceLibrariesDeclared||!source.rigFallback)
    process.exitCode=1;
  if(mode==='release'&&!review.eligibleForIndependentReleaseReview)process.exitCode=1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{cli();}catch(e){console.error('NATIVE REALITY GATE ERROR:',e?.message||e);process.exitCode=1;}
}
