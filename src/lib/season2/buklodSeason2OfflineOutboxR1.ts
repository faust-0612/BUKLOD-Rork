/**
 * Season 2 isolated offline receipt outbox contract — NO RUNTIME IMPORTS.
 * This is a pure state machine, not storage or a network implementation.
 * Clients may queue evidence; ONLY backend attestation can mark earned.
 * Immutable operations, retry-safe IDs, active-account isolation and bounded
 * exponential retry protect weak signal, app kills and double taps.
 */
export const S2_OUTBOX_VERSION='season2-outbox-r1-disabled' as const;
export const S2_OUTBOX_ROLLOUT=Object.freeze({
  persistedDeviceQueue:false, networkSubmission:false,
  verifiedRewardUI:false, backgroundFlush:false,
});
export const S2_OUTBOX_LIMITS=Object.freeze({
  maxEntries:200,maxAttempts:6,initialRetryMs:1500,maxRetryMs:60000,
});
export type S2OutboxStatus='QUEUED'|'SENDING'|'RETRY_WAIT'|
  'CONFIRMED'|'REJECTED'|'MANUAL_RECONCILE';
export type S2OutboxEntry=Readonly<{
  operationId:string;userId:string;sourceKind:string;sourceId:string;
  localQueuedAtMs:number;status:S2OutboxStatus;attempts:number;
  nextRetryAtMs:number;serverReceiptId:string|null;
  serverTokens:number|null;serverReason:string|null;
}>;
export type S2DraftOperation=Readonly<{
  operationId:string;userId:string;sourceKind:string;sourceId:string;
  localQueuedAtMs:number;
}>;
export type S2ServerResult=Readonly<{
  operationId:string;userId:string;sourceKind:string;sourceId:string;
  authenticatedAdapter:true;
  decision:'EARNED'|'DUPLICATE'|'INELIGIBLE'|'RETRY';
  serverReceiptId:string|null;serverTokens:number|null;reason:string;
}>;
const validId=(v:string):boolean=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
function validTime(n:number):boolean{return Number.isSafeInteger(n)&&n>=0;}
function assertEntryDraft(v:S2DraftOperation):void{
  if(!validId(v.operationId)||!validId(v.sourceId)||!validId(v.userId)||
     !/^[a-z][a-z0-9_]{2,50}$/.test(v.sourceKind)||
     !validTime(v.localQueuedAtMs))throw Error('INVALID_SEASON2_OUTBOX_DRAFT');
}
/** Caller must persist the returned full queue atomically BEFORE submitting.
 * If durable storage fails, never report that a submission was queued. */
export function enqueueS2Evidence(
  prior:readonly S2OutboxEntry[],draft:S2DraftOperation,
):Readonly<{queue:readonly S2OutboxEntry[];status:'QUEUED'|'DUPLICATE'}>{
  assertEntryDraft(draft);
  const old=prior.find(x=>x.operationId===draft.operationId||
     (x.userId===draft.userId&&x.sourceKind===draft.sourceKind&&
      x.sourceId===draft.sourceId));
  if(old){
    if(old.operationId!==draft.operationId &&
       (old.userId!==draft.userId||old.sourceKind!==draft.sourceKind||
        old.sourceId!==draft.sourceId))
      throw Error('OUTBOX_OPERATION_ID_COLLISION');
    return {queue:prior,status:'DUPLICATE'};
  }
  if(prior.length>=S2_OUTBOX_LIMITS.maxEntries)throw Error('OUTBOX_CAP_REACHED');
  const queued:S2OutboxEntry={...draft,status:'QUEUED',attempts:0,
    nextRetryAtMs:draft.localQueuedAtMs,serverReceiptId:null,
    serverTokens:null,serverReason:null};
  return {queue:[...prior,queued],status:'QUEUED'};
}
export function reserveS2Next(
  prior:readonly S2OutboxEntry[],activeUserId:string,
  online:boolean,nowMs:number
):Readonly<{queue:readonly S2OutboxEntry[];operation:S2OutboxEntry|null}>{
  if(!validTime(nowMs))throw Error('INVALID_CLOCK');
  if(!online||!validId(activeUserId)||prior.some(x=>
    x.userId===activeUserId&&x.status==='SENDING'))return {queue:prior,operation:null};
  const candidate=prior.find(x=>x.userId===activeUserId&&
    (x.status==='QUEUED'||x.status==='RETRY_WAIT')&&x.nextRetryAtMs<=nowMs);
  if(!candidate)return {queue:prior,operation:null};
  const sending={...candidate,status:'SENDING' as const,attempts:candidate.attempts+1};
  return {queue:prior.map(x=>x.operationId===candidate.operationId?sending:x),
    operation:sending};
}
export function retryDelayMs(attempt:number):number{
  if(!Number.isInteger(attempt)||attempt<1)throw Error('INVALID_RETRY_ATTEMPT');
  return Math.min(S2_OUTBOX_LIMITS.maxRetryMs,
    S2_OUTBOX_LIMITS.initialRetryMs*2**Math.min(12,attempt-1));
}
/** Unknown network result is NEVER treated as a rejection or a reward.
 * Same stable operation/source IDs are retried; the backend must dedupe. */
export function markS2TransportUnknown(
  prior:readonly S2OutboxEntry[],operationId:string,nowMs:number
):readonly S2OutboxEntry[]{
  if(!validTime(nowMs))throw Error('INVALID_CLOCK');
  return prior.map(x=>{
    if(x.operationId!==operationId||x.status!=='SENDING')return x;
    if(x.attempts>=S2_OUTBOX_LIMITS.maxAttempts)
      return {...x,status:'MANUAL_RECONCILE',nextRetryAtMs:0,
        serverReason:'Awaiting server reconciliation'};
    return {...x,status:'RETRY_WAIT',nextRetryAtMs:nowMs+retryDelayMs(x.attempts),
      serverReason:'Network result unknown'};
  });
}
export function confirmS2ServerResult(
 prior:readonly S2OutboxEntry[],answer:S2ServerResult,nowMs:number
):readonly S2OutboxEntry[]{
  if(!validTime(nowMs))throw Error('INVALID_CLOCK');
  return prior.map(x=>{
    if(x.operationId!==answer.operationId)return x;
    if(x.status!=='SENDING')return x;
    // Result identity must match the original signed-in account/source.
    // Rejected mismatches NEVER credit another account in UI.
    if(x.userId!==answer.userId||x.sourceKind!==answer.sourceKind||
       x.sourceId!==answer.sourceId||answer.authenticatedAdapter!==true)
      return {...x,status:'MANUAL_RECONCILE',serverTokens:null,
        serverReason:'Server identity mismatch'};
    if(answer.decision==='RETRY')return markS2TransportUnknown([x],x.operationId,nowMs)[0];
    if(answer.decision==='INELIGIBLE')return {...x,status:'REJECTED',
      serverTokens:0,serverReceiptId:answer.serverReceiptId,
      serverReason:answer.reason};
    const tokens=answer.serverTokens;
    if(!answer.serverReceiptId||!Number.isSafeInteger(tokens)||
       tokens===null||tokens<0||tokens>12)
      return {...x,status:'MANUAL_RECONCILE',serverTokens:null,
        serverReason:'Malformed reward confirmation'};
    return {...x,status:'CONFIRMED',serverReceiptId:answer.serverReceiptId,
      serverTokens:tokens,serverReason:answer.reason};
  });
}
/** On cold start, never discard a send interrupted by app/process death.
 * Retry with the original operation ID after checking server receipt status. */
export function recoverS2InterruptedSends(
 prior:readonly S2OutboxEntry[],nowMs:number
):readonly S2OutboxEntry[]{
  if(!validTime(nowMs))throw Error('INVALID_CLOCK');
  return prior.map(x=>x.status==='SENDING'
   ?{...x,status:'RETRY_WAIT',nextRetryAtMs:nowMs,serverReason:'App interrupted; verify server'}
   :x);
}
export function getS2RewardDisplay(entry:S2OutboxEntry):
  'PENDING_VERIFICATION'|'EARNED'|'NOT_ELIGIBLE'|'NEEDS_RECONCILIATION'{
  if(entry.status==='CONFIRMED')return 'EARNED';
  if(entry.status==='REJECTED')return 'NOT_ELIGIBLE';
  if(entry.status==='MANUAL_RECONCILE')return 'NEEDS_RECONCILIATION';
  return 'PENDING_VERIFICATION';
}
