const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {approvedIds,validate,checkRepo}=require('../scripts/season2-owner-scope-lock.cjs');
const source=JSON.parse(fs.readFileSync('contracts/season2-owner-approved-exclusives-20261119.json','utf8'));
test('exactly ten owner-approved features with unchanged release boundary',()=>{
 assert.equal(approvedIds.length,10);assert.equal(validate(source).valid,true);assert.equal(checkRepo().ok,true);
});
test('unexpected new / removed / reordered features are denied',()=>{
 for(const changed of [approvedIds.concat('unapproved_feature'),approvedIds.slice(1),[...approvedIds].reverse()]){
  assert.ok(validate({...source,approvedFeatureIds:changed}).errors.includes('FEATURE_SET_DRIFT'));
 }
});
test('early launch, reward writes, production flags and unreviewed scope changes fail closed',()=>{
 for(const patch of [{productionAuthorized:true},{backendRewardWritesAllowed:true},{automaticDec6Launch:true},
  {firstPossibleProductionManila:'2026-12-05T00:00:00+08:00'},{allowUnrequestedFeatureInsertion:true},
  {allowUnrequestedFeatureRemoval:true},{themeWorkAuthorized:true},{productionShaBoundApprovalRequired:false}]){
  assert.equal(validate({...source,...patch}).valid,false);
 }
});
test('the approved list must be identical to the ten labelled feature entries',()=>{
 assert.equal(validate({...source,featureEntries:source.featureEntries.slice(1)}).valid,false);
 assert.equal(validate({...source,featureEntries:source.featureEntries.map((e,i)=>({...e,number:i+2}))}).valid,false);
});
