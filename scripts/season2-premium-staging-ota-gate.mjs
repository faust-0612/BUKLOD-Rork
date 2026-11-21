#!/usr/bin/env node
/** Fail-closed Season 2 premium staging OTA preflight. NO DEPLOY OR MUTATION.
 * --source: inspect repository/asset/profile invariants (safe for CI).
 * --release --commit=<current-premium-40sha> --evidence=<eas-evidence.json>:
 * keep separate the existing signed native APK SHA and premium OTA JS SHA;
 * require tested native provenance and runtime/ads/nav/backend contracts.
 * Offline JSON is NOT EAS verification and never authorizes an OTA by itself.
 * Never interpret a SOURCE pass as an APK, RC or OTA receipt.
 */
import {existsSync,readFileSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFileSync(resolve(root,p),'utf8');
const fail=[];
const prodRef='yhanxndaqbmuzbdqlblu';
const profileName='season2-genesis-preview';
const channel='season2-genesis-preview';
const nativeRuntime='2.0.0-genesis-preview';
const appPackage='org.mzbministry.buklod.staging';
const verifiedNativeApk=Object.freeze({
 source:'a04d9ccf91e508a062bab8a7657297e574ae40a2',
 sha256:'f2608820b522a2d58fbbcfe94be10df600f7c3915a509e625f53902288770900',
 versionCode:13,
 buildId:'42ce5047-70dc-47e1-b8a9-77948c9b8dba',
 easProjectId:'23dad7d0-389a-406e-8dec-08965dab85d8',
});
const eas=JSON.parse(read('eas.json'));
const profile=eas.build?.[profileName];
const env=profile?.env||{};
if(!profile)fail.push('Missing Genesis preview EAS build profile');
if(profile?.channel!==channel||profile?.environment!=='preview'||profile?.android?.buildType!=='apk'||profile?.distribution!=='internal')fail.push('Staging EAS channel/environment/APK profile mismatch');
if(env.APP_VARIANT!=='staging'||env.EXPO_PUBLIC_APP_ENV!=='staging'||env.EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW!=='true')fail.push('Not a Genesis-only staging build');
if(env.EXPO_PUBLIC_BUKLOD_ARENA_EXPERIMENTAL!=='true')fail.push('Arena must be included in reviewed Genesis conso source');
if(env.EXPO_PUBLIC_BUKLOD_ARENA_RANKED_ENABLED!=='false')fail.push('Ranked Diamond settlement must remain off until existing paid backend has been deployed and verified');
// Shared paid Supabase is the approved BUKLOD app backend. This profile is not a
// sandbox. Keep original server RLS/reward entitlements authoritative: source-only
// staging visuals must not create new production ledgers or migrate live schema.
const expectedSupabaseUrl='https://'+prodRef+'.supabase.co';
if(env.EXPO_PUBLIC_BUKLOD_GENESIS_SHARED_BACKEND_REVIEW!=='true')
  fail.push('Genesis candidate must explicitly acknowledge shared paid BUKLOD Supabase');
if(env.EXPO_PUBLIC_SUPABASE_URL!==expectedSupabaseUrl)
  fail.push('Genesis candidate Supabase must match canonical paid BUKLOD backend');
if(!/^sb_publishable_[A-Za-z0-9_-]+$/.test(env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY||''))
  fail.push('Existing publishable client key missing; never use service_role or secret keys');
const appConfig=read('app.config.js');
if(!appConfig.includes("'2.0.0-genesis-preview'"))fail.push('Native Genesis runtime contract missing');
if(!appConfig.includes("genesisNativePreview ? './assets/season2/genesis/genesis-green-b-transparent.png'"))
 fail.push('Genesis staging native green B splash/icon must match verified signed APK');
if(!read('src/app/games/index.tsx').includes('BuklodKingdomAdSlot'))fail.push('Kingdom ad slot missing');
if(!read('src/app/buklod-map.tsx').includes('BuklodFirstViewAd'))fail.push('First-view ad protected source missing');
if(!existsSync(resolve(root,'src/app/games/empire-arena.tsx'))||
   !existsSync(resolve(root,'experiments/empire-arena-v2/arena-v2-engine.mjs')))
 fail.push('Season 2 conso must include in-app Arena route and engine');
if(!read('src/app/games/empire-arena.tsx').includes('EmpireArenaRouteGuard')||
   !read('src/features/season2/genesis/GenesisKingdomPortal.tsx').includes('/games/empire-arena'))
 fail.push('Arena auth-guard or Kingdom navigation missing');
if(!existsSync(resolve(root,'assets/season2/arena/generated-manifest.json')))
 fail.push('Source-owned Arena fullbody animation asset manifest missing');
const variants=[
 ['assets/season2/genesis/kingdom/kingdom-nature-panorama.webp','232c99e995fafde2e018a286f998a39917de32620ee502c8486ca58a1eabf8eb'],
 ['assets/season2/genesis/kingdom/kingdom-nature-panorama-compact.webp','5e7ed0af9568aa6f9cc8d6753015b3c8ac36fd4e070541d43f017d88975fcc95'],
];
for(const [path,expected] of variants){
 if(!existsSync(resolve(root,path))){fail.push('Missing premium art: '+path);continue;}
 const data=readFileSync(resolve(root,path));
 if(data.subarray(8,12).toString('ascii')!=='WEBP'||createHash('sha256').update(data).digest('hex')!==expected)fail.push('Incorrect premium art bytes: '+path);
}
const release=process.argv.includes('--release');
if(release){
 // EAS preview env may inject overrides. Explicitly forbid shadow projects and
 // non-publishable keys; do not require or buy a second Supabase project.
 const endpoint=(process.env.EXPO_PUBLIC_SUPABASE_URL||env.EXPO_PUBLIC_SUPABASE_URL||'').trim();
 const key=(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY||env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'').trim();
 if(endpoint!==expectedSupabaseUrl)fail.push('EAS build backend mismatch: only canonical paid BUKLOD Supabase allowed');
 if(key!==env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY)fail.push('EAS build public key does not match verified BUKLOD publishable key');
 const commit=process.argv.find(x=>x.startsWith('--commit='))?.slice(9)||'';
 const evidenceFile=process.argv.find(x=>x.startsWith('--evidence='))?.slice(11)||'';
 if(!/^[0-9a-f]{40}$/.test(commit))fail.push('Exact 40-character premium OTA source commit required');
 // A stale binary from a previous signed EAS run is NOT the JavaScript OTA source.
 // Refuse stale/alien source even if the evidence JSON claims it is correct.
 try{
  const actual=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',timeout:20000}).trim();
  if(commit!==actual)fail.push('Current HEAD differs from requested premium OTA source commit');
 }catch{fail.push('Cannot verify exact premium OTA source commit');}
 const parity=spawnSync(process.execPath,['scripts/season2-native-apk-source-parity.mjs'],
  {cwd:root,encoding:'utf8',timeout:30000});
 if(parity.status!==0)fail.push('Verified native signed APK source parity failed (new native build needed)');
 let evidence;
 if(!evidenceFile||!existsSync(evidenceFile))fail.push('Signed native APK EAS record evidence missing');
 else try{evidence=JSON.parse(readFileSync(evidenceFile,'utf8'));}catch{fail.push('Invalid native evidence JSON');}
 if(evidence){
  // Evidence fields are machine-readable inputs only. The EAS provider's actual
  // current build, stage channel mapping, and OTA manifest must be queried
  // independently before claiming published/ready.
  if(evidence.otaSourceCommit!==commit)fail.push('Premium OTA source is not the exact current commit');
  if(evidence.nativeApkSourceCommit!==verifiedNativeApk.source||
     evidence.nativeApkSha256!==verifiedNativeApk.sha256||
     evidence.nativeApkVersionCode!==verifiedNativeApk.versionCode||
     evidence.nativeEasBuildId!==verifiedNativeApk.buildId||
     evidence.easProjectId!==verifiedNativeApk.easProjectId)
     fail.push('Signed green-B native APK provenance/hash/version/build mismatch');
  if(evidence.channel!==channel||evidence.runtimeVersion!==nativeRuntime||
    evidence.package!==appPackage||evidence.platform!=='android'||evidence.environment!=='preview'||
    evidence.signed!==true||String(evidence.status).toLowerCase()!=='finished'||
    evidence.backendProjectRef!==prodRef||evidence.backendMode!=='shared-live'||
    !/^https:\/\/(expo\.dev|eas\.expo\.dev)\//.test(evidence.evidenceUrl||''))
    fail.push('EAS native channel/runtime/package/backend/signature evidence invalid');
  for(const check of ['adFirstView','navigation','audioFocus','imageDecode','mediaLifecycle','authPrivacy','noUnreleasedEconomyWrites']){
   if(evidence.checks?.[check]!=='passed')fail.push('Mandatory automated native check not passed: '+check);
  }
 }

}
const outcome={schema:'buklod-premium-season2-staging-gate-v1',
 mode:release?'artifact-readiness':'source',
 ok:fail.length===0,
 sourcePrepared:fail.length===0&&!release,
 // A local, untrusted JSON attestation must never claim real EAS bookability.
 // Server-side release/OTA publication requires separately verified EAS receipt.
 artifactContractValidated:release&&fail.length===0,
 otaReady:false,
 nativeApkSource:verifiedNativeApk.source,
 nativeApkSha256:verifiedNativeApk.sha256,
 nativeEasBuildId:verifiedNativeApk.buildId,
 channel,runtimeVersion:nativeRuntime,package:appPackage,
 arenaIncluded:existsSync(resolve(root,'src/app/games/empire-arena.tsx'))&&
   env.EXPO_PUBLIC_BUKLOD_ARENA_EXPERIMENTAL==='true',
 rankedLive:false,backendMode:'existing-paid-shared-live',backendProjectRef:prodRef,
 deviceVisualVerification:'owner-waived-unverified',published:false,
 failures:fail};
console.log(JSON.stringify(outcome,null,2));
if(fail.length)process.exitCode=1;
