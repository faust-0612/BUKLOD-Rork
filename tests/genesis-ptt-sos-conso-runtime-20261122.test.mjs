import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const cfg=readFileSync('app.config.js','utf8');
const eas=JSON.parse(readFileSync('eas.json','utf8'));
const scope=JSON.parse(readFileSync('.buklod/releases/genesis-ptt-sos-conso-staging-prep-20261122.json','utf8'));
const native=readFileSync('src/lib/pushNotifications.ts','utf8');
const ptt=readFileSync('src/ptt/buklodPttSetup.ts','utf8');
const SOS=readFileSync('src/components/BuklodGlobalEmergencyHost.tsx','utf8');

test('Old Genesis OTA native runtime preserved while SOS-only APK uses R3 runtime',()=>{
 assert.match(cfg,/runtimeVersion: isClassroom \? '1\.3\.0' : \(genesisNativePreview \? '2\.0\.0-genesis-preview' : '1\.3\.2'\)/);
 assert.match(cfg,/sosNativePreview \? \{ runtimeVersion: '2\.0\.1-genesis-sos' \} : \{\}/);
 assert.match(cfg,/sosNativePreview \? \{ version: '2\.0\.1' \} : \{\}/);
 assert.match(cfg,/sounds: \['\.\/assets\/sounds\/buklod_alert\.wav'\]/);
 assert.match(cfg,/isStaging \? 'org\.mzbministry\.buklod\.staging' : 'org\.mzbministry\.buklod'/);
 assert.equal(eas.build['season2-genesis-preview'].env.EXPO_PUBLIC_BUKLOD_SOS_NATIVE_R3,undefined);
 assert.equal(eas.build['season2-genesis-sos-preview'].env.EXPO_PUBLIC_BUKLOD_SOS_NATIVE_R3,'true');
 assert.equal(eas.build['season2-genesis-sos-preview'].channel,'season2-genesis-preview');
 assert.equal(scope.deploymentDependencies.runtimeVersion,'2.0.1-genesis-sos');
 assert.equal(scope.actualPublishedNow,false);
 assert.equal(scope.productionUnchanged,true);
});

test('Only an installed matching native runtime can register dedicated alarm channel',()=>{
 assert.match(native,/Updates\.runtimeVersion === '2\.0\.1-genesis-sos'/);
 assert.match(native,/setNotificationChannelAsync\('buklod-emergency-v2'/);
 assert.match(native,/buklod_help_register_emergency_channel/);
 assert.ok(ptt.length>200);
 assert.match(SOS,/buklod_help_get_rescue_coordinates/);
 assert.match(SOS,/buklod_help_refresh_opted_in_presence/);
});
