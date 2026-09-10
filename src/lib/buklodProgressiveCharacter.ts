/* BUKLOD_CHARACTER_R31_PROGRESSIVE_MODEL_V2_FORWARD_PORT */
import type { BuklodCoreCharacterId } from '@/lib/buklodCharacterSelectionV2';

export type ProgressiveCharacterId = BuklodCoreCharacterId;

export type ProgressiveCharacterProfile = {
  id: ProgressiveCharacterId;
  name: string;
  rowHeight: number;
  stages: readonly string[];
  collectiblePrefix: readonly string[];
};

export const PROGRESSIVE_LEVEL_THRESHOLDS = [
  0, 50, 100, 250, 500,
  1000, 2500, 5000, 10000, 25000,
  50000, 75000, 100000, 150000, 200000,
  250000, 300000, 350000, 400000, 500000,
] as const;

const PHAN_STAGES = [
  'Farmer', 'Fisherman', 'Student', 'Worker', 'Service',
  'College', 'Intern', 'First Job', 'Professional', 'Team Lead',
  'Manager', 'Entrepreneur', 'Business Owner', 'Investor', 'Philanthropist',
  'Influencer', 'Industry Leader', 'Visionary', 'Executive', 'CEO',
] as const;

const QUIN_STAGES = [
  'Innocent', 'Province Girl', 'Student', 'Youth Helper', 'Volunteer',
  'College Girl', 'Explorer', 'Travel Enthusiast', 'Tourism Advocate', 'Travel Planner',
  'Team Leader', 'Project Manager', 'Content Creator', 'Tour Operator', 'Business Founder',
  'Tourism Entrepreneur', 'Resort Owner', 'Brand Leader', 'Industry Influencer', 'Tourism Business Owner',
] as const;

const VAN_STAGES = [
  'Innocent', 'Young Boy', 'Student', 'Altar Boy', 'Youth Helper',
  'College', 'Church Worker', 'Worship Leader', 'Community Volunteer', 'Ministry Worker',
  'Outreach Leader', 'Bible Teacher', 'Mission Trainee', 'Field Worker', 'Missionary',
  'Program Director', 'Training Leader', 'Mission Strategist', 'International Missionary', 'Global Mission Leader',
] as const;

const CHRISTIAN_STAGES = [
  'Student', 'Class Officer', 'Youth Leader', 'Athlete', 'College',
  'Organization Head', 'Intern', 'Professional', 'Community Volunteer', 'Team Leader',
  'Public Service Staff', 'Public Servant', 'Government Staff', 'Local Leader', 'Councilor',
  'Mayor', 'Provincial Leader', 'Congressional Leader', 'National Leader', 'Popular Politician',
] as const;

const LHEN_STAGES = [
  'Gas Station Worker', 'Service Crew', 'Cashier', 'Fast Food Crew', 'Sales Associate',
  'Community Volunteer', 'Church Youth', 'Choir Member', 'Bible Student', 'College Student',
  'Sunday School Teacher', 'Worship Leader', 'Community Outreach', 'Mission Volunteer', 'Education Coordinator',
  'Trainer', 'Missionary-Educator', 'Program Director', 'National Advocate', 'Missionary-Educator Global',
] as const;

export const PROGRESSIVE_CHARACTERS: Record<ProgressiveCharacterId, ProgressiveCharacterProfile> = {
  phan: { id: 'phan', name: 'Phan', rowHeight: 129, stages: PHAN_STAGES, collectiblePrefix: ['Seed', 'Notebook', 'Tool', 'Milestone', 'Legacy'] },
  quin: { id: 'quin', name: 'Quin', rowHeight: 142, stages: QUIN_STAGES, collectiblePrefix: ['Memory', 'Map', 'Camera', 'Travel Token', 'Destination Trophy'] },
  van: { id: 'van', name: 'Van', rowHeight: 140, stages: VAN_STAGES, collectiblePrefix: ['Joy Token', 'Bible Note', 'Service Tool', 'Mission Keepsake', 'Harvest Emblem'] },
  christian: { id: 'christian', name: 'Christian', rowHeight: 127, stages: CHRISTIAN_STAGES, collectiblePrefix: ['School Token', 'Leadership Note', 'Service Badge', 'Public Trust Item', 'Legacy Medal'] },
  lhen: { id: 'lhen', name: 'Lhen', rowHeight: 128, stages: LHEN_STAGES, collectiblePrefix: ['Work Token', 'Song Note', 'Teaching Tool', 'Mission Keepsake', 'Education Legacy'] },
};

export const PROGRESSIVE_CHARACTER_IDS: readonly ProgressiveCharacterId[] = [
  'phan', 'quin', 'van', 'christian', 'lhen',
] as const;

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

export function collectibleNames(id: ProgressiveCharacterId, level: number) {
  const profile = PROGRESSIVE_CHARACTERS[id];
  const safeLevel = Math.max(1, Math.min(20, Math.floor(level || 1)));
  const stage = profile.stages[safeLevel - 1] ?? `Level ${safeLevel}`;
  return profile.collectiblePrefix.map((prefix) => `${stage} ${prefix}`);
}

export function getProgressiveCharacterDisplayState(input: {
  activeCharacterId?: ProgressiveCharacterId | null;
  characterLevel?: number;
  characterPointsSinceSelection?: number;
}): BuklodProgressiveDisplayState {
  const activeCharacterId = input.activeCharacterId ?? null;
  const characterPointsSinceSelection = activeCharacterId
    ? Math.max(0, Number(input.characterPointsSinceSelection ?? 0) || 0)
    : 0;
  // The current V2 server result is authoritative. Thresholds above are retained for
  // R31 preview/metadata compatibility and never recompute or override the saved V2 level.
  const currentLevel = activeCharacterId
    ? Math.max(1, Math.min(20, Number(input.characterLevel ?? 1) || 1))
    : 1;

  return {
    activeCharacterId,
    currentLevel,
    characterPointsSinceSelection,
    characters: PROGRESSIVE_CHARACTER_IDS.map((id) => ({
      id,
      level: id === activeCharacterId ? currentLevel : 1,
      isActive: id === activeCharacterId,
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
