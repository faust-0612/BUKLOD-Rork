/**
 * BUKLOD Community BP — pure DEV-ONLY treasury and challenge funding contract.
 *
 * Community BP is an ACCOUNT SCOPE of virtual BP, not personal Lifetime BP:
 * it grows only from independently confirmed member-progress receipts and
 * separately settled earned-BP community-to-community award transfers.
 * It CANNOT create personal rank, personal QMP, or cash value.
 *
 * No client-side award, wallet mutation, mint RPC, QMP or stake settlement.
 * A future server must atomically lock/validate receipts and balances.
 */
export const WORLD_COMMUNITY_TREASURY_ENABLED = false as const;
export const WORLD_COMMUNITY_AWARDS_ENABLED = false as const;
export type WorldCommunityScope = {kind:'cluster'|'organization';scopeId:string};
export type WorldCommunityProgressReceipt = {
  receiptId:string;
  memberId:string;
  community:WorldCommunityScope;
  sourceActivityReceiptId:string;
  /** BP that member earned from independently verified app participation. */
  personalBpEarned:number;
  /** Server-authoritative eligible personal BP earned earlier in the same month,
   * so small honest activities accumulate toward community BP fairly. */
  monthlyPersonalBpBeforeEvent:number;
  verifiedByServer:boolean;
  activeMembershipAtEarnTime:boolean;
  occurredAt:string;
  flagged:boolean;
};
export type WorldCommunityProgressPolicyDraft={
  version:'community_bp_progress_v1';
  /** Draft: 10 community BP for every 100 personal BP earned; NOT a transfer. */
  communityBpPer100EarnedBp:number;
  perReceiptCapBp:number;
  perMemberMonthlyCapBp:number;
};
export const WORLD_COMMUNITY_PROGRESS_POLICY:WorldCommunityProgressPolicyDraft={
  version:'community_bp_progress_v1',
  communityBpPer100EarnedBp:10,
  perReceiptCapBp:30,
  perMemberMonthlyCapBp:200,
};
export type WorldCommunityProgressCredit={
  eventId:string;
  communityScopeId:string;
  memberId:string;
  period:string;
  sourceActivityReceiptId:string;
  creditedCommunityBp:number;
};
export type WorldCommunityProgressPreview=
  | {qualifies:true;proposedCommunityBp:number;personalBpDeducted:0;personalEarnedBpAdded:0;personalQmpAdded:0}
  | {qualifies:false;proposedCommunityBp:0;reason:string};

export function previewCommunityProgressBp(
  event:WorldCommunityProgressReceipt,
  history:readonly WorldCommunityProgressCredit[],
  policy:WorldCommunityProgressPolicyDraft=WORLD_COMMUNITY_PROGRESS_POLICY,
):WorldCommunityProgressPreview{
  const reject=(reason:string):WorldCommunityProgressPreview=>({qualifies:false,proposedCommunityBp:0,reason});
  if(!event?.receiptId?.trim()||!event.memberId?.trim()||
     !event.community?.scopeId?.trim()||
     !['cluster','organization'].includes(event.community.kind)||
     !event.sourceActivityReceiptId?.trim()||
     !Number.isFinite(Date.parse(event.occurredAt))||
     !Number.isSafeInteger(event.personalBpEarned)||event.personalBpEarned<=0||
     !Number.isSafeInteger(event.monthlyPersonalBpBeforeEvent)||event.monthlyPersonalBpBeforeEvent<0||
     !Number.isSafeInteger(event.monthlyPersonalBpBeforeEvent+event.personalBpEarned))
    return reject('Invalid original verified progress receipt.');
  if(!event.verifiedByServer||!event.activeMembershipAtEarnTime||event.flagged)
    return reject('Unverified, flagged or non-member participation.');
  // One source activity can fund ONE designated community; avoid double minting.
  if(history.some(h=>h.eventId===event.receiptId||
      h.sourceActivityReceiptId===event.sourceActivityReceiptId))
    return reject('Already credited from this source activity in this community.');
  const period=event.occurredAt.slice(0,7);
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))
    return reject('Invalid monthly period.');
  if(!Number.isSafeInteger(policy.communityBpPer100EarnedBp)||policy.communityBpPer100EarnedBp<0||
     !Number.isSafeInteger(policy.perReceiptCapBp)||policy.perReceiptCapBp<0||
     !Number.isSafeInteger(policy.perMemberMonthlyCapBp)||policy.perMemberMonthlyCapBp<0)
    return reject('Invalid policy limits.');
  const previous=history
    .filter(h=>h.communityScopeId===event.community.scopeId&&h.memberId===event.memberId&&h.period===period)
    .reduce((acc,h)=>acc+Math.max(0,h.creditedCommunityBp),0);
  const remaining=Math.max(0,policy.perMemberMonthlyCapBp-previous);
  const beforeRatio=Math.floor(event.monthlyPersonalBpBeforeEvent*policy.communityBpPer100EarnedBp/100);
  const afterRatio=Math.floor((event.monthlyPersonalBpBeforeEvent+event.personalBpEarned)*policy.communityBpPer100EarnedBp/100);
  const proposed=Math.min(
    Math.max(0,afterRatio-beforeRatio),
    policy.perReceiptCapBp,
    remaining,
  );
  if(!Number.isSafeInteger(proposed)||proposed<=0)return reject('No community BP available within caps.');
  return {qualifies:true,proposedCommunityBp:proposed,
    personalBpDeducted:0,personalEarnedBpAdded:0,personalQmpAdded:0};
}

export type WorldCommunityTreasury={
  community:WorldCommunityScope;
  /** Cumulative earned from verified member progress; immutable ledger source. */
  mintedFromVerifiedProgressBp:number;
  /** Cumulative winning challenge receipts, received from other treasuries. */
  receivedChallengeAwardsBp:number;
  /** Cumulative valid outgoing challenge awards. */
  distributedChallengeAwardsBp:number;
  /** Cumulative purchases of world community assets. */
  spentOnCommunityAssetsBp:number;
  /** Existing community commitments not yet disbursed. */
  reservedForChallengesBp:number;
};
export function communityTreasuryAvailableBp(t:WorldCommunityTreasury):number|null{
  const fields=[
    t.mintedFromVerifiedProgressBp,t.receivedChallengeAwardsBp,
    t.distributedChallengeAwardsBp,t.spentOnCommunityAssetsBp,
    t.reservedForChallengesBp,
  ];
  if(!t.community?.scopeId?.trim()||
      !['cluster','organization'].includes(t.community.kind)||
      fields.some(v=>!Number.isSafeInteger(v)||v<0))return null;
  const all=t.mintedFromVerifiedProgressBp+t.receivedChallengeAwardsBp;
  const used=t.distributedChallengeAwardsBp+t.spentOnCommunityAssetsBp+t.reservedForChallengesBp;
  return Number.isSafeInteger(all)&&Number.isSafeInteger(used)&&used<=all?all-used:null;
}
export type WorldCommunityAwardReservation={
  challengeId:string;
  sponsor:WorldCommunityScope;
  prizeBp:number;
  reservationReceiptId:string;
  status:'reserved'|'settled'|'released';
  /** Approval of winning community requires independent verification, not just two leaders. */
  authorizedWinnerScopeId:string|null;
};
export type WorldCommunityAwardDecision=
  | {ok:true;sourceTreasuryDebitBp:number;winnerTreasuryCreditBp:number;
     personalBpCredit:0;personalQmpCredit:0;reason:'approved-for-server-settlement'}
  | {ok:false;reason:string};

export function previewCommunityChallengeAward(
  source:WorldCommunityTreasury,
  reserve:WorldCommunityAwardReservation,
  recipient:WorldCommunityScope,
  check:{
    challengeVerified:boolean;
    independentFinalAuditReceiptId:string|null;
    disputeOpen:boolean;
    reservationAlreadySettled:boolean;
  },
):WorldCommunityAwardDecision{
  const reject=(reason:string):WorldCommunityAwardDecision=>({ok:false,reason});
  if(!reserve?.challengeId?.trim()||!reserve.reservationReceiptId?.trim()||
    reserve.status!=='reserved'||!Number.isSafeInteger(reserve.prizeBp)||reserve.prizeBp<=0)
    return reject('Missing active prefunded challenge reservation.');
  if(source.community.scopeId!==reserve.sponsor.scopeId||
     source.community.kind!==reserve.sponsor.kind)
    return reject('Prize must be funded from the sponsoring community treasury.');
  if(!recipient?.scopeId?.trim()||reserve.authorizedWinnerScopeId!==recipient.scopeId)
    return reject('Recipient is not the independently approved winning community.');
  if(recipient.scopeId===source.community.scopeId)
    return reject('Sponsor cannot transfer the award to itself: release its reservation instead.');
  if(!check.challengeVerified||!check.independentFinalAuditReceiptId?.trim()||
     check.disputeOpen||check.reservationAlreadySettled)
    return reject('Challenge is not finalized, verified or safe to settle.');
  // The reservation must ALREADY be accounted for in the treasury snapshot.
  const available=communityTreasuryAvailableBp(source);
  if(available===null||source.reservedForChallengesBp<reserve.prizeBp)
    return reject('Sponsor prize is not reserved against a valid treasury.');
  return {ok:true,sourceTreasuryDebitBp:reserve.prizeBp,
    winnerTreasuryCreditBp:reserve.prizeBp,
    personalBpCredit:0,personalQmpCredit:0,
    reason:'approved-for-server-settlement'};
}
