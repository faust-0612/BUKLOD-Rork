import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RELEASE_PATHS,FROZEN_SOURCE,VERIFIED_BASE,BRANCH,PRIOR_STAGE_ID,PRIOR_PROD_ID} from '../scripts/buklod-nov16-all-v3-stage132-policy.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const yaml=read('.github/workflows/buklod-nov16-all-v3-stage132-ota.yml');
const policy=read('scripts/buklod-nov16-all-v3-stage132-policy.mjs');
const manifest=JSON.parse(read('.buklod/scopes/nov16-all-v3-stage132-release.json'));

test('staging-only release source is anchored to exact verified content and matching frozen app',()=>{
 assert.equal(FROZEN_SOURCE,'bf8e82019297dc6642b92748bf8f3498cf15ae67');
 assert.equal(VERIFIED_BASE,'a9e8e74c80bbbdb4496ef8b836cde896434119ac');
 assert.equal(PRIOR_STAGE_ID,'01a1e0f0-5d84-74c7-915c-7a28acbf7629');
 assert.equal(PRIOR_PROD_ID,'01a1dff8-7563-790b-a714-22c316f56590');
 assert.equal(BRANCH,'release/nov16-conso-all-v3-stage132-once');
 assert.deepEqual(RELEASE_PATHS.slice().sort(),[
 '.github/workflows/buklod-nov16-all-v3-stage132-ota.yml',
 '.buklod/scopes/nov16-all-v3-stage132-release.json',
 'scripts/buklod-nov16-all-v3-stage132-policy.mjs',
 'tests/nov16-all-v3-stage132-release.test.mjs'
 ].sort());
 assert.equal(manifest.contractVersion,2);
 assert.deepEqual(manifest.allowedPaths.slice().sort(),RELEASE_PATHS.slice().sort());
 assert.match(policy,/Post-reviewed app source changed/);
 assert.match(policy,/Native, app, assets, DB or dependency release mutation forbidden/);
});
test('no production or web publication; signed stage APK and EAS freshness rechecked before publish',()=>{
 assert.match(yaml,/branches: \[release\/bible-132-dialogue-staging132-once-20261116\]/);
 assert.match(yaml,/startsWith\(github\.event\.head_commit\.message, 'BUKLOD_NOV16_ALL_V3_STAGING_PUBLISH:'\)/);
 assert.match(yaml,/pull_number:858/);
 assert.match(yaml,/Engineering Accountability/);
 assert.match(yaml,/BUKLOD Main - Report Door and Legacy Integration PR QA/);
 assert.match(yaml,/build:view bc4be208-bfb0-42f3-95cb-358353d0600f/);
 assert.match(yaml,/expo export --platform android/);
 assert.match(yaml,/update --channel staging-user --platform android/);
 assert.doesNotMatch(yaml,/update --channel production|--platform ios|build --platform android|submit --platform/i);
 assert.match(policy,/verifyBuild\(read\(dir\+'\/build.json'\)\)/);
 assert.match(policy,/Staging changed during export: stop/);
 assert.match(policy,/PRODUCTION MOVED: do not claim unchanged/);
 assert.match(policy,/physicalDeviceVerification:'SKIPPED BY OWNER'/);
});
test('new 132 story content remains unchanged in release commit, and production can never be marked published based on CI alone',()=>{
 const content=read('src/features/childrenStories/bibleExpansion.ts');
 assert.match(content,/BIBLE_EXPANSION_DIALOGUES_NEW_B/);
 assert.match(content,/retellingNotice:local/);
 assert.match(yaml,/verify.*production|prod-channel-after.json/);
 assert.match(yaml,/postpublish/);
 assert.match(yaml,/stage-updates-after.json/);
 assert.match(yaml,/BUKLOD_NOV16_ALL_V3_STAGE132_/);
 assert.match(read('src/lib/buklodHenryTranslation.ts'),/henry-translation-v3:/);
 assert.match(yaml,/henry-natural-filipino-20261116.test.cjs/);
});
