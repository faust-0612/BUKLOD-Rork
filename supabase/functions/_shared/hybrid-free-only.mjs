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
