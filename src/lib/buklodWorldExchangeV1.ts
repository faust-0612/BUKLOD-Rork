/** BUKLOD World Exchange — authenticated thin RPC client (DEV contract only).
 * No wallet writes, client-issued items, local trading fallbacks or optimistic
 * item ownership updates. All authority belongs to verified Postgres RPCs.
 * The live feature flag must remain OFF until isolated DB/RC verification.
 */
export type WorldItemKind = 'gear' | 'strategy' | 'material';
export type WorldItemStatus = 'inventory' | 'escrow' | 'match_reserved' | 'consumed' | 'revoked';
export type WorldItem = {
  id: string;
  asset_key: string;
  kind: WorldItemKind;
  character_id: string | null;
  slot: string | null;
  tier: number;
  material_quantity: number;
  tradable: boolean;
  status: WorldItemStatus;
  created_at: string;
};
export type WorldOffer = {
  offer_id: string;
  price_bp: number;
  asset_key: string;
  kind: WorldItemKind;
  character_id: string | null;
  slot: string | null;
  tier: number;
  created_at: string;
};
export type WorldReceipt = {
  transfer_id: string;
  offer_id: string;
  item_id: string;
  amount_bp: number;
  status: 'settled';
};
export type WorldStatus = {
  trading_enabled: boolean;
  source: string;
  currency: 'spendable_bp_only';
};
export type RpcError = { message?: string; code?: string; details?: string };
export type WorldRpcTransport = {
  rpc: (name: string, params?: Record<string, unknown>) => Promise<{
    data: unknown;
    error: RpcError | null;
  }>;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validUuid = (v: string): boolean => typeof v === 'string' && UUID.test(v);
const stableKey = (v: string): boolean => typeof v === 'string' && v.length >= 8 && v.length <= 120;
const integer = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
function assertArray<T>(data: unknown): T[] {
  if (!Array.isArray(data)) throw new Error('Invalid World Exchange server response');
  return data as T[];
}
function assertReceipt(data: unknown): WorldReceipt {
  if (data === null || typeof data !== 'object') throw new Error('Invalid settlement response');
  const receipt = data as Partial<WorldReceipt>;
  if (!validUuid(receipt.transfer_id ?? '') || !validUuid(receipt.item_id ?? '') ||
      !validUuid(receipt.offer_id ?? '') || !integer(receipt.amount_bp, 1, 100000) ||
      receipt.status !== 'settled') throw new Error('Unverified settlement response');
  return receipt as WorldReceipt;
}

/** Inject the existing authenticated Supabase instance from the calling app.
 * No service_role credentials belong in a browser, app or offline Arena HTML. */
export function makeBuklodWorldExchangeClient(transport: WorldRpcTransport) {
  if (!transport || typeof transport.rpc !== 'function') throw new Error('Authenticated RPC transport required');
  async function call(functionName: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const response = await transport.rpc(functionName, params);
    if (!response || response.error) {
      throw new Error(response?.error?.message || 'World Exchange is currently unavailable');
    }
    return response.data;
  }
  return {
    async status(): Promise<WorldStatus> {
      const data = await call('buklod_world_exchange_status_v1');
      if (!data || typeof data !== 'object' || typeof (data as WorldStatus).trading_enabled !== 'boolean' ||
          (data as WorldStatus).currency !== 'spendable_bp_only') {
        throw new Error('Invalid World Exchange status');
      }
      return data as WorldStatus;
    },
    async inventory(limit = 40): Promise<WorldItem[]> {
      if (!integer(limit, 1, 100)) throw new Error('Invalid inventory limit');
      return assertArray<WorldItem>(await call('buklod_world_my_items_v1', { p_limit: limit }));
    },
    async browse(limit = 30): Promise<WorldOffer[]> {
      if (!integer(limit, 1, 50)) throw new Error('Invalid offer limit');
      return assertArray<WorldOffer>(await call('buklod_world_browse_offers_v1', { p_limit: limit }));
    },
    /** Persist requestId before submitting; reuse it on slow-network retries. */
    async listItem(args: {itemId: string; priceBp: number; requestId: string; restrictedBuyerId?: string | null}): Promise<string> {
      if (!validUuid(args.itemId) || !integer(args.priceBp, 1, 100000) || !stableKey(args.requestId) ||
          (args.restrictedBuyerId != null && !validUuid(args.restrictedBuyerId))) {
        throw new Error('Invalid listing parameters');
      }
      const data = await call('buklod_world_list_item_v1', {
        p_item_id: args.itemId,
        p_price_bp: args.priceBp,
        p_request_id: args.requestId,
        p_restricted_buyer_id: args.restrictedBuyerId ?? null,
      });
      if (typeof data !== 'string' || !validUuid(data)) throw new Error('Invalid listing receipt');
      return data;
    },
    /** A seller/buyer update is not shown as complete until the server returns
     * a durable transfer ID. This method never mutates any local BP balance. */
    async buyOffer(offerId: string, requestId: string): Promise<WorldReceipt> {
      if (!validUuid(offerId) || !stableKey(requestId)) throw new Error('Invalid purchase parameters');
      return assertReceipt(await call('buklod_world_buy_offer_v1', {
        p_offer_id: offerId,
        p_request_id: requestId,
      }));
    },
    async cancelOffer(offerId: string): Promise<void> {
      if (!validUuid(offerId)) throw new Error('Invalid offer');
      const result = await call('buklod_world_cancel_offer_v1', {p_offer_id: offerId});
      if (result !== true) throw new Error('Cancellation was not confirmed');
    },
  };
}