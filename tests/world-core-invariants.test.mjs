import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EMPTY_WORLD_BP_WALLET, applyWorldBpWalletChange, availableBp, WORLD_BP_SALES_ENABLED,
} from '../src/features/world/worldBpWalletContract.ts';
import {
  previewWorldBpProvenanceMovement,
} from '../src/features/world/worldBpProvenance.ts';
import {
  previewWorldQmpFromBpSpend, WORLD_QMP_ACTIVATION_ENABLED,
} from '../src/features/world/worldQmpPolicyDraft.ts';
import {
  previewCommunityProgressBp, previewCommunityChallengeAward, communityTreasuryAvailableBp,
  WORLD_COMMUNITY_AWARDS_ENABLED,
} from '../src/features/world/worldCommunityTreasury.ts';
import {
  assessWorldChallengeEvidence, validateWorldChallengeFunding, WORLD_WINNER_TAKES_STAKES_ENABLED,
} from '../src/features/world/worldCommunityChallenges.ts';
import {
  worldTier, nextWorldAdvance, applyPreviewWorldAdvance, WORLD_DEVELOPMENT_ENABLED,
} from '../src/features/world/worldDevelopmentCatalog.ts';
import {
  WORLD_BP_PURCHASES_WITH_FIAT_ENABLED, WORLD_TRADING_ENABLED,
  WORLD_BLUEPRINT_PREVIEWS, WORLD_ITEM_PREVIEWS, quoteWorldItemPurchase, previewRecipeCost,
} from '../src/features/world/worldEconomyBlueprint.ts';

test('earned-only BP: receiving gift increases Available, never Lifetime Earned', () => {
 assert.equal(WORLD_BP_SALES_ENABLED,false);
 const grant=applyWorldBpWalletChange(EMPTY_WORLD_BP_WALLET,{
  type:'receive_transfer',amount:500,origin:'earned_origin',reason:'gift',receiptId:'gift-1',
 });
 assert.equal(grant.ok,true);
 if(!grant.ok)return;
 assert.equal(availableBp(grant.wallet),500);
 assert.equal(grant.wallet.lifetimeEarnedBp,0);
 const purchase=applyWorldBpWalletChange(grant.wallet,{type:'spend_purchase',amount:300,receiptId:'purchase-1'});
 assert.equal(purchase.ok,true);
 if(!purchase.ok)return;
 assert.equal(availableBp(purchase.wallet),200);
 assert.equal(purchase.wallet.lifetimeEarnedBp,0);
 assert.equal(purchase.debitSources?.giftedEarnedBpDebited,300);
});

test('earned BP receipt can create QMP qualification only on first valid purchase', () => {
 const original={
  lotId:'earned-lot-1',sourceActivityReceiptId:'reward-1',
  ownerKind:'member',ownerId:'user-a',availableBp:300,
  qmpEligibleBp:300,origin:'verified_personal_earning',version:0,
 };
 const gifted=previewWorldBpProvenanceMovement(original,{
  movementId:'gift-a-b',kind:'gift',recipient:{kind:'member',id:'user-b'},amountBp:200,
 });
 assert.equal(gifted.ok,true);
 if(!gifted.ok)return;
 assert.equal(gifted.qmpEligibleBpUsed,0);
 assert.equal(gifted.recipientLot.qmpEligibleBp,200);
 const purchase=previewWorldBpProvenanceMovement(gifted.recipientLot,{
  movementId:'purchase-b-c',kind:'peer_item_purchase',
  recipient:{kind:'member',id:'user-c'},amountBp:200,
 });
 assert.equal(purchase.ok,true);
 if(!purchase.ok)return;
 assert.equal(purchase.qmpEligibleBpUsed,200);
 assert.equal(purchase.recipientLot.qmpEligibleBp,0);
 const second=previewWorldBpProvenanceMovement(purchase.recipientLot,{
  movementId:'purchase-c-a',kind:'peer_item_purchase',
  recipient:{kind:'member',id:'user-a'},amountBp:200,
 });
 assert.equal(second.ok,true);
 if(second.ok)assert.equal(second.qmpEligibleBpUsed,0);
});

test('gift alone cannot create QMP; verified purchase requires original unused rights',()=>{
 assert.equal(WORLD_QMP_ACTIVATION_ENABLED,false);
 const base={
  receiptId:'order-1',actorId:'buyer',period:'2026-12',entityId:'materials-1',
  transactionKind:'purchase',category:'construction_materials',bpDebited:500,
  earnedBpDebited:0,giftedEarnedBpDebited:500,
  purchasedBpDebited:0,giftedPurchasedBpDebited:0,qmpEligibleBpDebited:500,
  source:'world',settledByServer:true,state:'fulfilled',
 };
 const purchased=previewWorldQmpFromBpSpend(base,[]);
 assert.equal(purchased.qualifies,true);
 assert.equal(previewWorldQmpFromBpSpend({...base,transactionKind:'bp_gift'},[]).qualifies,false);
 assert.equal(previewWorldQmpFromBpSpend({...base,qmpEligibleBpDebited:0},[]).qualifies,false);
 assert.equal(previewWorldQmpFromBpSpend({...base,settledByServer:false},[]).qualifies,false);
 assert.equal(previewWorldQmpFromBpSpend({...base,purchasedBpDebited:500,giftedEarnedBpDebited:0},[]).qualifies,false);
});

test('one member BP earning receipt can credit only one designated Cluster',()=>{
 const event={
  receiptId:'grant-1',memberId:'member-1',
  community:{kind:'cluster',scopeId:'cluster-a'},sourceActivityReceiptId:'earned-action-1',
  personalBpEarned:100,monthlyPersonalBpBeforeEvent:0,verifiedByServer:true,
  activeMembershipAtEarnTime:true,occurredAt:'2026-12-03T12:00:00+08:00',flagged:false,
 };
 const grant=previewCommunityProgressBp(event,[]);
 assert.equal(grant.qualifies,true);
 if(grant.qualifies) {
  assert.equal(grant.proposedCommunityBp,10);
  assert.equal(grant.personalBpDeducted,0);
  assert.equal(grant.personalQmpAdded,0);
 }
 const used=[{eventId:'other',communityScopeId:'cluster-b',memberId:'member-1',period:'2026-12',
  sourceActivityReceiptId:'earned-action-1',creditedCommunityBp:10}];
 assert.equal(previewCommunityProgressBp(event,used).qualifies,false);
 assert.equal(previewCommunityProgressBp({...event,flagged:true},[]).qualifies,false);
});

test('Cluster sponsor uses its own reserved prize; no member or loser contribution',()=>{
 assert.equal(WORLD_COMMUNITY_AWARDS_ENABLED,false);
 assert.equal(WORLD_WINNER_TAKES_STAKES_ENABLED,false);
 const sponsor={community:{kind:'cluster',scopeId:'cluster-a'},
  mintedFromVerifiedProgressBp:600,receivedChallengeAwardsBp:0,
  distributedChallengeAwardsBp:0,spentOnCommunityAssetsBp:0,reservedForChallengesBp:300};
 assert.equal(communityTreasuryAvailableBp(sponsor),300);
 const reservation={challengeId:'contest-1',sponsor:{kind:'cluster',scopeId:'cluster-a'},
  prizeBp:300,reservationReceiptId:'reserve-1',status:'reserved',
  authorizedWinnerScopeId:'cluster-b'};
 const decision=previewCommunityChallengeAward(sponsor,reservation,
  {kind:'cluster',scopeId:'cluster-b'},{
   challengeVerified:true,independentFinalAuditReceiptId:'auditor-verdict-1',
   disputeOpen:false,reservationAlreadySettled:false,
  });
 assert.equal(decision.ok,true);
 if(decision.ok){
  assert.equal(decision.sourceTreasuryDebitBp,300);
  assert.equal(decision.winnerTreasuryCreditBp,300);
  assert.equal(decision.personalQmpCredit,0);
 }
 assert.ok(validateWorldChallengeFunding({
  mode:'cluster_treasury_award',restrictedProjectBudgetBp:100,
  prefundedSponsorAwardBp:300,recipientGetsOtherTeamsBudget:true,
  awardSponsorCommunity:{kind:'cluster',scopeId:'cluster-a'},awardReservationReceiptId:'reserve-1',
 }));
});

test('two-team mutual approvals and barangay permission alone never verify a project',()=>{
 const challenge={
  id:'garden-1',format:'friendly_impact_contest',
  title:'Community garden',purpose:'Improve community gardening',
  measurableOutcome:'Verified completed raised beds',
  participants:[{kind:'cluster',scopeId:'cluster-a'},{kind:'cluster',scopeId:'cluster-b'}],
  evidenceWindowStart:'2026-12-01T00:00:00+08:00',
  deadline:'2026-12-30T00:00:00+08:00',
  localPermissionRequired:true,
  funding:{mode:'none',restrictedProjectBudgetBp:0,prefundedSponsorAwardBp:0,recipientGetsOtherTeamsBudget:false},
  state:'under_review',
 };
 const e=[{id:'permit-1',challengeId:'garden-1',kind:'authority_permission',
  submittedBy:'participant-1',contentHash:'a'.repeat(64),
  recordedAt:'2026-12-05T10:00:00+08:00',
  verification:{state:'verified',reviewerId:'neutral-1',
   reviewerIndependent:true,verifiedWithIssuer:true,reviewReceiptId:'review-1'}}];
 const ctx={priorEvidenceHashes:new Set(),reuseExceptionApprovedByIndependentAuditor:false,
  disputeOpen:false,participantApprovals:['cluster-a','cluster-b'],
  independentReview:{reviewerId:'neutral-2',scopeIdsReviewerBelongsTo:[],
   conflictOfInterestDeclared:false,finalAuditReceiptId:'final-review',result:'pass'}};
 const review=assessWorldChallengeEvidence(challenge,e,ctx);
 assert.equal(review.evidenceReady,false);
 assert.equal(review.bpReleaseAuthorized,false);
});

test('permanent 10-level world stages require verified step receipts and sufficient area',()=>{
 assert.equal(WORLD_DEVELOPMENT_ENABLED,false);
 for(const track of ['personal_lot','house','farm','cluster','organization']){
  assert.equal(worldTier(track,1).stages.length,5);
  assert.equal(worldTier(track,10).level,10);
  assert.ok(worldTier(track,10).sampleBpForFullTier>worldTier(track,1).sampleBpForFullTier);
 }
 const state={track:'house',level:0,stage:0,revision:0};
 const next=nextWorldAdvance(state);
 assert.equal(next.nextStage,1);
 assert.equal(applyPreviewWorldAdvance(state,{
  worldId:'home-1',approvedArtId:next.sampleArtStageId,level:1,
  stage:1,revision:1,serverVerified:false,
 },100).ok,false);
});

test('material catalog and house recipes can be priced without backend/fiat sale',()=>{
 assert.equal(WORLD_BP_PURCHASES_WITH_FIAT_ENABLED,false);
 assert.equal(WORLD_TRADING_ENABLED,false);
 assert.ok(WORLD_ITEM_PREVIEWS.length>=65);
 assert.equal(WORLD_BLUEPRINT_PREVIEWS.length,4);
 for(const b of WORLD_BLUEPRINT_PREVIEWS){
  assert.ok(b.recipe.length>0);
  assert.equal(previewRecipeCost(b.recipe),b.sampleBuildingBp);
 }
 assert.equal(quoteWorldItemPurchase('wood-plank',10,'best_value').sampleCostBp,55);
 assert.equal(quoteWorldItemPurchase('sand',0.5,'unit').sampleCostBp,1);
 assert.equal(quoteWorldItemPurchase('wood-plank',0.5,'unit'),null);
});

test('five construction receipts consume the exact disabled preview tier sum and never invent an ownership receipt',()=>{
  let state={track:'house',level:0,stage:0,revision:0};
  const tier=worldTier('house',1);
  let bp=0;
  for(let stage=1;stage<=5;stage++){
    const next=nextWorldAdvance(state);
    assert.equal(next?.nextStage,stage);
    bp+=next.sampleBpForCurrentStage;
    const result=applyPreviewWorldAdvance(state,{worldId:'test-world',approvedArtId:next.sampleArtStageId,
      level:1,stage,revision:state.revision+1,serverVerified:true},1000);
    assert.equal(result.ok,true);
    if(result.ok)state=result.next;
  }
  assert.equal(bp,tier.sampleBpForFullTier);
  assert.equal(state.level,1);
  assert.equal(state.stage,0);
  assert.equal(state.revision,5);
  assert.equal(nextWorldAdvance({...state,stage:5}),null);
});
