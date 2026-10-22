export type BuklodGameExperienceProfile = {
  camera: 'static' | 'follow' | 'cinematic';
  environmentMotion: 'low' | 'medium' | 'high';
  particles: boolean;
  layeredAudio: boolean;
  haptics: boolean;
  characterStateMachine: boolean;
  persistentWorldChange: boolean;
};

export const PREMIUM_ADVENTURE_PROFILE: BuklodGameExperienceProfile = {
  camera: 'cinematic',
  environmentMotion: 'high',
  particles: true,
  layeredAudio: true,
  haptics: true,
  characterStateMachine: true,
  persistentWorldChange: true,
};

export const PREMIUM_PUZZLE_PROFILE: BuklodGameExperienceProfile = {
  camera: 'follow',
  environmentMotion: 'medium',
  particles: true,
  layeredAudio: true,
  haptics: true,
  characterStateMachine: true,
  persistentWorldChange: true,
};
