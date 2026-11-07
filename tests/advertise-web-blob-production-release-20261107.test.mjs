import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const workflow=read('.github/workflows/buklod-authorized-production-20261107.yml');
const web=read('.github/workflows/production_web_deploy.yml');
const uploader=read('src/app/advertise/index.tsx');
const reader=read('src/lib/advertise/readAdvertiseUploadBody.ts');
const config=read('app.config.js');

test('explicit browser upload release is main-only and source-exact',()=>{
 assert.match(workflow,/branches: \[main\]/);
 assert.match(workflow,/paths: \[\.github\/workflows\/buklod-authorized-production-20261107\.yml\]/);
 assert.match(workflow,/if: >-\s*\n\s+github\.event_name == 'push'/);
 assert.match(workflow,/startsWith\(github\.event\.head_commit\.message, 'release\(buklod\): Advertise web file upload 2026-11-07'\)/);
 assert.match(workflow,/test "\$GITHUB_REPOSITORY" =/); // Verified repo identity must be checked.
 assert.match(workflow,/test "\$head" = "\$GITHUB_SHA"/);
});

test('one-shot browser upload release dispatches Expo web and never Android OTA',()=>{
 const marker="'release(buklod): Advertise web file upload 2026-11-07')";
 const target='targets=("production_web_deploy.yml|BUKLOD/Expo Hosting production web") ;;';
 assert.ok(workflow.includes(marker+'\n              '+target));
 const dispatcherCases=workflow.slice(workflow.indexOf('case "$commit_title" in'));
 const markerPosition=dispatcherCases.indexOf(marker);
 assert.ok(markerPosition>=0,'Release marker must be a shell case label');
 const caseBody=dispatcherCases.slice(markerPosition,dispatcherCases.indexOf(';;',markerPosition)+2);
 assert.doesNotMatch(caseBody,/production_android_ota\.yml/);
 assert.match(workflow,/for entry in "\$\{targets\[@\]\}"; do/);
 assert.match(workflow,/\$api\/actions\/workflows\/\$workflow\/dispatches/);
 assert.match(web,/workflow_dispatch:/);
 assert.match(web,/sha256sum -c web-rc-sha256\.txt/);
 assert.match(web,/npx eas-cli@latest deploy --prod/);
 assert.doesNotMatch(workflow,/npx eas-cli|npx eas update|npx eas deploy/);
});

test('published code includes web File path, native ArrayBuffer fallback, and owner-scoped uploads',()=>{
 assert.match(reader,/asset\.file \?\? \(await fetchWebBlob\(asset\.uri\)\)/);
 assert.match(reader,/if \(web\)/);
 assert.match(uploader,/Platform\.OS==='web'/);
 assert.match(uploader,/async\(\)=>decode\(await FileSystem\.readAsStringAsync/);
 assert.match(uploader,/user\.id\}\/\$\{folder\}/);
 assert.match(uploader,/uploadAsset\(proof,'paid-ad-payment','payment','proof'\)/);
 assert.match(uploader,/payment_status:'pending'/);
 assert.match(uploader,/status:'pending'/);
 assert.match(config,/runtimeVersion: isClassroom \? '1\.3\.0' : '1\.3\.2'/);
});

test('final publication state requires actual verified Expo Hosting deployment step',()=>{
 assert.match(workflow,/workflow_run:/);
 assert.match(workflow,/final_step="Deployment status"/);
 assert.match(workflow,/\[ "\$conclusion" = success \] && \[ "\$final_result" = success \]/);
 assert.match(workflow,/state=failure/);
});
