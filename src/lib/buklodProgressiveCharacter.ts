/* BUKLOD_CHARACTER_R31_FORWARD_PORT_V2_SAFE */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getMyBuklodCharacterSelectionV2,
  setMyBuklodCharacterActiveV2,
  type BuklodCoreCharacterId,
} from '@/lib/buklodCharacterSelectionV2';

export type ProgressiveCharacterId = BuklodCoreCharacterId;

export type ProgressiveCharacterProfile = {
  id: ProgressiveCharacterId;
  name: string;
  rowHeight: number;
  stages: readonly string[];
  collectiblePrefix: readonly string[];
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
  const profile = PROGRESSIVE_CHARACTERS[id];
  const safeLevel = Math.max(1, Math.min(20, Math.floor(Number(level) || 1)));
  const stage = profile.stages[safeLevel - 1] ?? `Level ${safeLevel}`;
  return profile.collectiblePrefix.map((prefix) => `${stage} ${prefix}`);
}
