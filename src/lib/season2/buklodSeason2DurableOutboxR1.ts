/**
 * Season 2 DEV-only durable queue. No installed-app imports or network calls.
 * The host will inject its storage service and authenticated adapter later.
 * This module never awards points, tokens, inventory, or financial rights.
 */
import {
 enqueueS2Evidence,reserveS2Next,confirmS2ServerResult,
 markS2TransportUnknown,recoverS2InterruptedSends,
 compactS2ConfirmedOutbox,S2_OUTBOX_LIMITS,
 type S2DraftOperation,type S2OutboxEntry,type S2ServerResult
} from './buklodSeason2OfflineOutboxR1.ts';

export const S2_DURABLE_OUTBOX_ROLLOUT=Object.freeze({
 installedRuntime:false,backendSubmission:false,optimisticCredit:false
});
export type S2KeyValueStore=Readonly<{
 getItem(key:string):Promise<string|null>;
 setItem(key:string,value:string):Promise<void>;
}>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const states=new Set(['QUEUED','SENDING','RETRY_WAIT',
 'CONFIRMED','REJECTED','MANUAL_RECONCILE']);
function validEntry(x:unknown,uid:string):x is S2OutboxEntry{
 if(!x||typeof x!=='object')return false;
 const v=x as Record<string,unknown>;
 return v.userId===uid && typeof v.operationId==='string' &&
   uuid.test(v.operationId) && typeof v.sourceId==='string' &&
   uuid.test(v.sourceId) && typeof v.sourceKind==='string' &&
   /^[a-z][a-z0-9_]{2,50}$/.test(v.sourceKind) &&
   typeof v.status==='string' && states.has(v.status) &&
   Number.isSafeInteger(v.localQueuedAtMs) && Number(v.localQueuedAtMs)>=0 &&
   Number.isSafeInteger(v.attempts) && Number(v.attempts)>=0 &&
   Number.isSafeInteger(v.nextRetryAtMs) && Number(v.nextRetryAtMs)>=0 &&
   (v.serverTokens===null||
      (Number.isSafeInteger(v.serverTokens)&&Number(v.serverTokens)>=0&&Number(v.serverTokens)<=12)) &&
   (v.serverReceiptId===null||(typeof v.serverReceiptId==='string'&&v.serverReceiptId.length>0&&v.serverReceiptId.length<201)) &&
   (v.serverReason===null||(typeof v.serverReason==='string'&&v.serverReason.length<301));
}
export class S2DurableOutboxR1 {
 private readonly locks=new Map<string,Promise<void>>();
 private readonly storage:S2KeyValueStore;
 constructor(storage:S2KeyValueStore){this.storage=storage;}
 private key(uid:string):string{
  if(!uuid.test(uid))throw Error('S2_ACCOUNT_REQUIRED');
  return 'buklod:s2:outbox:r1:'+uid.toLowerCase();
 }
 private async read(uid:string):Promise<readonly S2OutboxEntry[]>{
  const raw=await this.storage.getItem(this.key(uid));
  if(raw===null)return [];
  let parsed:unknown;
  try{parsed=JSON.parse(raw);}catch{throw Error('S2_CORRUPT_OUTBOX');}
  if(!Array.isArray(parsed)||parsed.length>S2_OUTBOX_LIMITS.maxEntries||
    parsed.some(x=>!validEntry(x,uid))||
    new Set(parsed.map(x=>x.operationId)).size!==parsed.length)
   throw Error('S2_CORRUPT_OUTBOX');
  return parsed as S2OutboxEntry[];
 }
 private async write(uid:string,queue:readonly S2OutboxEntry[]):Promise<void>{
  if(queue.length>S2_OUTBOX_LIMITS.maxEntries||
     queue.some(x=>!validEntry(x,uid)))throw Error('S2_INVALID_OUTBOX_WRITE');
  await this.storage.setItem(this.key(uid),JSON.stringify(queue));
 }
 private async serialize<T>(uid:string,action:()=>Promise<T>):Promise<T>{
  this.key(uid);
  const last=this.locks.get(uid)??Promise.resolve();
  let finish:()=>void=()=>{};
  const current=new Promise<void>(resolve=>{finish=resolve;});
  this.locks.set(uid,current);
  await last.catch(()=>{});
  try{return await action();}
  finally{
   finish();
   if(this.locks.get(uid)===current)this.locks.delete(uid);
  }
 }
 async inspect(uid:string):Promise<readonly S2OutboxEntry[]>{
  return this.serialize(uid,()=>this.read(uid));
 }
 async enqueue(uid:string,draft:S2DraftOperation){
  return this.serialize(uid,async()=>{
   if(draft.userId!==uid)throw Error('S2_ACCOUNT_MISMATCH');
   const result=enqueueS2Evidence(await this.read(uid),draft);
   if(result.status==='QUEUED')await this.write(uid,result.queue);
   return result;
  });
 }
 async reserve(uid:string,online:boolean,nowMs:number):Promise<S2OutboxEntry|null>{
  return this.serialize(uid,async()=>{
   const result=reserveS2Next(await this.read(uid),uid,online,nowMs);
   if(result.operation)await this.write(uid,result.queue);
   return result.operation;
  });
 }
 async recover(uid:string,nowMs:number):Promise<readonly S2OutboxEntry[]>{
  return this.serialize(uid,async()=>{
   const prev=await this.read(uid);
   const next=recoverS2InterruptedSends(prev,nowMs);
   if(next.some((x,i)=>x!==prev[i]))await this.write(uid,next);
   return next;
  });
 }
 async unknown(uid:string,operationId:string,nowMs:number){
  return this.serialize(uid,async()=>{
   const prev=await this.read(uid);
   const next=markS2TransportUnknown(prev,operationId,nowMs);
   if(next.some((x,i)=>x!==prev[i]))await this.write(uid,next);
   return next;
  });
 }
 async confirm(uid:string,server:S2ServerResult,nowMs:number){
  return this.serialize(uid,async()=>{
   if(server.userId!==uid)throw Error('S2_ACCOUNT_MISMATCH');
   const prev=await this.read(uid);
   const next=confirmS2ServerResult(prev,server,nowMs);
   if(next.some((x,i)=>x!==prev[i]))await this.write(uid,next);
   return next;
  });
 }
 async acknowledgeWallet(uid:string,ids:ReadonlySet<string>){
  return this.serialize(uid,async()=>{
   const prev=await this.read(uid);
   const next=compactS2ConfirmedOutbox(prev,ids);
   if(next.length!==prev.length)await this.write(uid,next);
   return next;
  });
 }
}
