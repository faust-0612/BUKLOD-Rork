/**
 * Season 2 visual-only Circle Rank artwork contract.
 * Exact order: eight families x V, IV, III, II, I = 40 slots.
 * Source: user-approved BUKLOD badge sheets; assets are individually segmented
 * into a transparent 5x8 atlas to avoid 40 network requests or neighbor crops.
 * Does not change server points, rank thresholds, or Season 1 rules.
 */
export const RANK_FAMILIES = ['starter','active','steady','builder','impact','vanguard','prime','prime elite'] as const;
export const RANK_LEVELS = ['V','IV','III','II','I'] as const;
export const RANK_ATLAS_COLUMNS = 5;
export const RANK_ATLAS_ROWS = 8;
export const RANK_COUNT = 40;
export const RANK_ART_SOURCE = require('../../assets/season2/buklod-circle-ranks-40.webp');
export type BuklodRankArt = {
  family: (typeof RANK_FAMILIES)[number];
  level: (typeof RANK_LEVELS)[number];
  index: number;
  color: string;
  accent: string;
};
export const FAMILY_COLORS: Record<(typeof RANK_FAMILIES)[number],{border:string; accent:string}> = {
  starter: {border:'#A7E935',accent:'#F4BD36'},
  active: {border:'#41A9FF',accent:'#D8ECFF'},
  steady: {border:'#B877F9',accent:'#EAD3FF'},
  builder: {border:'#EFA733',accent:'#FFE4A0'},
  impact: {border:'#24C6B5',accent:'#A6FFF1'},
  vanguard: {border:'#E34C59',accent:'#FFC57A'},
  prime: {border:'#3D83FF',accent:'#FFE092'},
  'prime elite': {border:'#B45CFF',accent:'#FFE36D'},
};
export function resolveCircleRankArt(value: string | null | undefined): BuklodRankArt | null {
  const raw = String(value ?? '').trim().replace(/\s+/g, ' ');
  const match = raw.match(/^(?:(?:circle|buklod)\s+)?(prime elite|buklod prime elite|prime|buklod prime|starter|active|steady|builder|impact|vanguard)\s+(V|IV|III|II|I)$/i);
  if (!match) return null;
  const family = match[1].replace(/^buklod\s+/i,'').toLowerCase() as (typeof RANK_FAMILIES)[number];
  const level = match[2].toUpperCase() as (typeof RANK_LEVELS)[number];
  const familyIndex = RANK_FAMILIES.indexOf(family);
  const levelIndex = RANK_LEVELS.indexOf(level);
  if (familyIndex < 0 || levelIndex < 0) return null;
  return {family,level,index:familyIndex*RANK_ATLAS_COLUMNS+levelIndex,
    color:FAMILY_COLORS[family].border,accent:FAMILY_COLORS[family].accent};
}
