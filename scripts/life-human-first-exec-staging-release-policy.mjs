#!/usr/bin/env node
/**
 * BUKLOD LIFE: exactly-once staging Android OTA policy.
 * Preserves latest verified Executive Density baseline; never deploys production.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { APK_SOURCE, BUILD_ID, PROJECT, verifyBuild, verifyChannels, verifyUpdate, manifest } from './navigation-v2-owner-staging-policy.mjs';

export const BASE='ab3ed7c375b09b31dcac2369c106eba4bd8a6ca0';
export const PREVIOUS_UPDATE='01a1df87-139b-7da4-9e69-4e5ed36024df';
export const PREVIOUS_GROUP='e7d295b8-5045-4307-98e9-72c5b1e7c41a';
export const PREVIOUS_MESSAGE='BUKLOD_EXECUTIVE_STAGING_132_'+BASE;
export const BRANCH='integration/life-human-first-executive-stage-132-20261115';
export const RELEASE_FILE='release/life-human-first-stage-20261115.json';
const SCOPE='.buklod/scopes/life-human-first-20261115.json';
const MIGRATION='supabase/migrations/20261115143417_buklod_life_no_inferred_milestones_v1.sql';
const OLD_MIGRATION='supabase/migrations/20261115125000_buklod_life_no_inferred_milestones.sql';
const CHANNEL='staging-user', RUNTIME='1.3.2', PACKAGE='org.mzbministry.buklod.staging';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
export const marker=sha=>'BUKLOD_LIFE_HUMAN_FIRST_STAGING_132_'+sha;
const unquote=s=>{const raw=String(s??'');const wrapped=/^"([^"]+)" \([^()]+\)$/.exec(raw);return wrapped?wrapped[1]:raw;};

export function verifySource(sha) {
  assert.match(sha,/^[a-f0-9]{40}$/);
  assert.equal(git('rev-parse','HEAD'),sha);
  assert.equal(process.env.GITHUB_REF,'refs/heads/'+BRANCH);
  assert.equal(git('merge-base',BASE,sha),BASE,'Not based on last verified staging source');
  assert.equal(git('merge-base',APK_SOURCE,sha),APK_SOURCE,'Incompatible with signed staging APK');
  const scope=read(SCOPE),release=read(RELEASE_FILE);
  assert.equal(scope.baseRef,BASE);
  assert.equal(release.exactStageParent,BASE);
  assert.equal(release.verifiedStageUpdateId,PREVIOUS_UPDATE);
  assert.equal(release.verifiedStageUpdateGroup,PREVIOUS_GROUP);
  assert.equal(release.backendMigrationApplied,true);
  assert.equal(release.backendMigrationVersion,'20261115143417');
  assert.equal(release.backendPrivacyReadbackVerified,true);
  assert.ok(fs.existsSync(MIGRATION),'Migration source missing');
  assert.equal(fs.existsSync(OLD_MIGRATION),false,'Old duplicate migration remains');
  const changes=git('diff','--name-only',BASE,sha).split('\n').filter(Boolean);
  assert.ok(changes.includes('src/app/life/topic.tsx'));
  const extras=changes.filter(p=>!scope.allowedPaths.includes(p)&&p!==OLD_MIGRATION);
  assert.deepEqual(extras,[],'Unapproved source delta');
  assert.ok(!changes.some(p=>/^(?:app\.config\.js|eas\.json|package(?:-lock)?\.json|plugins\/|assets\/|android\/|ios\/)/.test(p)),'Native or dependent source mutated');
  const app=requireConfig(),eas=read('eas.json');
  assert.equal(app.runtimeVersion,RUNTIME);
  assert.equal(app.android.package,PACKAGE);
  assert.equal(app.extra.appEnvironment,'staging');
  assert.equal(app.extra.eas.projectId,PROJECT);
  assert.equal(eas.build['staging-user'].channel,CHANNEL);
  assert.equal(eas.build['staging-user'].environment,'preview');
  assert.equal(eas.build.production.channel,'production');
  assert.equal(git('status','--porcelain','--untracked-files=no'),'');
  return changes;
}
function requireConfig(){
  // app.config.js is CommonJS, loaded dynamically in the EAS runner.
  return createRequireForConfig()({config:{}});
}
function createRequireForConfig(){
  return requireFromHere('../app.config.js');
}
import { createRequire } from 'node:module';
const requireFromHere=createRequire(import.meta.url);

export function verifyPrior(rows,stageId,sha) {
  const list=rows.currentPage??rows;
  assert.ok(Array.isArray(list)&&list[0]?.group,'Cannot verify latest EAS staging group');
  const row=list[0],message=unquote(row.message);
  assert.equal(row.runtimeVersion,RUNTIME);
  if(message===marker(sha)){
    return {alreadyPublished:true,group:row.group,updateId:stageId};
  }
  assert.equal(message,PREVIOUS_MESSAGE,'Staging changed since baseline; no overwrite');
  assert.equal(row.group,PREVIOUS_GROUP,'Unexpected published staging group');
  assert.equal(String(stageId).toLowerCase(),PREVIOUS_UPDATE,'Staging manifest advanced; no publish');
  return {alreadyPublished:false,group:row.group,updateId:stageId};
}

export async function preflight(sha,dir) {
  verifySource(sha);
  verifyBuild(read(dir+'/build.json'));
  const branch=verifyChannels(read(dir+'/staging-channel-before.json'),read(dir+'/production-channel-before.json'));
  const stage=await manifest(CHANNEL),prod=await manifest('production');
  assert.equal(stage.extra?.expoClient?.android?.package,PACKAGE);
  assert.equal(prod.extra?.expoClient?.android?.package,'org.mzbministry.buklod');
  const previous=verifyPrior(read(dir+'/staging-updates-before.json'),stage.id,sha);
  write(dir+'/preflight.json',{
    sourceSha:sha,branch,previous,buildId:BUILD_ID,project:PROJECT,productionId:prod.id,
    channel:CHANNEL,package:PACKAGE,runtimeVersion:RUNTIME,
    backendMigrationVersion:'20261115143417',deviceVerification:'SKIPPED BY OWNER',
    stagingOnly:true,productionOta:false
  });
}

export async function recheck(sha,dir){
  verifySource(sha);
  const pre=read(dir+'/preflight.json');
  assert.equal(pre.sourceSha,sha);
  verifyChannels(read(dir+'/staging-channel-before.json'),read(dir+'/production-channel-before.json'));
  const stage=await manifest(CHANNEL);
  const current=verifyPrior(read(dir+'/staging-updates-recheck.json'),stage.id,sha);
  assert.equal(current.alreadyPublished,pre.previous.alreadyPublished);
  assert.equal(current.group,pre.previous.group);
  const prod=await manifest('production');
  assert.equal(prod.id,pre.productionId,'Production changed before publishing; abort');
}

export async function postpublish(sha,dir){
  verifySource(sha);
  const pre=read(dir+'/preflight.json');
  assert.equal(pre.sourceSha,sha);
  const u=verifyUpdate(read(dir+'/update-view.json'),sha,pre.branch.name);
  const stage=await manifest(CHANNEL);
  assert.equal(String(stage.id).toLowerCase(),String(u.id).toLowerCase(),'Staging manifest missing exact published update');
  assert.equal(stage.extra?.expoClient?.android?.package,PACKAGE);
  assert.equal(stage.extra?.expoClient?.extra?.appEnvironment,'staging');
  const prod=await manifest('production');
  assert.equal(prod.id,pre.productionId,'Production update mutated');
  verifyChannels(read(dir+'/staging-channel-after.json'),read(dir+'/production-channel-after.json'));
  write(dir+'/verification.json',{
    status:'VERIFIED STAGING ANDROID OTA — LIFE HUMAN-FIRST',
    sourceSha:sha,updateId:u.id,updateGroup:u.group,branch:u.branch,
    channel:CHANNEL,platform:'android',package:PACKAGE,runtimeVersion:RUNTIME,
    buildId:BUILD_ID,createdAt:u.createdAt,backendPrivacyMigration:'20261115143417',
    productionUpdateIdUnchanged:prod.id,productionOtaPublished:false,
    deviceVerification:'SKIPPED BY OWNER',
    runUrl:'https://github.com/'+process.env.GITHUB_REPOSITORY+'/actions/runs/'+process.env.GITHUB_RUN_ID
  });
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  (async()=>{
    const [mode,sha,dir]=process.argv.slice(2);
    if(mode==='source'){verifySource(sha);return;}
    assert.ok(dir?.startsWith('/tmp/buklod-life-exec-staging-'));
    if(mode==='preflight')await preflight(sha,dir);
    else if(mode==='recheck')await recheck(sha,dir);
    else if(mode==='postpublish')await postpublish(sha,dir);
    else throw Error('Unsupported LIFE staging phase');
  })().catch(e=>{console.error('LIFE_STAGING_BLOCK:',e.message);process.exitCode=1;});
}
