'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
const {resolveExpoConfigFromSource, assertNativeRuntimeCompatible} = require('../scripts/native-expo-config-compat.cjs');
const baseline='d67e805879e3398cbff8a4383c6c7e05039ed9f7';
const pinnedV28='2f26645e50e8e079ebf09f3999aacfc506ae7651';
const removedPermission='android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE';
function configFor(target='main',variant='production') {
 const old={BUKLOD_APP_TARGET:process.env.BUKLOD_APP_TARGET,APP_VARIANT:process.env.APP_VARIANT,EXPO_PUBLIC_APP_ENV:process.env.EXPO_PUBLIC_APP_ENV};
 try {
  process.env.BUKLOD_APP_TARGET=target;process.env.APP_VARIANT=variant;process.env.EXPO_PUBLIC_APP_ENV=variant;
  return require('../app.config.js')({config:{}});
 } finally { for(const [k,v] of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v;} }
}
function historicConfig(commit) {
 const s=execFileSync('git',['show',commit+':app.config.js'],{encoding:'utf8'});
 return resolveExpoConfigFromSource(s,{...process.env,APP_VARIANT:'production',EXPO_PUBLIC_APP_ENV:'production',BUKLOD_APP_TARGET:'main'});
}
test('V30 production release identity and existing OTA runtime are preserved',()=>{
 const c=configFor();
 assert.equal(c.name,'BUKLOD');
 assert.equal(c.version,'1.3.6');
 assert.equal(c.android.versionCode,30);
 assert.equal(c.runtimeVersion,'1.3.2');
 assert.equal(c.android.package,'org.mzbministry.buklod');
 assert.equal(c.extra.eas.projectId,'23dad7d0-389a-406e-8dec-08965dab85d8');
 assert.equal(c.updates.url,'https://u.expo.dev/23dad7d0-389a-406e-8dec-08965dab85d8');
 const e=JSON.parse(fs.readFileSync('eas.json','utf8'));
 assert.equal(e.build.production.android.buildType,'app-bundle');
 assert.equal(e.build.production.channel,'production');
 assert.equal(e.build.production.environment,'production');
 assert.equal(e.cli.appVersionSource,'local');
});
test('connectedDevice foreground-service permission is blocked and not emitted by PTT plugin',()=>{
 const c=configFor();
 assert.equal(c.android.blockedPermissions.filter(p=>p===removedPermission).length,1);
 const plugin=fs.readFileSync('plugins/withBuklodPttHardwareFoundation.js','utf8');
 assert.doesNotMatch(plugin,/\['android\.permission\.FOREGROUND_SERVICE_CONNECTED_DEVICE',\s*null\]/);
 for(const existing of ['BLUETOOTH_SCAN','BLUETOOTH_CONNECT','NEARBY_WIFI_DEVICES']){
  assert.match(plugin,new RegExp('android\\.permission\\.'+existing));
 }
 for(const allowed of ['CAMERA','RECORD_AUDIO']){
  assert.ok(c.android.permissions.includes('android.permission.'+allowed));
 }
});
test('V30 makes only a documented FGS permission deletion compared with V28/V29 native config',()=>{
 const current=configFor();
 const normalized=JSON.parse(JSON.stringify(current));
 normalized.android.blockedPermissions=normalized.android.blockedPermissions.filter(p=>p!==removedPermission);
 assertNativeRuntimeCompatible(normalized,historicConfig(baseline));
 assertNativeRuntimeCompatible(normalized,historicConfig(pinnedV28));
 const paths=execFileSync('git',['diff','--name-only',pinnedV28,'HEAD','--','android','plugins','package-lock.json','package.json'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
 assert.deepEqual(paths,['plugins/withBuklodPttHardwareFoundation.js'],'Unexpected native or dependency drift beyond targeted PTT manifest permission');
 const historicPlugin=execFileSync('git',['show',pinnedV28+':plugins/withBuklodPttHardwareFoundation.js'],{encoding:'utf8'});
 const currentPlugin=fs.readFileSync('plugins/withBuklodPttHardwareFoundation.js','utf8');
 const expected=historicPlugin.replace("  ['android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE', null],\n","  // No connectedDevice foreground service: PTT uses Stream VoIP transport.\n");
 assert.equal(currentPlugin,expected,'PTT plugin has other native changes');
});
test('staging and Classroom app identities remain isolated',()=>{
 const s=configFor('main','staging'),c=configFor('classroom','production');
 assert.equal(s.version,'1.3.4');assert.equal(s.android.versionCode,undefined);
 assert.equal(s.android.package,'org.mzbministry.buklod.staging');
 assert.equal(c.version,'1.3.4');assert.equal(c.android.versionCode,28);
 assert.equal(c.android.package,'org.mzbministry.buklod.classroom');
 assert.equal(c.runtimeVersion,'1.3.0');
});
test('V30 build workflow validates the final AAB manifest without submitting to Play or OTA',()=>{
 const w=fs.readFileSync('.github/workflows/buklod-v30-aab-production-20261108.yml','utf8');
 assert.match(w,/BUKLOD_V30_AAB_BUILD_20261108/);
 assert.match(w,/--platform android --profile production --non-interactive --wait --json/);
 assert.match(w,/bundletool.*dump manifest/);
 assert.match(w,/FOREGROUND_SERVICE_CONNECTED_DEVICE/);
 assert.match(w,/versionCode,30/);
 assert.match(w,/runtimeVersion, '1\.3\.2'/);
 assert.doesNotMatch(w,/eas-cli@latest\s+(?:submit|update|deploy)\b/);
});
