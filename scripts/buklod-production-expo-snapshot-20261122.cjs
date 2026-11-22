'use strict';
// Production Expo manifest read-only fingerprint. Does not publish, log tokens,
// access private users, mutate a branch, or claim an OTA succeeded.
const fs = require('node:fs');
const PROJECT='23dad7d0-389a-406e-8dec-08965dab85d8';
const RUNTIME='1.3.2';
const CHANNEL='production';
function parseManifest(raw, filters, status) {
  if (status !== 200) throw Error('Expo production manifest HTTP '+status);
  let m;
  try { m=JSON.parse(raw); } catch {
    const line=raw.split(/\r?\n/).find(x=>x.startsWith('{"id"'));
    if (!line) throw Error('Expo manifest missing JSON body');
    m=JSON.parse(line);
  }
  if (typeof m.id!=='string' || !/^[0-9a-f-]{36}$/i.test(m.id)) throw Error('Invalid Expo update identifier');
  if (m.runtimeVersion!==RUNTIME) throw Error('Production native runtime differs from pinned 1.3.2');
  if (typeof m.launchAsset?.hash!=='string' || m.launchAsset.hash.length<20) throw Error('Production launch bundle hash absent');
  if (!/branchname="production"/.test(filters||'')) throw Error('Expo manifest channel/branch filter does not identify production');
  return {updateId:m.id,runtimeVersion:m.runtimeVersion,channel:CHANNEL,bundleHash:m.launchAsset.hash,
    observedAt:new Date().toISOString(),sourceShaNotProven:true,productionMutation:false};
}
async function getSnapshot(fetcher=fetch) {
  const response=await fetcher('https://u.expo.dev/'+PROJECT,{headers:{
    'expo-platform':'android','expo-runtime-version':RUNTIME,'expo-channel-name':CHANNEL
  },signal:AbortSignal.timeout(30000)});
  return parseManifest(await response.text(),response.headers.get('expo-manifest-filters'),response.status);
}
if(require.main===module) {
  getSnapshot().then(data=>{
    fs.mkdirSync('ota-evidence',{recursive:true});
    fs.writeFileSync('ota-evidence/production-baseline-readonly-20261122.json',JSON.stringify(data,null,2)+'\n');
    console.log('EXPO_PRODUCTION_READONLY_BASELINE_PASS',JSON.stringify(data));
  }).catch(e=>{console.error('EXPO_PRODUCTION_READONLY_BASELINE_BLOCK',e.message);process.exitCode=1});
}
module.exports={parseManifest,getSnapshot,PROJECT,RUNTIME,CHANNEL};
