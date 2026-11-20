/**
 * BUKLOD WORLD — ledger provenance right simulation (never client authority).
 *
 * Earned-only BP can move between players, but one originating BP unit should
 * not generate new spend-QMP repeatedly through wash trades. This separate,
 * non-cash "QMP eligibility right" travels with a GIFT, is consumed on its
 * first verified PURCHASE, and does not regenerate when a seller receives BP.
 *
 * The actual implementation MUST lock wallet lots server-side and persist
 * immutable purchase/gift receipts. This pure module performs no writes.
 */
export const WORLD_BP_PROVENANCE_SETTLEMENT_ENABLED = false as const;
export type WorldBpLotOwnerKind='member'|'cluster'|'organization';
export type WorldBpLot={
  lotId:string;
  sourceActivityReceiptId:string;
  ownerKind:WorldBpLotOwnerKind;
  ownerId:string;
  availableBp:number;
  /** QMP eligibility from this lot not consumed in a prior verified purchase. */
  qmpEligibleBp:number;
  origin:'verified_personal_earning'|'verified_community_progress'|'settled_transfer';
  version:number;
};
export type WorldBpLotMovementKind='gift'|'peer_item_purchase'|'system_store_purchase'|'community_award';
export type WorldBpProvenanceMovement={
  movementId:string;
  kind:WorldBpLotMovementKind;
  recipient:{kind:WorldBpLotOwnerKind;id:string}|null;
  amountBp:number;
};
export type WorldBpProvenanceQuote=
 |{ok:false;reason:string}
 |{ok:true;senderAfter:WorldBpLot;recipientLot:WorldBpLot|null;
   qmpEligibleBpUsed:number;recipientQmpEligibleBp:number;debitBp:number};

function safePositive(n:number){return Number.isSafeInteger(n)&&n>0;}
export function validateWorldBpLot(lot:WorldBpLot):boolean{
 return Boolean(lot?.lotId?.trim()&&lot.sourceActivityReceiptId?.trim()&&lot.ownerId?.trim())&&
   ['member','cluster','organization'].includes(lot.ownerKind)&&
   ['verified_personal_earning','verified_community_progress','settled_transfer'].includes(lot.origin)&&
   Number.isSafeInteger(lot.availableBp)&&lot.availableBp>=0&&
   Number.isSafeInteger(lot.qmpEligibleBp)&&lot.qmpEligibleBp>=0&&
   lot.qmpEligibleBp<=lot.availableBp&&
   Number.isSafeInteger(lot.version)&&lot.version>=0&&
   (lot.ownerKind==='member'||lot.qmpEligibleBp===0);
}
export function previewWorldBpProvenanceMovement(
 lot:WorldBpLot,movement:WorldBpProvenanceMovement,
):WorldBpProvenanceQuote{
 const fail=(reason:string):WorldBpProvenanceQuote=>({ok:false,reason});
 if(!validateWorldBpLot(lot)||!movement?.movementId?.trim()||
    !['gift','peer_item_purchase','system_store_purchase','community_award'].includes(movement.kind)||
    !safePositive(movement.amountBp)||movement.amountBp>lot.availableBp)
   return fail('Invalid BP lot, amount or movement.');
 if(lot.ownerKind!=='member'&&
   !['community_award','system_store_purchase'].includes(movement.kind))
   return fail('Community BP cannot be gifted or traded by members.');
 if(movement.kind==='community_award'&&lot.ownerKind==='member')
   return fail('Personal BP cannot fund Cluster treasury awards.');
 const isTransfer=movement.kind!=='system_store_purchase';
 if(isTransfer){
   if(!movement.recipient?.id?.trim()||
      !['member','cluster','organization'].includes(movement.recipient.kind))
     return fail('Invalid receiving account.');
   if(movement.recipient.id===lot.ownerId&&movement.recipient.kind===lot.ownerKind)
     return fail('Transfers to the same account are prohibited.');
 }else if(movement.recipient!==null)return fail('System store checkout does not pay another user.');
 if(movement.kind==='gift'&&movement.recipient?.kind!=='member')
   return fail('Personal BP gifts require a named member recipient.');
 if(movement.kind==='peer_item_purchase'&&movement.recipient?.kind!=='member')
   return fail('Peer item purchases require an eligible seller member.');
 if(movement.kind==='community_award'&&
   (!movement.recipient||movement.recipient.kind==='member'))
   return fail('Challenge awards must remain community-owned.');
 const spentEligible=Math.min(movement.amountBp,lot.qmpEligibleBp);
 const remaining=lot.availableBp-movement.amountBp;
 const eligibleRemaining=lot.qmpEligibleBp-spentEligible;
 const version=lot.version+1;
 if(!Number.isSafeInteger(version))return fail('Lot revision overflow.');
 const senderAfter={...lot,availableBp:remaining,qmpEligibleBp:eligibleRemaining,version};
 // Gift preserves unused QMP eligibility, but does not issue QMP itself.
 // Every eligible BP used in a purchase loses its QMP right before being
 // transferred to a seller, preventing circular purchases from minting QMP.
 const isGift=movement.kind==='gift';
 const recipientQmpEligibleBp=isGift?spentEligible:0;
 const recipientLot=isTransfer?{
   lotId:movement.movementId+':credit',
   sourceActivityReceiptId:lot.sourceActivityReceiptId,
   ownerKind:movement.recipient!.kind,
   ownerId:movement.recipient!.id,
   availableBp:movement.amountBp,
   qmpEligibleBp:recipientQmpEligibleBp,
   origin:'settled_transfer' as const,
   version:0,
 }:null;
 return {ok:true,senderAfter,recipientLot,
   qmpEligibleBpUsed:isGift?0:lot.ownerKind==='member'?spentEligible:0,
   recipientQmpEligibleBp,debitBp:movement.amountBp};
}
