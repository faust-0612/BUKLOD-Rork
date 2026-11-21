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
 assert.equal(report.signedNativeBaselineSha,'a04d9ccf91e508a062bab8a7657297e574ae40a2');
 assert.equal(report.verifiedSignedApkSha256,'f2608820b522a2d58fbbcfe94be10df600f7c3915a509e625f53902288770900');
 assert.equal(report.verifiedSignedApkVersionCode,13);
 assert.equal(report.verifiedSignedEasBuildId,'42ce5047-70dc-47e1-b8a9-77948c9b8dba');
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
 assert.match(script,/cat-file','-e'/);
 assert.match(script,/git\(\['diff','--name-only'/);
 assert.match(script,/assert\.deepEqual\(currentPkg\[key\]/);
 assert.match(workflow,/fetch-depth: 0/);
 assert.match(workflow,/node scripts\/season2-native-apk-source-parity\.mjs/);
 assert.doesNotMatch(script,/\beas-cli\b|\beas update\b|\beas build\b|supabase\.rpc|apply_migration/i);
 assert.doesNotMatch(workflow,/\bEXPO_TOKEN\b|actions\/upload-artifact/);
});
