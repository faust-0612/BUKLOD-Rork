import {
 WORLD_BP_PROVENANCE_SETTLEMENT_ENABLED,previewWorldBpProvenanceMovement,
 validateWorldBpLot,type WorldBpLot,
} from '@/features/world/worldBpProvenance';
const earned=():WorldBpLot=>({
 lotId:'lot-e1',sourceActivityReceiptId:'verified-earning-1',
 ownerKind:'member',ownerId:'user-a',
 availableBp:500,qmpEligibleBp:500,
 origin:'verified_personal_earning',version:0,
});
describe('BUKLOD BP provenance prevents repeat purchase-QMP cycling',()=>{
 it('is source only, never a live wallet action',()=>{
  expect(WORLD_BP_PROVENANCE_SETTLEMENT_ENABLED).toBe(false);
 });
 it('gift passes unused BP QMP right without issuing QMP or rank',()=>{
  const moved=previewWorldBpProvenanceMovement(earned(),{
   movementId:'gift-1',kind:'gift',recipient:{kind:'member',id:'user-b'},amountBp:300,
  });
  expect(moved.ok).toBe(true);
  if(!moved.ok)return;
  expect(moved.senderAfter.availableBp).toBe(200);
  expect(moved.senderAfter.qmpEligibleBp).toBe(200);
  expect(moved.recipientLot?.availableBp).toBe(300);
  expect(moved.recipientLot?.qmpEligibleBp).toBe(300);
  expect(moved.qmpEligibleBpUsed).toBe(0);
 });
 it('one original 300 BP can create purchase-QMP ONCE, even across multiple holders',()=>{
  const gifted=previewWorldBpProvenanceMovement(earned(),{
   movementId:'gift-2',kind:'gift',recipient:{kind:'member',id:'user-b'},amountBp:300,
  });
  if(!gifted.ok||!gifted.recipientLot)throw Error('gift failed');
  const bought=previewWorldBpProvenanceMovement(gifted.recipientLot,{
   movementId:'buy-1',kind:'peer_item_purchase',
   recipient:{kind:'member',id:'user-c'},amountBp:300,
  });
  expect(bought.ok).toBe(true);
  if(!bought.ok||!bought.recipientLot)return;
  expect(bought.qmpEligibleBpUsed).toBe(300);
  expect(bought.recipientLot.qmpEligibleBp).toBe(0);
  const next=previewWorldBpProvenanceMovement(bought.recipientLot,{
   movementId:'buy-2',kind:'peer_item_purchase',
   recipient:{kind:'member',id:'user-a'},amountBp:300,
  });
  expect(next.ok).toBe(true);
  if(next.ok){
   expect(next.debitBp).toBe(300);
   expect(next.qmpEligibleBpUsed).toBe(0);
   expect(next.recipientLot?.qmpEligibleBp).toBe(0);
  }
 });
 it('system purchases consume valid rights with no recipient',()=>{
  const result=previewWorldBpProvenanceMovement(earned(),{
   movementId:'store-1',kind:'system_store_purchase',recipient:null,amountBp:100,
  });
  expect(result.ok).toBe(true);
  if(result.ok){
   expect(result.qmpEligibleBpUsed).toBe(100);
   expect(result.recipientLot).toBeNull();
  }
 });
 it('community awards are community to community, no personal QMP',()=>{
  const cluster:WorldBpLot={...earned(),lotId:'cluster-bp-1',ownerId:'cluster-a',
   ownerKind:'cluster',origin:'verified_community_progress',qmpEligibleBp:0};
  expect(validateWorldBpLot(cluster)).toBe(true);
  const award=previewWorldBpProvenanceMovement(cluster,{
   movementId:'award-1',kind:'community_award',
   recipient:{kind:'cluster',id:'cluster-b'},amountBp:100,
  });
  expect(award.ok).toBe(true);
  if(award.ok){
   expect(award.qmpEligibleBpUsed).toBe(0);
   expect(award.recipientLot?.qmpEligibleBp).toBe(0);
  }
  const invalid=previewWorldBpProvenanceMovement(earned(),{
   movementId:'fake-award',kind:'community_award',
   recipient:{kind:'cluster',id:'cluster-b'},amountBp:100,
  });
  expect(invalid.ok).toBe(false);
 });
 it('rejects insufficient money, self-trade, invalid lots and fabricated eligibilities',()=>{
  const fake={...earned(),qmpEligibleBp:600};
  expect(validateWorldBpLot(fake)).toBe(false);
  expect(previewWorldBpProvenanceMovement(fake,{
   movementId:'x',kind:'gift',recipient:{kind:'member',id:'user-b'},amountBp:100,
  }).ok).toBe(false);
  expect(previewWorldBpProvenanceMovement(earned(),{
   movementId:'x',kind:'gift',recipient:{kind:'member',id:'user-a'},amountBp:100,
  }).ok).toBe(false);
  expect(previewWorldBpProvenanceMovement(earned(),{
   movementId:'x',kind:'gift',recipient:{kind:'member',id:'user-b'},amountBp:600,
  }).ok).toBe(false);
 });
});
