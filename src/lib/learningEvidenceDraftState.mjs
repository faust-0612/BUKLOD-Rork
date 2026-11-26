export function draftResult(module,raw){
 if(!raw||typeof raw!=="object"||raw.points_awarded!==0)return null;
 const statuses=module==="children_story"?["verified","rework"]:["shadow_candidate","shadow_rework"];
 if(!statuses.includes(raw.status)||!Array.isArray(raw.items)||!raw.items.length||raw.items.length>20||raw.items.some(i=>typeof i?.id!=="string"||typeof i.passed!=="boolean"))return null;
 const pass=raw.status==="verified"||raw.status==="shadow_candidate";
 if(pass!==raw.items.every(i=>i.passed))return null;
 if(pass&&(typeof raw.receipt_id!=="string"||!/^[0-9a-f-]{36}$/i.test(raw.receipt_id)))return null;
 return {status:raw.status,receiptId:pass?raw.receipt_id:null,items:raw.items.map(i=>({id:i.id.slice(0,40),passed:i.passed,feedback:typeof i.feedback==="string"?i.feedback.slice(0,240):""}))};
}
export function sameDraft(a,b){return !!a&&!!b&&JSON.stringify(a.payload)===JSON.stringify(b.payload);}
