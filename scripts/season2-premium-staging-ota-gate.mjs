#!/usr/bin/env node
/** Fail-closed Season 2 premium staging OTA preflight. NO DEPLOY OR MUTATION.
 * --source: inspect repository/asset/profile invariants (safe for CI).
 * --release --commit=<40sha> --evidence=<signed-EAS-attestation.json>:
 * also require isolated staging Supabase and real native/AdMob/nav checks.
 * Never interpret a SOURCE pass as an APK, RC or OTA receipt.
 */
import {existsSync,readFileSync} from 'node:fs';
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
const eas=JSON.parse(read('eas.json'));
const profile=eas.build?.[profileName];
const env=profile?.env||{};
if(!profile)fail.push('Missing Genesis preview EAS build profile');
if(profile?.channel!==channel||profile?.environment!=='preview'||profile?.android?.buildType!=='apk'||profile?.distribution!=='internal')fail.push('Staging EAS channel/environment/APK profile mismatch');
if(env.APP_VARIANT!=='staging'||env.EXPO_PUBLIC_APP_ENV!=='staging'||env.EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW!=='true')fail.push('Not a Genesis-only staging build');
if(env.EXPO_PUBLIC_BUKLOD_ARENA_EXPERIMENTAL!=='false')fail.push('Arena must be disabled in this staging candidate');
if(env.EXPO_PUBLIC_BUKLOD_GENESIS_SHARED_BACKEND_REVIEW!=='false')fail.push('Shared production backend review must be disabled');
if(env.EXPO_PUBLIC_SUPABASE_URL||env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY)fail.push('Do not embed shared or unchecked Supabase credentials in EAS profile');
if(!read('app.config.js').includes("'2.0.0-genesis-preview'"))fail.push('Native Genesis runtime contract missing');
if(!read('src/app/games/index.tsx').includes('BuklodKingdomAdSlot'))fail.push('Kingdom ad slot missing');
if(!read('src/app/buklod-map.tsx').includes('BuklodFirstViewAd'))fail.push('First-view ad protected source missing');
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
 const stagingRef=(process.env.BUKLOD_STAGING_PROJECT_REF||'').trim();
 const endpoint=(process.env.EXPO_PUBLIC_SUPABASE_URL||'').trim();
 const key=(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'').trim();
 if(!/^[a-z0-9]{20}$/.test(stagingRef)||stagingRef===prodRef)fail.push('Real isolated BUKLOD_STAGING_PROJECT_REF required; production forbidden');
 if(!stagingRef||!endpoint.includes('https://'+stagingRef+'.supabase.co'))fail.push('Staging backend endpoint does not match isolated project');
 if(!key.startsWith('sb_publishable_'))fail.push('Staging publishable key missing');
 const commit=process.argv.find(x=>x.startsWith('--commit='))?.slice(9)||'';
 const evidenceFile=process.argv.find(x=>x.startsWith('--evidence='))?.slice(11)||'';
 if(!/^[0-9a-f]{40}$/.test(commit))fail.push('Exact 40-character RC source commit required');
 let evidence;
 if(!evidenceFile||!existsSync(evidenceFile))fail.push('Native signed APK/EAS record evidence missing');
 else try{evidence=JSON.parse(readFileSync(evidenceFile,'utf8'));}catch{fail.push('Invalid build evidence JSON');}
 if(evidence){
  if(evidence.sourceCommit!==commit||evidence.channel!==channel||evidence.runtimeVersion!==nativeRuntime||
    evidence.package!==appPackage||evidence.platform!=='android'||evidence.environment!=='preview'||
    evidence.signed!==true||evidence.status!=='finished'||!evidence.artifactId||
    !/^https:\/\/(expo\.dev|eas\.expo\.dev)\//.test(evidence.evidenceUrl||''))fail.push('EAS APK source/runtime/channel/signature evidence invalid');
  for(const check of ['adFirstView','navigation','audioFocus','imageDecode','mediaLifecycle','authPrivacy']){
   if(evidence.checks?.[check]!=='passed')fail.push('Mandatory automated native check not passed: '+check);
  }
 }
}
const outcome={schema:'buklod-premium-season2-staging-gate-v1',
 mode:release?'artifact-readiness':'source',
 ok:fail.length===0,
 sourcePrepared:fail.length===0&&!release,
 otaReady:release&&fail.length===0,
 channel,runtimeVersion:nativeRuntime,package:appPackage,
 arenaIncluded:false,deviceVisualVerification:'owner-waived-unverified',published:false,
 failures:fail};
console.log(JSON.stringify(outcome,null,2));
if(fail.length)process.exitCode=1;
