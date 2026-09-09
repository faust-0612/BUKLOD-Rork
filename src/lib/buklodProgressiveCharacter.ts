/* BUKLOD_CHARACTER_R26_PROGRESSIVE_FULL_BODY */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { BodyId, Equipment } from '@/lib/character-lab-core/types';
import { equipmentForRankLook } from '@/lib/buklodCharacter';

export type ProgressiveCharacterId = 'phan' | 'quin' | 'van' | 'christian' | 'lhen';

export type ProgressiveCharacterProfile = {
  id: ProgressiveCharacterId;
  name: string;
  body: BodyId;
  traits: string;
  rowY: number;
  rowHeight: number;
  stages: readonly string[];
  collectiblePrefix: readonly string[];
};

export const PROGRESSIVE_LEVEL_THRESHOLDS = [
  0, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000,
  50000, 75000, 100000, 150000, 200000, 250000, 300000, 350000, 400000, 500000,
] as const;

const PHAN_STAGES = ['Farmer','Fisherman','Student','Worker','Service','College','Intern','First Job','Professional','Team Lead','Manager','Entrepreneur','Business Owner','Investor','Philanthropist','Influencer','Industry Leader','Visionary','Executive','CEO'] as const;
const QUIN_STAGES = ['Innocent','Province Girl','Student','Youth Helper','Volunteer','College Girl','Explorer','Travel Enthusiast','Tourism Advocate','Travel Planner','Team Leader','Project Manager','Content Creator','Tour Operator','Business Founder','Tourism Entrepreneur','Resort Owner','Brand Leader','Industry Influencer','Tourism Business Owner'] as const;
const VAN_STAGES = ['Innocent','Young Boy','Student','Altar Boy','Youth Helper','College','Church Worker','Worship Leader','Community Volunteer','Ministry Worker','Outreach Leader','Bible Teacher','Mission Trainee','Field Worker','Missionary','Program Director','Training Leader','Mission Strategist','International Missionary','Global Mission Leader'] as const;
const CHRISTIAN_STAGES = ['Student','Class Officer','Youth Leader','Athlete','College','Organization Head','Intern','Professional','Community Volunteer','Team Leader','Public Service Staff','Public Servant','Government Staff','Local Leader','Councilor','Mayor','Provincial Leader','Congressional Leader','National Leader','Popular Politician'] as const;
const LHEN_STAGES = ['Gas Station Worker','Service Crew','Cashier','Fast Food Crew','Sales Associate','Community Volunteer','Church Youth','Choir Member','Bible Student','College Student','Sunday School Teacher','Worship Leader','Community Outreach','Mission Volunteer','Education Coordinator','Trainer','Missionary-Educator','Program Director','National Advocate','Missionary-Educator Global'] as const;

export const PROGRESSIVE_CHARACTERS: Record<ProgressiveCharacterId, ProgressiveCharacterProfile> = {
  phan: { id:'phan', name:'Phan', body:'male', traits:'Simple, mahinhin, matalino, payatin, moreno.', rowY:65, rowHeight:129, stages:PHAN_STAGES, collectiblePrefix:['Seed','Notebook','Tool','Milestone','Legacy'] },
  quin: { id:'quin', name:'Quin', body:'female', traits:'Cute, pandak, masayahin, long curly hair, maputi.', rowY:234, rowHeight:142, stages:QUIN_STAGES, collectiblePrefix:['Memory','Map','Camera','Travel Token','Destination Trophy'] },
  van: { id:'van', name:'Van', body:'male', traits:'Maputi, masayahin, bibo, masunurin, mapagmahal.', rowY:422, rowHeight:140, stages:VAN_STAGES, collectiblePrefix:['Joy Token','Bible Note','Service Tool','Mission Keepsake','Harvest Emblem'] },
  christian: { id:'christian', name:'Christian', body:'male', traits:'Gwapo, maputi, pungay ang mata, matangkad, athletic.', rowY:608, rowHeight:127, stages:CHRISTIAN_STAGES, collectiblePrefix:['School Token','Leadership Note','Service Badge','Public Trust Item','Legacy Medal'] },
  lhen: { id:'lhen', name:'Lhen', body:'female', traits:'Simple, sobrang bait, strikto, magaling kumanta.', rowY:778, rowHeight:128, stages:LHEN_STAGES, collectiblePrefix:['Work Token','Song Note','Teaching Tool','Mission Keepsake','Education Legacy'] },
};

export const PROGRESSIVE_CHARACTER_ORDER: readonly ProgressiveCharacterId[] = ['phan','quin','van','christian','lhen'];
export const PROGRESSIVE_CHARACTER_STORAGE_KEY = 'buklod_progressive_character_v1';

const selectedByUser = new Map<string, ProgressiveCharacterId>();
const listeners = new Set<(userId: string, id: ProgressiveCharacterId | null) => void>();

function keyFor(userId: string) {
  return `${PROGRESSIVE_CHARACTER_STORAGE_KEY}:${userId}`;
}

export function isProgressiveCharacterId(value: unknown): value is ProgressiveCharacterId {
  return typeof value === 'string' && value in PROGRESSIVE_CHARACTERS;
}

export async function loadProgressiveCharacter(userId?: string | null): Promise<ProgressiveCharacterId | null> {
  if (!userId) return null;
  const cached = selectedByUser.get(userId);
  if (cached) return cached;
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!isProgressiveCharacterId(raw)) return null;
    selectedByUser.set(userId, raw);
    return raw;
  } catch {
    return null;
  }
}

export async function saveProgressiveCharacter(userId: string | null | undefined, id: ProgressiveCharacterId) {
  if (!userId) return;
  await AsyncStorage.setItem(keyFor(userId), id);
  selectedByUser.set(userId, id);
  listeners.forEach((listener) => listener(userId, id));
}

export function subscribeProgressiveCharacter(listener: (userId: string, id: ProgressiveCharacterId | null) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function sameEquipment(a: Equipment, b: Equipment) {
  const slots: (keyof Equipment)[] = ['base','face','hair','top','bottom','shoes','accessory','badge','special','background'];
  return slots.reduce((score, slot) => score + (a[slot] === b[slot] ? 1 : 0), 0);
}

export function progressiveLevelForEquipment(body: BodyId, equipment: Equipment): number {
  let bestLevel = 1;
  let bestScore = -1;
  PROGRESSIVE_LEVEL_THRESHOLDS.forEach((points, index) => {
    const expected = equipmentForRankLook(body, points);
    const score = sameEquipment(equipment, expected);
    if (score > bestScore || (score === bestScore && index + 1 > bestLevel)) {
      bestScore = score;
      bestLevel = index + 1;
    }
  });
  return Math.max(1, Math.min(20, bestLevel));
}

export function collectibleNames(id: ProgressiveCharacterId, level: number) {
  const profile = PROGRESSIVE_CHARACTERS[id];
  const safeLevel = Math.max(1, Math.min(20, Math.floor(level)));
  const stage = profile.stages[safeLevel - 1] ?? `Level ${safeLevel}`;
  return profile.collectiblePrefix.map((prefix, index) => `${stage} ${prefix} ${index + 1}`);
}
