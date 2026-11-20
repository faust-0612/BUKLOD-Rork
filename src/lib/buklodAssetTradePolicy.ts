/**
 * Permanent virtual asset/trading contract. This module is pure policy only:
 * it MUST NOT mint points, mutate inventory, or bypass server verification.
 * Existing BP reward, Circle Rank and QMP authorities remain unchanged.
 */
export type AssetKind = 'lot' | 'house' | 'cluster' | 'business';
export type BuildPhase = 'materials' | 'posts' | 'frame' | 'structure' | 'finish';
export const BUILD_PHASES: readonly BuildPhase[] = ['materials','posts','frame','structure','finish'];
export const MAX_ASSET_LEVEL = 10;
export type ItemOrigin = 'participation' | 'trade' | 'craft' | 'authorized_supply';
export type TradeEligibility = { sellerId: string; buyerId: string; sellerAvailable: number; buyerSpendableBp: number; quantity: number; unitPriceBp: number; itemTradable: boolean; sellerVerified: boolean; buyerVerified: boolean; listingActive: boolean };
export type TradeDecision = { allowed: boolean; reason: string | null; totalBp: number };
export function assessTrade(input: TradeEligibility): TradeDecision {
  const fail = (reason: string): TradeDecision => ({allowed:false,reason,totalBp:0});
  if (!input.sellerId || !input.buyerId || input.sellerId === input.buyerId) return fail('INVALID_COUNTERPARTY');
  if (!input.sellerVerified || !input.buyerVerified) return fail('MEMBERSHIP_REQUIRED');
  if (!input.listingActive || !input.itemTradable) return fail('ITEM_UNAVAILABLE');
  if (![input.quantity,input.unitPriceBp,input.sellerAvailable,input.buyerSpendableBp].every(Number.isSafeInteger)) return fail('INVALID_AMOUNT');
  if (input.quantity <= 0 || input.unitPriceBp <= 0 || input.sellerAvailable < input.quantity || input.buyerSpendableBp < 0) return fail('INSUFFICIENT_RESOURCES');
  const totalBp = input.quantity * input.unitPriceBp;
  if (!Number.isSafeInteger(totalBp) || totalBp > input.buyerSpendableBp) return fail('INSUFFICIENT_BP');
  return {allowed:true,reason:null,totalBp};
}
/** Increasing target effort, not a source of BP or items. */
export function levelEffort(level: number): number {
  if (!Number.isInteger(level) || level < 1 || level > MAX_ASSET_LEVEL) throw new RangeError('Invalid asset level');
  return Math.round(100 * Math.pow(level, 1.85));
}
export function nextBuildPhase(completed: readonly BuildPhase[]): BuildPhase | null {
  const unique = new Set(completed);
  if (unique.size !== completed.length || completed.some((phase,index) => BUILD_PHASES[index] !== phase)) throw new Error('Build phases must be sequential');
  return BUILD_PHASES[completed.length] ?? null;
}
export type BusinessApplication = { membershipApproved: boolean; orientationVerified: boolean; businessIdentityVerified: boolean; usableLotOrSlot: boolean; initialInventoryVerified: boolean; starterCapitalBp: number; requiredCapitalBp: number; regulatedActivityApproved: boolean };
export function businessOpeningGaps(a: BusinessApplication): string[] {
  const gaps: string[] = [];
  if (!a.membershipApproved) gaps.push('membership');
  if (!a.orientationVerified) gaps.push('orientation');
  if (!a.businessIdentityVerified) gaps.push('business_identity');
  if (!a.usableLotOrSlot) gaps.push('lot_or_slot');
  if (!a.initialInventoryVerified) gaps.push('inventory');
  if (!Number.isSafeInteger(a.starterCapitalBp) || !Number.isSafeInteger(a.requiredCapitalBp) || a.requiredCapitalBp < 0 || a.starterCapitalBp < a.requiredCapitalBp) gaps.push('capital');
  if (!a.regulatedActivityApproved) gaps.push('compliance');
  return gaps;
}
/** Purchase grants ownership of an item, never completion of the construction stage. */
export function mayUseItemForBuild(owned: number, required: number): boolean {
  return Number.isSafeInteger(owned) && Number.isSafeInteger(required) && required > 0 && owned >= required;
}
/** A sale transfers existing BP. Rank-eligible trading gains need separate trusted
 * cost-basis, anti-wash-trading and settlement verification; never credit on client. */
export const TRADE_POLICY = Object.freeze({
  newBpPerTrade: 0,
  rankLossOnPurchase: 0,
  rankCreditOnUnverifiedSale: 0,
  qmpEffect: 0,
  seasonDependent: false,
  faithRequired: false,
  serverSettlementRequired: true,
  selfTradeAllowed: false,
});
