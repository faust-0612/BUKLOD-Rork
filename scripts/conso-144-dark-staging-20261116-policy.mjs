#!/usr/bin/env node
/** Exact-source, one-Android-update only. No backend, web or production writes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { APK_SOURCE, BUILD_ID, PROJECT, verifyBuild, verifyChannels, verifyUpdate, manifest } from './navigation-v2-owner-staging-policy.mjs';

export const BASE='4d1ac6986405b3f2f9715422a69fa7a04b07fc22';
export const PREVIOUS_ID='01a1dfff-098e-71b1-b91a-63c0602ce512';
export const PREVIOUS_GROUP='4c456fda-cd0c-4864-bb6b-27c7fddc6377';
export const PREVIOUS_MESSAGE='BUKLOD_CHILD_BIBLE_AUDIO_STAGE_132_'+BASE;
export const BRANCH='fix/conso-144-dark-staging-20261116';
export const SCOPE='.buklod/scopes/conso-144-dark-staging-20261116.json';
export const CHANNEL='staging-user';
export const marker=sha=>'BUKLOD_CONSO_144_DARK_STAGING_132_'+sha;
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const localRequire=createRequire(import.meta.url);
const unquote=s=>{const v=String(s??'');const m=/^"([^"]+)" \([^()]+\)$/.exec(v);return m?m[1]:v;};

export function verifySource(sha){
  assert.match(sha,/^[a-f0-9]{40}$/);
  assert.equal(git('rev-parse','HEAD'),sha);
  assert.equal(process.env.GITHUB_REF,'refs/heads/'+BRANCH);
  assert.equal(git('merge-base',BASE,sha),BASE,'Source does not descend from verified stage');
  assert.equal(git('merge-base',APK_SOURCE,sha),APK_SOURCE,'Signed APK runtime ancestry invalid');
  const scope=read(SCOPE);
  assert.equal(scope.baseRef,BASE);
  const paths=git('diff','--name-only',BASE,sha).split('\n').filter(Boolean);
  assert.ok(paths.length>=7,'Unexpected missing stage-only source diff');
  assert.ok(paths.includes('src/app/bible/index.tsx'));
  assert.ok(paths.includes('src/app/notifications/index.tsx'));
  assert.ok(!paths.some(p=>p.startsWith('src/features/childrenStories/')||p.startsWith('src/app/children-stories/')),'144 story library or narration modified: STOP');
  assert.deepEqual(paths.filter(p=>!scope.allowedPaths.includes(p)),[],'Nonconsolidated files changed');
  assert.ok(!paths.some(p=>/^(?:app\.config\.js|eas\.json|package(?:-lock)?\.json|plugins\/|assets\/|android\/|ios\/|supabase\/)/.test(p)),'Native/backend/config mutation forbidden');
  const app=localRequire('../app.config.js')({config:{}}),eas=read('eas.json');
  assert.equal(app.runtimeVersion,'1.3.2');
  assert.equal(app.android.package,'org.mzbministry.buklod.staging');
  assert.equal(app.extra.appEnvironment,'staging');
  assert.equal(app.extra.eas.projectId,PROJECT);
  assert.equal(eas.build['staging-user'].channel,'staging-user');
  assert.equal(eas.build['staging-user'].environment,'preview');
  assert.equal(eas.build.production.channel,'production');
  assert.equal(git('status','--porcelain','--untracked-files=no'),'');
  return paths;
}
export function verifyPrior(rows,stageId,sha){
  const list=rows.currentPage??rows;
  assert.ok(Array.isArray(list)&&list[0]?.group,'Missing latest staging update identity');
  const row=list[0], message=unquote(row.message);
  assert.equal(row.runtimeVersion,'1.3.2');
  if(message===marker(sha))return {alreadyPublished:true,group:row.group,updateId:stageId};
  assert.equal(message,PREVIOUS_MESSAGE,'Staging advanced from inspected stage: STOP');
  assert.equal(row.group,PREVIOUS_GROUP,'Wrong EAS staging group: STOP');
  assert.equal(String(stageId).toLowerCase(),PREVIOUS_ID,'Wrong EAS staging update: STOP');
  return {alreadyPublished:false,group:row.group,updateId:stageId};
}
export async function preflight(sha,dir){
  verifySource(sha);
  verifyBuild(read(dir+'/build.json'));
  const branch=verifyChannels(read(dir+'/staging-before.json'),read(dir+'/production-before.json'));
  const stage=await manifest(CHANNEL),production=await manifest('production');
  assert.equal(stage.extra?.expoClient?.android?.package,'org.mzbministry.buklod.staging');
  assert.equal(production.extra?.expoClient?.android?.package,'org.mzbministry.buklod');
  const prior=verifyPrior(read(dir+'/stage-updates-before.json'),stage.id,sha);
  write(dir+'/preflight.json',{sha,branch,prior,buildId:BUILD_ID,
   stageUpdateId:stage.id,productionUpdateId:production.id,
   channel:CHANNEL,package:'org.mzbministry.buklod.staging',runtime:'1.3.2',
   stagingOnly:true,physicalDeviceVerification:'SKIPPED BY OWNER'});
}
export async function recheck(sha,dir){
  verifySource(sha);
  const pre=read(dir+'/preflight.json');
  assert.equal(pre.sha,sha);
  const stage=await manifest(CHANNEL),production=await manifest('production');
  const current=verifyPrior(read(dir+'/stage-updates-recheck.json'),stage.id,sha);
  assert.equal(current.alreadyPublished,pre.prior.alreadyPublished);
  assert.equal(current.group,pre.prior.group);
  assert.equal(production.id,pre.productionUpdateId,'Production changed during release: STOP');
}
export async function postpublish(sha,dir){
  verifySource(sha);
  const pre=read(dir+'/preflight.json'),u=verifyUpdate(read(dir+'/update-view.json'),sha,pre.branch.name);
  assert.equal(pre.sha,sha);
  const stage=await manifest(CHANNEL),production=await manifest('production');
  assert.equal(String(stage.id).toLowerCase(),String(u.id).toLowerCase(),'Latest stage manifest does not match exact update');
  assert.equal(stage.extra?.expoClient?.android?.package,'org.mzbministry.buklod.staging');
  assert.equal(stage.extra?.expoClient?.extra?.appEnvironment,'staging');
  assert.equal(production.id,pre.productionUpdateId,'Production mutated: STOP');
  verifyChannels(read(dir+'/staging-after.json'),read(dir+'/production-after.json'));
  write(dir+'/verification.json',{
   status:'VERIFIED SERVER-SIDE STAGING ANDROID OTA: KIDS + DARK',
   sourceSha:sha,updateId:u.id,groupId:u.group,channel:CHANNEL,branch:u.branch,
   runtimeVersion:u.runtimeVersion,platform:'android',package:'org.mzbministry.buklod.staging',
   buildId:BUILD_ID,projectId:PROJECT,productionUnchangedId:production.id,
   physicalDeviceVerification:'SKIPPED BY OWNER',
   runUrl:'https://github.com/'+process.env.GITHUB_REPOSITORY+'/actions/runs/'+process.env.GITHUB_RUN_ID,
  });
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 (async()=>{
  const [mode,sha,dir]=process.argv.slice(2);
  if(mode==='source'){verifySource(sha);return;}
  assert.ok(dir?.startsWith('/tmp/buklod-conso-144-dark-'));
  if(mode==='preflight')await preflight(sha,dir);
  else if(mode==='recheck')await recheck(sha,dir);
  else if(mode==='postpublish')await postpublish(sha,dir);
  else throw Error('Unknown staging publish phase');
 })().catch(e=>{console.error('CONSO_144_DARK_STAGING_BLOCK:',e.message);process.exitCode=1;});
}
