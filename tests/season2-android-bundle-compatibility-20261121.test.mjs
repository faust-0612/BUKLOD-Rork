import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFileSync(resolve(root,p),'utf8');
test('Premium Genesis Android source export preflight is no-publish and uses only canonical paid backend',()=>{
 const result=spawnSync(process.execPath,['scripts/season2-android-bundle-compatibility.mjs'],{
  cwd:root,encoding:'utf8'});
 assert.equal(result.status,0,result.stderr||result.stdout);
 const report=JSON.parse(result.stdout);
 assert.equal(report.sourceReady,true);
 assert.equal(report.androidExported,false);
 assert.equal(report.otaPublished,false);
 assert.equal(report.channel,'season2-genesis-preview');
 assert.equal(report.package,'org.mzbministry.buklod.staging');
});
test('Android Metro compiler is locked to staging and cannot touch Expo EAS publish or production',()=>{
 const script=read('scripts/season2-android-bundle-compatibility.mjs');
 const workflow=read('.github/workflows/season2-map-conso-source-qa-20261121.yml');
 assert.match(script,/spawnSync\(expoBin,\['export','--platform','android'/);
 assert.match(script,/otaPublished:false/);
 assert.match(script,/EXPO_PUBLIC_BUKLOD_ARENA_EXPERIMENTAL,'true'/);
 assert.match(script,/BUKLOD_APP_TARGET:'main'/);
 assert.match(workflow,/npm ci --ignore-scripts --no-audit --no-fund/);
 assert.match(workflow,/node scripts\/season2-android-bundle-compatibility\.mjs --compile/);
 assert.doesNotMatch(script,/\beas-cli\b|\beas update\b|\beas build\b|apply_migration|service_role|sb_secret/i);
 assert.doesNotMatch(workflow,/\bEXPO_TOKEN\b|\beas-cli\b|actions\/upload-artifact/);
 const profile=JSON.parse(read('eas.json')).build['season2-genesis-preview'];
 assert.equal(profile.env.EXPO_PUBLIC_SUPABASE_URL,'https://yhanxndaqbmuzbdqlblu.supabase.co');
 assert.equal(existsSync(resolve(root,'src/app/games/empire-arena.tsx')),true);
 assert.equal(profile.env.EXPO_PUBLIC_BUKLOD_ARENA_RANKED_ENABLED,'false');
});
