/**
 * Permanent BUKLOD Participation -> Item -> Trade -> Construction economy.
 * The backend owns all balances, eligibility, inventory and Rank qualifications.
 */
import { supabase } from '@/lib/supabase';

export type TradeItem = { code: string; title: string; max_unit_price: number };
export type TradeInventoryItem = { code: string; quantity: number; cost_basis_bp: number };
export type TradeBusiness = {
  id: string; owner_id: string; title: string; category: string;
  level: number; construction_stage: number; active: boolean;
};
export type TradeListing = {
  id: string; business: string; item_code: string;
  quantity: number; unit_price_bp: number; is_mine: boolean;
};
export type TradeRequirement = {
  level: number; stage: number; item_code: string; quantity: number; bp_cost: number;
};
export type TradeOrder = {
  id: string; total_bp: number; quantity: number; item_code: string;
  role: 'seller' | 'buyer'; rank_state: 'PENDING' | 'QUALIFIED' | 'EXCLUDED' | 'REVIEW';
  rank_credit_bp: number; created_at: string;
};
export type TradeSnapshot = {
  enabled: boolean; rank_profit_enabled: boolean; available_bp: number;
  business: TradeBusiness | null; inventory: TradeInventoryItem[];
  items: TradeItem[]; listings: TradeListing[]; requirements: TradeRequirement[];
  recent_orders: TradeOrder[];
};
export type TradeSource = {
  id: string; activity_type: string; created_at: string; points: number;
};
export const TRADE_CONSTRUCTION_STAGES = [
  'Survey & posts', 'Framework', 'Walls', 'Roof', 'Fittings & finish',
] as const;
export const TRADE_MAX_BUSINESS_LEVEL = 10;
export const TRADE_MIN_PARTICIPATION = 5;
export const TRADE_STARTER_BP = 40;

/** A timeout is ambiguous: the server may still have completed the transaction. */
async function callTradeRpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Request timed out. Refresh before retrying.')), 12000);
    });
    const { data, error } = await Promise.race([(supabase as any).rpc(fn, args), timeout]) as {
      data: T; error: { message?: string } | null;
    };
    if (error) throw new Error(String(error.message || 'BUKLOD Marketplace is unavailable.'));
    return data;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function businessCanList(business: TradeBusiness | null): boolean {
  return !!business && business.active && business.construction_stage === 5;
}
export function businessBuildLabel(business: TradeBusiness | null): string {
  if (!business) return 'No registered business';
  if (business.level === TRADE_MAX_BUSINESS_LEVEL && business.construction_stage === 5) {
    return 'Level 10 · Complete';
  }
  if (business.construction_stage === 5) {
    return 'Level ' + business.level + ' complete · Next: Level ' + (business.level + 1);
  }
  return 'Level ' + business.level + ' · ' + TRADE_CONSTRUCTION_STAGES[business.construction_stage];
}
export function nextBusinessRequirements(business: TradeBusiness | null, all: TradeRequirement[]) {
  if (!business || business.construction_stage === 5) return [];
  return all.filter(r => r.level === business.level && r.stage === business.construction_stage + 1);
}
export function canAffordBusinessStage(
  requirements: TradeRequirement[], inventory: TradeInventoryItem[], availableBP: number,
): boolean {
  if (!requirements.length) return false;
  const held = new Map(inventory.map(i => [i.code, i.quantity]));
  return requirements.every(r => (held.get(r.item_code) ?? 0) >= r.quantity) &&
    availableBP >= requirements.reduce((sum, row) => sum + row.bp_cost, 0);
}
export function tradeGrossProfit(price: number, costBasis: number): number {
  return Math.max(0, price - costBasis);
}

export async function loadBuklodTradeSnapshot(): Promise<TradeSnapshot> {
  const s = await callTradeRpc<Partial<TradeSnapshot>>('buklod_trade_snapshot_v1');
  if (!s || typeof s.enabled !== 'boolean' || !Array.isArray(s.items)) {
    throw new Error('Marketplace state could not be validated.');
  }
  return {
    enabled: s.enabled, rank_profit_enabled: s.rank_profit_enabled === true,
    available_bp: Math.max(0, Number(s.available_bp) || 0), business: s.business ?? null,
    inventory: s.inventory ?? [], items: s.items ?? [], listings: s.listings ?? [],
    requirements: s.requirements ?? [], recent_orders: s.recent_orders ?? [],
  };
}

export async function loadEligibleTradeParticipation(): Promise<TradeSource[]> {
  const rows = await callTradeRpc<TradeSource[]>('buklod_trade_unclaimed_sources_v1', { p_limit: 30 });
  if (!Array.isArray(rows)) throw new Error('Verified item sources are unavailable.');
  return rows;
}
export async function claimTradeParticipationItem(ledgerId: string) {
  return callTradeRpc<{ already_claimed: boolean; item_code: string; quantity?: number }>(
    'buklod_trade_claim_participation_item_v1', { p_ledger_id: ledgerId });
}
export async function registerTradeBusiness(title: string, category: string) {
  return callTradeRpc<{ business_id: string; level: number; stage: number }>(
    'buklod_trade_register_business_v1',
    { p_title: title.trim(), p_category: category.trim(), p_orientation_ack: true });
}
export async function buildTradeBusiness(businessId: string) {
  return callTradeRpc<{ level: number; stage: number; new_level?: boolean; bp_spent?: number }>(
    'buklod_trade_build_business_v1', { p_business: businessId });
}
export async function listTradeItem(businessId: string, itemCode: string, quantity: number, price: number) {
  return callTradeRpc<{ listing_id: string }>('buklod_trade_list_item_v1', {
    p_business: businessId, p_code: itemCode, p_qty: quantity, p_unit_price: price,
  });
}
export async function cancelTradeListing(listingId: string) {
  return callTradeRpc('buklod_trade_cancel_listing_v1', { p_listing: listingId });
}
/** Reuse one requestKey across retries after network loss, never create a second charge. */
export async function purchaseTradeItem(listingId: string, quantity: number, requestKey: string) {
  return callTradeRpc<{ order_id: string; already_processed: boolean; total_bp: number }>(
    'buklod_trade_buy_item_v1',
    { p_listing: listingId, p_qty: quantity, p_request_key: requestKey });
}
export async function settleTradeRank(orderId: string) {
  return callTradeRpc<{ rank_state: TradeOrder['rank_state']; rank_credit_bp: number }>(
    'buklod_trade_settle_rank_v1', { p_order: orderId });
}
