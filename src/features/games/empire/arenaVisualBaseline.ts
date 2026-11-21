/** BUKLOD Season 2 Arena image baseline: art is part of the app source, never a UI mockup.
 * Every local file below is already tracked in the canonical repository.
 * Generated artwork is added here only after the actual bytes are committed and inspected.
 */
import type { ImageSourcePropType } from 'react-native';
import type { BuklodCharacterId } from '@/lib/buklodCharacterSelectionV2';

export const ARENA_VISUAL_BASELINE = 'genesis-arena-inapp-r1' as const;

export const ARENA_HERO_ART: Record<BuklodCharacterId, ImageSourcePropType> = {
  phan: require('../../../../assets/images/characters/phan_r26.jpg'),
  quin: require('../../../../assets/images/characters/quin_r26.jpg'),
  van: require('../../../../assets/images/characters/van_r26.jpg'),
  christian: require('../../../../assets/images/characters/christian_r26.jpg'),
  lhen: require('../../../../assets/images/characters/lhen_r26.jpg'),
  ace: require('../../../../assets/images/characters/special/batch1/ace_hero.jpg'),
  ellusur: require('../../../../assets/images/characters/special/batch1/ellusur_hero.jpg'),
  jawo: require('../../../../assets/images/characters/special/batch1/jawo_hero.jpg'),
  mitch: require('../../../../assets/images/characters/special/batch1/mitch_hero.jpg'),
  niel: require('../../../../assets/images/characters/special/batch1/niel_hero.jpg'),
  angel: require('../../../../assets/images/characters/special/batch1/angel_hero.jpg'),
  vhen: require('../../../../assets/images/characters/special/batch1/vhen_hero.jpg'),
  trudice: require('../../../../assets/images/characters/special/batch1/trudice_hero.jpg'),
};

/** Reuses already-approved BUKLOD art plates; new artwork must be committed and versioned. */
export const ARENA_SCENE_GAME_ID = {
  genesis_rift: 'quin-discovery-expedition',
  aurora_foundry: 'angel-kingdom-treasury',
  verdant_fracture: 'jawo-forest-trail',
} as const;
export type ArenaSceneId = keyof typeof ARENA_SCENE_GAME_ID;
