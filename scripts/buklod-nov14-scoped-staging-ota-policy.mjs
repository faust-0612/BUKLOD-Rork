#!/usr/bin/env node
// Owner-scoped Android staging QA OTA. This does not promote to production or
// override the historical 18-item full-consolidation gate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import {
  APK_SOURCE, BUILD_ID, PROJECT, verifyBuild, verifyChannels, verifyUpdate, manifest
} from './navigation-v2-owner-staging-policy.mjs';

const BASE='9c9661b888eca979c7cd114c42ae97a333830d37';
const STAGING_PACKAGE='org.mzbministry.buklod.staging';
const SOURCE_FILES=['src/app/(auth)/register.tsx','src/app/(tabs)/buklod.tsx','src/app/(tabs)/me.tsx','src/components/BuklodProfileActivityCards.tsx','src/components/BuklodProfileMembershipNav.tsx'];
const OGG_BLOCK=`// Expo defaults omit Ogg Vorbis in Metro; licensed offline Kingdom music must
// be bundled as real assets instead of resolved as a JS module. Android audio
// decoder supports Vorbis via its native media stack; no native dependency.
if (!config.resolver.assetExts.includes('ogg')) {
  config.resolver.assetExts.push('ogg');
}
`;
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');

export function verifyReleaseScope(release){
  assert.equal(release.baseSha,BASE);
  assert.equal(release.stagingQaPublicationAuthorized,true);
  assert.equal(release.readyForOta,false,'Must not claim completed owner visual acceptance');
  assert.equal(release.otaPublished,false,'Repository source cannot claim publication');
  assert.equal(release.target.channel,'staging-user');
  assert.equal(release.target.package,STAGING_PACKAGE);
  assert.equal(release.target.runtime,'1.3.2');
  assert.equal(release.target.environment,'preview');
  for(const word of ['Health Center','SALIKSIK']){
    assert.ok(release.excluded.some(x=>x.includes(word)),word+' must remain excluded');
  }
}
export function verifyMetroChange(before,after){
  assert.ok(after.includes(OGG_BLOCK),'Required original offline Kingdom music extension missing');
  assert.equal(after.replace(OGG_BLOCK,''),before,'Unexpected Metro packager change vs signed APK');
}
export function verifySource(source){
  assert.match(source,/^[a-f0-9]{40}$/);
  assert.equal(git('rev-parse','HEAD'),source);
  assert.equal(git('merge-base',APK_SOURCE,source),APK_SOURCE);
  assert.equal(git('merge-base',BASE,source),BASE);
  const forbidden=git('diff','--name-only',APK_SOURCE,source,'--',
    'package.json','package-lock.json','app.config.js','eas.json','babel.config.js',
    'android/','ios/','plugins/','supabase/','src/providers/AuthProvider.tsx',
    'src/providers/AdsProvider.tsx');
  assert.equal(forbidden,'','Native/DB/auth/ads ABI or production dependency changed');
  const relevant=git('diff','--name-only',BASE,source,'--','src/','assets/','app/','android/',
    'ios/','plugins/','supabase/','package.json','package-lock.json',
    'app.config.js','eas.json','metro.config.js').split('\n').filter(Boolean).sort();
  assert.deepEqual(relevant,SOURCE_FILES,'Only the five reviewed OTA-compatible JS runtime source deltas are allowed');
  const before=git('show',APK_SOURCE+':metro.config.js');
  const after=fs.readFileSync('metro.config.js','utf8').trim();
  verifyMetroChange(before,after);
  assert.equal(git('status','--porcelain','--untracked-files=no'),'','Tracked source dirty');
  verifyReleaseScope(read('release/nov14-staging-conso-excluding-health-saliksik.json'));
}
async function main(){
  const [mode,source,dir]=process.argv.slice(2);
  assert.ok(dir?.startsWith('/tmp/'),'Evidence must stay under /tmp');
  verifySource(source);
  if(mode==='verify-source'){
    console.log('VERIFIED exact scoped staging Android JS/native compatibility; no OTA published');
  }else if(mode==='preflight'){
    verifyBuild(read(dir+'/build.json'));
    const branch=verifyChannels(read(dir+'/staging-channel.json'),read(dir+'/production-channel.json'));
    const live=await manifest('production');
    assert.equal(live.extra?.expoClient?.android?.package,'org.mzbministry.buklod');
    const previous=await manifest('staging-user');
    assert.equal(previous.extra?.expoClient?.android?.package,STAGING_PACKAGE);
    write(dir+'/preflight.json',{source,branch,buildId:BUILD_ID,apkSource:APK_SOURCE,
      originalProductionUpdateId:live.id,previousStagingUpdateId:previous.id,
      scope:'staging-only-qa-no-hc-saliksik',publicationStatus:'pending',
      androidPackage:STAGING_PACKAGE,runtimeVersion:'1.3.2'});
  }else if(mode==='postpublish'){
    const pre=read(dir+'/preflight.json');
    assert.equal(pre.source,source);
    const u=verifyUpdate(read(dir+'/update-view.json'),source,pre.branch.name);
    const current=await manifest('staging-user');
    assert.equal(current.id.toLowerCase(),u.id.toLowerCase());
    assert.equal(current.extra?.expoClient?.android?.package,STAGING_PACKAGE);
    assert.equal(current.extra?.expoClient?.extra?.appEnvironment,'staging');
    const live=await manifest('production');
    assert.equal(live.id,pre.originalProductionUpdateId,'Production changed during staging QA release');
    verifyChannels(read(dir+'/staging-channel-after.json'),read(dir+'/production-channel-after.json'));
    write(dir+'/verification.json',{
      status:'VERIFIED SERVER-SIDE SCOPED ANDROID STAGING OTA',
      sourceSha:source,updateId:u.id,groupId:u.group,channel:'staging-user',branch:u.branch,
      environment:'preview',package:STAGING_PACKAGE,runtimeVersion:u.runtimeVersion,
      platform:u.platform,createdAt:u.createdAt,buildId:BUILD_ID,
      productionUpdateIdUnchanged:live.id,healthCenterEnabled:false,saliksikEnabled:false,
      physicalDeviceAcceptance:'WAIVED/NOT TESTED',fullConsolidationAcceptance:false,
      githubRunUrl:'https://github.com/'+process.env.GITHUB_REPOSITORY+'/actions/runs/'+process.env.GITHUB_RUN_ID
    });
  }else throw Error('Unknown staging policy mode');
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
  main().catch(e=>{console.error('BUKLOD SCOPED STAGING HOLD:',e.message);process.exitCode=1;});
}
