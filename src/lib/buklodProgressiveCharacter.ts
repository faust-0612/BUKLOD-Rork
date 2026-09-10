export type ProgressiveCharacterId = 'phan' | 'quin' | 'van' | 'christian' | 'lhen';

export type ProgressiveCharacterProfile = {
  id: ProgressiveCharacterId;
  name: string;
  traits: string;
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
  phan: { id: 'phan', name: 'Phan', traits: 'Simple, mahinhin, matalino, payatin, moreno.', rowHeight: 129, stages: PHAN_STAGES, collectiblePrefix: ['Seed', 'Notebook', 'Tool', 'Milestone', 'Legacy'] },
  quin: { id: 'quin', name: 'Quin', traits: 'Cute, pandak, masayahin, long curly hair, maputi.', rowHeight: 142, stages: QUIN_STAGES, collectiblePrefix: ['Memory', 'Map', 'Camera', 'Travel Token', 'Destination Trophy'] },
  van: { id: 'van', name: 'Van', traits: 'Maputi, masayahin, bibo, masunurin, mapagmahal.', rowHeight: 140, stages: VAN_STAGES, collectiblePrefix: ['Joy Token', 'Bible Note', 'Service Tool', 'Mission Keepsake', 'Harvest Emblem'] },
  christian: { id: 'christian', name: 'Christian', traits: 'Gwapo, maputi, pungay ang mata, matangkad, athletic.', rowHeight: 127, stages: CHRISTIAN_STAGES, collectiblePrefix: ['School Token', 'Leadership Note', 'Service Badge', 'Public Trust Item', 'Legacy Medal'] },
  lhen: { id: 'lhen', name: 'Lhen', traits: 'Simple, sobrang bait, strikto, magaling kumanta.', rowHeight: 128, stages: LHEN_STAGES, collectiblePrefix: ['Work Token', 'Song Note', 'Teaching Tool', 'Mission Keepsake', 'Education Legacy'] },
};

export const PROGRESSIVE_CHARACTER_ORDER: readonly ProgressiveCharacterId[] = ['phan', 'quin', 'van', 'christian', 'lhen'];

export function collectibleNames(id: ProgressiveCharacterId, level: number) {
  const profile = PROGRESSIVE_CHARACTERS[id];
  const safeLevel = Math.max(1, Math.min(20, Math.floor(level)));
  const stage = profile.stages[safeLevel - 1] ?? `Level ${safeLevel}`;
  return profile.collectiblePrefix.map(prefix => `${stage} ${prefix}`);
}
