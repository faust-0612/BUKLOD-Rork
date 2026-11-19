'use strict';
/** Read-only billing check before an EAS Update publish.
 * Only a positively verified Free plan is allowed. Unknown is NOT Free.
 * Free plans have no overage charges under the current Expo billing policy.
 * This guard never alters accounts, subscriptions, credits or project settings.
 */
const fs=require('node:fs');
function direct(obj,keys){
  let out=obj;
  for(const k of keys){if(!out||typeof out!=='object'||!(k in out))return undefined;out=out[k];}
  return out;
}
function inspectFreePlan(document){
  const candidates=[
    ['account','subscription','plan','name'],
    ['account','subscription','planName'],
    ['account','subscription','name'],
    ['subscription','plan','name'],
    ['subscription','planName'],
    ['subscription','name'],
    ['billing','currentPlan','name'],
    ['billing','subscription','plan','name'],
    ['currentPlan','name'],
    ['plan','name'],
    ['planName'],
    ['plan'],
  ];
  if(!document||typeof document!=='object'||Array.isArray(document))
    return {free:false,reason:'UNRECOGNIZED_BILLING_RESPONSE'};
  const values=candidates.map(keys=>direct(document,keys)).filter(x=>x!==undefined&&x!==null);
  if(!values.length||values.some(x=>typeof x!=='string'||x.trim().toLowerCase()!=='free'))
    return {free:false,reason:'PLAN_NOT_PROVEN_FREE'};
  const charges=[
    direct(document,['billing','overageCharges']),
    direct(document,['overageCharges']),
    direct(document,['billing','amountDue']),
  ].filter(x=>x!==undefined&&x!==null);
  if(charges.some(x=>!Number.isFinite(Number(x))||Number(x)>0))
    return {free:false,reason:'BILLING_NOT_ZERO'};
  return {free:true,reason:'FREE_PLAN_NO_OVERAGES'};
}
if(require.main===module){
  let result={free:false,reason:'UNKNOWN'};
  try{
    if(process.argv.length!==3)throw Error('Usage: node guard.cjs PRIVATE_BILLING_JSON');
    const doc=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
    result=inspectFreePlan(doc);
  }catch{result={free:false,reason:'BILLING_CHECK_UNAVAILABLE'};}
  console.log(result.free?'ZERO-COST EAS FREE PLAN CHECK PASSED':'ZERO-COST EAS PUBLISH BLOCKED: '+result.reason);
  if(!result.free)process.exitCode=1;
}
module.exports={inspectFreePlan};
