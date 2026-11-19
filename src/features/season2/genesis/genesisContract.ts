/**
 * BUKLOD MAIN / Season 2: Genesis — The Beginning.
 * Presentation-only contract. This module must never grant XP, coins, tokens, ranks,
 * collectibles or finance entitlements. Season 1 remains authoritative in production.
 */
export const GENESIS_PALETTE = Object.freeze({
  forest: '#0D2A20',
  deepForest: '#061B16',
  leaf: '#4AB881',
  dawn: '#F5F1DD',
  porcelain: '#FEFCF5',
  gold: '#EAC47B',
  goldLight: '#FFE7AD',
  teal: '#7BD0B2',
  textOnDark: '#F9F7EA',
  line: 'rgba(234,196,123,0.47)',
});

export const GENESIS_MOTION_MS = Object.freeze({
  tap: 130,
  navigation: 180,
  iconAccent: 1600,
  atmosphericDrift: 8500,
  rewardEntrance: 490,
  rewardReveal: 950,
});

export type GenesisSurface =
  | 'home' | 'wall' | 'connect' | 'profile' | 'bible'
  | 'character' | 'kingdom' | 'reward';

export type GenesisQuality = 'full' | 'balanced' | 'minimal';
export interface GenesisMotionContext {
  surface: GenesisSurface;
  quality: GenesisQuality;
  focused: boolean;
  appActive: boolean;
  reducedMotion: boolean;
  powerSave?: boolean;
  videoPlaying?: boolean;
  callActive?: boolean;
}

export function resolveGenesisMotion(context: GenesisMotionContext) {
  const live = context.focused && context.appActive && !context.reducedMotion
    && !context.powerSave && !context.videoPlaying && !context.callActive;
  const ambientSurfaces: GenesisSurface[] = ['home', 'profile', 'character', 'kingdom', 'reward'];
  const ambient = live && context.quality !== 'minimal' && ambientSurfaces.includes(context.surface);
  const particles = ambient && context.quality === 'full' && ['home', 'character', 'kingdom', 'reward'].includes(context.surface);
  const cinematic = live && (context.surface === 'reward' || context.surface === 'kingdom');
  return { ambient, particles, cinematic, essential: !context.reducedMotion };
}

/**
 * Deliberately not a production feature flag. Preview may only run in
 * non-production builds, regardless of a stale OTA environment value.
 * A future explicit audited production authorization must replace this gate.
 */
export function isGenesisPreviewEnabled(
  enabled: string | undefined,
  environment: string | undefined,
): boolean {
  return enabled === 'true' &&
    ['staging', 'preview', 'development', 'dev'].includes((environment ?? '').toLowerCase());
}

export function isGenesisPreviewBuild(): boolean {
  return isGenesisPreviewEnabled(
    process.env.EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW,
    process.env.EXPO_PUBLIC_APP_ENV,
  );
}

export function getGenesisExperience(surface: GenesisSurface) {
  switch (surface) {
    case 'home': return 'living-dawn-hero';
    case 'wall': return 'subtle-line-accents-no-ambient-music';
    case 'connect': return 'fast-motion-no-decorative-loop';
    case 'profile': return 'living-insignia';
    case 'bible': return 'quiet-sacred-reader';
    case 'character': return 'rigged-character-scene';
    case 'kingdom': return 'interactive-world';
    case 'reward': return 'verified-cinematic-reveal';
  }
}
