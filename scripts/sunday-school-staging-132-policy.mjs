#!/usr/bin/env node
/** Release only the already-reviewed Sunday School content onto exact prior
 *  Android staging-user 1.3.2. Fail closed on any newer EAS update. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { APK_SOURCE, BUILD_ID, PROJECT, verifyBuild, verifyChannels, verifyUpdate, manifest } from './navigation-v2-owner-staging-policy.mjs';

export const BASE = '6b9981e200e4dfa9faa43f5d2691bc858a3f56f1';
export const PREVIOUS_UPDATE = '01a1dd05-6cb1-74b6-8f0a-4430c22fa5ba';
export const PREVIOUS_GROUP = 'e89c5420-b380-42c0-a3aa-4f7eba9d5bf7';
export const PREVIOUS_MESSAGE = 'BUKLOD_CHILD_STORY_STAGING_132_20261115_' + BASE;
export const BRANCH = 'feature/sunday-school-continuous-stories-20261115';
export const SCOPE = '.buklod/scopes/sunday-school-full-stories-20261115.json';
const CHANNEL='staging-user',PACKAGE='org.mzbministry.buklod.staging',RUNTIME='1.3.2';
const require=createRequire(import.meta.url);
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,data)=>fs.writeFileSync(p,JSON.stringify(data,null,2)+'\n');
const ancestor=(old,newSha)=>{
  try{execFileSync('git',['merge-base','--is-ancestor',old,newSha],{stdio:'ignore'});return true;}catch{return false;}
};

export function verifySource(sha){
  assert.match(sha,/^[a-f0-9]{40}$/);
  assert.equal(git('rev-parse','HEAD'),sha);
  assert.equal(process.env.GITHUB_REF,'refs/heads/'+BRANCH);
  assert.ok(ancestor(BASE,sha),'Staging verified base not an ancestor');
  assert.ok(ancestor(APK_SOURCE,sha),'Incompatible with signed APK');
  const changes=git('diff','--name-only',BASE,sha,'--').split('\n').filter(Boolean).sort();
  const scope=read(SCOPE);
  assert.equal(scope.baseRef,BASE);
  assert.deepEqual(changes,[...scope.allowedPaths].sort(),'Unreviewed source delta; no OTA');
  const native=git('diff','--name-only',BASE,sha,'--','app.config.js','eas.json','package.json','package-lock.json',
    'android/','ios/','plugins/','assets/','supabase/','src/providers/','src/lib/buklodGlobalAdController.ts',
    'src/components/BuklodAdSafetyRouteBridge.tsx','src/components/home/BuklodHomeUtilityCards.tsx',
    'src/lib/supabase.ts','src/components/CommunityVideo.tsx');
  assert.equal(native,'','Native/backend/ads/home/provider source changed');
  const app=require('../app.config.js')({config:{}});
  const eas=require('../eas.json');
  assert.equal(app.runtimeVersion,RUNTIME);
  assert.equal(app.android.package,PACKAGE);
  assert.equal(app.extra.appEnvironment,'staging');
  assert.equal(app.extra.eas.projectId,PROJECT);
  assert.equal(eas.build['staging-user'].channel,CHANNEL);
  assert.equal(eas.build['staging-user'].environment,'preview');
  assert.equal(git('status','--porcelain','--untracked-files=no'),'');
}

function latest(rows) {
  const j=rows.currentPage??rows;
  assert.ok(Array.isArray(j)&&j[0]?.group,'No verifiable previous staging update');
  return j[0];
}
export function verifyPriorUpdate(rows,stageId) {
  const row=latest(rows);
  assert.equal(row.group,PREVIOUS_GROUP,'Current staging OTA group advanced; do not regress');
  assert.equal(row.runtimeVersion,RUNTIME,'Staging runtime changed');
  const shown=String(row.message??'');
  const wrapped=/^"([^"]+)" \([^()]+\)$/.exec(shown);
  assert.equal(wrapped?wrapped[1]:shown,PREVIOUS_MESSAGE,'Current staging update is not the previously verified story release');
  assert.equal(String(stageId).toLowerCase(),PREVIOUS_UPDATE,'Current staging manifest advanced; do not overwrite');
  return {group:row.group,updateId:stageId};
}

export async function preflight(sha,dir){
  verifySource(sha);
  verifyBuild(read(dir+'/build.json'));
  const branch=verifyChannels(read(dir+'/staging-channel-before.json'),read(dir+'/production-channel-before.json'));
  const stage=await manifest(CHANNEL),production=await manifest('production');
  assert.equal(stage.extra?.expoClient?.android?.package,PACKAGE);
  assert.equal(production.extra?.expoClient?.android?.package,'org.mzbministry.buklod');
  const previous=verifyPriorUpdate(read(dir+'/staging-updates-before.json'),stage.id);
  write(dir+'/preflight.json',{sourceSha:sha,branch,previous,project:PROJECT,buildId:BUILD_ID,
    channel:CHANNEL,package:PACKAGE,runtimeVersion:RUNTIME,productionId:production.id,
    nativeRebuild:false,productionDeployment:false,deviceCheck:'SKIPPED BY OWNER',status:'PREPARED'});
}

export async function recheck(sha,dir){
  verifySource(sha);
  const pre=read(dir+'/preflight.json');
  assert.equal(pre.sourceSha,sha);
  verifyChannels(read(dir+'/staging-channel-before.json'),read(dir+'/production-channel-before.json'));
  const stage=await manifest(CHANNEL);
  verifyPriorUpdate(read(dir+'/staging-updates-recheck.json'),stage.id);
  const prod=await manifest('production');
  assert.equal(prod.id,pre.productionId,'Production changed between preflight and publish');
}

export async function postpublish(sha,dir){
  verifySource(sha);
  const pre=read(dir+'/preflight.json');
  assert.equal(pre.sourceSha,sha);
  const update=verifyUpdate(read(dir+'/update-view.json'),sha,pre.branch.name);
  const stage=await manifest(CHANNEL);
  assert.equal(String(stage.id).toLowerCase(),String(update.id).toLowerCase());
  assert.equal(stage.extra?.expoClient?.android?.package,PACKAGE);
  assert.equal(stage.extra?.expoClient?.extra?.appEnvironment,'staging');
  const prod=await manifest('production');
  assert.equal(prod.id,pre.productionId,'Production changed after publish');
  verifyChannels(read(dir+'/staging-channel-after.json'),read(dir+'/production-channel-after.json'));
  write(dir+'/verification.json',{
    status:'VERIFIED SERVER-SIDE SUNDAY SCHOOL STAGING OTA',sourceSha:sha,updateId:update.id,
    updateGroup:update.group,branch:update.branch,channel:CHANNEL,platform:'android',
    package:PACKAGE,runtimeVersion:RUNTIME,buildId:BUILD_ID,createdAt:update.createdAt,
    productionIdUnchanged:prod.id,deviceVerification:'SKIPPED BY OWNER',
    backendMigration:'NOT APPLIED',nativeRebuild:false,
    runUrl:'https://github.com/'+process.env.GITHUB_REPOSITORY+'/actions/runs/'+process.env.GITHUB_RUN_ID,
  });
  console.log('VERIFIED_SUNDAY_SCHOOL_STAGING_UPDATE_ID='+update.id);
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  (async()=>{
    const [action,sha,dir]=process.argv.slice(2);
    assert.ok(dir?.startsWith('/tmp/buklod-sunday-school-'));
    if(action==='source')verifySource(sha);
    else if(action==='preflight')await preflight(sha,dir);
    else if(action==='recheck')await recheck(sha,dir);
    else if(action==='postpublish')await postpublish(sha,dir);
    else throw Error('Unsupported release phase');
  })().catch(e=>{console.error('SUNDAY_SCHOOL_STAGING_BLOCK:',e.message);process.exitCode=1;});
}
