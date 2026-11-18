/**
 * Season 2 visual-only Circle Rank mapping. Server-side rank/points stay authoritative.
 * One transparent sprite cell per canonical rank, in strict rank_order 1..40.
 */
export const CIRCLE_RANK_FAMILIES = [
  'Starter', 'Active', 'Steady', 'Builder',
  'Impact', 'Vanguard', 'Prime', 'Prime Elite',
] as const;
export const CIRCLE_RANK_LEVELS = ['V', 'IV', 'III', 'II', 'I'] as const;
export const CIRCLE_RANK_BORDERS = [
  '#57DC47', '#49AEFF', '#AF77F8', '#FFAD3C',
  '#24CFC5', '#D74748', '#488FFF', '#B858F5',
] as const;

export type CircleRankArtwork = {
  rankName: string;
  family: string;
  level: string;
  order: number;
  row: number;
  column: number;
  borderColor: string;
};

export function resolveCircleRankArtwork(value?: string | null): CircleRankArtwork | null {
  const input = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!input) return null;
  const level = input.match(/\b(V|IV|III|II|I)$/i)?.[1]?.toUpperCase();
  if (!level) return null;
  const candidate = input
    .replace(/\s+(V|IV|III|II|I)$/i, '')
    .replace(/^(circle|buklod)\s+/i, '')
    .trim().toLowerCase();
  const row = CIRCLE_RANK_FAMILIES.findIndex(family => family.toLowerCase() === candidate);
  const column = CIRCLE_RANK_LEVELS.indexOf(level as typeof CIRCLE_RANK_LEVELS[number]);
  if (row < 0 || column < 0) return null;
  const family = CIRCLE_RANK_FAMILIES[row];
  return {
    rankName: (row < 6 ? 'Circle ' : 'BUKLOD ') + family + ' ' + level,
    family,
    level,
    order: row * 5 + column + 1,
    row,
    column,
    borderColor: CIRCLE_RANK_BORDERS[row],
  };
}
