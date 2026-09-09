import type { BuklodWorldCharacterId } from '@/lib/buklodCharacterWorldV3';

export const R31_LEVEL_THRESHOLDS = [
  0, 50, 100, 250, 500,
  1000, 2500, 5000, 10000, 25000,
  50000, 75000, 100000, 150000, 200000,
  250000, 300000, 350000, 400000, 500000,
] as const;

const STAGES: Partial<Record<BuklodWorldCharacterId, readonly string[]>> = {
  phan: ['Farmer','Fisherman','Student','Worker','Service','College','Intern','First Job','Professional','Team Lead','Manager','Entrepreneur','Business Owner','Investor','Philanthropist','Influencer','Industry Leader','Visionary','Executive','CEO'],
  quin: ['Innocent','Province Girl','Student','Youth Helper','Volunteer','College Girl','Explorer','Travel Enthusiast','Tourism Advocate','Travel Planner','Team Leader','Project Manager','Content Creator','Tour Operator','Business Founder','Tourism Entrepreneur','Resort Owner','Brand Leader','Industry Influencer','Tourism Business Owner'],
  van: ['Innocent','Young Boy','Student','Altar Boy','Youth Helper','College','Church Worker','Worship Leader','Community Volunteer','Ministry Worker','Outreach Leader','Bible Teacher','Mission Trainee','Field Worker','Missionary','Program Director','Training Leader','Mission Strategist','International Missionary','Global Mission Leader'],
  christian: ['Student','Class Officer','Youth Leader','Athlete','College','Organization Head','Intern','Professional','Community Volunteer','Team Leader','Public Service Staff','Public Servant','Government Staff','Local Leader','Councilor','Mayor','Provincial Leader','Congressional Leader','National Leader','Popular Politician'],
  lhen: ['Gas Station Worker','Service Crew','Cashier','Fast Food Crew','Sales Associate','Community Volunteer','Church Youth','Choir Member','Bible Student','College Student','Sunday School Teacher','Worship Leader','Community Outreach','Mission Volunteer','Education Coordinator','Trainer','Missionary-Educator','Program Director','National Advocate','Missionary-Educator Global'],
};

export function r31StageName(id: BuklodWorldCharacterId, level: number) {
  const list = STAGES[id];
  const safe = Math.max(1, Math.min(20, Math.floor(level || 1)));
  return list?.[safe - 1] ?? `Stage ${safe}`;
}
