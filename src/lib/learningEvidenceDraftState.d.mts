export function draftResult(module:string,raw:unknown):{status:'verified'|'rework'|'shadow_candidate'|'shadow_rework';receiptId:string|null;items:{id:string;passed:boolean;feedback:string}[]}|null;
export function sameDraft(a:unknown,b:unknown):boolean;
