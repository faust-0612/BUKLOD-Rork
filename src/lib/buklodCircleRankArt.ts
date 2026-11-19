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
  ['#B47F42', '#C2D3D7', '#7CCB82', '#BAE75C', '#F5DA61'], // Starter: bronze to radiant
  ['#397CBB', '#72B7EA', '#30B6FF', '#66CAFF', '#F0CD6A'], // Active: steel to sapphire gold
  ['#8B62B4', '#9D77D2', '#B476E8', '#CC91FF', '#EDD3FF'], // Steady: violet to crystalline
  ['#B77724', '#D79231', '#EDAD36', '#FFD16E', '#FFE8A8'], // Builder: bronze to gilded
  ['#1D958A', '#5AB4AC', '#4ED4BF', '#91E1D6', '#F3CE63'], // Impact: sea green to aurora
  ['#B74444', '#D26049', '#F08145', '#F0AF60', '#FFE49A'], // Vanguard: ember to golden
  ['#365BB2', '#577ECD', '#56A9E6', '#83CAFF', '#FAD77A'], // Prime: cobalt to royal
  ['#76509D', '#A18BCB', '#C79AE9', '#E8B0F6', '#FFE69C'], // Prime Elite: amethyst to celestial
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
    // Prime Elite shares the Prime prefix: keep checking the longer family.
    if (levelIndex < 0) continue;
    return {
      name: family + ' ' + BUKLOD_CIRCLE_RANK_LEVELS[levelIndex],
      order: familyIndex * 5 + levelIndex + 1,
      familyIndex,
      levelIndex,
      borderColor: RANK_BORDER_COLORS[familyIndex][levelIndex],
    };
  }
  return null;
}
