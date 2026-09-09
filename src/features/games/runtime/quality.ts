export const BUKLOD_GAME_QUALITY = {
  targetFps: 60,
  frameBudgetMs: 16.67,
  minInteractiveTargetPx: 44,
  inputLatencyGoalMs: 80,
  reducedMotionSupported: true,
  feedback: {
    haptics: true,
    layeredAudio: true,
    particles: true,
    cameraMotion: true,
    screenShake: true,
  },
  renderProfile: 'premium-2d-2.5d',
} as const;

export type BuklodGameBiome =
  | 'forest'
  | 'playground'
  | 'city'
  | 'farm'
  | 'academy'
  | 'music'
  | 'strategy'
  | 'art'
  | 'mission'
  | 'treasury'
  | 'agriculture'
  | 'highlands'
  | 'discovery';
