'use strict';
/**
 * Read-only Expo account:usage --json validation, fail-closed.
 * Expo/eas-cli@27.x prints account.name / account.plan / billing.estimated.
 * The account must be the owner of this specific EAS project.
 * Free plan has no overage billing; unknown/paid response never publishes.
 */
const fs=require('node:fs');
const EXPECTED_EXPO_OWNER='faust_0612';
function validCents(value,allowNull=false){
  if(allowNull&&value===null)return true;
  return typeof value==='number'&&Number.isSafeInteger(value)&&value===0;
}
function inspectFreePlan(data){
  if(!data||typeof data!=='object'||Array.isArray(data))
    return {free:false,reason:'UNRECOGNIZED_BILLING_RESPONSE'};
  if(data.account?.name!==EXPECTED_EXPO_OWNER)
    return {free:false,reason:'EXPO_ACCOUNT_IDENTITY_MISMATCH'};
  if(typeof data.account?.plan!=='string'||data.account.plan.trim().toLowerCase()!=='free')
    return {free:false,reason:'PLAN_NOT_PROVEN_FREE'};
  const charges=data.billing?.estimated;
  if(!charges||!validCents(charges.overageCents)||!validCents(charges.totalCents)
    ||!validCents(charges.recurringCents,true)
    ||!validCents(data.updates?.overageCostCents))
    return {free:false,reason:'NONZERO_OR_UNKNOWN_BILLING'};
  return {free:true,reason:'VERIFIED_EXPO_FREE_ZERO_ESTIMATED_CHARGE'};
}
if(require.main===module){
  let result={free:false,reason:'BILLING_CHECK_UNAVAILABLE'};
  try{
    if(process.argv.length!==3)throw Error('Usage: node guard.cjs PRIVATE_BILLING_JSON');
    result=inspectFreePlan(JSON.parse(fs.readFileSync(process.argv[2],'utf8')));
  }catch{/* billing data and credentials are never printed */}
  console.log(result.free?'ZERO-COST EAS FREE PLAN CHECK PASSED':'ZERO-COST EAS PUBLISH BLOCKED: '+result.reason);
  if(!result.free)process.exitCode=1;
}
module.exports={inspectFreePlan,EXPECTED_EXPO_OWNER};
