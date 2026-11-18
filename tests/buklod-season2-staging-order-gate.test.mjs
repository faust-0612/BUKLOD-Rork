import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {validateProof,CURRENT_STAGING,PRODUCTION_BEFORE}=require('../scripts/buklod-season2-staging-order-gate.cjs');
const live={id:'01a1fabc-1234-7abc-8abc-0123456789ab',runtimeVersion:'1.3.2',
 extra:{expoClient:{android:{package:'org.mzbministry.buklod'}}}};
const proof={version:1,status:'VERIFIED_PRODUCTION',sourceSha:CURRENT_STAGING.sourceSha,
 stagingSourceUpdateId:CURRENT_STAGING.updateId,runtime:'1.3.2',
 productionUpdateId:live.id,productionSourceSha:'a'.repeat(40),
 releaseRunUrl:'https://github.com/faust-0612/BUKLOD-Rork/actions/runs/123456',
 adMobDeviceEvidenceId:'device-ads-verified',navigationDeviceEvidenceId:'device-nav-verified',
 ownerApprovedReleaseId:'owner-current-fixes-release',season2Included:false};
test('Season2 staging is allowed after current fixes production evidence, not tied to Dec 6',()=>{
 assert.equal(validateProof(proof,live),true);
});
test('Missing proof, stale live manifest and old production baseline are blocked',()=>{
 assert.equal(validateProof(null,live),false);
 assert.equal(validateProof(proof,{...live,id:PRODUCTION_BEFORE}),false);
 assert.equal(validateProof({...proof,productionUpdateId:PRODUCTION_BEFORE},live),false);
});
test('No accidental Season2 inclusion or fabricated device gate',()=>{
 assert.equal(validateProof({...proof,season2Included:true},live),false);
 assert.equal(validateProof({...proof,adMobDeviceEvidenceId:''},live),false);
 assert.equal(validateProof({...proof,navigationDeviceEvidenceId:''},live),false);
 assert.equal(validateProof({...proof,stagingSourceUpdateId:'wrong'},live),false);
 assert.equal(validateProof(proof,{...live,extra:{expoClient:{android:{package:'org.mzbministry.buklod.staging'}}}}),false);
});
