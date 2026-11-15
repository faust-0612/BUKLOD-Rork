#!/usr/bin/env node
/**
 * BUKLOD Children Story World — isolated staging-user Android OTA verification.
 * Exact staging baseline, no Main/production changes, no native rebuild or DB migration.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import {
  APK_SOURCE, BUILD_ID, PROJECT,
  verifyBuild, verifyChannels, verifyUpdate, manifest
} from './navigation-v2-owner-staging-policy.mjs';

export const STAGING_BASE = 'ec1ae3e729990928bfe97c0b01fbdf4ddef11ced';
export const STAGING_BRANCH = 'integration/children-story-staging-132-20261115';
export const TARGET_CHANNEL = 'staging-user';
export const TARGET_PACKAGE = 'org.mzbministry.buklod.staging';
export const TARGET_RUNTIME = '1.3.2';
export const SCOPE_PATH = '.buklod/scopes/children-story-staging-20261115.json';
export const PREVIOUS_MARKER = 'BUKLOD_NOV15_CONSO_STAGING_OTA_' + STAGING_BASE;
export const PREVIOUS_STAGING_UPDATE_ID = '01a1dc49-05e7-73ec-9a61-c7eae9d1bdd9';
export const PREVIOUS_STAGING_GROUP_ID = 'f58acdd7-d800-4ae5-b9de-7d29640e04bb';
export const RELEASE_MARKER = 'BUKLOD_CHILD_STORY_STAGING_132_20261115_';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const read = name => JSON.parse(fs.readFileSync(name, 'utf8'));
const write = (name,value) => fs.writeFileSync(name, JSON.stringify(value,null,2) + '\n');

export function validateSourcePaths(changed, allowed) {
  assert.ok(changed.length > 15, 'Story source changes missing');
  assert.equal(new Set(changed).size,changed.length,'Duplicate changes');
  assert.deepEqual([...changed].sort(),[...allowed].sort(),'Unapproved staging delta');
  const mustRemainUnchanged=[
    /^app\.config\./, /^eas\.json$/, /^package(?:-lock)?\.json$/,
    /^android\//, /^ios\//, /^plugins\//, /^assets\//,
    /^google-services/, /^babel\.config\./, /^metro\.config\./,
    /^supabase\/functions\//, /^src\/providers\/(?:AuthProvider|AdsProvider)/,
    /^src\/lib\/supabase\.ts$/, /^src\/components\/CommunityVideo/
  ];
  for(const path of changed) {
    assert.equal(mustRemainUnchanged.some(pattern=>pattern.test(path)),false,'Native/protected regression: '+path);
  }
  assert.ok(changed.includes('src/app/children-stories/index.tsx'));
  assert.ok(changed.includes('src/app/children-stories/[id].tsx'));
  assert.ok(changed.includes('src/components/home/BuklodHomeUtilityCards.tsx'));
  assert.ok(changed.includes('src/lib/buklodGlobalAdController.ts'));
  assert.ok(changed.includes('tests/children-stories-staging-ota-20261115.test.mjs'));
  assert.ok(changed.includes('.github/workflows/buklod-children-story-staging-ota-20261115.yml'));
  // All schema changes are bundled as migration source only. No apply_migration.
  assert.deepEqual(changed.filter(p=>p.startsWith('supabase/')),
    ['supabase/migrations/20261115090000_buklod_children_stories_v1.sql',
     'supabase/tests/buklod_children_stories_rls_contract_20261115.sql']);
}

export function validateExistingRelease(previousUpdates, originalStageManifest) {
  const rows = previousUpdates.currentPage ?? previousUpdates;
  assert.ok(Array.isArray(rows)&&rows.length>0,'Cannot resolve prior EAS updates');
  // EAS update:list renders the message as: "message" (3 hours ago by author).
  // Compare the *whole quoted message* only; never accept partial SHA matches.
  const displayedMessage=String(rows[0].message??'');
  const parsed=/^"([^"]+)" \([^()]+\)$/.exec(displayedMessage);
  const actualMessage=parsed?parsed[1]:displayedMessage;
  assert.equal(actualMessage,PREVIOUS_MARKER,
    'Staging channel advanced past inspected baseline; abort to avoid regression');
  assert.equal(rows[0].runtimeVersion,TARGET_RUNTIME,'Previous staging runtime changed');
  const previousId = originalStageManifest.id?.toLowerCase();
  assert.equal(previousId,PREVIOUS_STAGING_UPDATE_ID,
    'Current staging manifest is not the inspected baseline');
  assert.equal(rows[0].group,PREVIOUS_STAGING_GROUP_ID,
    'Current staging group differs from last independently verified release');
  return { id: previousId, group: rows[0].group, message: PREVIOUS_MARKER };
}

export function verifySource(sha) {
  assert.match(sha,/^[0-9a-f]{40}$/);
  assert.equal(git('rev-parse','HEAD'),sha,'Wrong exact source head');
  assert.equal(git('merge-base',STAGING_BASE,sha),STAGING_BASE,'Could overwrite newest staged fix');
  assert.equal(git('merge-base',APK_SOURCE,sha),APK_SOURCE,'Not signed APK native lineage');
  const declared=read(SCOPE_PATH);
  assert.equal(declared.baseRef,STAGING_BASE);
  assert.equal(declared.releaseMode,'isolated-android-staging-ota');
  const changed=git('diff','--name-only',STAGING_BASE,sha,'--').split('\n').filter(Boolean);
  validateSourcePaths(changed,declared.allowedPaths);
  assert.equal(git('status','--porcelain','--untracked-files=no'),'','Source dirty');
  assert.match(fs.readFileSync('src/lib/buklodGlobalAdController.ts','utf8'),/['"]\/children-stories['"]/);
  assert.match(fs.readFileSync('src/components/BuklodAdSafetyRouteBridge.tsx','utf8'),/if \(!isBuklodAdRouteSensitive\(\)\)/);
  const config = requireStagingConfig();
  assert.equal(config.runtimeVersion,TARGET_RUNTIME);
  assert.equal(config.android.package,TARGET_PACKAGE);
  assert.equal(config.extra.eas.projectId,PROJECT);
  assert.equal(config.extra.appEnvironment,'staging');
  assert.equal(config.extra.appTarget,'main');
  const eas=read('eas.json');
  assert.equal(eas.build['staging-user'].channel,TARGET_CHANNEL);
  assert.equal(eas.build['staging-user'].environment,'preview');
  assert.equal(eas.build.production.channel,'production');
}
export function requireStagingConfig() {
  const configModule = fs.readFileSync('app.config.js','utf8');
  assert.match(configModule,/runtimeVersion: isClassroom \? '1\.3\.0' : '1\.3\.2'/);
  // app.config is CommonJS; createRequire here to avoid spoofing runtime inputs.
  return requireFromEsm()({config:{}});
}
function requireFromEsm() {
  // isolated to keep the validation function side-effect-free until invocation
  return requireConfig;
}
import { createRequire } from 'node:module';
const requireConfig = createRequire(import.meta.url)('../app.config.js');

export async function run(mode,sha,dir) {
  assert.ok(typeof dir==='string' && /^\/tmp\/buklod-children-story-/.test(dir),'Evidence directory must be isolated under /tmp');
  verifySource(sha);
  if(mode==='verify-source'){
    console.log('VERIFIED_CHILDREN_STORIES_STAGING_SOURCE='+sha);
  } else if(mode==='preflight'){
    verifyBuild(read(dir+'/build.json'));
    const branch=verifyChannels(read(dir+'/staging-channel.json'),read(dir+'/production-channel.json'));
    assert.equal(branch.name,TARGET_CHANNEL);
    const production=await manifest('production');
    assert.equal(production.extra?.expoClient?.android?.package,'org.mzbministry.buklod');
    const stage=await manifest('staging-user');
    assert.equal(stage.extra?.expoClient?.android?.package,TARGET_PACKAGE);
    const previous=validateExistingRelease(read(dir+'/previous-updates.json'),stage);
    write(dir+'/preflight.json',{
      sourceSha:sha,baseSha:STAGING_BASE,buildId:BUILD_ID,
      branch,previous,previousStageId:stage.id,productionUpdateId:production.id,
      package:TARGET_PACKAGE,runtimeVersion:TARGET_RUNTIME,
      physicalDeviceAcceptance:'SKIPPED BY OWNER',databaseMigrationApplied:false,
      otaPublished:false
    });
  } else if(mode==='postpublish') {
    const prior=read(dir+'/preflight.json');
    assert.equal(prior.sourceSha,sha);
    const update=verifyUpdate(read(dir+'/update-view.json'),sha,prior.branch.name);
    const current=await manifest('staging-user');
    assert.equal(current.id.toLowerCase(),update.id.toLowerCase(),'Staging endpoint does not serve our update');
    assert.equal(current.extra?.expoClient?.android?.package,TARGET_PACKAGE);
    assert.equal(current.extra?.expoClient?.extra?.appEnvironment,'staging');
    const production=await manifest('production');
    assert.equal(production.id,prior.productionUpdateId,'Production update mutated');
    verifyChannels(read(dir+'/staging-channel-after.json'),read(dir+'/production-channel-after.json'));
    write(dir+'/verification.json',{
      status:'VERIFIED_SERVER_SIDE_CHILDREN_STORIES_STAGING_OTA',
      sourceSha:sha,baseSha:STAGING_BASE,buildId:BUILD_ID,
      groupId:update.group,updateId:update.id,branch:update.branch,
      channel:TARGET_CHANNEL,package:TARGET_PACKAGE,runtimeVersion:TARGET_RUNTIME,
      platform:'android',createdAt:update.createdAt,environment:'preview',
      productionUpdateIdUnchanged:production.id,physicalDeviceAcceptance:'SKIPPED BY OWNER',
      nativeRebuild:false,databaseMigrationApplied:false,webDeployment:false,
      githubRunUrl:'https://github.com/'+process.env.GITHUB_REPOSITORY+'/actions/runs/'+process.env.GITHUB_RUN_ID
    });
    console.log('VERIFIED_CHILDREN_STORIES_STAGING_UPDATE_ID='+update.id);
  } else throw Error('Unknown mode');
}
if(process.argv[1] && pathToFileURL(process.argv[1]).href===import.meta.url){
  run(...process.argv.slice(2)).catch(error=>{console.error('CHILDREN_STORIES_STAGING_HOLD:',error.message);process.exitCode=1;});
}
