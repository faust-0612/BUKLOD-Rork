/**
 * Muted, accessible accents for informational cards and secondary actions.
 * Color is supplementary: labels, membership state, and actions stay explicit.
 */
export type BuklodCardToneName =
  | 'mint'
  | 'sky'
  | 'lavender'
  | 'amber'
  | 'peach'
  | 'teal';

export type BuklodCardTone = Readonly<{
  surface: string;
  border: string;
  ink: string;
  action: string;
  soft: string;
}>;

const LIGHT: Record<BuklodCardToneName, BuklodCardTone> = {
  mint: { surface: '#EFF9F2', border: '#B9DEC9', ink: '#195B3C', action: '#176443', soft: '#DAF1E2' },
  sky: { surface: '#EEF6FF', border: '#BFDAF4', ink: '#194F80', action: '#245A91', soft: '#DCEEFF' },
  lavender: { surface: '#F5F0FF', border: '#D8C9F2', ink: '#594185', action: '#62498D', soft: '#E9E0FA' },
  amber: { surface: '#FFF7E9', border: '#EAD4A8', ink: '#78511D', action: '#80541B', soft: '#FFEDCA' },
  peach: { surface: '#FFF1EC', border: '#F0C9BB', ink: '#883E2B', action: '#93442F', soft: '#FFE2D8' },
  teal: { surface: '#ECF9F9', border: '#B8E0E0', ink: '#175F64', action: '#16676C', soft: '#D6F0EF' },
};

const DARK: Record<BuklodCardToneName, BuklodCardTone> = {
  mint: { surface: '#1B332A', border: '#385B49', ink: '#E0F7E7', action: '#176443', soft: '#294B39' },
  sky: { surface: '#1E3043', border: '#3C5875', ink: '#E0F0FF', action: '#245A91', soft: '#2B4360' },
  lavender: { surface: '#30283F', border: '#605275', ink: '#F1E7FF', action: '#62498D', soft: '#45345B' },
  amber: { surface: '#3A3122', border: '#685638', ink: '#FFF0CE', action: '#80541B', soft: '#4D3E29' },
  peach: { surface: '#3C2A28', border: '#6A4640', ink: '#FFE8DE', action: '#93442F', soft: '#523731' },
  teal: { surface: '#1E3638', border: '#3B6366', ink: '#E1F8F8', action: '#16676C', soft: '#2B4D50' },
};

export function getBuklodCardTone(
  tone: BuklodCardToneName,
  dark = false,
): BuklodCardTone {
  return (dark ? DARK : LIGHT)[tone];
}

export function isBuklodDarkPaletteId(paletteId: string): boolean {
  return paletteId === 'graphite'
    || paletteId === 'nightPine'
    || paletteId === 'midnight';
}

/** Stable across reorder/filter refreshes; no randomized colors on rerender. */
export function getStableBuklodCardTone(key: string): BuklodCardToneName {
  const tones: BuklodCardToneName[] = ['sky', 'mint', 'lavender', 'peach', 'teal', 'amber'];
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (Math.imul(hash, 31) + key.charCodeAt(i)) | 0;
  }
  return tones[(hash >>> 0) % tones.length];
}
