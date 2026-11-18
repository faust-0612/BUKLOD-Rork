import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {EXPECTED_PROD,validateProductionProof,STAGING_BRANCH}=require('../scripts/buklod-season2-staging-release-order.cjs');
const proof=JSON.parse(readFileSync('.buklod/releases/train-a-production-verified-20261118.json','utf8'));
const live={id:EXPECTED_PROD.updateId,runtimeVersion:'1.3.2',extra:{expoClient:{android:{package:EXPECTED_PROD.package}}}};
test('Season2 STAGING is allowed after Train A server-verified production; not date-locked before Dec 6',()=>{
 assert.equal(STAGING_BRANCH,'staging/season2-rise-together-20261118');
 assert.equal(validateProductionProof(proof,live),true);
 assert.equal(proof.season2Included,false);
 assert.equal(proof.manualDeviceVerificationWaivedByOwner,true);
 assert.equal(proof.physicalAdMobFillVerified,false);
 assert.equal(proof.physicalInstantNavigationVerified,false);
});
test('Wrong/stale production OTA, runtime, app package or source fails closed',()=>{
 assert.equal(validateProductionProof(null,live),false);
 for(const delta of [
 {id:'01a1e2e2-cb65-7733-bcb6-3519230c9cf4'},
 {runtimeVersion:'1.3.0'},
 {extra:{expoClient:{android:{package:'org.mzbministry.buklod.staging'}}}}
 ])assert.equal(validateProductionProof(proof,{...live,...delta}),false);
 for(const delta of [
 {sourceSha:'a'.repeat(40)}, {updateId:'01a1e2e2-cb65-7733-bcb6-3519230c9cf4'},
 {season2Included:true},{manualDeviceVerificationWaivedByOwner:false},
 {physicalAdMobFillVerified:true},{physicalInstantNavigationVerified:true},
 {frozenAndroidBundleSha256:'0'.repeat(64)},
 {channel:'staging-user'}
 ])assert.equal(validateProductionProof({...proof,...delta},live),false);
});
test('Staging workflow contract is separate from production and never mints rewards',()=>{
 const s=readFileSync('scripts/buklod-season2-staging-release-order.cjs','utf8');
 assert.match(s,/manifest\('production'\)/);
 assert.match(s,/GITHUB_REF,'refs\/heads\/'\+STAGING_BRANCH/);
 assert.match(s,/APP_VARIANT,'staging'/);
 assert.doesNotMatch(s,/\.rpc\(|\.(insert|update|delete)\(|eas update|update --channel production/);
 const campaign=readFileSync('src/lib/buklodSeason2CampaignR1.ts','utf8');
 assert.match(campaign,/officialOpeningPublished:false/);
 assert.match(campaign,/missionAwardsLive:false/);
 assert.match(campaign,/inactivityDeductionsLive:false/);
});
