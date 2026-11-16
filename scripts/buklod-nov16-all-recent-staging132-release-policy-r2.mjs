#!/usr/bin/env node
// One-shot verified BUKLOD Android staging OTA, fail closed on production/staging drift.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {verifyBuild,verifyChannels,verifyUpdate,manifest,PROJECT,BUILD_ID} from './navigation-v2-owner-staging-policy.mjs';
const SOURCE='6ec6c5026a50d846b49c9706990f0bc60a6402d3';
const PARENT='3b488fa704b804f05c5a289a7e0775daeabb2404';
const BRANCH='release/nov16-all-recent-staging132-publish-r2';
const STAGE_ID='01a1e0c8-488e-7474-918d-6c1f0a0f5e8d';
const PROD_ID='01a1e10a-f043-7113-9a6c-673e91a58517';
const releasePath='release/nov16-all-recent-staging132-publish-authorization-r2.json';
const scopePath='.buklod/scopes/nov16-all-pending-home-focus-stories-henry-v4.json';
const allowedPaths=[releasePath,'scripts/buklod-nov16-all-recent-staging132-release-policy-r2.mjs','.github/workflows/buklod-nov16-all-recent-staging132-publish-r2.yml'];
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,obj)=>fs.writeFileSync(p,JSON.stringify(obj,null,2)+'\n');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const unquote=v=>{const match=/^"([^"]+)" \([^()]+\)$/.exec(String(v??''));return match?match[1]:String(v??'');};
const expectedMessage=sha=>'BUKLOD_NOV16_ALL_RECENT_STAGE132_'+sha;
const requireLocal=createRequire(import.meta.url);
function source(sha){
 assert.match(sha,/^[a-f0-9]{40}$/);
 assert.equal(process.env.GITHUB_REF,'refs/heads/'+BRANCH);
 assert.equal(git('rev-parse','HEAD'),sha);
 assert.equal(git('rev-parse','HEAD^'),SOURCE,'Release marker must directly follow exact green-check RC source');
 assert.equal(git('merge-base',PARENT,SOURCE),PARENT);
 const releaseChanges=git('diff','--name-only',SOURCE,sha).split('\n').filter(Boolean);
 assert.deepEqual(releaseChanges.slice().sort(),allowedPaths.slice().sort(),'Unexpected post-QA source mutation');
 const scope=read(scopePath);
 const srcChanges=git('diff','--name-only',PARENT,SOURCE).split('\n').filter(Boolean);
 assert.deepEqual(srcChanges.filter(p=>!scope.allowedPaths.includes(p)),[],'Missing QA for source changes');
 for(const name of ['src/app/(tabs)/hub.tsx','src/app/(tabs)/me.tsx','src/app/profile/buklod-family.tsx','src/components/BuklodTodayCard.tsx','src/features/childrenStories/inStoryDialogue.ts','src/lib/buklodHenryTranslation.ts','src/components/BuklodExclusiveScopeCommunity.tsx','src/app/(tabs)/buklod.tsx','src/components/ProfileAvatar.tsx','src/components/connect/ConnectQuickContacts.tsx','src/app/post/[id].tsx'])
    assert.ok(srcChanges.includes(name),'Missing consolidated Nov16 fix: '+name);
 assert.ok(!srcChanges.some(p=>/^(?:app\.config\.js|eas\.json|package(?:-lock)?\.json|android\/|ios\/|plugins\/)/.test(p)),'Native/config changes not OTA safe');
 assert.deepEqual(srcChanges.filter(p=>p.startsWith('supabase/')),[],'No new SQL/backend changes in this OTA');
 const r=read(releasePath);
 assert.equal(r.stagingReady,true);
 assert.equal(r.publicationPolicy.allowOtaPublish,true);
 assert.equal(r.publicationPolicy.allowProductionPromotion,false);
 assert.equal(r.productionOtaPublished,false);
 assert.equal(r.target.platform,'android');
 assert.equal(r.target.channel,'staging-user');
 assert.equal(r.target.environment,'preview');
 assert.equal(r.target.packageId,'org.mzbministry.buklod.staging');
 assert.equal(r.target.runtimeVersion,'1.3.2');
 const config=requireLocal('../app.config.js')({config:{}}),eas=read('eas.json');
 assert.equal(config.android.package,'org.mzbministry.buklod.staging');
 assert.equal(config.runtimeVersion,'1.3.2');
 assert.equal(config.extra.eas.projectId,PROJECT);
 assert.equal(eas.build['staging-user'].channel,'staging-user');
 assert.equal(eas.build['staging-user'].environment,'preview');
 assert.equal(eas.build.production.channel,'production');
 assert.equal(git('status','--porcelain','--untracked-files=no'),'');
}
export async function preflight(sha,dir){
 source(sha);
 verifyBuild(read(dir+'/build.json'));
 const branch=verifyChannels(read(dir+'/stage-channel.json'),read(dir+'/prod-channel.json'));
 const stage=await manifest('staging-user'),prod=await manifest('production');
 assert.equal(stage.extra?.expoClient?.android?.package,'org.mzbministry.buklod.staging');
 assert.equal(prod.extra?.expoClient?.android?.package,'org.mzbministry.buklod');
 assert.equal(prod.id,PROD_ID,'Production advanced after source audit');
 const updates=read(dir+'/stage-updates.json'),list=updates.currentPage??updates;
 assert.ok(Array.isArray(list)&&list[0]?.group,'No current staging update group');
 const current=list[0],msg=unquote(current.message);
 const already=msg===expectedMessage(sha);
 if(already){
   assert.equal(String(stage.id).toLowerCase(),String(current.id).toLowerCase(),'Already published update/manifest mismatch');
 }else{
   assert.equal(stage.id,STAGE_ID,'Staging advanced: do not overwrite');
   assert.match(String(current.group),/^[0-9a-f-]{36}$/i,'Missing current staging group');
   assert.equal(msg,'BUKLOD_NOV16_COMPLETE_CONSO_STAGE132_5c5e528a89b293efaf7874fd9512640e054b3e59','Unexpected staging source/message: do not overwrite');
   assert.equal(current.runtimeVersion,'1.3.2');
 }
 write(dir+'/preflight.json',{sha,branch:branch.name,previousStageId:stage.id,previousStageGroup:current.group,
  previousProdId:prod.id,alreadyPublished:already,signedBuildId:BUILD_ID,projectId:PROJECT,
  platform:'android',runtimeVersion:'1.3.2',package:'org.mzbministry.buklod.staging',
  physicalAcceptance:'SKIPPED BY OWNER'});
}
export async function recheck(sha,dir){
 source(sha);
 const prior=read(dir+'/preflight.json');
 assert.equal(prior.sha,sha);
 const stage=await manifest('staging-user'),prod=await manifest('production');
 assert.equal(stage.id,prior.previousStageId,'Staging manifest moved: STOP');
 assert.equal(prod.id,prior.previousProdId,'Production manifest moved: STOP');
 const updates=read(dir+'/stage-updates-recheck.json'),list=updates.currentPage??updates;
 assert.ok(Array.isArray(list)&&list[0]?.group===prior.previousStageGroup,'Staging group moved: STOP');
}
export async function postpublish(sha,dir){
 source(sha);
 const prior=read(dir+'/preflight.json');
 assert.equal(prior.sha,sha);
 const update=verifyUpdate(read(dir+'/update-view.json'),sha,prior.branch);
 let stage;
 for(let n=0;n<5;n++){
   stage=await manifest('staging-user');
   if(String(stage.id).toLowerCase()===String(update.id).toLowerCase())break;
   if(n<4)await new Promise(done=>setTimeout(done,2500));
 }
 assert.equal(String(stage.id).toLowerCase(),String(update.id).toLowerCase(),'Latest staging manifest is not published update');
 assert.equal(stage.extra?.expoClient?.android?.package,'org.mzbministry.buklod.staging');
 assert.equal(stage.extra?.expoClient?.extra?.appEnvironment,'staging');
 const prod=await manifest('production');
 assert.equal(prod.id,prior.previousProdId,'PRODUCTION CHANGE DETECTED');
 verifyChannels(read(dir+'/stage-channel-after.json'),read(dir+'/prod-channel-after.json'));
 write(dir+'/verification.json',{status:'VERIFIED SERVER-SIDE STAGING ANDROID OTA',
  sourceSha:SOURCE,releaseSha:sha,channel:'staging-user',runtimeVersion:update.runtimeVersion,platform:'android',
  package:'org.mzbministry.buklod.staging',projectId:PROJECT,signedBuildId:BUILD_ID,
  updateId:update.id,groupId:update.group,branch:update.branch,productionUnchangedId:prod.id,
  physicalDeviceVerification:'SKIPPED BY OWNER',
  runUrl:'https://github.com/'+process.env.GITHUB_REPOSITORY+'/actions/runs/'+process.env.GITHUB_RUN_ID});
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 (async()=>{
   const [phase,sha,dir]=process.argv.slice(2);
   if(phase==='source'){source(sha);return;}
   assert.ok(dir?.startsWith('/tmp/buklod-nov16-complete-conso-staging132'));
   if(phase==='preflight')await preflight(sha,dir);
   else if(phase==='recheck')await recheck(sha,dir);
   else if(phase==='postpublish')await postpublish(sha,dir);
   else throw Error('Unknown release phase');
 })().catch(err=>{console.error('BUKLOD_EXACT_STAGING_RELEASE_BLOCK:',err.message);process.exitCode=1;});
}
