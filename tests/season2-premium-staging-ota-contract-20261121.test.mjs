import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFileSync(resolve(root,p),'utf8');
test('Premium Kingdom nature landmarks are selectable canonical character worlds',()=>{
 const portal=read('src/features/season2/genesis/GenesisKingdomPortal.tsx');
 assert.match(portal,/KINGDOM_NATURE_LANDMARKS\.map/);
 assert.match(portal,/onPress=\{\(\) => select\(realm\)\}/);
 for(const region of ['Living Forest','Kingdom Citadel','Winter Highlands','River Valley','Coastal District'])assert.ok(portal.includes(region),region);
 assert.match(portal,/accessibilityState=\{\{selected:isSelected\}\}/);
 assert.doesNotMatch(portal,/claimBp|awardBp|awardDiamond|supabase\.rpc/i);
});
test('Arena native route and experimental engine cannot enter staging bundle, even via deep links',()=>{
 const portal=read('src/features/season2/genesis/GenesisKingdomPortal.tsx');
 assert.doesNotMatch(portal,/empire-arena|arenaExperimental/);
 assert.equal(existsSync(resolve(root,'src/app/games/empire-arena.tsx')),false);
 assert.equal(existsSync(resolve(root,'src/features/games/empire/arenaGeneratedAssets.ts')),false);
 assert.equal(existsSync(resolve(root,'experiments/empire-arena-v2/arena-v2-engine.mjs')),false);
});

test('EAS Genesis profile reuses existing paid BUKLOD Supabase without new subscriptions',()=>{
 const eas=JSON.parse(read('eas.json'));
 const env=eas.build['season2-genesis-preview'].env;
 assert.equal(env.EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW,'true');
 assert.equal(env.EXPO_PUBLIC_BUKLOD_ARENA_EXPERIMENTAL,'false');
 assert.equal(env.EXPO_PUBLIC_BUKLOD_GENESIS_SHARED_BACKEND_REVIEW,'true');
 assert.equal(env.EXPO_PUBLIC_SUPABASE_URL,'https://yhanxndaqbmuzbdqlblu.supabase.co');
 assert.match(env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,/^sb_publishable_/);
 assert.doesNotMatch(env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,/service_role|sb_secret_/i);
});
test('Source gate passes but artifact release gate fails closed without independent backend/APK proof',()=>{
 const script=resolve(root,'scripts/season2-premium-staging-ota-gate.mjs');
 const source=spawnSync(process.execPath,[script,'--source'],{cwd:root,encoding:'utf8'});
 assert.equal(source.status,0,source.stderr||source.stdout);
 const srcReport=JSON.parse(source.stdout);
 assert.equal(srcReport.backendMode,'existing-paid-shared-live');
 assert.equal(srcReport.backendProjectRef,'yhanxndaqbmuzbdqlblu');
 assert.equal(srcReport.ok,true);
 assert.equal(srcReport.otaReady,false);
 assert.equal(srcReport.published,false);
 const release=spawnSync(process.execPath,[script,'--release'],{cwd:root,encoding:'utf8',
   env:{...process.env,BUKLOD_STAGING_PROJECT_REF:'',EXPO_PUBLIC_SUPABASE_URL:'',EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:''}});
 assert.notEqual(release.status,0,'Release must fail closed without signed EAS evidence');
 const report=JSON.parse(release.stdout);
 assert.equal(report.otaReady,false);
 assert.ok(report.failures.some(e=>e.includes('signed APK')||e.includes('EAS')));
});

test('New premium OTA SHA is distinct from verified native APK SHA and local evidence alone cannot publish',()=>{
 const script=resolve(root,'scripts/season2-premium-staging-ota-gate.mjs');
 const working=mkdtempSync(join(tmpdir(),'buklod-premium-stage-gate-'));
 try{
  const git=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
  assert.equal(git.status,0);
  const current=git.stdout.trim();
  const good={
    otaSourceCommit:current,
    nativeApkSourceCommit:'a04d9ccf91e508a062bab8a7657297e574ae40a2',
    nativeApkSha256:'f2608820b522a2d58fbbcfe94be10df600f7c3915a509e625f53902288770900',
    nativeApkVersionCode:13,
    nativeEasBuildId:'42ce5047-70dc-47e1-b8a9-77948c9b8dba',
    easProjectId:'23dad7d0-389a-406e-8dec-08965dab85d8',
    channel:'season2-genesis-preview',
    runtimeVersion:'2.0.0-genesis-preview',
    package:'org.mzbministry.buklod.staging',
    platform:'android',environment:'preview',
    signed:true,status:'finished',
    backendProjectRef:'yhanxndaqbmuzbdqlblu',backendMode:'shared-live',
    evidenceUrl:'https://expo.dev/accounts/a/projects/b/builds/42ce5047-70dc-47e1-b8a9-77948c9b8dba',
    checks:Object.fromEntries(['adFirstView','navigation','audioFocus','imageDecode','mediaLifecycle','authPrivacy','noUnreleasedEconomyWrites'].map(k=>[k,'passed'])),
  };
  const evidence=join(working,'eas-evidence.json');
  const run=()=>spawnSync(process.execPath,[script,'--release','--commit='+current,'--evidence='+evidence],{cwd:root,encoding:'utf8'});
  writeFileSync(evidence,JSON.stringify({...good,nativeApkSha256:'f'.repeat(64)}));
  const bad=run();assert.notEqual(bad.status,0);
  assert.match(bad.stdout,/Signed green-B native APK provenance/);
  writeFileSync(evidence,JSON.stringify({...good,otaSourceCommit:good.nativeApkSourceCommit}));
  const badJs=run();assert.notEqual(badJs.status,0);
  assert.match(badJs.stdout,/Premium OTA source is not the exact current commit/);
  writeFileSync(evidence,JSON.stringify(good));
  const local=run();
  // All offline assertions may pass, but a self-authored JSON cannot become a
  // verified EAS OTA publication or an RC release receipt.
  if(local.status===0){
   const report=JSON.parse(local.stdout);
   assert.equal(report.artifactContractValidated,true);
   assert.equal(report.otaReady,false);
   assert.equal(report.published,false);
  } else {
   const report=JSON.parse(local.stdout);
   assert.equal(report.otaReady,false);
  }
 }finally{rmSync(working,{recursive:true,force:true});}
});
