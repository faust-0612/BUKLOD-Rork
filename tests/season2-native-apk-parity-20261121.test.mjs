import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFileSync(resolve(root,p),'utf8');
test('Premium Season 2 OTA JS can reuse the verified Genesis staging native base with exact pinned source',()=>{
 const job=spawnSync(process.execPath,['scripts/season2-native-apk-source-parity.mjs'],{
  cwd:root,encoding:'utf8'});
 assert.equal(job.status,0,job.stderr||job.stdout);
 const report=JSON.parse(job.stdout);
 assert.equal(report.nativeSourceCompatible,true);
 assert.equal(report.signedNativeBaselineSha,'5bd80dbcafd85b0e8dc3c78f8d555b4aff2193d0');
 assert.equal(report.knownSignedEasBuildId,'d9e279a6-766b-4bd9-8316-3f700749594c');
 assert.equal(report.package,'org.mzbministry.buklod.staging');
 assert.equal(report.runtime,'2.0.0-genesis-preview');
 assert.equal(report.stagingOtaPublished,false);
 assert.equal(report.existingSignedApkLiveReverified,false);
});
test('Native compatibility compares pinned source and dependencies; cannot build or publish',()=>{
 const script=read('scripts/season2-native-apk-source-parity.mjs');
 const workflow=read('.github/workflows/season2-map-conso-source-qa-20261121.yml');
 for(const file of ['app.config.js','metro.config.js','babel.config.js','package-lock.json',
  'modules','plugins','android','ios','scripts/genesis-assert-native-autolinking.mjs'])
  assert.ok(script.includes(file),'Required native input missing: '+file);
 assert.match(script,/merge-base','--is-ancestor'/);
 assert.match(script,/git\(\['diff','--name-only'/);
 assert.match(script,/assert\.deepEqual\(currentPkg\[key\]/);
 assert.match(workflow,/fetch-depth: 0/);
 assert.match(workflow,/node scripts\/season2-native-apk-source-parity\.mjs/);
 assert.doesNotMatch(script,/\beas-cli\b|\beas update\b|\beas build\b|supabase\.rpc|apply_migration/i);
 assert.doesNotMatch(workflow,/\bEXPO_TOKEN\b|actions\/upload-artifact/);
});
