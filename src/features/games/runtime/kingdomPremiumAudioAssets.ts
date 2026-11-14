/**
 * Premium Kingdom soundtrack: real CC0 orchestral recordings and Kenney CC0 SFX,
 * vendored and SHA-verified locally. Never request live-preview host audio.
 * Bundled assets must remain available offline in the staging APK/OTA.
 */
import type { RorkAudioKey } from './rorkMedia';

const MUSIC = {
  adventure: require('../../../../assets/sounds/kingdom-premium/kingdom-theme.ogg'),
  village: require('../../../../assets/sounds/kingdom-premium/kingdom-village.ogg'),
  hall: require('../../../../assets/sounds/kingdom-premium/kingdom-great-hall.ogg'),
} as const;

const SFX = {
  ui_tap: require('../../../../assets/sounds/kingdom-premium/ui-soft.wav'),
  ui_confirm: require('../../../../assets/sounds/kingdom-premium/enter.wav'),
  game_enter: require('../../../../assets/sounds/kingdom-premium/enter.wav'),
  unlock: require('../../../../assets/sounds/kingdom-premium/unlock.wav'),
  success: require('../../../../assets/sounds/kingdom-premium/victory.wav'),
  retry: require('../../../../assets/sounds/kingdom-premium/failure.wav'),
  pickup: require('../../../../assets/sounds/kingdom-premium/collect-crystal.wav'),
  coins: require('../../../../assets/sounds/kingdom-premium/coins.wav'),
  beat_hit: require('../../../../assets/sounds/kingdom-premium/ui-soft.wav'),
  beat_combo: require('../../../../assets/sounds/kingdom-premium/victory-alt.wav'),
  mission_go: require('../../../../assets/sounds/kingdom-premium/enter.wav'),
  build_hit: require('../../../../assets/sounds/kingdom-premium/impact-wood.wav'),
} as const;

/** Regional orchestration; map has its own signature theme. */
export function getPremiumKingdomMusic(gameId?: string | null, region?: RorkAudioKey | null): number {
  if (gameId === 'kingdom-map') return MUSIC.adventure;
  if (region === 'amb_market' || region === 'amb_harbour') return MUSIC.village;
  if (region === 'amb_hall') return MUSIC.hall;
  return MUSIC.adventure;
}

export function getPremiumKingdomSfx(key: RorkAudioKey): number | null {
  return Object.prototype.hasOwnProperty.call(SFX, key)
    ? SFX[key as keyof typeof SFX]
    : null;
}
