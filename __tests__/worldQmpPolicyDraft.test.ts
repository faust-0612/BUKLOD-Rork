import {
  previewWorldQmpFromBpSpend, previewWorldSpendQmpQuote,
  WORLD_QMP_ACTIVATION_ENABLED, WORLD_QMP_POLICY_DRAFT,
  type WorldQmpSpendEvent,
} from '@/features/world/worldQmpPolicyDraft';

const valid=(overrides: Partial<WorldQmpSpendEvent> = {}):WorldQmpSpendEvent=>({
  receiptId:'receipt-1',
  actorId:'user-a',
  period:'2026-12',
  entityId:'order-1',
  transactionKind:'purchase',
  category:'construction_materials',
  bpDebited:500,
  earnedBpDebited:500,
  giftedEarnedBpDebited:0,
  purchasedBpDebited:0,
  giftedPurchasedBpDebited:0,
  qmpEligibleBpDebited:500,
  source:'world',
  settledByServer:true,
  state:'fulfilled',
  ...overrides,
});

describe('BUKLOD spend-driven QMP — disabled DEV policy preview',()=>{
  it('is never connected to production Finance',()=>{
    expect(WORLD_QMP_ACTIVATION_ENABLED).toBe(false);
    expect(WORLD_QMP_POLICY_DRAFT.version).toBe('proposal_spend_driven_v2');
  });

  it('participation earns BP elsewhere; BP earning cannot directly create QMP',()=>{
    expect(previewWorldQmpFromBpSpend(valid({transactionKind:'earn_bp'}),[]).qualifies).toBe(false);
    expect(previewWorldQmpFromBpSpend(valid({transactionKind:'passive'}),[]).qualifies).toBe(false);
  });

  it('a completed eligible BP purchase creates proposed spend QMP',()=>{
    const quote=previewWorldQmpFromBpSpend(valid(),[]);
    expect(quote.qualifies).toBe(true);
    if(quote.qualifies)expect(quote.proposedWeight).toBe(5);
  });

  it('a BP gift or item gift never receives a positive QMP credit',()=>{
    expect(previewWorldQmpFromBpSpend(valid({transactionKind:'bp_gift'}),[]).qualifies).toBe(false);
    expect(previewWorldQmpFromBpSpend(valid({transactionKind:'item_gift'}),[]).qualifies).toBe(false);
    const gift=previewWorldSpendQmpQuote('bp_gift',100,5,2);
    expect(gift.purchaseQmpCredit).toBe(0);
    expect(gift.giftQmpDeduction).toBe(2);
    expect(gift.netQmpChange).toBe(-2);
    expect(previewWorldSpendQmpQuote('bp_gift',100,5,null).netQmpChange).toBeNull();
    const purchase=previewWorldSpendQmpQuote('purchase',100,1,5);
    expect(purchase.purchaseQmpCredit).toBe(1);
    expect(purchase.giftQmpDeduction).toBeNull();
    expect(purchase.netQmpChange).toBe(1);
  });

  it('BP is earned-only; any paid-origin debit is forbidden, including mixed provenance',()=>{
    const fromGift=previewWorldQmpFromBpSpend(valid({bpDebited:500,earnedBpDebited:200,giftedEarnedBpDebited:300}),[]);
    expect(fromGift.qualifies).toBe(true);
    if(fromGift.qualifies)expect(fromGift.proposedWeight).toBe(5);
    expect(previewWorldQmpFromBpSpend(valid({bpDebited:500,earnedBpDebited:200,purchasedBpDebited:300}),[]).qualifies).toBe(false);
    expect(previewWorldQmpFromBpSpend(valid({earnedBpDebited:0,purchasedBpDebited:500}),[]).qualifies).toBe(false);
    expect(previewWorldQmpFromBpSpend(valid({source:'external_paid'}),[]).qualifies).toBe(false);
  });

  it('gifted earned-origin BP can be spent for legitimate purchase QMP, but gift itself earns zero QMP',()=>{
    const gifted=valid({bpDebited:500,earnedBpDebited:0,giftedEarnedBpDebited:500});
    const preview=previewWorldQmpFromBpSpend(gifted,[]);
    expect(preview.qualifies).toBe(true);
    if(preview.qualifies)expect(preview.proposedWeight).toBe(5);
    expect(previewWorldQmpFromBpSpend({...gifted,transactionKind:'bp_gift'},[]).qualifies).toBe(false);
    expect(previewWorldQmpFromBpSpend({
      ...gifted,giftedEarnedBpDebited:0,giftedPurchasedBpDebited:500
    },[]).qualifies).toBe(false);
  });

  it('exhausted BP remains spendable but cannot mint repeat QMP',()=>{
    const oldSpend=valid({bpDebited:500,earnedBpDebited:500,qmpEligibleBpDebited:0});
    expect(previewWorldQmpFromBpSpend(oldSpend,[]).qualifies).toBe(false);
    expect(previewWorldQmpFromBpSpend(valid({qmpEligibleBpDebited:501}),[]).qualifies).toBe(false);
  });
  it('rejects unverified transactions, refunds, self-trade and negative amounts',()=>{
    expect(previewWorldQmpFromBpSpend(valid({settledByServer:false}),[]).qualifies).toBe(false);
    expect(previewWorldQmpFromBpSpend(valid({state:'pending'}),[]).qualifies).toBe(false);
    expect(previewWorldQmpFromBpSpend(valid({transactionKind:'refund'}),[]).qualifies).toBe(false);
    expect(previewWorldQmpFromBpSpend(valid({isSelfTrade:true}),[]).qualifies).toBe(false);
    expect(previewWorldQmpFromBpSpend(valid({counterpartyId:'user-a'}),[]).qualifies).toBe(false);
    expect(previewWorldQmpFromBpSpend(valid({isFlagged:true}),[]).qualifies).toBe(false);
    expect(previewWorldQmpFromBpSpend(valid({bpDebited:-5}),[]).qualifies).toBe(false);
    expect(previewWorldQmpFromBpSpend(valid({earnedBpDebited:501}),[]).qualifies).toBe(false);
    expect(previewWorldQmpFromBpSpend(valid({earnedBpDebited:100,giftedEarnedBpDebited:500}),[]).qualifies).toBe(false);
  });

  it('cannot repeat the same spend receipt across categories or replay same purchase entity',()=>{
    const previous={
      receiptId:'receipt-1',actorId:'user-a',period:'2026-12',entityId:'order-1',
      category:'construction_materials' as const,qualifiedWeight:5,
    };
    expect(previewWorldQmpFromBpSpend(valid(),[previous]).qualifies).toBe(false);
    expect(previewWorldQmpFromBpSpend(valid({receiptId:'receipt-1',category:'house_upgrade'}),[previous]).qualifies).toBe(false);
    expect(previewWorldQmpFromBpSpend(valid({receiptId:'receipt-2'}),[previous]).qualifies).toBe(false);
  });

  it('has per-receipt, per-category, and overall monthly caps',()=>{
    const p=previewWorldQmpFromBpSpend(valid({bpDebited:100000,earnedBpDebited:100000,qmpEligibleBpDebited:100000}),[]);
    expect(p.qualifies).toBe(true);
    if(p.qualifies)expect(p.proposedWeight).toBe(WORLD_QMP_POLICY_DRAFT.perPurchaseCap);
    const categoryCap=[{receiptId:'past',actorId:'user-a',period:'2026-12',
      entityId:'order-prev',category:'construction_materials' as const,qualifiedWeight:12}];
    expect(previewWorldQmpFromBpSpend(valid(),categoryCap).qualifies).toBe(false);
    const totalCap=[{receiptId:'past',actorId:'user-a',period:'2026-12',
      entityId:'other-order',category:'land_acquisition' as const,qualifiedWeight:50}];
    expect(previewWorldQmpFromBpSpend(valid(),totalCap).qualifies).toBe(false);
  });
});
