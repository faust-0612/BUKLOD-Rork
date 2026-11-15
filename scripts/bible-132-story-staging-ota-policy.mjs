#!/usr/bin/env node
// BUKLOD one-time, exact source, staging Android runtime 1.3.2 ONLY.
// Never changes production; every unrecognized EAS movement fails closed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {verifyBuild,verifyChannels,verifyUpdate,manifest,PROJECT,BUILD_ID} from './navigation-v2-owner-staging-policy.mjs';

export const FROZEN_SOURCE='a9e8e74c80bbbdb4496ef8b836cde896434119ac';
export const VERIFIED_BASE='131c6d294062ce34ff91f91a7090b9bb0d6ce6f2';
export const BRANCH='release/bible-132-dialogue-staging132-once-20261116';
export const PRIOR_STAGE_ID='01a1e0c8-488e-7474-918d-6c1f0a0f5e8d';
export const PRIOR_STAGE_GROUP='4b91eacf-ae98-4e0d-84fe-3c98a680da34';
export const PRIOR_PROD_ID='01a1dff8-7563-790b-a714-22c316f56590';
export const RELEASE_PATHS=[
  '.github/workflows/bible-132-story-staging-ota-20261116.yml',
  '.buklod/scopes/bible-132-dialogue-release-staging-20261116.json',
  'scripts/bible-132-story-staging-ota-policy.mjs',
  'tests/bible-132-story-staging-ota.test.mjs',
];
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const loadRequire=createRequire(import.meta.url);
const msg=sha=>'BUKLOD_BIBLE_132_DIALOGUE_STAGE132_'+sha;
const cleanMessage=v=>{
  const t=String(v??'');
  const quoted=/^"([^"]+)" \([^()]+\)$/.exec(t);
  return quoted?quoted[1]:t;
};
function latest(dir,name){
  const raw=read(dir+'/'+name);
  const list=raw.currentPage??raw;
  assert.ok(Array.isArray(list)&&list.length&&list[0]?.group,'Missing current EAS staging group');
  return list[0];
}
function config(){
  const c=loadRequire('../app.config.js')({config:{}}),e=read('eas.json');
  assert.equal(c.android.package,'org.mzbministry.buklod.staging');
  assert.equal(c.runtimeVersion,'1.3.2');
  assert.equal(c.extra.appEnvironment,'staging');
  assert.equal(c.extra.eas.projectId,PROJECT);
  assert.equal(e.build['staging-user'].channel,'staging-user');
  assert.equal(e.build['staging-user'].environment,'preview');
  assert.equal(e.build.production.channel,'production');
}
export function proveFrozenRelease(sha){
  assert.match(sha,/^[a-f0-9]{40}$/);
  assert.equal(git('rev-parse','HEAD'),sha);
  assert.equal(git('rev-parse','refs/remotes/origin/'+BRANCH),sha,'Release branch changed');
  assert.equal(git('merge-base',FROZEN_SOURCE,sha),FROZEN_SOURCE);
  const changed=git('diff','--name-only',FROZEN_SOURCE,sha).split('\n').filter(Boolean).sort();
  assert.deepEqual(changed,RELEASE_PATHS.slice().sort(),'Post-reviewed app source changed');
  const base=git('merge-base',VERIFIED_BASE,FROZEN_SOURCE);
  assert.equal(base,VERIFIED_BASE,'New source is not based on verified staging app');
  const packagePaths=git('diff','--name-only',FROZEN_SOURCE,sha,'--','src/','assets/','supabase/','app.config.js','eas.json','package.json','package-lock.json');
  assert.equal(packagePaths,'','Native, app, assets, DB or dependency release mutation forbidden');
  config();
  return {source:FROZEN_SOURCE,release:sha,runtime:'1.3.2'};
}
export async function preflight(sha,dir){
  proveFrozenRelease(sha);
  verifyBuild(read(dir+'/build.json'));
  const branch=verifyChannels(read(dir+'/stage-channel.json'),read(dir+'/prod-channel.json'));
  const stage=await manifest('staging-user'),prod=await manifest('production');
  assert.equal(stage.extra?.expoClient?.android?.package,'org.mzbministry.buklod.staging');
  assert.equal(stage.runtimeVersion,'1.3.2');
  assert.equal(prod.id,PRIOR_PROD_ID,'Production moved: stop and reconcile');
  const recent=latest(dir,'stage-updates.json');
  assert.equal(recent.runtimeVersion,'1.3.2');
  const already=cleanMessage(recent.message)===msg(sha);
  if(already){
    assert.equal(recent.group?.length,36);
    assert.ok(stage.id&&stage.id!==PRIOR_STAGE_ID,'Already-published message but old manifest');
  }else{
    assert.equal(stage.id,PRIOR_STAGE_ID,'Staging moved since verified baseline: stop and reconcile');
    assert.equal(recent.group,PRIOR_STAGE_GROUP,'Staging EAS group advanced: stop');
    assert.equal(cleanMessage(recent.message),'BUKLOD_NOV16_COMPLETE_CONSO_STAGE132_5c5e528a89b293efaf7874fd9512640e054b3e59','Unexpected previous staging source: stop');
  }
  const record={reviewedSourceSha:FROZEN_SOURCE,releaseSha:sha,branch:branch.name,package:'org.mzbministry.buklod.staging',runtime:'1.3.2',platform:'android',signedBuildId:BUILD_ID,project:PROJECT,stageId:stage.id,stageGroup:recent.group,prodId:prod.id,alreadyPublished:already};
  write(dir+'/preflight.json',record);
  return record;
}
export async function recheck(sha,dir){
  proveFrozenRelease(sha);
  const prior=read(dir+'/preflight.json');
  assert.equal(prior.releaseSha,sha);
  const stage=await manifest('staging-user'),prod=await manifest('production');
  assert.equal(stage.id,prior.stageId,'Staging changed during export: stop');
  assert.equal(prod.id,prior.prodId,'Production changed during export: stop');
  const latestGroup=latest(dir,'stage-updates-recheck.json');
  assert.equal(latestGroup.group,prior.stageGroup,'Staging group changed during export: stop');
  return prior;
}
export async function postpublish(sha,dir){
  proveFrozenRelease(sha);
  const pre=read(dir+'/preflight.json');
  const item=verifyUpdate(read(dir+'/update-view.json'),sha,pre.branch);
  const list=latest(dir,'stage-updates-after.json');
  assert.equal(list.group,item.group,'Published update is not newest EAS group');
  assert.equal(cleanMessage(list.message),msg(sha),'Newest staging update is not exact release');
  let stage;
  for(let i=0;i<5;i++){
    stage=await manifest('staging-user');
    if(String(stage.id).toLowerCase()===String(item.id).toLowerCase())break;
    await new Promise(done=>setTimeout(done,2500));
  }
  assert.equal(String(stage.id).toLowerCase(),String(item.id).toLowerCase(),'EAS Android manifest does not match published update');
  assert.equal(stage.extra?.expoClient?.android?.package,'org.mzbministry.buklod.staging');
  assert.equal(stage.extra?.expoClient?.extra?.appEnvironment,'staging');
  const prod=await manifest('production');
  assert.equal(prod.id,pre.prodId,'PRODUCTION MOVED: do not claim unchanged');
  verifyChannels(read(dir+'/stage-channel-after.json'),read(dir+'/prod-channel-after.json'));
  const receipt={status:'VERIFIED SERVER-SIDE ANDROID STAGING OTA',reviewedSourceSha:FROZEN_SOURCE,releaseSha:sha,updateId:item.id,groupId:item.group,channel:'staging-user',package:'org.mzbministry.buklod.staging',runtime:item.runtimeVersion,platform:item.platform,productionUnchangedId:prod.id,signedStagingBuildId:BUILD_ID,projectId:PROJECT,physicalDeviceVerification:'SKIPPED BY OWNER',run:process.env.GITHUB_RUN_ID};
  write(dir+'/verification.json',receipt);
  console.log('BUKLOD_132_STORY_STAGING_VERIFIED',JSON.stringify(receipt));
  return receipt;
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
  (async()=>{
    const [phase,sha,dir]=process.argv.slice(2);
    assert.ok(dir?.startsWith('/tmp/buklod-132-story-stage'),'Nonapproved evidence directory');
    if(phase==='source')proveFrozenRelease(sha);
    else if(phase==='preflight')await preflight(sha,dir);
    else if(phase==='recheck')await recheck(sha,dir);
    else if(phase==='postpublish')await postpublish(sha,dir);
    else throw Error('Unknown release phase');
  })().catch(e=>{console.error('BUKLOD_132_STAGING_RELEASE_BLOCK:',e.message);process.exitCode=1;});
}
