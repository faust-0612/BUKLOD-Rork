/* BUKLOD_CHARACTER_R31_PROGRESSIVE_MODEL_V2_FORWARD_PORT */
import type { BuklodCoreCharacterId } from '@/lib/buklodCharacterSelectionV2';

export type ProgressiveCharacterId = BuklodCoreCharacterId;

export const PROGRESSIVE_CHARACTER_IDS: readonly ProgressiveCharacterId[] = [
  'phan',
  'quin',
  'van',
  'christian',
  'lhen',
] as const;

export const PROGRESSIVE_LEVEL_THRESHOLDS: readonly number[] = [
  0, 20, 50, 90, 140, 200, 275, 365, 470, 590,
  725, 875, 1040, 1220, 1415, 1625, 1850, 2090, 2345, 2615,
] as const;

export const collectibleNames: Record<ProgressiveCharacterId, readonly string[]> = {
  phan: ['First Step', 'Trail Token', 'Forest Crest', 'Phan Legacy'],
  quin: ['First Step', 'Study Token', 'Wisdom Crest', 'Quin Legacy'],
  van: ['First Step', 'Journey Token', 'Voyager Crest', 'Van Legacy'],
  christian: ['First Step', 'Service Token', 'Faith Crest', 'Christian Legacy'],
  lhen: ['First Step', 'Care Token', 'Compassion Crest', 'Lhen Legacy'],
};

export type ProgressiveCharacterState = {
  characterId: ProgressiveCharacterId;
  level: number;
  characterPoints: number;
};

export type BuklodProgressiveDisplayState = {
  activeCharacterId: ProgressiveCharacterId | null;
  currentLevel: number;
  characterPointsSinceSelection: number;
  characters: Array<{
    id: ProgressiveCharacterId;
    level: number;
    isActive: boolean;
  }>;
};

const showcaseListeners = new Set<(state: BuklodProgressiveDisplayState) => void>();
let latestShowcase: BuklodProgressiveDisplayState | null = null;

export function getProgressiveLevelPoints(level: number) {
  const normalized = Math.max(1, Math.min(20, Math.floor(level || 1)));
  return PROGRESSIVE_LEVEL_THRESHOLDS[normalized - 1] ?? 0;
}

export function getProgressiveLevelForPoints(characterPoints: number) {
  const points = Math.max(0, Number(characterPoints) || 0);
  let level = 1;
  for (let index = 0; index < PROGRESSIVE_LEVEL_THRESHOLDS.length; index += 1) {
    if (points >= PROGRESSIVE_LEVEL_THRESHOLDS[index]) level = index + 1;
    else break;
  }
  return Math.min(20, level);
}

export function getProgressiveCharacterDisplayState(input: {
  activeCharacterId?: ProgressiveCharacterId | null;
  characterLevel?: number;
  characterPointsSinceSelection?: number;
}): BuklodProgressiveDisplayState {
  const characterPointsSinceSelection = Math.max(
    0,
    Number(input.characterPointsSinceSelection ?? 0) || 0,
  );
  const derivedLevel = getProgressiveLevelForPoints(characterPointsSinceSelection);
  const serverLevel = Math.max(1, Math.min(20, Number(input.characterLevel ?? 1) || 1));
  const currentLevel = input.activeCharacterId ? Math.max(derivedLevel, serverLevel) : 1;

  return {
    activeCharacterId: input.activeCharacterId ?? null,
    currentLevel,
    characterPointsSinceSelection: input.activeCharacterId ? characterPointsSinceSelection : 0,
    characters: PROGRESSIVE_CHARACTER_IDS.map((id) => ({
      id,
      level: id === input.activeCharacterId ? currentLevel : 1,
      isActive: id === input.activeCharacterId,
    })),
  };
}

/** Compatibility read for the R31 contract. V2 server state remains authoritative. */
export async function loadProgressiveCharacter(
  fallback?: ProgressiveCharacterState,
): Promise<ProgressiveCharacterState> {
  if (latestShowcase?.activeCharacterId) {
    return {
      characterId: latestShowcase.activeCharacterId,
      level: latestShowcase.currentLevel,
      characterPoints: latestShowcase.characterPointsSinceSelection,
    };
  }
  return fallback ?? { characterId: 'phan', level: 1, characterPoints: 0 };
}

/** Compatibility presentation write only; activation/reset must use V2 server RPC. */
export async function saveProgressiveCharacter(state: ProgressiveCharacterState) {
  latestShowcase = getProgressiveCharacterDisplayState({
    activeCharacterId: state.characterId,
    characterLevel: state.level,
    characterPointsSinceSelection: state.characterPoints,
  });
  showcaseListeners.forEach((listener) => listener(latestShowcase as BuklodProgressiveDisplayState));
  return state;
}

export function loadProgressiveShowcase() {
  return latestShowcase;
}

export function publishProgressiveShowcase(state: BuklodProgressiveDisplayState) {
  latestShowcase = state;
  showcaseListeners.forEach((listener) => listener(state));
}

export function subscribeProgressiveShowcase(listener: (state: BuklodProgressiveDisplayState) => void) {
  showcaseListeners.add(listener);
  if (latestShowcase) listener(latestShowcase);
  return () => showcaseListeners.delete(listener);
}
