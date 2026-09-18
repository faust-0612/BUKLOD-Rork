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
  background: string;
  ambience: RorkAudioKey;
  signature: RorkAudioKey;
  accent: string;
};

const RORK_PUBLIC_BASE = 'https://kp3ge50a5t6chyb7gv3jn-web.rork.live/kingdom';
const AUDIO_BASE = `${RORK_PUBLIC_BASE}/audio`;
const BG_BASE = `${RORK_PUBLIC_BASE}/bg`;

export const RORK_AUDIO: Record<RorkAudioKey, string> = {
  ui_tap: `${AUDIO_BASE}/ui_tap.mp3`,
  ui_confirm: `${AUDIO_BASE}/ui_confirm.mp3`,
  game_enter: `${AUDIO_BASE}/game_enter.mp3`,
  unlock: `${AUDIO_BASE}/unlock.mp3`,
  success: `${AUDIO_BASE}/success.mp3`,
  retry: `${AUDIO_BASE}/retry.mp3`,
  pickup: `${AUDIO_BASE}/pickup.mp3`,
  coins: `${AUDIO_BASE}/coins.mp3`,
  beat_hit: `${AUDIO_BASE}/beat_hit.mp3`,
  beat_combo: `${AUDIO_BASE}/beat_combo.mp3`,
  mission_go: `${AUDIO_BASE}/mission_go.mp3`,
  build_hit: `${AUDIO_BASE}/build_hit.mp3`,
  amb_forest: `${AUDIO_BASE}/amb_forest.mp3`,
  amb_market: `${AUDIO_BASE}/amb_market.mp3`,
  amb_harbour: `${AUDIO_BASE}/amb_harbour.mp3`,
  amb_hall: `${AUDIO_BASE}/amb_hall.mp3`,
  amb_desert: `${AUDIO_BASE}/amb_desert.mp3`,
};

// The Rork project serves its compressed WebP plates directly. These are
// enhancement-only sources; the shipped game scene remains fully usable if
// the network/CDN is unavailable. The exported prototype ZIP is preserved as
// the vendoring source for a future fully-local asset pass.
const BG = {
  village: `${BG_BASE}/village_yard.webp`,
  forest: `${BG_BASE}/forest_trail.webp`,
  harvest: `${BG_BASE}/harvest_terrace.webp`,
  citadel: `${BG_BASE}/citadel_hall.webp`,
  resonance: `${BG_BASE}/resonance_stage.webp`,
  treasury: `${BG_BASE}/treasury_vault.webp`,
  frontier: `${BG_BASE}/frontier_camp.webp`,
  harbour: `${BG_BASE}/harbour_quay.webp`,
  ruins: `${BG_BASE}/sunspire_ruins.webp`,
  council: `${BG_BASE}/council_terrace.webp`,
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
