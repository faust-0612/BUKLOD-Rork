/* Core character items. Each character has their own set.
 * Unlock uses that character's own level while they are Showing Now.
 * Items never change Character level or Circle Rank. */
import { supabase } from '@/lib/supabase';
import type { ProgressiveCharacterId } from '@/lib/buklodProgressiveCharacter';

export type CharacterCollectibleRewardKind =
  | 'expression'
  | 'speech'
  | 'profile_frame'
  | 'visual_effect'
  | 'title_badge';

const TOKEN_ICONS: Record<ProgressiveCharacterId, readonly string[]> = {
  phan: ['sprout', 'notebook-outline', 'hammer-wrench', 'flag-checkered', 'crown-outline'],
  quin: ['image-outline', 'map-outline', 'camera-outline', 'ticket-confirmation-outline', 'trophy-outline'],
  van: ['heart-outline', 'book-open-variant', 'hand-heart', 'gift-outline', 'barley'],
  christian: ['school-outline', 'account-tie', 'shield-star-outline', 'handshake-outline', 'medal-outline'],
  lhen: ['briefcase-outline', 'music-note', 'human-male-board', 'gift-outline', 'school-outline'],
};

export function characterTokenIcon(characterId: ProgressiveCharacterId, itemIndex: number) {
  const icons = TOKEN_ICONS[characterId];
  return icons[Math.max(0, Math.min(icons.length - 1, itemIndex - 1))] ?? 'star-circle-outline';
}

export type CharacterCollectibleItem = {
  collectibleId: string;
  characterId: ProgressiveCharacterId;
  level: number;
  itemIndex: number;
  rewardKind: CharacterCollectibleRewardKind;
  discoveredAt: string | null;
  redeemedAt: string | null;
};

export type CharacterCollectibleLoadout = {
  characterId: ProgressiveCharacterId;
  rewardKind: CharacterCollectibleRewardKind;
  collectibleId: string;
};

export type CharacterCollectibleState = {
  lifetimePoints: number;
  pointsOnCharacter: number;
  characterLevel: number;
  isActiveCharacter: boolean;
  items: CharacterCollectibleItem[];
  loadout: CharacterCollectibleLoadout[];
};

const CORE_IDS = new Set(['phan', 'quin', 'van', 'christian', 'lhen']);
const REWARD_KINDS = new Set<CharacterCollectibleRewardKind>([
  'expression',
  'speech',
  'profile_frame',
  'visual_effect',
  'title_badge',
]);

function fail(error: { message?: string } | null, fallback: string): never {
  const message = String(error?.message ?? '').trim();
  throw new Error(message || fallback);
}

function asRow(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function asCharacterId(value: unknown): ProgressiveCharacterId | null {
  const id = String(value ?? '').toLowerCase();
  return CORE_IDS.has(id) ? (id as ProgressiveCharacterId) : null;
}

function asRewardKind(value: unknown): CharacterCollectibleRewardKind | null {
  const kind = String(value ?? '').toLowerCase();
  return REWARD_KINDS.has(kind as CharacterCollectibleRewardKind)
    ? (kind as CharacterCollectibleRewardKind)
    : null;
}

function normalizeState(value: unknown): CharacterCollectibleState {
  const row = asRow(value) ?? {};
  const items = Array.isArray(row.items) ? row.items : [];
  const loadout = Array.isArray(row.loadout) ? row.loadout : [];
  return {
    lifetimePoints: Math.max(0, Number(row.lifetime_points ?? 0) || 0),
    pointsOnCharacter: Math.max(0, Number(row.points_on_character ?? 0) || 0),
    characterLevel: Math.max(1, Math.min(20, Math.floor(Number(row.character_level ?? row.current_level ?? 1) || 1))),
    isActiveCharacter: Boolean(row.is_active_character),
    items: items.flatMap((item) => {
      const record = asRow(item);
      const characterId = asCharacterId(record?.character_id);
      const rewardKind = asRewardKind(record?.reward_kind);
      const level = Math.floor(Number(record?.level));
      const itemIndex = Math.floor(Number(record?.item_index));
      if (!record || !characterId || !rewardKind || level < 1 || level > 20 || itemIndex < 1 || itemIndex > 5) {
        return [];
      }
      return [{
        collectibleId: String(record.collectible_id ?? ''),
        characterId,
        level,
        itemIndex,
        rewardKind,
        discoveredAt: record.discovered_at ? String(record.discovered_at) : null,
        redeemedAt: record.redeemed_at ? String(record.redeemed_at) : null,
      }];
    }),
    loadout: loadout.flatMap((item) => {
      const record = asRow(item);
      const characterId = asCharacterId(record?.character_id);
      const rewardKind = asRewardKind(record?.reward_kind);
      if (!record || !characterId || !rewardKind) return [];
      return [{
        characterId,
        rewardKind,
        collectibleId: String(record.collectible_id ?? ''),
      }];
    }),
  };
}

export function shownCollectiblePins(
  state: CharacterCollectibleState | null,
  characterId?: ProgressiveCharacterId | null,
) {
  if (!state) return [];
  return state.loadout.flatMap((pin) => {
    if (characterId && pin.characterId !== characterId) return [];
    const byId = state.items.find((row) => row.collectibleId === pin.collectibleId);
    const byKind = byId
      ? null
      : state.items.find((row) =>
        row.redeemedAt
        && row.rewardKind === pin.rewardKind
        && (!characterId || row.characterId === characterId));
    const owned = byId ?? byKind;
    return [{
      key: pin.collectibleId || `${pin.characterId}:${pin.rewardKind}`,
      characterId: pin.characterId,
      rewardKind: pin.rewardKind,
      itemIndex: owned?.itemIndex ?? 1,
    }];
  });
}

export function isCollectibleShown(
  item: CharacterCollectibleItem,
  state: CharacterCollectibleState | null,
) {
  if (!state || !item.collectibleId) return false;
  return state.loadout.some((row) => row.collectibleId === item.collectibleId);
}

/** Level chip / Open gate: character must be Showing Now and at least this level. */
export function isCollectibleLevelOpen(
  state: CharacterCollectibleState | null,
  level: number,
) {
  if (!state?.isActiveCharacter) return false;
  return state.characterLevel >= Math.max(1, Math.min(20, Math.floor(Number(level) || 1)));
}

export async function getMyCharacterCollectibles(
  characterId: ProgressiveCharacterId,
): Promise<CharacterCollectibleState> {
  const { data, error } = await (supabase as any).rpc('get_my_buklod_character_collectible_state_v1', {
    p_character_id: characterId,
  });
  if (error) fail(error, 'Could not load character items.');
  return normalizeState(data);
}

export async function openMyCharacterCollectible(
  characterId: ProgressiveCharacterId,
  level: number,
  itemIndex: number,
) {
  const { error } = await (supabase as any).rpc('open_my_buklod_character_collectible_v1', {
    p_character_id: characterId,
    p_level: level,
    p_item_index: itemIndex,
  });
  if (error) fail(error, 'Could not open this item.');
}

export async function redeemMyCharacterCollectible(
  characterId: ProgressiveCharacterId,
  level: number,
  itemIndex: number,
) {
  const { error } = await (supabase as any).rpc('redeem_my_buklod_character_collectible_v1', {
    p_character_id: characterId,
    p_level: level,
    p_item_index: itemIndex,
  });
  if (error) fail(error, 'Could not claim this item.');
}

export async function useMyCharacterCollectible(
  characterId: ProgressiveCharacterId,
  level: number,
  itemIndex: number,
) {
  const { error } = await (supabase as any).rpc('set_my_buklod_character_reward_active_v1', {
    p_character_id: characterId,
    p_level: level,
    p_item_index: itemIndex,
  });
  if (error) fail(error, 'Could not use this item.');
}

export async function clearMyCharacterCollectible(
  characterId: ProgressiveCharacterId,
  rewardKind: CharacterCollectibleRewardKind,
) {
  const { error } = await (supabase as any).rpc('clear_my_buklod_character_reward_active_v1', {
    p_character_id: characterId,
    p_reward_kind: rewardKind,
  });
  if (error) fail(error, 'Could not remove this item.');
}
