/* BUKLOD_CHARACTER_R25_COHESIVE_RANK_LOOKS */
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
export const CHARACTER_STORAGE_VERSION = 4;

/**
 * R25 stops treating progression as isolated shirt / pants swaps.
 * Auto mode equips one coherent visual look for the user's current milestone.
 * Manual mode still lets the user mix any owned items without being overwritten.
 */
export type BuklodRankLookMode = 'auto' | 'manual';

export type BuklodCharacterState = {
  body: BodyId;
  equipment: Equipment;
  /** Item ids unlocked since last acknowledged — local only for now. */
  newlyUnlocked: string[];
  /** True once the user explicitly picks Male or Female. */
  bodyChosen?: boolean;
  /** Tracks one-time equipment migrations. */
  storageVersion?: number;
  /** Auto = cohesive milestone outfit; manual = preserve individual choices. */
  rankLookMode?: BuklodRankLookMode;
};

/** @deprecated Use BuklodCharacterState — kept for gradual migration. */
export type BuklodCharacterConfig = BuklodCharacterState;

export const CHARACTER_SLOT_ORDER = CATEGORY_ORDER;
export const CHARACTER_SLOT_LABELS = SLOT_LABELS;

function baseId(body: BodyId) {
  return body === 'female' ? 'base_female' : 'base_male';
}

function starterHairId(body: BodyId) {
  return body === 'female' ? 'f_hair_knot' : 'm_hair_crop';
}

function hairId(
  body: BodyId,
  female: string,
  male: string,
) {
  return body === 'female' ? female : male;
}

function withRankLook(
  body: BodyId,
  patch: Partial<Equipment>,
): Equipment {
  return {
    ...defaultEquipment(body),
    base: baseId(body),
    ...patch,
  };
}

/**
 * The authoritative cohesive wardrobe ladder.
 * Each milestone changes the whole silhouette, not just one sticker-like layer.
 */
export function equipmentForRankLook(
  body: BodyId,
  lifetimePoints: number,
): Equipment {
  const points = Math.max(0, Number(lifetimePoints) || 0);

  let equipment = withRankLook(body, {
    hair: starterHairId(body),
    top: 'top_warrior',
    bottom: 'bottom_warrior',
    shoes: 'shoes_warrior',
    accessory: 'acc_none',
    face: 'face_natural',
    badge: 'badge_none',
    special: 'fx_none',
    background: 'bg_covenant',
  });

  if (points >= 50) {
    equipment = withRankLook(body, {
      hair: starterHairId(body),
      top: 'top_tunic',
      bottom: 'bottom_wrap',
      shoes: 'shoes_sandals',
      accessory: 'acc_none',
      face: 'face_natural',
      badge: 'badge_none',
      special: 'fx_none',
      background: 'bg_covenant',
    });
  }

  if (points >= 100) {
    equipment = withRankLook(body, {
      hair: hairId(body, 'f_hair_braid', 'm_hair_sweep'),
      top: 'top_jacket',
      bottom: 'bottom_wrap',
      shoes: 'shoes_sandals',
      accessory: 'acc_satchel',
      face: 'face_natural',
      badge: 'badge_none',
      special: 'fx_none',
      background: 'bg_covenant',
    });
  }

  if (points >= 250) {
    equipment = withRankLook(body, {
      hair: hairId(body, 'f_hair_waves', 'm_hair_locs'),
      top: 'top_jacket',
      bottom: 'bottom_long',
      shoes: 'shoes_boots',
      accessory: 'acc_stole',
      face: 'face_marks',
      badge: 'badge_none',
      special: 'fx_none',
      background: 'bg_covenant',
    });
  }

  if (points >= 500) {
    equipment = withRankLook(body, {
      hair: hairId(body, 'f_hair_waves', 'm_hair_locs'),
      top: 'top_mantle',
      bottom: 'bottom_long',
      shoes: 'shoes_boots',
      accessory: 'acc_lenses',
      face: 'face_marks',
      badge: 'badge_seed',
      special: 'fx_none',
      background: 'bg_verdant',
    });
  }

  if (points >= 1000) {
    equipment = withRankLook(body, {
      hair: hairId(body, 'f_hair_crest', 'm_hair_warden'),
      top: 'top_mantle',
      bottom: 'bottom_greaves',
      shoes: 'shoes_boots',
      accessory: 'acc_bracer',
      face: 'face_marks',
      badge: 'badge_hands',
      special: 'fx_aura',
      background: 'bg_skyward',
    });
  }

  if (points >= 2500) {
    equipment = withRankLook(body, {
      hair: hairId(body, 'f_hair_crest', 'm_hair_warden'),
      top: 'top_regalia',
      bottom: 'bottom_greaves',
      shoes: 'shoes_gilded',
      accessory: 'acc_bracer',
      face: 'face_sigil',
      badge: 'badge_hands',
      special: 'fx_aura',
      background: 'bg_skyward',
    });
  }

  if (points >= 5000) {
    equipment = {
      ...equipment,
      badge: 'badge_crown',
      special: 'fx_ascend',
    };
  }

  if (points >= 10000) {
    equipment = withRankLook(body, {
      hair: hairId(body, 'prestige_f_hair_vanguard', 'prestige_m_hair_vanguard'),
      top: 'prestige_top_vanguard',
      bottom: 'bottom_greaves',
      shoes: 'shoes_gilded',
      accessory: 'prestige_acc_vanguard',
      face: 'prestige_face_covenant',
      badge: 'prestige_badge_vanguard',
      special: 'prestige_fx_vanguard',
      background: 'prestige_bg_vanguard',
    });
  }

  if (points >= 25000) {
    equipment = {
      ...equipment,
      bottom: 'prestige_bottom_pathfinder',
      shoes: 'prestige_shoes_pathfinder',
      special: 'prestige_fx_pathfinder',
      background: 'prestige_bg_pathfinder',
    };
  }

  if (points >= 50000) {
    equipment = {
      ...equipment,
      hair: hairId(body, 'prestige_f_hair_pathfinder', 'prestige_m_hair_pathfinder'),
      top: 'prestige_top_pathfinder',
      accessory: 'prestige_acc_pathfinder',
      face: 'prestige_face_radiant',
      badge: 'prestige_badge_pathfinder',
    };
  }

  if (points >= 75000) {
    equipment = {
      ...equipment,
      bottom: 'prestige_bottom_veteran',
      special: 'prestige_fx_veteran',
      background: 'prestige_bg_veteran',
    };
  }

  if (points >= 100000) {
    equipment = {
      ...equipment,
      top: 'prestige_top_luminary',
      shoes: 'prestige_shoes_luminary',
      face: 'prestige_face_luminary',
      badge: 'prestige_badge_luminary',
    };
  }

  if (points >= 150000) {
    equipment = {
      ...equipment,
      hair: hairId(body, 'prestige_f_hair_luminary', 'prestige_m_hair_luminary'),
      accessory: 'prestige_acc_luminary',
      special: 'prestige_fx_luminary',
      background: 'prestige_bg_luminary',
    };
  }

  if (points >= 200000) {
    equipment = {
      ...equipment,
      bottom: 'prestige_bottom_covenant',
    };
  }

  if (points >= 250000) {
    equipment = {
      ...equipment,
      top: 'prestige_top_covenant',
      face: 'prestige_face_legacy',
      badge: 'prestige_badge_legacy',
    };
  }

  if (points >= 300000) {
    equipment = {
      ...equipment,
      shoes: 'prestige_shoes_legacy',
      accessory: 'prestige_acc_legacy',
      special: 'prestige_fx_legacy',
      background: 'prestige_bg_legacy',
    };
  }

  if (points >= 350000) {
    equipment = {
      ...equipment,
      hair: hairId(body, 'prestige_f_hair_legacy', 'prestige_m_hair_legacy'),
    };
  }

  if (points >= 400000) {
    equipment = {
      ...equipment,
      bottom: 'prestige_bottom_summit',
    };
  }

  if (points >= 450000) {
    equipment = {
      ...equipment,
      accessory: 'prestige_acc_summit',
    };
  }

  if (points >= 500000) {
    equipment = {
      ...equipment,
      top: 'prestige_top_summit',
      shoes: 'prestige_shoes_summit',
      face: 'prestige_face_summit',
      badge: 'prestige_badge_summit',
      special: 'prestige_fx_summit',
      background: 'prestige_bg_summit',
    };
  }

  return equipment;
}

function shouldAdoptAutoRankLook(equipment: Equipment) {
  const starterTop =
    equipment.top === 'top_warrior' ||
    equipment.top === 'top_tunic';
  const starterBottom =
    equipment.bottom === 'bottom_warrior' ||
    equipment.bottom === 'bottom_wrap';
  const starterShoes =
    equipment.shoes === 'shoes_warrior' ||
    equipment.shoes === 'shoes_sandals';

  const starterCount = [
    starterTop,
    starterBottom,
    starterShoes,
  ].filter(Boolean).length;

  return starterCount >= 2;
}

export function defaultCharacterState(
  body: BodyId = 'female'
): BuklodCharacterState {
  return {
    body,
    equipment: defaultEquipment(body),
    newlyUnlocked: [],
    bodyChosen: false,
    storageVersion: CHARACTER_STORAGE_VERSION,
    rankLookMode: 'auto',
  };
}

/**
 * Kept as an exported compatibility hook. R25 deliberately does not downgrade
 * legacy starter garments back to the bare Warrior frame.
 */
export function migrateLegacyStarterGarments(
  equipment: Equipment
): Equipment {
  return equipment;
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
      equipment = migrateLegacyStarterGarments(equipment);
      storageVersion = CHARACTER_STORAGE_VERSION;
      needsPersist = true;
    }

    const rankLookMode: BuklodRankLookMode =
      parsed.rankLookMode === 'manual'
        ? 'manual'
        : parsed.rankLookMode === 'auto'
          ? 'auto'
          : shouldAdoptAutoRankLook(equipment)
            ? 'auto'
            : 'manual';

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
      rankLookMode,
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
  const reconciled = reconcileEquipment(
    state.equipment,
    state.body,
    lifetimePoints,
    fallback
  );

  const rankLookMode: BuklodRankLookMode =
    state.rankLookMode ??
    (shouldAdoptAutoRankLook(reconciled) ? 'auto' : 'manual');

  const equipment =
    rankLookMode === 'auto'
      ? reconcileEquipment(
          equipmentForRankLook(state.body, lifetimePoints),
          state.body,
          lifetimePoints,
          fallback,
        )
      : reconciled;

  return {
    ...state,
    equipment,
    rankLookMode,
    storageVersion: CHARACTER_STORAGE_VERSION,
  };
}

export function applyBestRankLook(
  state: BuklodCharacterState,
  lifetimePoints: number,
): BuklodCharacterState {
  const fallback = defaultEquipment(state.body);
  return {
    ...state,
    rankLookMode: 'auto',
    equipment: reconcileEquipment(
      equipmentForRankLook(state.body, lifetimePoints),
      state.body,
      lifetimePoints,
      fallback,
    ),
    storageVersion: CHARACTER_STORAGE_VERSION,
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
      base: baseId(body),
      hair: starterHairId(body),
    },
    body,
    lifetimePoints,
    fallback
  );

  return reconcileCharacterForPoints(
    {
      ...state,
      body,
      equipment,
      bodyChosen: true,
    },
    lifetimePoints,
  );
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
    rankLookMode: 'manual',
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
