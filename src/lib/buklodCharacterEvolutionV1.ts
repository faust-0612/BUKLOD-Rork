/* Character evolution is server-owned. Never infer item ownership from BP or cosmetic collectibles. */
import { supabase } from '@/lib/supabase';
import type { BuklodCharacterId } from '@/lib/buklodCharacterSelectionV2';

export type BuklodEvolutionItem = {
  itemIndex: number;
  taskMetric: string;
  verifiedCount: number;
  requiredCount: number;
  obtained: boolean;
  readyToClaim: boolean;
};

export type BuklodEvolutionGate = {
  characterId: BuklodCharacterId;
  visibleLevel: number;
  bpEligibleLevel: number;
  grandfatheredLevel: number;
  nextLevel: number;
  bpReady: boolean;
  requiredItemCount: number;
  items: BuklodEvolutionItem[];
};

const IDS = new Set([
  'phan','quin','van','christian','lhen','jawo','trudice','ace',
  'mitch','niel','angel','vhen','ellusur',
]);
const METRICS = new Set([
  'character_public_post','character_public_comment','character_public_reaction',
  'character_public_share','character_public_active_week',
]);
const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
const integer = (value: unknown, min: number, max: number) => {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error('Invalid Character evolution data.');
  return Math.max(min, Math.min(max, Math.floor(n)));
};

function decodeGate(raw: unknown): BuklodEvolutionGate {
  const row = asObject(raw);
  if (row.model !== 'BP_ELIGIBILITY_VERIFIED_ITEMS_V1' ||
      !IDS.has(String(row.active_character_id))) {
    throw new Error('Verified item-based Character evolution is not available on this server.');
  }
  const visibleLevel = integer(row.visible_level, 1, 20);
  const bpEligibleLevel = integer(row.bp_eligible_level, 1, 20);
  const nextLevel = integer(row.next_level, 1, 20);
  const requiredItemCount = integer(row.required_item_count, 0, 5);
  const items = Array.isArray(row.items) ? row.items.map(item => {
    const entry = asObject(item);
    const itemIndex = integer(entry.item_index, 1, 5);
    const taskMetric = String(entry.task_metric ?? '');
    if (!METRICS.has(taskMetric)) throw new Error('Unrecognized verified evolution task.');
    return {
      itemIndex,
      taskMetric,
      verifiedCount: integer(entry.verified_count, 0, 1000000000),
      requiredCount: integer(entry.required_count, 1, 1000000000),
      obtained: entry.obtained === true,
      readyToClaim: entry.ready_to_claim === true,
    };
  }) : [];
  if (visibleLevel > bpEligibleLevel || items.length !== requiredItemCount ||
      new Set(items.map(item => item.itemIndex)).size !== items.length ||
      (visibleLevel === 20 && requiredItemCount !== 0)) {
    throw new Error('Inconsistent Character evolution state.');
  }
  return {
    characterId: row.active_character_id as BuklodCharacterId,
    visibleLevel,
    bpEligibleLevel,
    grandfatheredLevel: integer(row.grandfathered_level, 1, 20),
    nextLevel,
    bpReady: row.bp_ready === true,
    requiredItemCount,
    items,
  };
}

export async function getMyBuklodCharacterEvolutionV1(): Promise<BuklodEvolutionGate> {
  const { data, error } = await (supabase as any).rpc('get_my_buklod_character_evolution_v1');
  if (error) throw new Error(error.message || 'Could not load verified Character items.');
  return decodeGate(data);
}

export async function claimMyBuklodCharacterEvolutionItemV1(
  fromLevel: number,
  itemIndex: number,
): Promise<BuklodEvolutionGate> {
  const { data, error } = await (supabase as any).rpc('claim_my_buklod_character_evolution_item_v1', {
    p_from_level: integer(fromLevel,1,19),
    p_item_index: integer(itemIndex,1,5),
  });
  if (error) throw new Error(error.message || 'Verified Character task is incomplete.');
  return decodeGate(data);
}
