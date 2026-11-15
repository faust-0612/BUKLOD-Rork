#!/usr/bin/env node
// BUKLOD Children Stories: staging-user Android OTA on the existing Expo runtime 1.3.2.
// This is not a main merge, production release, backend migration, APK, or Play build.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import {
  APK_SOURCE, BUILD_ID, PROJECT, verifyBuild, verifyChannels, verifyUpdate, manifest,
} from './navigation-v2-owner-staging-policy.mjs';

const require = createRequire(import.meta.url);
const BASE = '2e7dc3aa69d2362b7b360013ccaac9917c353e2b';
const CHANNEL = 'staging-user';
const PACKAGE = 'org.mzbministry.buklod.staging';
const RUNTIME = '1.3.2';
const RELEASE_PATH = '.github/workflows/buklod-children-stories-staging-132-ota-20261115.yml';
const POLICY_PATH = 'scripts/children-stories-staging-132-policy.mjs';
const TEST_PATH = 'tests/children-stories-staging-132-release.test.mjs';
const SCOPE_PATH = '.buklod/scopes/children-story-world-staging-132-20261115.json';

const FEATURE_PATHS = [
  'src/features/childrenStories/catalog.ts',
  'src/features/childrenStories/service.ts',
  'src/features/childrenStories/StoryArt.tsx',
  'src/features/childrenStories/catalog.test.ts',
  'src/app/children-stories/index.tsx',
  'src/app/children-stories/[id].tsx',
  'src/app/admin/children-stories.tsx',
  'src/components/home/BuklodHomeUtilityCards.tsx',
  'src/app/admin/index.tsx',
  'src/app/_layout.tsx',
  'src/lib/buklodGlobalAdController.ts',
  'src/components/BuklodAdSafetyRouteBridge.tsx',
  'src/lib/buklodNavigationV2.ts',
  'src/components/BuklodFeatureFinder.tsx',
  'supabase/migrations/20261115090000_buklod_children_stories_v1.sql',
  'supabase/tests/buklod_children_stories_rls_contract_20261115.sql',
  'tests/children-stories-contract.test.mjs',
  'tests/children-stories-navigation-ad-safety.test.mjs',
];
const ALLOWED = new Set([...FEATURE_PATHS, RELEASE_PATH, POLICY_PATH, TEST_PATH, SCOPE_PATH]);
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const read = path => JSON.parse(fs.readFileSync(path,'utf8'));
const write = (path, obj) => fs.writeFileSync(path,JSON.stringify(obj,null,2)+'\n');
const compatible = (ancestor, source) => {
  try { execFileSync('git',['merge-base','--is-ancestor',ancestor,source],{stdio:'ignore'}); return true; }
  catch { return false; }
};

export function verifySource(sha) {
  assert.match(sha,/^[a-f\d]{40}$/);
  assert.equal(git('rev-parse','HEAD'),sha,'Exact staging source must be checked out');
  assert.ok(compatible(BASE,sha),'Previously accepted staging integration source missing');
  assert.ok(compatible(APK_SOURCE,sha),'Not derived from signed staging APK source');
  assert.equal(process.env.GITHUB_REF,'refs/heads/integration/children-stories-staging-132-20261115');
  const changed = git('diff','--name-only',BASE,sha,'--').split('\n').filter(Boolean);
  for (const path of changed) assert.ok(ALLOWED.has(path),'Unexpected staging source change: '+path);
  for (const path of FEATURE_PATHS) assert.ok(changed.includes(path),'Story feature incomplete: '+path);
  for (const path of [RELEASE_PATH,POLICY_PATH,TEST_PATH,SCOPE_PATH]) {
    assert.ok(changed.includes(path),'Missing release safety contract: '+path);
  }
  const forbidden = git('diff','--name-only',APK_SOURCE,sha,'--',
    'app.config.js','eas.json','package.json','package-lock.json','yarn.lock','pnpm-lock.yaml',
    'babel.config.js','android/','ios/','plugins/',
    'google-services.production.json','google-services.staging.json',
    'src/providers/AuthProvider.tsx','src/providers/AdsProvider.tsx','src/lib/supabase.ts'
  );
  assert.equal(forbidden,'','Native/Expo/auth/ads provider configuration differs from signed staging APK');
  const app = require('../app.config.js')({ config: {} });
  const eas = require('../eas.json');
  assert.equal(app.runtimeVersion,RUNTIME);
  assert.equal(app.android.package,PACKAGE);
  assert.equal(app.extra.appEnvironment,'staging');
  assert.equal(app.extra.appTarget,'main');
  assert.equal(app.extra.eas.projectId,PROJECT);
  assert.equal(eas.build['staging-user'].channel,CHANNEL);
  assert.equal(eas.build['staging-user'].environment,'preview');
  assert.notEqual(eas.build.production.channel,CHANNEL);
  assert.equal(git('status','--porcelain','--untracked-files=no'),'','Tracked source dirty');
  return changed;
}

export function verifyPreviousStage(views, liveManifest, newSha) {
  assert.ok(Array.isArray(views),'EAS update:view shape not recognized');
  const android = views.filter(u=>u.platform === 'android');
  assert.equal(android.length,1,'Expected exactly one previous Android staging update');
  const previous = android[0];
  assert.equal(previous.runtimeVersion,RUNTIME);
  assert.equal(previous.branch,CHANNEL);
  assert.equal(String(previous.id).toLowerCase(),String(liveManifest.id).toLowerCase(),
    'Current live staging update is not the most recent recorded branch update; protect newer staging work');
  const previousSha = previous.gitCommitHash;
  assert.match(previousSha??'',/^[a-f\d]{40}$/,'Cannot verify staging source lineage');
  assert.ok(compatible(previousSha,newSha),
    'Current staging OTA includes changes outside target source; do not overwrite newer fixes');
  return { previousSha, previousUpdateId:previous.id, previousGroup:previous.group };
}

export async function preflight(sha, dir) {
  verifySource(sha);
  verifyBuild(read(dir+'/build.json'));
  const branch=verifyChannels(read(dir+'/staging-channel-before.json'),read(dir+'/production-channel-before.json'));
  const prod=await manifest('production');
  const stage=await manifest(CHANNEL);
  assert.equal(prod.extra?.expoClient?.android?.package,'org.mzbministry.buklod');
  assert.equal(stage.extra?.expoClient?.android?.package,PACKAGE);
  const previous=verifyPreviousStage(read(dir+'/staging-previous-update-view.json'),stage,sha);
  write(dir+'/preflight.json',{
    sourceSha:sha,project:PROJECT,runtimeVersion:RUNTIME,package:PACKAGE,
    channel:CHANNEL,branch,buildId:BUILD_ID,apkSource:APK_SOURCE,
    productionUpdateId:prod.id,...previous,physicalDeviceAcceptance:'SKIPPED BY OWNER',
    backendMigration:'NOT APPLIED; bundled stories only',releaseStatus:'PREFLIGHT ONLY'
  });
}

export async function postpublish(sha,dir) {
  verifySource(sha);
  const pre=read(dir+'/preflight.json');
  assert.equal(pre.sourceSha,sha);
  const updates=read(dir+'/update-view.json');
  const published=verifyUpdate(updates,sha,pre.branch.name);
  const currentStage=await manifest(CHANNEL);
  assert.equal(String(currentStage.id).toLowerCase(),String(published.id).toLowerCase());
  assert.equal(currentStage.extra?.expoClient?.android?.package,PACKAGE);
  assert.equal(currentStage.extra?.expoClient?.extra?.appEnvironment,'staging');
  const prod=await manifest('production');
  assert.equal(prod.id,pre.productionUpdateId,'Production EAS manifest changed during staging OTA');
  verifyChannels(read(dir+'/staging-channel-after.json'),read(dir+'/production-channel-after.json'));
  write(dir+'/verification.json',{
    status:'VERIFIED SERVER-SIDE ANDROID STAGING 1.3.2 OTA',
    sourceSha:sha,updateId:published.id,updateGroup:published.group,
    project:PROJECT,package:PACKAGE,runtimeVersion:RUNTIME,
    branch:published.branch,channel:CHANNEL,platform:published.platform,
    buildId:BUILD_ID,createdAt:published.createdAt,
    physicalDeviceAcceptance:'SKIPPED BY OWNER',
    backendMigration:'NOT APPLIED',
    productionUpdateIdUnchanged:prod.id,
    githubRunUrl:'https://github.com/'+process.env.GITHUB_REPOSITORY+'/actions/runs/'+process.env.GITHUB_RUN_ID
  });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const [action,sha,dir] = process.argv.slice(2);
  (async () => {
    assert.ok(dir?.startsWith('/tmp/'));
    if (action === 'source') {
      verifySource(sha);
      console.log('CHILDREN_STORIES_STAGING_SOURCE_VERIFIED');
    } else if (action === 'preflight') await preflight(sha,dir);
    else if (action === 'postpublish') await postpublish(sha,dir);
    else throw Error('Invalid OTA policy action');
  })().catch(err => { console.error('CHILDREN_STORIES_STAGING_BLOCK:',err.message);process.exitCode=1; });
}
