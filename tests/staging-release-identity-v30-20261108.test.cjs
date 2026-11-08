'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const source='da2ddfd8d5942865707ad6f308ff074fca73e99b';
const flow=fs.readFileSync('.github/workflows/buklod-staging-user-latest-main-apk-20261108.yml','utf8');
function config(variant){
 const before={APP_VARIANT:process.env.APP_VARIANT,EXPO_PUBLIC_APP_ENV:process.env.EXPO_PUBLIC_APP_ENV,BUKLOD_APP_TARGET:process.env.BUKLOD_APP_TARGET};
 try{
  process.env.APP_VARIANT=variant;
  process.env.EXPO_PUBLIC_APP_ENV=variant;
  process.env.BUKLOD_APP_TARGET='main';
  return require('../app.config.js')({config:{}});
 }finally{
  for(const [k,v] of Object.entries(before)){if(v==null)delete process.env[k];else process.env[k]=v;}
 }
}
test('release-identity: latest main must own the canonical green-B staging launcher and exact Android package',()=>{
 const s=config('staging');
 assert.equal(s.name,'BUKLOD Staging');
 assert.equal(s.version,'1.3.6');
 assert.equal(s.runtimeVersion,'1.3.2');
 assert.equal(s.android.package,'org.mzbministry.buklod.staging');
 assert.equal(s.icon,'./assets/release/buklod-main-canonical.png');
 assert.equal(s.android.adaptiveIcon.foregroundImage,s.icon);
 assert.equal(s.updates.url,'https://u.expo.dev/23dad7d0-389a-406e-8dec-08965dab85d8');
 assert.equal(execFileSync('git',['rev-parse','HEAD:assets/release/buklod-main-canonical.png'],{encoding:'utf8'}).trim(),'9a4e4a826191d6e310dc26f5c74d4611293ceb17');
 assert.match(flow,/BUKLOD_STAGING_USER_CANONICAL_V30_APK_20261108/);
 assert.ok(flow.includes('git merge-base --is-ancestor '+source));
});
test('release-identity: production icon, native runtime and package stay unchanged while staging builds separately',()=>{
 const p=config('production'),s=config('staging');
 assert.equal(p.icon,'./assets/release/app-icon.png');
 assert.equal(p.android.adaptiveIcon.foregroundImage,p.icon);
 assert.equal(p.version,'1.3.6');
 assert.equal(p.android.package,'org.mzbministry.buklod');
 assert.equal(p.runtimeVersion,'1.3.2');
 assert.equal(s.runtimeVersion,p.runtimeVersion);
 assert.match(flow,/--profile staging-user --non-interactive --wait --json/);
 assert.doesNotMatch(flow,/eas-cli@latest\\s+(?:update|deploy|submit)\\b/);
});
