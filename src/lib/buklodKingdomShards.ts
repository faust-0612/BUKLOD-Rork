/* BUKLOD Main Kingdom Shards client.
 * The server is the sole authority for noncash grants, prices and ownership.
 * Offline cache is user-scoped and only enables noncredit practice helpers.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

export type KingdomShardItemKey =
  'wisdom_lens' | 'guardian_shield' | 'explorer_compass' | 'aura_emerald';

export const KINGDOM_SHARD_ITEMS: ReadonlyArray<{
  key: KingdomShardItemKey; name: string; description: string; price: number;
}> = [
  { key:'wisdom_lens', name:'Wisdom Lens', description:'See one practice answer hint when you need help.', price:2 },
  { key:'guardian_shield', name:'Guardian Shield', description:'Protect correct answers when retrying a practice challenge.', price:3 },
  { key:'explorer_compass', name:'Explorer Compass', description:'Rule out two wrong answers per practice question.', price:2 },
  { key:'aura_emerald', name:'Emerald Aura', description:'Permanently illuminate your practice hero card.', price:10 },
];
const KEYS = new Set<string>(KINGDOM_SHARD_ITEMS.map(item => item.key));
const CACHE_PREFIX = 'buklod:kingdom:shards:verified:v1:';

export type KingdomShardsSnapshot = {
  balance: number; earned: number; spent: number;
  ownedItems: KingdomShardItemKey[];
  source: 'server' | 'cached' | 'unavailable';
  syncedAt: number | null;
};
const EMPTY: KingdomShardsSnapshot = {
  balance:0,earned:0,spent:0,ownedItems:[],source:'unavailable',syncedAt:null,
};
export function emptyKingdomShards(): KingdomShardsSnapshot {
  return { ...EMPTY, ownedItems:[] };
}
function validCount(value: unknown): number {
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : 0;
}
function asObject(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown> : null;
}
function normalize(raw: unknown, source: 'server'|'cached'): KingdomShardsSnapshot | null {
  const data = asObject(raw);
  if (!data || data.ok === false || data.game_only !== true || data.version !== 1 ||
      !Array.isArray(data.owned_items)) return null;
  const ownedItems = [...new Set(data.owned_items.filter(
    (key): key is KingdomShardItemKey => typeof key === 'string' && KEYS.has(key),
  ))];
  const earned = validCount(data.earned), spent = validCount(data.spent);
  const balance = validCount(data.balance);
  if (earned < spent || earned - spent !== balance) return null;
  return { balance, earned, spent, ownedItems, source,
    syncedAt: source === 'server' ? Date.now() : validCount(data.synced_at) || null };
}
export function hasKingdomPower(state: KingdomShardsSnapshot | null, key: KingdomShardItemKey) {
  return Boolean(state && state.source !== 'unavailable' && state.ownedItems.includes(key));
}

export async function getCachedKingdomShards(userId: string): Promise<KingdomShardsSnapshot> {
  if (!userId) return emptyKingdomShards();
  try {
    const stored = await AsyncStorage.getItem(CACHE_PREFIX + userId);
    if (!stored) return emptyKingdomShards();
    return normalize(JSON.parse(stored), 'cached') ?? emptyKingdomShards();
  } catch { return emptyKingdomShards(); }
}
async function cacheVerified(userId: string, snapshot: KingdomShardsSnapshot) {
  if (snapshot.source !== 'server' || !userId) return;
  try {
    await AsyncStorage.setItem(CACHE_PREFIX + userId,JSON.stringify({
      ok:true,version:1,game_only:true,
      balance:snapshot.balance,earned:snapshot.earned,spent:snapshot.spent,
      owned_items:snapshot.ownedItems,synced_at:snapshot.syncedAt,
    }));
  } catch { /* cache failure never revokes a valid purchase */ }
}
async function enforceAccount(userId: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error || data.session?.user.id !== userId) {
    throw new Error('Kingdom session changed. Sign in again before spending Shards.');
  }
}
function timeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_resolve,reject) => {
      timer = setTimeout(() => reject(new Error('Kingdom network timeout. Retry when online.')),ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/** Returns the last server-confirmed snapshot if offline; no client-side grant. */
export async function getMyKingdomShards(userId: string): Promise<KingdomShardsSnapshot> {
  if (!userId) return emptyKingdomShards();
  try {
    await enforceAccount(userId);
    const { data, error } = await timeout<{ data: unknown; error: { message?: string } | null }>(
      (supabase as any).rpc('get_my_buklod_kingdom_shards_v1'),8000);
    if (error) throw new Error(error.message || 'Kingdom Shards are not active yet.');
    const snapshot = normalize(data,'server');
    if (!snapshot) throw new Error('Invalid Kingdom Shards server response.');
    await enforceAccount(userId);
    await cacheVerified(userId,snapshot);
    return snapshot;
  } catch {
    return getCachedKingdomShards(userId);
  }
}
/** Never optimistically subtracts Shards; timeout can succeed on server, so refresh. */
export async function buyMyKingdomItem(userId: string, key: KingdomShardItemKey): Promise<{
  state: KingdomShardsSnapshot; purchased: boolean; alreadyOwned: boolean;
}> {
  if (!userId || !KEYS.has(key)) throw new Error('Unknown Kingdom item.');
  await enforceAccount(userId);
  const { data, error } = await timeout<{ data: unknown; error: { message?: string } | null }>(
    (supabase as any).rpc('buy_my_buklod_kingdom_item_v1',{p_item_key:key}),10000);
  if (error) throw new Error(error.message || 'Could not complete your Kingdom purchase.');
  const row = asObject(data);
  if (row?.ok === false && row.reason === 'insufficient_shards') {
    throw new Error('Not enough Shards. Earn more through verified Kingdom Mastery or badge claiming.');
  }
  const state = normalize(row,'server');
  if (!state || !state.ownedItems.includes(key)) throw new Error('Purchase not confirmed by Kingdom server.');
  await enforceAccount(userId);
  await cacheVerified(userId,state);
  return { state, purchased: row?.purchased === true, alreadyOwned: row?.already_owned === true };
}
