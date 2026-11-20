/**
 * BUKLOD WORLD: SPEND-DRIVEN QMP POLICY PROPOSAL (DEV SIMULATION ONLY).
 *
 * Owner's distinction:
 * 1. Qualifying participation earns BP in the EXISTING canonical BP system.
 * 2. VERIFIED, ELIGIBLE BP PURCHASES / DEVELOPMENT EXPENDITURES earn QMP.
 * 3. Giving BP is not a purchase and NEVER earns positive QMP.
 * 4. Historic Lifetime BP / Character Rank remain separate from spendable BP.
 *
 * THIS FILE IS NOT CONNECTED TO PRODUCTION BP, FINANCE OR REWARD RPCs.
 * No QMP weight is live until owner-approved formula, legal review and Finance QA.
 */
export const WORLD_QMP_ACTIVATION_ENABLED = false as const;

export type WorldBpSpendingCategory =
  | 'world_store_item'
  | 'peer_item_purchase'
  | 'land_acquisition'
  | 'construction_materials'
  | 'house_upgrade'
  | 'farm_development'
  | 'community_development'
  | 'home_customization'
  | 'pet_supplies';

export type WorldBpTransactionKind =
  | 'purchase'
  | 'bp_gift'
  | 'item_gift'
  | 'earn_bp'
  | 'refund'
  | 'passive';

export type WorldQmpSpendEvent = {
  receiptId: string;
  actorId: string;
  period: string;
  /** Unique fulfilled order/upgrade, never an arbitrary repeatable SKU. */
  entityId: string;
  transactionKind: WorldBpTransactionKind;
  category: WorldBpSpendingCategory;
  bpDebited: number;
  /** BP earned by this actor from actual verified activities. */
  earnedBpDebited: number;
  /** BP originally earned by another user and genuinely received as gift/trade.
   * Spendable, but NEVER added to this recipient's Lifetime Earned BP / rank. */
  giftedEarnedBpDebited: number;
  /** Paid BP: excluded from QMP irrespective of who currently holds it. */
  purchasedBpDebited: number;
  /** Paid BP passed through other accounts; never relabel as earned. */
  giftedPurchasedBpDebited: number;
  /** Authoritative unused QMP right consumed from original earned BP lots.
   * May be LESS than earned-origin BP paid if those units funded earlier purchases. */
  qmpEligibleBpDebited: number;
  source: 'system' | 'world' | 'cluster' | 'external_paid';
  settledByServer: boolean;
  state: 'fulfilled' | 'pending' | 'rejected';
  counterpartyId?: string | null;
  isSelfTrade?: boolean;
  isFlagged?: boolean;
};

export type WorldQmpPolicyDraft = {
  version: 'proposal_spend_driven_v2';
  /** Illustrative BP-to-QMP scale; never a production exchange rate. */
  bpPerQmp: number;
  /** Cap on QMP from any single eligible transaction. */
  perPurchaseCap: number;
  /** Category-level monthly cap on new weight, to prevent artificial spending. */
  monthlyCategoryCap: Readonly<Record<WorldBpSpendingCategory, number>>;
  /** A final overall monthly cap regardless of categories. */
  monthlyTotalCap: number;
  /** Eligible purchasing power can come from own earned OR gifted earned BP.
   * Purchased-origin BP never becomes QMP eligible by laundering through gifts. */
  excludePurchasedOriginBp: true;
};

export const WORLD_QMP_POLICY_DRAFT: WorldQmpPolicyDraft = {
  version:'proposal_spend_driven_v2',
  bpPerQmp:100,
  perPurchaseCap:10,
  monthlyCategoryCap:{
    world_store_item:12,
    peer_item_purchase:8,
    land_acquisition:20,
    construction_materials:12,
    house_upgrade:16,
    farm_development:12,
    community_development:16,
    home_customization:10,
    pet_supplies:6,
  },
  monthlyTotalCap:50,
  excludePurchasedOriginBp:true,
};

export type WorldQmpHistoryRow = {
  receiptId: string;
  actorId: string;
  period: string;
  entityId: string;
  category: WorldBpSpendingCategory;
  qualifiedWeight: number;
};

export type WorldQmpSpendPreview =
  | { qualifies: false; reason: string; proposedWeight: 0 }
  | { qualifies: true; reason: 'eligible-spend-for-policy-review'; proposedWeight: number };

/**
 * Pure, side-effect-free client-side preview. In eventual production the
 * database must independently prove payment, debit provenance, asset delivery,
 * actor, item authenticity, caps and immutable receipt before posting QMP.
 */
export function previewWorldQmpFromBpSpend(
  event: WorldQmpSpendEvent,
  history: readonly WorldQmpHistoryRow[],
  policy: WorldQmpPolicyDraft = WORLD_QMP_POLICY_DRAFT,
): WorldQmpSpendPreview {
  const reject = (reason:string):WorldQmpSpendPreview => ({qualifies:false,reason,proposedWeight:0});
  if (!event.receiptId?.trim() || !event.actorId?.trim() || !event.entityId?.trim() ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(event.period)) return reject('Invalid receipt or month.');
  if (event.transactionKind!=='purchase') return reject('Only genuine BP purchases may qualify; earning and gifting BP do not create QMP.');
  if (!Object.prototype.hasOwnProperty.call(policy.monthlyCategoryCap,event.category)) return reject('Unknown purchase category.');
  if (!event.settledByServer || event.state!=='fulfilled') return reject('Only completed and verified purchases qualify.');
  if (event.isFlagged || event.isSelfTrade ||
      (event.counterpartyId && event.counterpartyId===event.actorId)) return reject('Self-dealing or flagged spending.');
  if (event.source==='external_paid') return reject('External fiat purchases never create QMP.');
  const parts=[
    event.earnedBpDebited,event.giftedEarnedBpDebited,
    event.purchasedBpDebited,event.giftedPurchasedBpDebited,
  ];
  if (!Number.isSafeInteger(event.bpDebited) || event.bpDebited<=0 ||
      parts.some(v=>!Number.isSafeInteger(v)||v<0) ||
      !Number.isSafeInteger(event.qmpEligibleBpDebited)||event.qmpEligibleBpDebited<0||
      event.qmpEligibleBpDebited>event.earnedBpDebited+event.giftedEarnedBpDebited||
      parts.reduce((sum,v)=>sum+v,0)!==event.bpDebited)
    return reject('BP debit and funding-source breakdown must match.');
  // BP is earned-only in the approved World redesign. The two paid-origin
  // columns exist only to fail closed on historical/untrusted client payloads.
  if(event.purchasedBpDebited!==0||event.giftedPurchasedBpDebited!==0)
    return reject('World BP cannot be bought; paid-origin transactions are ineligible.');
  const qualifiedBp=policy.excludePurchasedOriginBp
    ? event.qmpEligibleBpDebited
    : event.bpDebited;
  if(qualifiedBp<=0) return reject('No remaining unused QMP eligibility from earned BP lots.');
  if (!Number.isFinite(policy.bpPerQmp) || policy.bpPerQmp<=0 ||
      !Number.isFinite(policy.perPurchaseCap) || policy.perPurchaseCap<0 ||
      !Number.isFinite(policy.monthlyTotalCap) || policy.monthlyTotalCap<0) return reject('Invalid policy limits.');
  if (history.some(row=>row.actorId===event.actorId && row.receiptId===event.receiptId)) return reject('Duplicate purchase receipt.');
  if (history.some(row=>row.actorId===event.actorId && row.period===event.period &&
       row.entityId===event.entityId && row.category===event.category)) return reject('Already credited for this purchase entity.');
  const samePeriod=history.filter(row=>row.actorId===event.actorId && row.period===event.period);
  const categoryWeight=samePeriod.filter(row=>row.category===event.category)
    .reduce((sum,row)=>sum+Math.max(0,row.qualifiedWeight),0);
  const totalWeight=samePeriod.reduce((sum,row)=>sum+Math.max(0,row.qualifiedWeight),0);
  const room=Math.min(
    Math.max(0,policy.monthlyCategoryCap[event.category]-categoryWeight),
    Math.max(0,policy.monthlyTotalCap-totalWeight),
    policy.perPurchaseCap,
  );
  if(room<=0)return reject('Monthly QMP cap reached.');
  const proposedWeight=Math.floor(Math.min(room,qualifiedBp/policy.bpPerQmp)*100)/100;
  return proposedWeight>0
    ? {qualifies:true,reason:'eligible-spend-for-policy-review',proposedWeight}
    : reject('Spending is below minimum effective QMP unit.');
}

/**
 * Gifts cannot be re-labeled as market purchases. A BP gift may carry a
 * distinct sender-side QMP debit under the PREVIOUS proposed policy, but the
 * debit formula remains unapproved and MUST NOT imply positive QMP.
 */
export type WorldSpendQmpQuote = {
  transactionKind: WorldBpTransactionKind;
  outgoingBp: number;
  purchaseQmpCredit: number;
  giftQmpDeduction: number | null;
  netQmpChange: number | null;
};
export function previewWorldSpendQmpQuote(
  kind: WorldBpTransactionKind,
  bpAmount: number,
  purchaseCredit: number,
  giftDeduction: number | null = null,
): WorldSpendQmpQuote {
  const valid=Number.isSafeInteger(bpAmount) && bpAmount>0;
  const credit=valid&&kind==='purchase'&&Number.isFinite(purchaseCredit)&&purchaseCredit>=0
    ?purchaseCredit:0;
  if(kind==='bp_gift'){
    const deduction=valid && giftDeduction!==null&&Number.isFinite(giftDeduction)&&giftDeduction>=0
      ?giftDeduction:null;
    return {transactionKind:kind,outgoingBp:valid?bpAmount:0,
      purchaseQmpCredit:0,giftQmpDeduction:deduction,
      netQmpChange:deduction===null?null:-deduction};
  }
  return {transactionKind:kind,outgoingBp:valid?bpAmount:0,
    purchaseQmpCredit:credit,giftQmpDeduction:null,netQmpChange:credit};
}
