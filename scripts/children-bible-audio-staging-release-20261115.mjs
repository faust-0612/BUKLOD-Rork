#!/usr/bin/env node
/**
 * One-shot staging-user Android OTA for the reviewed bilingual Bible library.
 * Fail closed if EAS staging advanced, the signed runtime differs, or source
 * overlaps protected BUKLOD features. This script never publishes by itself.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { APK_SOURCE, BUILD_ID, PROJECT, verifyBuild, verifyChannels, verifyUpdate, manifest } from './navigation-v2-owner-staging-policy.mjs';

export const BASE = 'ea9a72c687c0885ea6a3c14a883503204f83dad4';
export const PREVIOUS_UPDATE = '01a1dfb1-578c-7e47-8547-ff3065c6792a';
export const PREVIOUS_GROUP = 'f2da9206-4fb6-478b-bc6e-adb47e4030cd';
export const PREVIOUS_MESSAGE = 'BUKLOD_LIFE_HUMAN_FIRST_STAGING_132_' + BASE;
export const BRANCH = 'integration/children-bible-audio-staging-132-20261115';
export const SCOPE = '.buklod/scopes/children-bible-library-20261115.json';
export const RELEASE_FILE = 'release/children-bible-audio-stage-132-20261115.json';
export const CHANNEL = 'staging-user';
const PACKAGE = 'org.mzbministry.buklod.staging';
const RUNTIME = '1.3.2';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const read = name => JSON.parse(fs.readFileSync(name,'utf8'));
const write = (name,value) => fs.writeFileSync(name,JSON.stringify(value,null,2)+'\n');
const config = createRequire(import.meta.url)('../app.config.js');
const parseMessage = text => {
  const raw=String(text ?? '');
  const match=/^"([^"]+)" \([^()]+\)$/.exec(raw);
  return match ? match[1] : raw;
};
export const marker = sha => 'BUKLOD_CHILD_BIBLE_AUDIO_STAGE_132_' + sha;

export function verifyPrior(rows,stageManifestId) {
  const list=rows.currentPage ?? rows;
  assert.ok(Array.isArray(list) && list.length>0 && list[0]?.group,'Cannot verify newest EAS staging Android update');
  const latest=list[0];
  assert.equal(parseMessage(latest.message),PREVIOUS_MESSAGE,'A newer staging OTA exists; do not overwrite it');
  assert.equal(latest.group,PREVIOUS_GROUP,'Staging update group changed unexpectedly');
  assert.equal(latest.runtimeVersion,RUNTIME,'Staging runtime changed unexpectedly');
  assert.equal(String(stageManifestId).toLowerCase(),PREVIOUS_UPDATE,'Staging Android manifest advanced');
  return { updateId:stageManifestId,group:latest.group };
}

export function verifySource(sha) {
  assert.match(sha,/^[a-f0-9]{40}$/);
  assert.equal(git('rev-parse','HEAD'),sha,'Wrong release source');
  assert.equal(process.env.GITHUB_REF,'refs/heads/'+BRANCH,'Wrong release branch');
  assert.equal(git('merge-base',BASE,sha),BASE,'Staging candidate not descended from verified previous OTA');
  assert.equal(git('merge-base',APK_SOURCE,sha),APK_SOURCE,'Signed staging APK incompatible');
  assert.equal(git('status','--porcelain','--untracked-files=no'),'','Dirty source');
  const scope=read(SCOPE),release=read(RELEASE_FILE),paths=git('diff','--name-only',BASE,sha).split('\n').filter(Boolean);
  assert.equal(scope.baseRef,BASE);
  assert.equal(release.exactPreviousSource,BASE);
  assert.equal(release.previousUpdateId,PREVIOUS_UPDATE);
  assert.equal(release.previousUpdateGroup,PREVIOUS_GROUP);
  assert.equal(release.targetChannel,CHANNEL);
  assert.equal(release.targetRuntime,RUNTIME);
  assert.equal(release.readyForStaging,true);
  assert.deepEqual(paths.filter(p=>!scope.allowedPaths.includes(p)),[],'Unapproved scope delta');
  assert.ok(paths.includes('src/features/childrenStories/storyNarration.ts'));
  assert.ok(paths.includes('tests/children-story-narration-20261115.test.mjs'));
  assert.ok(paths.includes('src/features/childrenStories/bibleExpansionNew.ts'));
  assert.ok(paths.includes('.github/workflows/buklod-children-bible-audio-stage-132-20261115.yml'));
  const protectedFiles=/^(?:android\/|ios\/|assets\/|plugins\/|supabase\/|app\.config\.|eas\.json$|package(?:-lock)?\.json$|src\/providers\/|src\/lib\/buklodGlobalAdController\.ts$)/;
  assert.ok(!paths.some(p=>protectedFiles.test(p)),'Unsafe native/security/AdMob regression');
  const app=config({config:{}}),eas=read('eas.json');
  assert.equal(app.runtimeVersion,RUNTIME);
  assert.equal(app.android.package,PACKAGE);
  assert.equal(app.extra.appEnvironment,'staging');
  assert.equal(app.extra.eas.projectId,PROJECT);
  assert.equal(eas.build['staging-user'].channel,CHANNEL);
  assert.equal(eas.build['staging-user'].environment,'preview');
  assert.equal(eas.build.production.channel,'production');
  return paths;
}

export async function preflight(sha,dir) {
  verifySource(sha);
  verifyBuild(read(dir+'/build.json'));
  const branch=verifyChannels(read(dir+'/stage-channel-before.json'),read(dir+'/prod-channel-before.json'));
  const stage=await manifest(CHANNEL),production=await manifest('production');
  assert.equal(stage.extra?.expoClient?.android?.package,PACKAGE);
  assert.equal(production.extra?.expoClient?.android?.package,'org.mzbministry.buklod');
  const previous=verifyPrior(read(dir+'/stage-updates-before.json'),stage.id);
  write(dir+'/preflight.json',{sourceSha:sha,baseSha:BASE,previous,buildId:BUILD_ID,branch,productionUpdateId:production.id,
    targetChannel:CHANNEL,package:PACKAGE,runtimeVersion:RUNTIME,
    deviceVerification:'SKIPPED BY OWNER',productionPublished:false,stagingPublished:false});
}

export async function recheck(sha,dir) {
  verifySource(sha);
  const before=read(dir+'/preflight.json');
  assert.equal(before.sourceSha,sha);
  const stage=await manifest(CHANNEL),prod=await manifest('production');
  const current=verifyPrior(read(dir+'/stage-updates-recheck.json'),stage.id);
  assert.equal(current.updateId,before.previous.updateId);
  assert.equal(current.group,before.previous.group);
  assert.equal(prod.id,before.productionUpdateId,'Production changed before release');
  verifyChannels(read(dir+'/stage-channel-before.json'),read(dir+'/prod-channel-before.json'));
}

export async function postpublish(sha,dir) {
  verifySource(sha);
  const pre=read(dir+'/preflight.json');
  assert.equal(pre.sourceSha,sha);
  const published=verifyUpdate(read(dir+'/update-view.json'),sha,pre.branch.name);
  const stage=await manifest(CHANNEL),production=await manifest('production');
  assert.equal(String(stage.id).toLowerCase(),String(published.id).toLowerCase(),'EAS staging manifest does not serve published artifact');
  assert.equal(stage.extra?.expoClient?.android?.package,PACKAGE);
  assert.equal(stage.extra?.expoClient?.extra?.appEnvironment,'staging');
  assert.equal(production.id,pre.productionUpdateId,'Production Android manifest changed');
  verifyChannels(read(dir+'/stage-channel-after.json'),read(dir+'/prod-channel-after.json'));
  write(dir+'/verification.json',{
    status:'VERIFIED CHILD BIBLE + AUDIO ANDROID STAGING OTA',sourceSha:sha,baseSha:BASE,
    updateId:published.id,updateGroup:published.group,branch:published.branch,
    channel:CHANNEL,platform:'android',package:PACKAGE,runtimeVersion:RUNTIME,
    buildId:BUILD_ID,createdAt:published.createdAt,environment:'preview',
    productionUpdateIdUnchanged:production.id,productionOtaPublished:false,
    deviceAudioVerified:false,deviceVerification:'SKIPPED BY OWNER',
    publisherRun:'https://github.com/'+process.env.GITHUB_REPOSITORY+'/actions/runs/'+process.env.GITHUB_RUN_ID,
  });
  console.log('VERIFIED_BIBLE_AUDIO_STAGING_UPDATE_ID='+published.id);
}

if(process.argv[1] && pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
  (async()=>{
    const [mode,sha,dir]=process.argv.slice(2);
    if(mode==='source'){verifySource(sha);return;}
    assert.match(dir ?? '',/^\/tmp\/buklod-bible-audio-staging-/);
    if(mode==='preflight') await preflight(sha,dir);
    else if(mode==='recheck') await recheck(sha,dir);
    else if(mode==='postpublish') await postpublish(sha,dir);
    else throw Error('Unknown staging operation');
  })().catch(error=>{console.error('BIBLE_AUDIO_STAGING_HOLD:',error.message);process.exitCode=1});
}
