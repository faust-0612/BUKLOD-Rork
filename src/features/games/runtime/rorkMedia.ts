export type RorkAudioKey =
  | 'ui_tap'
  | 'ui_confirm'
  | 'game_enter'
  | 'unlock'
  | 'success'
  | 'retry'
  | 'pickup'
  | 'coins'
  | 'beat_hit'
  | 'beat_combo'
  | 'mission_go'
  | 'build_hit'
  | 'amb_forest'
  | 'amb_market'
  | 'amb_harbour'
  | 'amb_hall'
  | 'amb_desert';

export type RorkGameMedia = {
  background: number;
  ambience: RorkAudioKey;
  signature: RorkAudioKey;
  accent: string;
};

export const RORK_AUDIO: Record<RorkAudioKey, number> = {
  ui_tap: require('../../../../assets/kingdom/rork/audio/ui_tap.mp3'),
  ui_confirm: require('../../../../assets/kingdom/rork/audio/ui_confirm.mp3'),
  game_enter: require('../../../../assets/kingdom/rork/audio/game_enter.mp3'),
  unlock: require('../../../../assets/kingdom/rork/audio/unlock.mp3'),
  success: require('../../../../assets/kingdom/rork/audio/success.mp3'),
  retry: require('../../../../assets/kingdom/rork/audio/retry.mp3'),
  pickup: require('../../../../assets/kingdom/rork/audio/pickup.mp3'),
  coins: require('../../../../assets/kingdom/rork/audio/coins.mp3'),
  beat_hit: require('../../../../assets/kingdom/rork/audio/beat_hit.mp3'),
  beat_combo: require('../../../../assets/kingdom/rork/audio/beat_combo.mp3'),
  mission_go: require('../../../../assets/kingdom/rork/audio/mission_go.mp3'),
  build_hit: require('../../../../assets/kingdom/rork/audio/build_hit.mp3'),
  amb_forest: require('../../../../assets/kingdom/rork/audio/amb_forest.mp3'),
  amb_market: require('../../../../assets/kingdom/rork/audio/amb_market.mp3'),
  amb_harbour: require('../../../../assets/kingdom/rork/audio/amb_harbour.mp3'),
  amb_hall: require('../../../../assets/kingdom/rork/audio/amb_hall.mp3'),
  amb_desert: require('../../../../assets/kingdom/rork/audio/amb_desert.mp3'),
};

const BG = {
  citadel: require('../../../../assets/kingdom/rork/bg/citadel_hall.webp'),
  council: require('../../../../assets/kingdom/rork/bg/council_terrace.webp'),
  forest: require('../../../../assets/kingdom/rork/bg/forest_trail.webp'),
  frontier: require('../../../../assets/kingdom/rork/bg/frontier_camp.webp'),
  harbour: require('../../../../assets/kingdom/rork/bg/harbour_quay.webp'),
  harvest: require('../../../../assets/kingdom/rork/bg/harvest_terrace.webp'),
  resonance: require('../../../../assets/kingdom/rork/bg/resonance_stage.webp'),
  ruins: require('../../../../assets/kingdom/rork/bg/sunspire_ruins.webp'),
  treasury: require('../../../../assets/kingdom/rork/bg/treasury_vault.webp'),
  village: require('../../../../assets/kingdom/rork/bg/village_yard.webp'),
} as const;

export const RORK_GAME_MEDIA: Record<string, RorkGameMedia> = {
  'jawo-forest-trail': { background: BG.forest, ambience: 'amb_forest', signature: 'pickup', accent: '#5db675' },
  'trudice-playground-memory': { background: BG.village, ambience: 'amb_market', signature: 'ui_confirm', accent: '#cf7fba' },
  'ace-rescue-grid': { background: BG.council, ambience: 'amb_hall', signature: 'ui_confirm', accent: '#5aa4c4' },
  'mitch-restore-mural': { background: BG.village, ambience: 'amb_market', signature: 'ui_confirm', accent: '#d4866c' },
  'niel-mission-trail': { background: BG.frontier, ambience: 'amb_forest', signature: 'mission_go', accent: '#8fa66d' },
  'angel-kingdom-treasury': { background: BG.treasury, ambience: 'amb_hall', signature: 'coins', accent: '#d6a842' },
  'vhen-farm-to-market': { background: BG.harvest, ambience: 'amb_market', signature: 'pickup', accent: '#9fb34f' },
  'elesur-village-builder': { background: BG.village, ambience: 'amb_market', signature: 'build_hit', accent: '#7c9d91' },
  'phan-enterprise-builder': { background: BG.harbour, ambience: 'amb_harbour', signature: 'build_hit', accent: '#4fa6b8' },
  'van-living-city-dispatch': { background: BG.harbour, ambience: 'amb_harbour', signature: 'ui_confirm', accent: '#4a9cac' },
  'christian-civic-leadership': { background: BG.council, ambience: 'amb_hall', signature: 'ui_confirm', accent: '#728cc7' },
  'lhen-rhythm-journey': { background: BG.resonance, ambience: 'amb_hall', signature: 'beat_hit', accent: '#c45ba7' },
  'quin-discovery-expedition': { background: BG.ruins, ambience: 'amb_desert', signature: 'pickup', accent: '#7f91d6' },
};

export function getRorkGameMedia(gameId?: string | null) {
  if (!gameId) return null;
  return RORK_GAME_MEDIA[gameId] ?? null;
}
