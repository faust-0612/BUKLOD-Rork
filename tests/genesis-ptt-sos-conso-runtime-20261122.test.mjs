import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const cfg=readFileSync('app.config.js','utf8');
const scope=JSON.parse(readFileSync('.buklod/releases/genesis-ptt-sos-conso-staging-prep-20261122.json','utf8'));
const ptt=readFileSync('src/ptt/buklodPttSetup.ts','utf8');
const SOS=readFileSync('src/components/BuklodGlobalEmergencyHost.tsx','utf8');

test('New bundled SOS native sound isolates staging runtime from installed old APKs',()=>{
 assert.match(cfg,/genesisNativePreview \? '2\.0\.1-genesis-sos' : '1\.3\.2'/);
 assert.match(cfg,/genesisNativePreview \? '2\.0\.1' : '1\.3\.6'/);
 assert.match(cfg,/sounds: \['\.\/assets\/sounds\/buklod_alert\.wav'\]/);
 assert.match(cfg,/isStaging \? 'org\.mzbministry\.buklod\.staging' : 'org\.mzbministry\.buklod'/);
 assert.equal(scope.deploymentDependencies.runtimeVersion,'2.0.1-genesis-sos');
 assert.equal(scope.actualPublishedNow,false);
 assert.equal(scope.productionUnchanged,true);
});

test('Cumulative source still includes real PTT setup and authorized SOS overlay',()=>{
 assert.ok(ptt.length>200);
 assert.match(SOS,/buklod_help_get_rescue_coordinates/);
 assert.match(SOS,/buklod_help_refresh_opted_in_presence/);
});
