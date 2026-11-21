/**
 * BUKLOD Empire Arena sound cues — cosmetic and client-only.
 * This file MUST NOT import database, progression, wallet or matchmaking logic.
 * Sound sources are locally packaged by kingdomPremiumAudioAssets.ts.
 */
export const ARENA_MUSIC_ID = Object.freeze({
  genesis_rift: 'quin-discovery-expedition',
  aurora_foundry: 'angel-kingdom-treasury',
  verdant_fracture: 'jawo-forest-trail',
});

// Never voice the entire 10 Hz replay log. Only locally meaningful battle events.
const EVENT_AUDIO = Object.freeze({
  skill: 'unlock',
  dash: 'move',
  defeat: 'impact',
  tower_destroyed: 'impact',
  seal_breached: 'impact',
  level_up: 'unlock',
  buff: 'collect',
  equipment_drop: 'collect',
  equipment_equip: 'success',
  victory: 'success',
  failure: 'failure',
  construction_started: 'collect',
});

export function arenaAudioCueForEvent(event, team = 'A', localSeat = 'A0') {
  if (!event || typeof event.type !== 'string') return null;
  const type = event.type;
  if (type === 'result') {
    return event.winner === team ? 'success' : event.winner == null ? 'failure' : 'failure';
  }
  const cue = EVENT_AUDIO[type];
  if (!cue) return null;
  // Character-triggered effects from other players may be visually represented,
  // but user audio should not become a storm in 5v5.
  if (typeof event.actor === 'string' && event.actor !== localSeat && 
      !['tower_destroyed', 'seal_breached'].includes(type)) return null;
  if (type === 'defeat' && event.to === localSeat) return 'failure';
  return cue;
}

/**
 * Sequence-bounded audio drain; no replay after blur, background, resume,
 * or battle phase changes. Only most recent 3 meaningful events per interval.
 */
export function drainArenaAudioEvents(events, lastSeq, currentSeq, team = 'A', localSeat = 'A0') {
  if (!Array.isArray(events)) return { lastSeq: currentSeq, cues: [] };
  const fresh = events.filter(event => Number.isSafeInteger(event?.seq) && 
    event.seq > lastSeq && event.seq <= currentSeq);
  const cues = fresh.map(event => arenaAudioCueForEvent(event, team, localSeat))
    .filter(Boolean).slice(-3);
  return { lastSeq: currentSeq, cues };
}
