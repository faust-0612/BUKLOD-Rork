/**
 * Proposed ACTIVITY-BASED QMP MODEL (DEV policy simulation ONLY).
 *
 * This is NOT the live Finance V3 QMP formula or a reward implementation.
 * Never import from wallet writes, claims, settlement or public RPCs until
 * signed-off owner policy and cross-version finance tests exist.
 */
export const WORLD_QMP_ACTIVATION_ENABLED = false as const;
export type WorldQmpAction =
  | 'purchase_item'
  | 'acquire_land'
  | 'complete_house_upgrade'
  | 'complete_farm_upgrade'
  | 'finish_community_project'
  | 'complete_eligible_trade'
  | 'fulfill_social_activity'
  | 'fulfill_service'
  | 'complete_learning_milestone'
  | 'complete_game_milestone'
  | 'complete_farm_cycle'
  | 'complete_pet_care';

export type WorldQmpEvent = {
  eventId: string;
  action: WorldQmpAction;
  actorId: string;
  period: string;
  entityId: string;
  counterpartyId?: string | null;
  source: 'system' | 'world' | 'cluster' | 'external_paid';
  verifiedByServer: boolean;
  participationOutcome: 'fulfilled' | 'pending' | 'rejected';
  currencyProvenance: 'earned_bp' | 'transferred_bp' | 'purchased_bp' | 'none';
  isSelfTrade?: boolean;
  isFlagged?: boolean;
};

export type WorldQmpPolicyDraft = {
  version: 'proposal_20261120_v1';
  /** Sample rates, not live payout weights; actual policy requires simulation. */
  weightByAction: Readonly<Record<WorldQmpAction, number>>;
  monthlyCategoryCap: Readonly<Record<WorldQmpAction, number>>;
  distinctEntityOnly: true;
  rejectPurchasedCurrencyActions: true;
};

export const WORLD_QMP_POLICY_DRAFT: WorldQmpPolicyDraft = {
  version:'proposal_20261120_v1',
  weightByAction:{
    purchase_item:1,
    acquire_land:3,
    complete_house_upgrade:4,
    complete_farm_upgrade:3,
    finish_community_project:5,
    complete_eligible_trade:2,
    fulfill_social_activity:3,
    fulfill_service:4,
    complete_learning_milestone:2,
    complete_game_milestone:2,
    complete_farm_cycle:1,
    complete_pet_care:1,
  },
  monthlyCategoryCap:{
    purchase_item:5,
    acquire_land:6,
    complete_house_upgrade:12,
    complete_farm_upgrade:9,
    finish_community_project:15,
    complete_eligible_trade:8,
    fulfill_social_activity:18,
    fulfill_service:16,
    complete_learning_milestone:12,
    complete_game_milestone:10,
    complete_farm_cycle:6,
    complete_pet_care:4,
  },
  distinctEntityOnly:true,
  rejectPurchasedCurrencyActions:true,
};

export type WorldQmpHistoryRow = {
  eventId: string;
  actorId: string;
  period: string;
  entityId: string;
  action: WorldQmpAction;
  qualifiedWeight: number;
};

export type WorldQmpPreview =
  | { qualifies: false; reason: string; proposedWeight: 0 }
  | { qualifies: true; reason: 'eligible-for-policy-review'; proposedWeight: number };

/**
 * Pure preview eligibility, no mutation / authority.
 * The server must authenticate actor, verify actual outcome, provenance,
 * counterparty independence, and deduplicate transactionally before posting.
 */
export function previewWorldQmp(
  event: WorldQmpEvent,
  history: readonly WorldQmpHistoryRow[],
  policy: WorldQmpPolicyDraft = WORLD_QMP_POLICY_DRAFT,
): WorldQmpPreview {
  const ineligible=(reason: string):WorldQmpPreview=>({qualifies:false,reason,proposedWeight:0});
  if(!event.eventId || !event.actorId || !event.entityId || !/^\d{4}-(0[1-9]|1[0-2])$/.test(event.period)) return ineligible('Invalid event identity or period.');
  if(!Object.prototype.hasOwnProperty.call(policy.weightByAction,event.action)) return ineligible('Unknown action.');
  if(!event.verifiedByServer || event.participationOutcome!=='fulfilled') return ineligible('Not independently completed and verified.');
  if(event.isFlagged || event.isSelfTrade || (event.counterpartyId && event.counterpartyId===event.actorId)) return ineligible('Risk or self-dealing.');
  if(event.source==='external_paid')return ineligible('Fiat payment must not create QMP.');
  if(policy.rejectPurchasedCurrencyActions &&
    ['purchase_item','acquire_land','complete_house_upgrade','complete_farm_upgrade','finish_community_project','complete_eligible_trade'].includes(event.action) &&
    event.currencyProvenance==='purchased_bp') return ineligible('Purchased BP expenditure does not qualify for revenue weight.');
  if(history.some(row=>row.actorId===event.actorId && row.period===event.period && row.eventId===event.eventId))return ineligible('Duplicate event.');
  const applicable=history.filter(row=>row.actorId===event.actorId && row.period===event.period && row.action===event.action);
  if(policy.distinctEntityOnly && applicable.some(row=>row.entityId===event.entityId))return ineligible('Already credited for this entity/action this period.');
  const earned=applicable.reduce((sum,row)=>sum+Math.max(0,row.qualifiedWeight),0);
  const remaining=Math.max(0,policy.monthlyCategoryCap[event.action]-earned);
  if(remaining<=0)return ineligible('Monthly category cap reached.');
  const proposedWeight=Math.min(policy.weightByAction[event.action],remaining);
  return proposedWeight>0?{qualifies:true,reason:'eligible-for-policy-review',proposedWeight}:ineligible('No remaining policy weight.');
}

/**
 * No QMP debit is assumed for every world purchase. Existing proposed
 * sender BP-transfer QMP deduction is a separate, unresolved policy.
 * A future atomic trade quote must show sender adjustment and any capped
 * action credit separately, including NET QMP, before accepting.
 */
export type WorldQmpTradeQuote = {
  outgoingBp: number;
  transferQmpDeduction: number | null;
  verifiedActivityQmpCredit: number | null;
  netQmpChange: number | null;
};
export function previewWorldQmpTradeQuote(
  outgoingBp:number,
  transferQmpDeduction:number | null,
  verifiedActivityQmpCredit:number | null,
):WorldQmpTradeQuote {
  const valid=Number.isFinite(outgoingBp)&&outgoingBp>0;
  const safeDebit=transferQmpDeduction!==null&&Number.isFinite(transferQmpDeduction)&&transferQmpDeduction>=0 ?transferQmpDeduction:null;
  const safeCredit=verifiedActivityQmpCredit!==null&&Number.isFinite(verifiedActivityQmpCredit)&&verifiedActivityQmpCredit>=0 ?verifiedActivityQmpCredit:null;
  return {
    outgoingBp: valid?outgoingBp:0,
    transferQmpDeduction:valid?safeDebit:null,
    verifiedActivityQmpCredit:valid?safeCredit:null,
    netQmpChange:valid&&safeDebit!==null&&safeCredit!==null?safeCredit-safeDebit:null,
  };
}
