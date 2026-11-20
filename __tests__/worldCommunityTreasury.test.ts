import {
  previewCommunityProgressBp,communityTreasuryAvailableBp,previewCommunityChallengeAward,
  WORLD_COMMUNITY_TREASURY_ENABLED,WORLD_COMMUNITY_AWARDS_ENABLED,
  type WorldCommunityProgressReceipt,type WorldCommunityTreasury,
} from '@/features/world/worldCommunityTreasury';

const progress=(patch:Partial<WorldCommunityProgressReceipt>={}):WorldCommunityProgressReceipt=>({
  receiptId:'community-credit-1',
  memberId:'member-1',
  community:{kind:'cluster',scopeId:'cluster-a'},
  sourceActivityReceiptId:'verified-original-personal-bp-1',
  personalBpEarned:100,
  verifiedByServer:true,
  activeMembershipAtEarnTime:true,
  occurredAt:'2026-12-03T14:00:00+08:00',
  flagged:false,...patch,
});
const treasury=():WorldCommunityTreasury=>({
  community:{kind:'cluster',scopeId:'cluster-a'},
  mintedFromVerifiedProgressBp:1000,
  receivedChallengeAwardsBp:200,
  distributedChallengeAwardsBp:0,
  spentOnCommunityAssetsBp:250,
  reservedForChallengesBp:300,
});
const reservation=()=>({
  challengeId:'garden-competition-01',
  sponsor:{kind:'cluster' as const,scopeId:'cluster-a'},
  prizeBp:300,reservationReceiptId:'sponsor-escrow-1',
  status:'reserved' as const,authorizedWinnerScopeId:'cluster-b',
});
const verified=()=>({
  challengeVerified:true,
  independentFinalAuditReceiptId:'independent-review-01',
  disputeOpen:false,reservationAlreadySettled:false,
});

describe('Community treasury from verified member progression — DEV only',()=>{
 it('cannot create financial rewards or settle prizes on a live wallet',()=>{
   expect(WORLD_COMMUNITY_TREASURY_ENABLED).toBe(false);
   expect(WORLD_COMMUNITY_AWARDS_ENABLED).toBe(false);
 });
 it('grows community BP from a verified personal earning WITHOUT deducting individual BP or adding QMP',()=>{
   const quote=previewCommunityProgressBp(progress(),[]);
   expect(quote.qualifies).toBe(true);
   if(!quote.qualifies)return;
   expect(quote.proposedCommunityBp).toBe(10);
   expect(quote.personalBpDeducted).toBe(0);
   expect(quote.personalEarnedBpAdded).toBe(0);
   expect(quote.personalQmpAdded).toBe(0);
 });
 it('rejects duplicated original member progress across MULTIPLE clusters',()=>{
   const history=[{eventId:'event-x',memberId:'member-1',communityScopeId:'cluster-other',
       sourceActivityReceiptId:'verified-original-personal-bp-1',period:'2026-12',creditedCommunityBp:10}];
   expect(previewCommunityProgressBp(progress(),history).qualifies).toBe(false);
 });
 it('blocks nonmembers, unverified, flagged, zero points and excessive monthly earning',()=>{
   expect(previewCommunityProgressBp(progress({activeMembershipAtEarnTime:false}),[]).qualifies).toBe(false);
   expect(previewCommunityProgressBp(progress({verifiedByServer:false}),[]).qualifies).toBe(false);
   expect(previewCommunityProgressBp(progress({flagged:true}),[]).qualifies).toBe(false);
   expect(previewCommunityProgressBp(progress({personalBpEarned:0}),[]).qualifies).toBe(false);
   const used=[{eventId:'old',memberId:'member-1',communityScopeId:'cluster-a',
      sourceActivityReceiptId:'old-earned-receipt',period:'2026-12',creditedCommunityBp:200}];
   expect(previewCommunityProgressBp(progress(),used).qualifies).toBe(false);
 });
 it('cannot distribute more than sponsor reserved balance or bypass independent approval',()=>{
   expect(communityTreasuryAvailableBp(treasury())).toBe(650);
   const recipient={kind:'cluster' as const,scopeId:'cluster-b'};
   const quote=previewCommunityChallengeAward(treasury(),reservation(),recipient,verified());
   expect(quote.ok).toBe(true);
   if(quote.ok){
     expect(quote.sourceTreasuryDebitBp).toBe(300);
     expect(quote.winnerTreasuryCreditBp).toBe(300);
     expect(quote.personalBpCredit).toBe(0);
     expect(quote.personalQmpCredit).toBe(0);
   }
   expect(previewCommunityChallengeAward(treasury(),{...reservation(),prizeBp:500},recipient,verified()).ok).toBe(false);
   expect(previewCommunityChallengeAward(treasury(),reservation(),recipient,
     {...verified(),disputeOpen:true}).ok).toBe(false);
   expect(previewCommunityChallengeAward(treasury(),reservation(),recipient,
     {...verified(),reservationAlreadySettled:true}).ok).toBe(false);
   expect(previewCommunityChallengeAward(treasury(),reservation(),recipient,
     {...verified(),independentFinalAuditReceiptId:null}).ok).toBe(false);
 });
 it('does not pay the losing community stake or the sponsoring Cluster itself',()=>{
   expect(previewCommunityChallengeAward(treasury(),reservation(),
      {kind:'cluster',scopeId:'cluster-a'},verified()).ok).toBe(false);
   expect(previewCommunityChallengeAward(treasury(),reservation(),
      {kind:'cluster',scopeId:'cluster-c'},verified()).ok).toBe(false);
 });
 it('fails closed on unbalanced ledger totals',()=>{
   expect(communityTreasuryAvailableBp({...treasury(),reservedForChallengesBp:999999})).toBeNull();
   expect(communityTreasuryAvailableBp({...treasury(),distributedChallengeAwardsBp:-1})).toBeNull();
 });
});
