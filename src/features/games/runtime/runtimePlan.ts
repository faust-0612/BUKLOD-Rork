import type { BuklodGameBiome } from './quality';
import type { BuklodGameExperienceProfile } from './experience';
import { PREMIUM_ADVENTURE_PROFILE, PREMIUM_PUZZLE_PROFILE } from './experience';

export type BuklodRuntimePlan = {
  biome: BuklodGameBiome;
  profile: BuklodGameExperienceProfile;
  gameplayStyle: 'adventure' | 'puzzle' | 'rhythm' | 'strategy' | 'management';
};

export const BUKLOD_RUNTIME_PLANS: Record<string, BuklodRuntimePlan> = {
  jawo: {
    biome: 'forest',
    profile: PREMIUM_ADVENTURE_PROFILE,
    gameplayStyle: 'adventure',
  },
  trudice: {
    biome: 'playground',
    profile: PREMIUM_PUZZLE_PROFILE,
    gameplayStyle: 'puzzle',
  },
};
