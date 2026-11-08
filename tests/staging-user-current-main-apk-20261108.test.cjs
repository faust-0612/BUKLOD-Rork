'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const cp=require('node:child_process');
const base='da2ddfd8d5942865707ad6f308ff074fca73e99b';
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
 assert.equal(d.trim(),'app.config.js','Only explicit staging icon and staged versionName may differ from the latest V30 main source');
 const baselineIcon = "icon: isClassroom ? './assets/classroom/app-icon.png' : './assets/release/app-icon.png',";
 const canonicalIcon = "icon: isClassroom\\n      ? './assets/classroom/app-icon.png'\\n      : (isStaging ? './assets/release/buklod-main-canonical.png' : './assets/release/app-icon.png'),".replaceAll('\\n','\n');
 const baselineAdaptive = "foregroundImage: isClassroom\\n          ? './assets/classroom/adaptive-icon.png'\\n          : './assets/release/app-icon.png',".replaceAll('\\n','\n');
 const canonicalAdaptive = "foregroundImage: isClassroom\\n          ? './assets/classroom/adaptive-icon.png'\\n          : (isStaging ? './assets/release/buklod-main-canonical.png' : './assets/release/app-icon.png'),".replaceAll('\\n','\n');
 assert.ok(pinned.includes(baselineIcon) && pinned.includes(baselineAdaptive));
 const expected = pinned.replace("version: isClassroom || isStaging ? '1.3.4' : '1.3.6'", "version: isClassroom ? '1.3.4' : '1.3.6'").replace(baselineIcon,canonicalIcon).replace(baselineAdaptive,canonicalAdaptive);
 assert.equal(fs.readFileSync('app.config.js','utf8'),expected,'Staging-only native icon and versionName must be the entire app config delta');
 withStaging(c=>{
  assert.equal(c.name,'BUKLOD Staging');
  assert.equal(c.version,'1.3.6');
  assert.equal(c.icon,'./assets/release/buklod-main-canonical.png');
  assert.equal(c.android.adaptiveIcon.foregroundImage,'./assets/release/buklod-main-canonical.png');
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
test('staging Firebase fallback requires an actually registered staging package',()=>{
 const source=JSON.parse(fs.readFileSync('google-services.production.json','utf8'));
 const packages=source.client?.map(c=>c.client_info?.android_client_info?.package_name)||[];
 assert.ok(packages.includes('org.mzbministry.buklod.staging'),'staging Firebase client is registered');
 assert.ok(packages.includes('org.mzbministry.buklod'),'original production Firebase client remains');
 assert.match(flow,/STAGING_FIREBASE_JSON_B64/);
 assert.match(flow,/f\.client\?\.some\(x=>x\.client_info\?\.android_client_info\?\.package_name==='org\.mzbministry\.buklod\.staging'/);
 assert.match(flow,/cp google-services\.production\.json google-services\.staging\.json/);
 assert.match(flow,/test -s google-services\.staging\.json/);
 assert.match(flow,/google-services\.staging\.json/);
});

test('dynamic app.config.js staging autoIncrement uses remote source only in build runner',()=>{
 assert.equal(eas.cli.appVersionSource,'local','production EAS config remains local');
 assert.equal(eas.build['staging-user'].autoIncrement,true);
 assert.match(flow,/eas\.cli\.appVersionSource='remote'/);
 assert.match(flow,/test "\$\(git diff --name-only\)" = "eas\.json"/);
 assert.match(flow,/assert\.equal\(c\.runtimeVersion,'1\.3\.2'\)/);
 assert.match(flow,/assert\.equal\(eas\.build\.production\.channel,'production'\)/);
 assert.match(flow,/--profile staging-user --non-interactive --wait --json/);
});

test('only user-authorized live-main commit can trigger one staging-user APK without release side effects',()=>{
 assert.match(flow,/BUKLOD_STAGING_USER_CANONICAL_V30_APK_20261108/);
 assert.match(flow,/git merge-base --is-ancestor da2ddfd8d5942865707ad6f308ff074fca73e99b/);
 assert.match(flow,/git ls-remote origin refs\/heads\/main/);
 assert.match(flow,/--platform android --profile staging-user --non-interactive --wait --json/);
 assert.match(flow,/status\)\.toLowerCase\(\),'finished'/);
 assert.match(flow,/\.apk\$/);
 assert.doesNotMatch(flow,/eas-cli@latest\s+(?:update|deploy|submit)\b/);
 assert.doesNotMatch(flow,/--profile production-apk|--profile production\s/);
 assert.doesNotMatch(flow,/BUKLOD_V30_AAB_BUILD_20261108/);
});

test('canonical staging mark does not silently alter production Android icon or runtime',()=>{
 const key='APP_VARIANT';
 const old=process.env[key];
 try{
  process.env[key]='production';
  const prod=config({config:{}});
  assert.equal(prod.name,'BUKLOD');
  assert.equal(prod.version,'1.3.6');
  assert.equal(prod.icon,'./assets/release/app-icon.png');
  assert.equal(prod.android.adaptiveIcon.foregroundImage,'./assets/release/app-icon.png');
  assert.equal(prod.android.package,'org.mzbministry.buklod');
  assert.equal(prod.runtimeVersion,'1.3.2');
 }finally{old===undefined?delete process.env[key]:process.env[key]=old;}
 assert.ok(fs.statSync('assets/release/buklod-main-canonical.png').size>0);
 assert.match(flow,/HEAD:assets\\/release\\/buklod-main-canonical\\.png/);
});
