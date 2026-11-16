/** Audio/motion contracts for the LOCAL, non-credit Kingdom adventure.
 * Uses already bundled CC0 Kingdom SFX; no random reward or new entitlement.
 */
export type AdventureCue = 'chapter' | 'practice' | 'gift' | 'relic' | 'refine' | 'gate' | 'ascend' | 'badge' | 'invalid';
export type PremiumSfxKey = 'enter' | 'collect-crystal' | 'coins' | 'unlock' | 'victory' | 'victory-alt' | 'ui-soft' | 'failure';
export const ADVENTURE_CUE_SOUND: Readonly<Record<AdventureCue, PremiumSfxKey>> = {
  chapter: 'enter',
  practice: 'collect-crystal',
  gift: 'coins',
  relic: 'unlock',
  refine: 'ui-soft',
  gate: 'victory',
  ascend: 'victory-alt',
  badge: 'victory-alt',
  invalid: 'failure',
};
export const ADVENTURE_CUE_LABEL: Readonly<Record<Exclude<AdventureCue, 'invalid'>, string>> = {
  chapter: 'NEW STORY UNLOCKED',
  practice: 'PRACTICE MASTERED',
  gift: 'BOND DEEPENED',
  relic: 'RELIC AWAKENED',
  refine: 'MEMORY DUST CREATED',
  gate: 'STORY GATE OPENED',
  ascend: 'ASCENSION COMPLETE',
  badge: 'NEW BADGE TIER',
};
/** Bound duration and particles; effects never mint items or affect official ranks. */
export const ADVENTURE_MOTION = Object.freeze({
  idleDurationMs: 3000,
  celebrationDurationMs: 760,
  sparkCount: 6,
  maximumActiveSounds: 4,
  minimumSoundIntervalMs: 140,
});
export function cueForAdventureAction(type: string): AdventureCue {
  switch (type) {
    case 'chapter': return 'chapter';
    case 'practice': return 'practice';
    case 'gift': return 'gift';
    case 'craft':
    case 'exchange': return 'relic';
    case 'refine': return 'refine';
    case 'gate': return 'gate';
    case 'ascend': return 'ascend';
    default: return 'invalid';
  }
}
