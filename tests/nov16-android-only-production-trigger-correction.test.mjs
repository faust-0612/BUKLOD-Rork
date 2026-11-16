import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import test from 'node:test';
const android=readFileSync(new URL('../.github/workflows/production_android_ota.yml',import.meta.url),'utf8');
const web=readFileSync(new URL('../.github/workflows/production_web_deploy.yml',import.meta.url),'utf8');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const scope=JSON.parse(readFileSync(new URL('../release/nov16-android-only-trigger-correction.json',import.meta.url),'utf8'));

test('Android-only owner release marker is recognized by native production workflow but excluded from web',()=>{
 assert.match(android,/startsWith\(github\.event\.head_commit\.message, 'BUKLOD_ANDROID_ONLY_PROD_20261114:'\)/);
 assert.doesNotMatch(web,/BUKLOD_ANDROID_ONLY_PROD_20261114:/);
 assert.match(web,/test "\$\(git ls-remote origin refs\/heads\/main/);
 assert.match(android,/test "\$\(git ls-remote origin refs\/heads\/main/);
});
test('After source-equivalent promotion, no app or backend bytes can differ from verified staging',()=>{
 assert.equal(scope.stagedUpdateId,'01a1e2c9-3ec3-76be-b931-84f5e0ebafc2');
 assert.equal(scope.runtimeVersion,'1.3.2');
 const changed=git('diff','--name-only',scope.stagedSourceSha,'HEAD','--','src/','assets/','app.config.js','eas.json','package.json','package-lock.json','android/','ios/','plugins/','supabase/');
 assert.equal(changed,'');
});
