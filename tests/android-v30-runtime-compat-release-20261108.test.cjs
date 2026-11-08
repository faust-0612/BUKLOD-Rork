'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {resolveExpoConfigFromSource,assertNativeRuntimeCompatible}=require('../scripts/native-expo-config-compat.cjs');
const {execFileSync}=require('node:child_process');
const mainBaseline='d67e805879e3398cbff8a4383c6c7e05039ed9f7';
const pinnedV28='2f26645e50e8e079ebf09f3999aacfc506ae7651';
const workflow=fs.readFileSync('.github/workflows/buklod-v30-aab-production-20261108.yml','utf8');
function conf(target='main',variant='production'){
 const previous={BUKLOD_APP_TARGET:process.env.BUKLOD_APP_TARGET,APP_VARIANT:process.env.APP_VARIANT,EXPO_PUBLIC_APP_ENV:process.env.EXPO_PUBLIC_APP_ENV};
 try{
  process.env.BUKLOD_APP_TARGET=target;process.env.APP_VARIANT=variant;process.env.EXPO_PUBLIC_APP_ENV=variant;
  return require('../app.config.js')({config:{}});
 }finally{
  for(const [key,val] of Object.entries(previous)){if(val===undefined)delete process.env[key];else process.env[key]=val;}
 }
}

test('V30 is new BUKLOD Main Play bundle with code greater than already built V29',()=>{
 const current=conf();
 assert.equal(current.version,'1.3.6');
 assert.equal(current.android.versionCode,30);
 assert.equal(current.name,'BUKLOD');
 assert.equal(current.android.package,'org.mzbministry.buklod');
 assert.equal(current.runtimeVersion,'1.3.2');
 assert.equal(current.extra.eas.projectId,'23dad7d0-389a-406e-8dec-08965dab85d8');
 assert.equal(current.updates.url,'https://u.expo.dev/23dad7d0-389a-406e-8dec-08965dab85d8');
});

test('V30 only changes native-exempt Play metadata from verified live main',()=>{
 const baseline=execFileSync('git',['show',mainBaseline+':app.config.js'],{encoding:'utf8'});
 const old=resolveExpoConfigFromSource(baseline,{
  ...process.env,APP_VARIANT:'production',EXPO_PUBLIC_APP_ENV:'production',BUKLOD_APP_TARGET:'main',
 });
 assert.equal(old.android.versionCode,29);
 assert.equal(old.version,'1.3.5');
 const current=conf();
 assertNativeRuntimeCompatible(current,old);
 const pinned=execFileSync('git',['show',pinnedV28+':app.config.js'],{encoding:'utf8'});
 assertNativeRuntimeCompatible(current,resolveExpoConfigFromSource(pinned,{
  ...process.env,APP_VARIANT:'production',EXPO_PUBLIC_APP_ENV:'production',BUKLOD_APP_TARGET:'main',
 }));
 const diff=execFileSync('git',['diff','--name-only',pinnedV28,'HEAD','--','android','plugins','package-lock.json','package.json'],{encoding:'utf8'});
 assert.equal(diff.trim(),'','No native dependency drift from installed V28 runtime');
});

test('Classroom and staging app identity/version stay untouched',()=>{
 const classroom=conf('classroom','production'),staging=conf('main','staging');
 assert.equal(classroom.version,'1.3.4');
 assert.equal(classroom.android.versionCode,28);
 assert.equal(classroom.android.package,'org.mzbministry.buklod.classroom');
 assert.equal(classroom.runtimeVersion,'1.3.0');
 assert.equal(staging.version,'1.3.4');
 assert.equal(staging.android.versionCode,undefined);
 assert.equal(staging.android.package,'org.mzbministry.buklod.staging');
});

test('V30 builder uses one guarded production AAB build, no APK, OTA/web deployment or Google Play submit',()=>{
 const eas=JSON.parse(fs.readFileSync('eas.json','utf8'));
 assert.equal(eas.cli.appVersionSource,'local');
 assert.equal(eas.build.production.android.buildType,'app-bundle');
 assert.equal(eas.build.production.channel,'production');
 assert.equal(eas.build.production.environment,'production');
 assert.notEqual(eas.build.production.autoIncrement,true);
 assert.match(workflow,/BUKLOD_V30_AAB_BUILD_20261108/);
 assert.match(workflow,/d67e805879e3398cbff8a4383c6c7e05039ed9f7/);
 assert.match(workflow,/git ls-remote origin refs\/heads\/main/);
 assert.match(workflow,/--platform android --profile production --non-interactive --wait --json/);
 assert.match(workflow,/a\.equal\(String\(b\.appBuildVersion\),'30'\)/);
 assert.match(workflow,/app-bundle/);
 assert.match(workflow,/runtimeVersion, '1\.3\.2'/);
 assert.match(workflow,/\[\s\S\]*?assertNativeRuntimeCompatible|native-expo-config-compat\.test/);
 assert.doesNotMatch(workflow,/eas-cli@latest\s+(?:submit|update|deploy)\b/);
 assert.doesNotMatch(workflow,/--profile production-apk/);
});
