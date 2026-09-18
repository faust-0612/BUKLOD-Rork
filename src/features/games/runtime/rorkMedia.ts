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

// Painted Rork plates are read from the stable public asset CDN rather than
// the ephemeral live-preview host. They remain enhancement-only: the shipped
// gameplay scene remains usable if media is unavailable.
const BG = {
  village: 'https://r2-pub.rork.com/projects/kp3ge50a5t6chyb7gv3jn/assets/3f5d9d55-e7dd-457b-8263-8a552cfad196.png',
  forest: 'https://r2-pub.rork.com/projects/kp3ge50a5t6chyb7gv3jn/assets/466950a3-d8c9-470d-a13c-847fcbcefe5e.png',
  harvest: 'https://r2-pub.rork.com/projects/kp3ge50a5t6chyb7gv3jn/assets/06893c0e-1dca-476f-94c8-c0e8923f33d8.png',
  citadel: 'https://r2-pub.rork.com/projects/kp3ge50a5t6chyb7gv3jn/assets/2d616eb4-e5a0-43b5-bddf-f35709a684d6.png',
  resonance: 'https://r2-pub.rork.com/projects/kp3ge50a5t6chyb7gv3jn/assets/3826a0d1-f060-486d-8648-c8a092232a9a.png',
  treasury: 'https://r2-pub.rork.com/projects/kp3ge50a5t6chyb7gv3jn/assets/02d290ce-4f4c-41ea-9507-19bf23a3acc9.png',
  frontier: 'https://r2-pub.rork.com/projects/kp3ge50a5t6chyb7gv3jn/assets/86c46583-17f8-4313-a175-0601cb4165e7.png',
  harbour: 'https://r2-pub.rork.com/projects/kp3ge50a5t6chyb7gv3jn/assets/4734fd77-4dc6-40e3-a405-d792bc1b6675.png',
  ruins: 'https://r2-pub.rork.com/projects/kp3ge50a5t6chyb7gv3jn/assets/7b7ca700-de35-49ab-bf6e-2f8f5a515c28.png',
  council: 'https://r2-pub.rork.com/projects/kp3ge50a5t6chyb7gv3jn/assets/c0efd678-84b4-4676-8028-9ac154dc0ec9.png',
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
