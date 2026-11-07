import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const workflow=read('.github/workflows/buklod-authorized-production-20261107.yml');
const android=read('.github/workflows/production_android_ota.yml');
const web=read('.github/workflows/production_web_deploy.yml');
const wall=read('src/app/(tabs)/buklod.tsx');
const hub=read('src/app/(tabs)/hub.tsx');
const source=read('src/components/BuklodCommunitySponsoredAd.tsx');
const config=read('app.config.js');
const marker='release(buklod): Paid sponsorship Wall and desktop Home 2026-11-07';

test('new paid sponsorship production authorization is exact main commit, not arbitrary pushes',()=>{
 assert.match(workflow,/branches: \[main\]/);
 assert.match(workflow,/paths: \[\.github\/workflows\/buklod-authorized-production-20261107\.yml\]/);
 assert.match(workflow,/if: >-\s*\n\s+github\.event_name == 'push'/);
 assert.ok(workflow.includes("startsWith(github.event.head_commit.message, '"+marker+"')"));
 assert.match(workflow,/test "\$GITHUB_REF" = "refs\/heads\/main"/);
 assert.match(workflow,/test "\$head" = "\$GITHUB_SHA"/);
 assert.doesNotMatch(workflow,/npx eas-cli|npx eas update|npx eas deploy/);
});

test('one exact sponsorship marker dispatches unchanged Android and web production workflows',()=>{
 const label="'"+marker+"')";
 const targets='targets=("production_android_ota.yml|BUKLOD/Android production OTA" "production_web_deploy.yml|BUKLOD/Expo Hosting production web") ;;';
 const caseBody=workflow.slice(workflow.indexOf('case "$commit_title" in'));
 assert.ok(caseBody.includes(label+'\n              '+targets),'both original publishers must be selected');
 assert.match(workflow,/for entry in "\$\{targets\[@\]\}"; do/);
 assert.match(workflow,/\$api\/actions\/workflows\/\$workflow\/dispatches/);
 assert.match(workflow,/if \[ "\$code" != 204 \]/);
 assert.match(android,/workflow_dispatch:/);
 assert.match(web,/workflow_dispatch:/);
 assert.match(android,/node scripts\/android-ota-rc\.cjs baseline/);
 assert.match(android,/node scripts\/android-ota-rc\.cjs published/);
 assert.match(web,/sha256sum -c web-rc-sha256\.txt/);
 assert.match(web,/npx eas-cli@latest deploy --prod/);
});

test('production source contains automatic sponsored slots without unapproved content',()=>{
 assert.match(wall,/<BuklodCommunitySponsoredAd audience="public" placement="community" \/>/);
 assert.match(hub,/<BuklodCommunitySponsoredAd audience="public" placement="home" \/>/);
 assert.match(source,/\.eq\('status', 'approved'\)/);
 assert.match(source,/\.in\('payment_status', \['paid', 'waived'\]\)/);
 assert.match(source,/\.gt\('ends_at'/);
 assert.match(source,/REFRESH_MS = 60_000/);
 assert.match(config,/runtimeVersion: isClassroom \? '1\.3\.0' : '1\.3\.2'/);
});

test('completion recorder requires actual success of BOTH verified publishing steps',()=>{
 assert.match(workflow,/workflow_run:/);
 assert.match(workflow,/final_step="Publish exact frozen Android RC"/);
 assert.match(workflow,/final_step="Deployment status"/);
 assert.match(workflow,/\[ "\$conclusion" = success \] && \[ "\$final_result" = success \]/);
 assert.match(workflow,/state=failure/);
});
