#!/usr/bin/env node
/**
 * Premium Genesis Android JS/asset Metro export. Read-only source & CI build
 * compatibility check; never an APK, Gradle test, EAS OTA or native device test.
 * Run without flags for source-only preflight; --compile in guarded CI after npm ci.
 */
import assert from 'node:assert/strict';
import {existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const eas=JSON.parse(readFileSync(join(root,'eas.json'),'utf8'));
const profile=eas.build?.['season2-genesis-preview'];
assert.equal(profile?.channel,'season2-genesis-preview');
assert.equal(profile?.distribution,'internal');
assert.equal(profile?.environment,'preview');
assert.equal(profile?.android?.buildType,'apk');
assert.equal(profile?.env?.EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW,'true');
assert.equal(profile?.env?.EXPO_PUBLIC_BUKLOD_ARENA_EXPERIMENTAL,'true');
assert.equal(profile?.env?.EXPO_PUBLIC_BUKLOD_ARENA_RANKED_ENABLED,'false');
assert.equal(profile?.env?.EXPO_PUBLIC_SUPABASE_URL,'https://yhanxndaqbmuzbdqlblu.supabase.co');
assert.match(profile?.env?.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'',/^sb_publishable_[A-Za-z0-9_-]+$/);
const old=JSON.parse(readFileSync(join(root,'eas.json'),'utf8')).build?.production;
assert.equal(old?.channel,'production');
assert.notEqual(old.channel,profile.channel);
const preflight=spawnSync(process.execPath,
 ['scripts/season2-premium-staging-ota-gate.mjs','--source'],
 {cwd:root,encoding:'utf8',env:{...process.env,...profile.env}});
assert.equal(preflight.status,0,'Source gate failed: '+(preflight.stderr||preflight.stdout));
if(!process.argv.includes('--compile')){
  console.log(JSON.stringify({sourceReady:true,androidExported:false,otaPublished:false,
    package:'org.mzbministry.buklod.staging',channel:profile.channel,
    message:'Source preflight only; run --compile with locked dependencies to verify Android JS export.'}));
  process.exit(0);
}
const expoBin=join(root,'node_modules','.bin',process.platform==='win32'?'expo.cmd':'expo');
assert.ok(existsSync(expoBin),'Locked expo CLI missing; run npm ci --ignore-scripts first');
const working=mkdtempSync(join(tmpdir(),'buklod-genesis-premium-android-'));
try{
 const output=join(working,'export');
 const build=spawnSync(expoBin,['export','--platform','android','--output-dir',output,'--clear'],{
  cwd:root,
  stdio:'inherit',
  timeout:12*60*1000,
  env:{...process.env,...profile.env,CI:'1',EXPO_NO_TELEMETRY:'1',
    EXPO_MAX_WORKERS:'2',BUKLOD_APP_TARGET:'main'},
 });
 assert.equal(build.status,0,'Expo Android export failed. This is a JS compatibility gate, not signed APK QA.');
 const metadata=join(output,'metadata.json');
 assert.ok(existsSync(metadata)&&statSync(metadata).size>50,'Android export metadata is missing');
 const payload=JSON.parse(readFileSync(metadata,'utf8'));
 assert.match(JSON.stringify(payload),/android/i,'Expo metadata must contain Android bundle record');
 const files=[];
 const walk=(folder)=>{for(const entry of readdirSync(folder,{withFileTypes:true})){
  const path=join(folder,entry.name);if(entry.isDirectory())walk(path);else if(entry.isFile())files.push(path);
 }};
 walk(output);
 const bundles=files.filter(f=>/\.(?:hbc|bundle|js)$/.test(f)&&statSync(f).size>10000);
 assert.ok(bundles.length,'Android export did not produce a nonempty JavaScript/Hermes bundle');
 console.log(JSON.stringify({sourceReady:true,androidExported:true,otaPublished:false,
  deviceVerified:false,nativeApkVerified:false,
  package:'org.mzbministry.buklod.staging',channel:profile.channel,
  runtime:'2.0.0-genesis-preview',bundleCount:bundles.length,
  outputFileCount:files.length,sourceSha:process.env.GITHUB_SHA||null,
  note:'Android Metro JS/asset export ONLY; requires verified compatible signed staging APK before any OTA.'}));
}finally{
 rmSync(working,{recursive:true,force:true,maxRetries:2});
}
