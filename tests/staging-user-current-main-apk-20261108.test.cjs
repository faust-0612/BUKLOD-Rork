'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const cp=require('node:child_process');
const base='d67e805879e3398cbff8a4383c6c7e05039ed9f7';
const flow=fs.readFileSync('.github/workflows/buklod-staging-user-latest-main-apk-20261108.yml','utf8');
const eas=JSON.parse(fs.readFileSync('eas.json','utf8'));
const config=require('../app.config.js');
function withStaging(cb){
 const prev={APP_VARIANT:process.env.APP_VARIANT,EXPO_PUBLIC_APP_ENV:process.env.EXPO_PUBLIC_APP_ENV,BUKLOD_APP_TARGET:process.env.BUKLOD_APP_TARGET};
 try{
  process.env.APP_VARIANT='staging';
  process.env.EXPO_PUBLIC_APP_ENV='staging';
  process.env.BUKLOD_APP_TARGET='main';
  return cb(config({config:{}}));
 }finally{
  for(const [k,v] of Object.entries(prev))v===undefined?delete process.env[k]:process.env[k]=v;
 }
}
test('staging-user APK shares current main source, independent package and the required runtime 1.3.2',()=>{
 const pinned=cp.execFileSync('git',['show',base+':app.config.js'],{encoding:'utf8'});
 assert.match(pinned,/runtimeVersion: isClassroom \? '1\.3\.0' : '1\.3\.2'/);
 const d=cp.execFileSync('git',['diff','--name-only',base,'HEAD','--','src','assets','app.config.js','eas.json','package.json','package-lock.json','plugins','android','ios'],{encoding:'utf8'});
 assert.equal(d.trim(),'','The staging build must have identical application source to verified live main');
 withStaging(c=>{
  assert.equal(c.name,'BUKLOD Staging');
  assert.equal(c.version,'1.3.4');
  assert.equal(c.runtimeVersion,'1.3.2');
  assert.equal(c.android.package,'org.mzbministry.buklod.staging');
  assert.equal(c.extra.eas.projectId,'23dad7d0-389a-406e-8dec-08965dab85d8');
  assert.equal(c.updates.url,'https://u.expo.dev/23dad7d0-389a-406e-8dec-08965dab85d8');
  assert.match(c.android.googleServicesFile,/google-services\.staging\.json/);
 });
});
test('staging-user uses Expo preview EAS environment and independent staging-user OTA channel',()=>{
 assert.equal(eas.cli.appVersionSource,'local');
 const p=eas.build['staging-user'];
 assert.equal(p.distribution,'internal');
 assert.equal(p.channel,'staging-user');
 assert.equal(p.environment,'preview');
 assert.equal(p.android.buildType,'apk');
 assert.equal(p.env.APP_VARIANT,'staging');
 assert.equal(p.env.EXPO_PUBLIC_APP_ENV,'staging');
 assert.equal(p.env.EXPO_PUBLIC_STREAM_ANDROID_PUSH_PROVIDER_NAME,'firebase-video-staging');
 assert.equal(p.autoIncrement,true);
});
test('only user-authorized live-main commit can trigger one staging-user APK without release side effects',()=>{
 assert.match(flow,/BUKLOD_STAGING_USER_CURRENT_MAIN_APK_20261108/);
 assert.match(flow,/git merge-base --is-ancestor d67e805879e3398cbff8a4383c6c7e05039ed9f7/);
 assert.match(flow,/git ls-remote origin refs\/heads\/main/);
 assert.match(flow,/--platform android --profile staging-user --non-interactive --wait --json/);
 assert.match(flow,/status\)\.toLowerCase\(\),'finished'/);
 assert.match(flow,/\.apk\$/);
 assert.doesNotMatch(flow,/eas-cli@latest\s+(?:update|deploy|submit)\b/);
 assert.doesNotMatch(flow,/--profile production-apk|--profile production\s/);
 assert.doesNotMatch(flow,/BUKLOD_V30_AAB_BUILD_20261108/);
});
