/**
 * Season 2 Circle Rank avatar visual contract.
 * Order follows the unchanged server ladder: 8 families × V, IV, III, II, I.
 * Visuals never grant points, badges, privileges, cash, or seasonal awards.
 */
export const BUKLOD_CIRCLE_RANK_FAMILIES = [
  'Circle Starter',
  'Circle Active',
  'Circle Steady',
  'Circle Builder',
  'Circle Impact',
  'Circle Vanguard',
  'BUKLOD Prime',
  'BUKLOD Prime Elite',
] as const;

export const BUKLOD_CIRCLE_RANK_LEVELS = ['V', 'IV', 'III', 'II', 'I'] as const;

const RANK_BORDER_COLORS = [
  '#48DE74', // Starter
  '#36BFFF', // Active
  '#B68CFF', // Steady
  '#F4B844', // Builder
  '#22DECF', // Impact
  '#EF6B46', // Vanguard
  '#5B9EFF', // BUKLOD Prime
  '#F2CF63', // Prime Elite
] as const;

export type BuklodCircleRankArt = {
  name: string;
  order: number;
  familyIndex: number;
  levelIndex: number;
  borderColor: string;
};

/** Strict parsing prevents displaying a fabricated rank for missing data. */
export function getBuklodCircleRankArt(value?: string | null): BuklodCircleRankArt | null {
  const normalized = String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  if (!normalized) return null;
  for (let familyIndex = 0; familyIndex < BUKLOD_CIRCLE_RANK_FAMILIES.length; familyIndex++) {
    const family = BUKLOD_CIRCLE_RANK_FAMILIES[familyIndex];
    const prefix = family.toLowerCase() + ' ';
    if (!normalized.startsWith(prefix)) continue;
    const levelIndex = BUKLOD_CIRCLE_RANK_LEVELS.findIndex(level => level.toLowerCase() === normalized.slice(prefix.length));
    if (levelIndex < 0) return null;
    return {
      name: family + ' ' + BUKLOD_CIRCLE_RANK_LEVELS[levelIndex],
      order: familyIndex * 5 + levelIndex + 1,
      familyIndex,
      levelIndex,
      borderColor: RANK_BORDER_COLORS[familyIndex],
    };
  }
  return null;
}
