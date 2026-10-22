/* BUKLOD_CHARACTER_R31_FORWARD_PORT_V2_SAFE */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getMyBuklodCharacterSelectionV2,
  setMyBuklodCharacterActiveV2,
  type BuklodCoreCharacterId,
} from '@/lib/buklodCharacterSelectionV2';
import {
  BUKLOD_CHARACTER_STAGES,
  buklodCollectibleNames,
} from '@/lib/buklodCharacterWorldCatalog';

export type ProgressiveCharacterId = BuklodCoreCharacterId;

export type ProgressiveCharacterProfile = {
  id: ProgressiveCharacterId;
  name: string;
  rowHeight: number;
  stages: readonly string[];
};

/* Preserved R31 visual milestones only. These values MUST NOT be used to infer
 * the active Character level from lifetime points. Current V2/server state is
 * authoritative and selecting another Character starts that selection at L1.
 */
export const PROGRESSIVE_LEVEL_THRESHOLDS = [
  0, 50, 100, 250, 500,
  1000, 2500, 5000, 10000, 25000,
  50000, 75000, 100000, 150000, 200000,
  250000, 300000, 350000, 400000, 500000,
] as const;

export const PROGRESSIVE_CHARACTERS: Record<ProgressiveCharacterId, ProgressiveCharacterProfile> = {
  phan: { id: 'phan', name: 'Phan', rowHeight: 129, stages: BUKLOD_CHARACTER_STAGES.phan },
  quin: { id: 'quin', name: 'Quin', rowHeight: 142, stages: BUKLOD_CHARACTER_STAGES.quin },
  van: { id: 'van', name: 'Van', rowHeight: 140, stages: BUKLOD_CHARACTER_STAGES.van },
  christian: { id: 'christian', name: 'Christian', rowHeight: 127, stages: BUKLOD_CHARACTER_STAGES.christian },
  lhen: { id: 'lhen', name: 'Lhen', rowHeight: 128, stages: BUKLOD_CHARACTER_STAGES.lhen },
};

export const PROGRESSIVE_CHARACTER_ORDER: readonly ProgressiveCharacterId[] = [
  'phan', 'quin', 'van', 'christian', 'lhen',
] as const;

const listeners = new Set<(userId: string, id: ProgressiveCharacterId | null) => void>();

export function isProgressiveCharacterId(value: unknown): value is ProgressiveCharacterId {
  return typeof value === 'string' && value in PROGRESSIVE_CHARACTERS;
}

/* Compatibility API retained for recovered R31 surfaces. Authority is V2/server. */
export async function loadProgressiveCharacter(userId?: string | null): Promise<ProgressiveCharacterId | null> {
  if (!userId) return null;
  const state = await getMyBuklodCharacterSelectionV2(userId);
  return isProgressiveCharacterId(state.active_character_id) ? state.active_character_id : null;
}

export async function saveProgressiveCharacter(
  userId: string | null | undefined,
  id: ProgressiveCharacterId,
) {
  if (!userId) return;
  await setMyBuklodCharacterActiveV2(userId, id);
  listeners.forEach((listener) => listener(userId, id));
}

export function subscribeProgressiveCharacter(
  listener: (userId: string, id: ProgressiveCharacterId | null) => void,
) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/* Featured collectible is presentation-only. It never writes points/rank/level. */
export type ProgressiveShowcaseSelection = {
  characterId: ProgressiveCharacterId;
  level: number;
  itemIndex: number;
};

export const PROGRESSIVE_SHOWCASE_STORAGE_KEY = 'buklod_progressive_showcase_v2';
const showcaseCache = new Map<string, ProgressiveShowcaseSelection | null>();
const showcaseListeners = new Set<(
  userId: string,
  selection: ProgressiveShowcaseSelection | null,
) => void>();

function showcaseKey(userId: string) {
  return `${PROGRESSIVE_SHOWCASE_STORAGE_KEY}:${userId}`;
}

function normalizeShowcase(value: unknown): ProgressiveShowcaseSelection | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Partial<ProgressiveShowcaseSelection>;
  if (!isProgressiveCharacterId(row.characterId)) return null;
  const level = Number(row.level);
  const itemIndex = Number(row.itemIndex);
  if (!Number.isInteger(level) || level < 1 || level > 20) return null;
  if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex > 4) return null;
  return { characterId: row.characterId, level, itemIndex };
}

export async function loadProgressiveShowcase(
  userId?: string | null,
): Promise<ProgressiveShowcaseSelection | null> {
  if (!userId) return null;
  if (showcaseCache.has(userId)) return showcaseCache.get(userId) ?? null;
  try {
    const raw = await AsyncStorage.getItem(showcaseKey(userId));
    const normalized = raw ? normalizeShowcase(JSON.parse(raw)) : null;
    showcaseCache.set(userId, normalized);
    return normalized;
  } catch {
    return null;
  }
}

export async function saveProgressiveShowcase(
  userId: string | null | undefined,
  selection: ProgressiveShowcaseSelection | null,
) {
  if (!userId) return;
  const normalized = normalizeShowcase(selection);
  if (normalized) await AsyncStorage.setItem(showcaseKey(userId), JSON.stringify(normalized));
  else await AsyncStorage.removeItem(showcaseKey(userId));
  showcaseCache.set(userId, normalized);
  showcaseListeners.forEach((listener) => listener(userId, normalized));
}

export function subscribeProgressiveShowcase(
  listener: (userId: string, selection: ProgressiveShowcaseSelection | null) => void,
) {
  showcaseListeners.add(listener);
  return () => showcaseListeners.delete(listener);
}

export function collectibleNames(id: ProgressiveCharacterId, level: number) {
  return [...buklodCollectibleNames(id, level)];
}
