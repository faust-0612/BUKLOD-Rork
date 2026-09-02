import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  CATEGORY_ORDER,
  defaultEquipment,
  SLOT_LABELS,
} from '@/lib/character-lab-core/catalog';
import {
  collectionTally,
  reconcileEquipment,
  resolveAll,
  type UnlockContext,
} from '@/lib/character-lab-core/unlock';
import { tierFor, tierProgress } from '@/lib/character-lab-core/tiers';
import type {
  BodyId,
  Equipment,
  ReactionId,
  SlotId,
} from '@/lib/character-lab-core/types';

export const BUKLOD_CHARACTER_STORAGE_KEY = 'buklod_character_v2';

/** Bump when persisted equipment shape or defaults change. */
export const CHARACTER_STORAGE_VERSION = 3;

/** Legacy starter garments (pre–warrior-frame defaults) migrated on load. */
const LEGACY_STARTER_BY_SLOT: Partial<Record<SlotId, string>> = {
  top: 'top_tunic',
  bottom: 'bottom_wrap',
  shoes: 'shoes_sandals',
};

const WARRIOR_REPLACEMENT_BY_SLOT: Partial<Record<SlotId, string>> = {
  top: 'top_warrior',
  bottom: 'bottom_warrior',
  shoes: 'shoes_warrior',
};

export type BuklodCharacterState = {
  body: BodyId;
  equipment: Equipment;
  /** Item ids unlocked since last acknowledged — local only for now. */
  newlyUnlocked: string[];
  /** True once the user explicitly picks Male or Female. */
  bodyChosen?: boolean;
  /** Tracks one-time equipment migrations (legacy starter → warrior frame). */
  storageVersion?: number;
};

/** @deprecated Use BuklodCharacterState — kept for gradual migration. */
export type BuklodCharacterConfig = BuklodCharacterState;

export const CHARACTER_SLOT_ORDER = CATEGORY_ORDER;
export const CHARACTER_SLOT_LABELS = SLOT_LABELS;

export function defaultCharacterState(
  body: BodyId = 'female'
): BuklodCharacterState {
  return {
    body,
    equipment: defaultEquipment(body),
    newlyUnlocked: [],
    bodyChosen: false,
    storageVersion: CHARACTER_STORAGE_VERSION,
  };
}

/** One-time migration: old starter garment ids → warrior frame slots (no PNG layers). */
export function migrateLegacyStarterGarments(
  equipment: Equipment
): Equipment {
  const next: Equipment = { ...equipment };
  let changed = false;

  (['top', 'bottom', 'shoes'] as const).forEach((slot) => {
    const legacy = LEGACY_STARTER_BY_SLOT[slot];
    const replacement = WARRIOR_REPLACEMENT_BY_SLOT[slot];
    if (legacy && replacement && next[slot] === legacy) {
      next[slot] = replacement;
      changed = true;
    }
  });

  return changed ? next : equipment;
}

export const DEFAULT_CHARACTER = defaultCharacterState('female');

function storageKey(userId?: string | null) {
  return userId
    ? `${BUKLOD_CHARACTER_STORAGE_KEY}:${userId}`
    : BUKLOD_CHARACTER_STORAGE_KEY;
}

function normalizeEquipment(
  raw: Partial<Equipment> | undefined,
  body: BodyId
): Equipment {
  const fallback = defaultEquipment(body);
  if (!raw) return fallback;
  const merged = {
    ...fallback,
    ...raw,
    accessory: raw.accessory ?? 'acc_none',
  };
  return reconcileEquipment(
    merged,
    body,
    Number.MAX_SAFE_INTEGER,
    fallback
  );
}

export async function loadBuklodCharacter(
  userId?: string | null
): Promise<BuklodCharacterState> {
  if (!userId) {
    return defaultCharacterState('female');
  }

  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return defaultCharacterState('female');

    const parsed = JSON.parse(raw) as Partial<BuklodCharacterState>;
    const body: BodyId =
      parsed.body === 'male' ? 'male' : 'female';

    let equipment = normalizeEquipment(parsed.equipment, body);
    let storageVersion = parsed.storageVersion ?? 1;
    let needsPersist = false;

    if (storageVersion < CHARACTER_STORAGE_VERSION) {
      const migrated = migrateLegacyStarterGarments(equipment);
      if (migrated !== equipment) {
        equipment = migrated;
      }
      storageVersion = CHARACTER_STORAGE_VERSION;
      needsPersist = true;
    }

    const state: BuklodCharacterState = {
      body,
      equipment,
      newlyUnlocked: Array.isArray(parsed.newlyUnlocked)
        ? parsed.newlyUnlocked.filter(
            (id): id is string => typeof id === 'string'
          )
        : [],
      bodyChosen: parsed.bodyChosen ?? true,
      storageVersion,
    };

    if (needsPersist) {
      await saveBuklodCharacter(state, userId);
    }

    return state;
  } catch {
    return defaultCharacterState('female');
  }
}

export async function saveBuklodCharacter(
  state: BuklodCharacterState,
  userId?: string | null
) {
  if (!userId) {
    console.warn(
      'saveBuklodCharacter: missing userId; character not persisted'
    );
    return;
  }

  await AsyncStorage.setItem(
    storageKey(userId),
    JSON.stringify(state)
  );
}

export function buildUnlockContext(
  lifetimePoints: number,
  state: BuklodCharacterState
): UnlockContext {
  return {
    lifetimePoints,
    equipment: state.equipment,
    newlyUnlocked: new Set(state.newlyUnlocked),
  };
}

export function reconcileCharacterForPoints(
  state: BuklodCharacterState,
  lifetimePoints: number
): BuklodCharacterState {
  const fallback = defaultEquipment(state.body);
  return {
    ...state,
    equipment: reconcileEquipment(
      state.equipment,
      state.body,
      lifetimePoints,
      fallback
    ),
    storageVersion: state.storageVersion ?? CHARACTER_STORAGE_VERSION,
  };
}

export function setBody(
  state: BuklodCharacterState,
  body: BodyId,
  lifetimePoints: number
): BuklodCharacterState {
  const fallback = defaultEquipment(body);
  const equipment = reconcileEquipment(
  {
      ...state.equipment,
      base: body === 'female' ? 'base_female' : 'base_male',
      hair: body === 'female' ? 'f_hair_knot' : 'm_hair_crop',
    },
    body,
    lifetimePoints,
    fallback
  );

  return { ...state, body, equipment, bodyChosen: true };
}

export function equipItem(
  state: BuklodCharacterState,
  slot: SlotId,
  itemId: string | null,
  lifetimePoints: number
): BuklodCharacterState {
  if (slot === 'base' && itemId) {
    const body: BodyId =
      itemId === 'base_male' ? 'male' : 'female';
    return setBody(state, body, lifetimePoints);
  }

  const next: BuklodCharacterState = {
    ...state,
    equipment: {
      ...state.equipment,
      [slot]: itemId,
    },
  };

  return reconcileCharacterForPoints(next, lifetimePoints);
}

export function characterTierSummary(lifetimePoints: number) {
  const progress = tierProgress(lifetimePoints);
  const tally = collectionTally('female', lifetimePoints);
  return {
    tier: progress.tier,
    nextTier: progress.next,
    tierProgressRatio: progress.ratio,
    pointsToNextTier: progress.pointsToNext,
    tierName: tierFor(lifetimePoints).name,
    collectionOwned: tally.owned,
    collectionTotal: tally.total,
  };
}

export type OwnedCollectionItem = {
  id: string;
  label: string;
  category: SlotId;
  locked: boolean;
};

export async function loadOwnedCollection(
  lifetimePoints: number,
  body: BodyId
): Promise<OwnedCollectionItem[]> {
  const ctx: UnlockContext = {
    lifetimePoints,
    equipment: defaultEquipment(body),
    newlyUnlocked: new Set<string>(),
  };

  return resolveAll(body, ctx)
    .filter((row) => row.isUnlocked)
    .map((row) => ({
      id: row.item.id,
      label: row.item.name,
      category: row.item.slot,
      locked: false,
    }));
}

export function reactionForEquip(
  itemId: string,
  state: BuklodCharacterState
): ReactionId {
  if (state.newlyUnlocked.includes(itemId)) {
    return 'new_item';
  }
  return 'happy';
}
