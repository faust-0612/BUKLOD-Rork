/**
 * Season 2 Genesis visual identity tokens.
 *
 * DESIGN PREPARATION ONLY. This module deliberately has NO activation hook,
 * clock trigger, reward reference, API call, or production entrypoint.
 * Season 2 production remains embargoed until separately approved.
 */
export const GENESIS_SEASON2_VISUALS = {
  id: 'genesis-first-light',
  officialWorkingTitle: 'GENESIS — THE FIRST LIGHT',
  subtitle: 'Season 2 · A new beginning, growing together',
  earliestProductionDatePht: '2026-12-06',
  defaultDecoration: 'firstLight',
  colors: {
    nightSky: '#102C3D',
    dawnGreen: '#1F7656',
    sunriseGold: '#E7B861',
    morningMist: '#F6F7F0',
    horizonBlue: '#79B8D2',
    textOnDark: '#FFFFFF',
  },
  motifs: ['firstLight', 'livingRoots', 'linkedPaths'],
} as const;

/** Decorations compose over a user's chosen color palette, never replace it. */
export type BuklodGenesisMotif =
  typeof GENESIS_SEASON2_VISUALS.motifs[number];

/**
 * Future user preference: auto means show the authorized seasonal skin only
 * when the release flag and launch gates both permit it. 'off' keeps palettes.
 * None of these values currently activates the Season 2 UI.
 */
export type BuklodSeasonalDecorationPreference =
  'auto' | 'on' | 'off';

/** Local, static lightweight line artwork only — no animations or downloads. */
export const GENESIS_ART_PERFORMANCE = {
  pointerEvents: 'none',
  offscreenAnimation: false,
  maxDecorativeOpacity: 0.18,
  avoid: ['ad slots', 'text inputs', 'reading body', 'photo/video overlays'],
} as const;
