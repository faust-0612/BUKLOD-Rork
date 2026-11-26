// Operator-attested release gate, not a billing API. Free project must have billing disabled.
export function freeOnlyConfig(env,now=Date.now()){
 if(env.BUKLOD_HYBRID_FREE_ONLY!=="true"||env.BUKLOD_HYBRID_BILLING_DISABLED_VERIFIED!=="true")return null;
 const key=env.BUKLOD_HYBRID_FREE_GEMINI_KEY,model=env.BUKLOD_HYBRID_FREE_GEMINI_MODEL,project=env.BUKLOD_HYBRID_FREE_PROJECT_ID;
 const until=Date.parse(env.BUKLOD_HYBRID_FREE_VERIFIED_UNTIL??"");
 if(typeof key!=="string"||key.trim().length<20||key===env.GEMINI_API_KEY||typeof model!=="string"||!/^gemini-[a-z0-9.-]+$/i.test(model)||typeof project!=="string"||!project.trim()||!Number.isFinite(until)||until<=now||until-now>86400000)return null;
 return {key,model};
}

export function providerFailure(status){
 return status===429?"quota_exhausted":([400,401,403,404].includes(status)?"provider_blocked":"retry");
}

export async function guardedFreeCall(admin,free,call){
 if(!free)throw new Error("FREE_GRADING_UNAVAILABLE");
 const r=await admin.rpc("buklod_hybrid_reserve_learning_call");
 if(r.error||r.data!==true)throw new Error("FREE_GRADING_BUDGET_UNAVAILABLE");
 try{return await call(free.key,free.model);}
 catch(e){
  const message=e instanceof Error?e.message:"";
  if(message==="quota_exhausted"||message==="provider_blocked"){
   const hold=await admin.rpc("buklod_hybrid_pause_learning_provider",{p_reason:message});
   if(hold.error||hold.data!==true)throw new Error("FREE_GRADING_PAUSE_NOT_CONFIRMED");
  }
  throw e;
 }
}

export function reusableLessonReceipt(row,key,model,updatedAt,now=Date.now()){
 if(!row||row.status!=="acceptable"||row.fail_open!==false||row.model!==model||row.question_context?.hybrid_grading_key!==key)return false;
 const created=Date.parse(row.created_at??""),updated=Date.parse(updatedAt??"");
 return Number.isFinite(created)&&Number.isFinite(updated)&&created>=updated&&created<=now&&created>=now-3600000;
}
