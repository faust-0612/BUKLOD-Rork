#!/usr/bin/env node
/** Android staging-user release safety policy, cumulative on the verified Nov15 staging OTA. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { APK_SOURCE, BUILD_ID, PROJECT, verifyBuild, verifyChannels, verifyUpdate, manifest } from './navigation-v2-owner-staging-policy.mjs';
export const BASE='0dc4fd0df8198bdbd3f37c93c181a3fae46c6cd2';
export const PREVIOUS_UPDATE='01a1e061-1ae9-7126-8e10-7936e2b72fb4';
export const PREVIOUS_GROUP='cb13d5d1-4f71-42aa-b65f-721a75cd0625';
export const PREVIOUS_MESSAGE='BUKLOD_NOV16_HENRY_CONSO_STAGE132_'+BASE;
export const BRANCH='fix/nov16-henry-children-dialogue-dark';
export const SCOPE='.buklod/scopes/nov16-henry-children-dialogue-dark-v2.json';
export const CHANNEL='staging-user', RUNTIME='1.3.2', PACKAGE='org.mzbministry.buklod.staging';
export const marker=sha=>'BUKLOD_NOV16_HENRY_CHILDREN_DIALOGUE_DARK_'+sha;
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const unquote=s=>{const t=String(s??'');const m=/^"([^"]+)" \([^()]+\)$/.exec(t);return m?m[1]:t;};
const requireConfig=createRequire(import.meta.url);
export function verifySource(sha){
 assert.match(sha,/^[a-f0-9]{40}$/);
 assert.equal(git('rev-parse','HEAD'),sha);
 assert.equal(process.env.GITHUB_REF,'refs/heads/'+BRANCH);
 assert.equal(git('merge-base',BASE,sha),BASE,'Not a descendant of last verified staging OTA');
 assert.equal(git('merge-base',APK_SOURCE,sha),APK_SOURCE,'Incompatible signed staging APK');
 const scope=read(SCOPE);
 assert.equal(scope.contractVersion,2);
 assert.equal(scope.baseRef,'release/nov16-henry-conso-stage132-publish');
 const changes=git('diff','--name-only',BASE,sha).split('\n').filter(Boolean);
 assert.ok(changes.includes('src/app/bible/read.tsx')&&changes.includes('src/app/children-stories/[id].tsx'));
 assert.deepEqual(changes.filter(p=>!scope.allowedPaths.includes(p)),[],'Unapproved source changes');
 assert.ok(!changes.some(p=>/^(?:app\.config\.|eas\.json|package(?:-lock)?\.json|plugins\/|assets\/|android\/|ios\/|supabase\/)/.test(p)),'Native/dependency/database change is not OTA safe');
 const c=requireConfig('../app.config.js')({config:{}}),eas=read('eas.json');
 assert.equal(c.runtimeVersion,RUNTIME);
 assert.equal(c.android.package,PACKAGE);
 assert.equal(c.extra.appEnvironment,'staging');
 assert.equal(c.extra.eas.projectId,PROJECT);
 assert.equal(eas.build['staging-user'].channel,CHANNEL);
 assert.equal(eas.build['staging-user'].environment,'preview');
 assert.equal(eas.build.production.channel,'production');
 assert.equal(git('status','--porcelain','--untracked-files=no'),'');
 return changes;
}
export function verifyPrior(rows,stageId,sha){
 const list=rows.currentPage??rows;
 assert.ok(Array.isArray(list)&&list[0]?.group,'Cannot verify latest staging group');
 const latest=list[0],message=unquote(latest.message);
 assert.equal(latest.runtimeVersion,RUNTIME);
 if(message===marker(sha))return {alreadyPublished:true,group:latest.group,updateId:stageId};
 assert.equal(message,PREVIOUS_MESSAGE,'Unexpected staging update; no overwrite');
 assert.equal(latest.group,PREVIOUS_GROUP,'Staging group changed');
 assert.equal(String(stageId).toLowerCase(),PREVIOUS_UPDATE,'Staging manifest moved');
 return {alreadyPublished:false,group:latest.group,updateId:stageId};
}
export async function preflight(sha,dir){
 verifySource(sha);
 verifyBuild(read(dir+'/build.json'));
 const branch=verifyChannels(read(dir+'/staging-channel-before.json'),read(dir+'/production-channel-before.json'));
 const stage=await manifest(CHANNEL),prod=await manifest('production');
 assert.equal(stage.extra?.expoClient?.android?.package,PACKAGE);
 assert.equal(prod.extra?.expoClient?.android?.package,'org.mzbministry.buklod');
 const previous=verifyPrior(read(dir+'/staging-updates-before.json'),stage.id,sha);
 write(dir+'/preflight.json',{sourceSha:sha,branch,previous,buildId:BUILD_ID,project:PROJECT,
   channel:CHANNEL,package:PACKAGE,runtimeVersion:RUNTIME,productionUpdateId:prod.id,
   deviceVerification:'SKIPPED BY OWNER',stagingOnly:true});
}
export async function recheck(sha,dir){
 verifySource(sha);
 const pre=read(dir+'/preflight.json');
 assert.equal(pre.sourceSha,sha);
 const stage=await manifest(CHANNEL);
 const current=verifyPrior(read(dir+'/staging-updates-recheck.json'),stage.id,sha);
 assert.equal(current.alreadyPublished,pre.previous.alreadyPublished);
 assert.equal(current.group,pre.previous.group);
 assert.equal((await manifest('production')).id,pre.productionUpdateId,'Production baseline shifted');
}
export async function postpublish(sha,dir){
 verifySource(sha);
 const pre=read(dir+'/preflight.json');
 assert.equal(pre.sourceSha,sha);
 const u=verifyUpdate(read(dir+'/update-view.json'),sha,pre.branch.name);
 const stage=await manifest(CHANNEL);
 assert.equal(String(stage.id).toLowerCase(),String(u.id).toLowerCase(),'Staging manifest did not adopt exact update');
 assert.equal(stage.extra?.expoClient?.android?.package,PACKAGE);
 assert.equal(stage.extra?.expoClient?.extra?.appEnvironment,'staging');
 const prod=await manifest('production');
 assert.equal(prod.id,pre.productionUpdateId,'Production OTA changed');
 verifyChannels(read(dir+'/staging-channel-after.json'),read(dir+'/production-channel-after.json'));
 write(dir+'/verification.json',{status:'VERIFIED STAGING ANDROID OTA: CHILDREN DIALOGUES + DARK BIBLE',
   sourceSha:sha,updateId:u.id,updateGroup:u.group,branch:u.branch,
   channel:CHANNEL,platform:'android',package:PACKAGE,runtimeVersion:RUNTIME,
   buildId:BUILD_ID,productionUpdateIdUnchanged:prod.id,productionOtaPublished:false,
   deviceVerification:'SKIPPED BY OWNER',
   runUrl:'https://github.com/'+process.env.GITHUB_REPOSITORY+'/actions/runs/'+process.env.GITHUB_RUN_ID});
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 (async()=>{
   const [mode,sha,dir]=process.argv.slice(2);
   if(mode==='source'){verifySource(sha);return;}
   assert.ok(dir?.startsWith('/tmp/buklod-nov16-henry-dialogue-staging-'));
   if(mode==='preflight')await preflight(sha,dir);
   else if(mode==='recheck')await recheck(sha,dir);
   else if(mode==='postpublish')await postpublish(sha,dir);
   else throw Error('Unsupported staging release phase');
 })().catch(e=>{console.error('NOV16_HENRY_DIALOGUE_STAGING_BLOCK:',e.message);process.exitCode=1;});
}
