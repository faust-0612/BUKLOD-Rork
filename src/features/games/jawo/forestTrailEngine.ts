/** Pure and deterministic Jawo Forest Trail rules. No Points/database writes. */
export type Lane = 0 | 1 | 2;
export type Encounter = {
  id: number;
  obstacleLane: Lane;
  lightLane: Lane;
  name: string;
  intensity: 1 | 2 | 3;
};

export type TrailTotals = {
  hearts: number;
  score: number;
  combo: number;
  bestCombo: number;
  lights: number;
};

export type TrailOutcome = 'impact' | 'light' | 'clear';
export const STARTING_HEARTS = 3;
export const TRAIL_LENGTH = 24;

const ZONES = [
  'Forest Edge',
  'Fern Corridor',
  'Creek Bend',
  'Whispering Pines',
  'Moss Crossing',
  'Hidden Grove',
  'Old Ranger Trail',
  'Ancient Tree Path',
  'Firefly Hollow',
] as const;

// Each run has 3 acts. Every encounter has exactly one obstacle lane,
// one collectible lane, and one safe lane; nothing becomes unavoidable.
export function makeTrail(seed: number): Encounter[] {
  let value = seed >>> 0;
  const randomLane = (): Lane => {
    value = (Math.imul(1664525, value) + 1013904223) >>> 0;
    return (value % 3) as Lane;
  };
  return Array.from({ length: TRAIL_LENGTH }, (_, index) => {
    const obstacleLane = randomLane();
    const offset = 1 + (randomLane() % 2);
    return {
      id: index,
      obstacleLane,
      lightLane: ((obstacleLane + offset) % 3) as Lane,
      name: ZONES[Math.floor(index / 3) % ZONES.length],
      intensity: (1 + Math.floor(index / 8)) as 1 | 2 | 3,
    };
  });
}

export function advanceTrail(totals: TrailTotals, lane: Lane, encounter: Encounter): TrailTotals & { outcome: TrailOutcome } {
  const next = { ...totals };
  let outcome: TrailOutcome;
  if (lane === encounter.obstacleLane) {
    outcome = 'impact';
    next.hearts = Math.max(0, next.hearts - 1);
    next.combo = 0;
    next.score = Math.max(0, next.score - 70);
  } else if (lane === encounter.lightLane) {
    outcome = 'light';
    next.combo += 1;
    next.lights += 1;
    next.score += 135 + Math.min(160, next.combo * 14);
  } else {
    outcome = 'clear';
    next.combo += 1;
    next.score += 55 + Math.min(75, next.combo * 6);
  }
  next.bestCombo = Math.max(next.bestCombo, next.combo);
  return { ...next, outcome };
}

export function starsForScore(score: number): 0 | 1 | 2 | 3 {
  if (score >= 2250) return 3;
  if (score >= 1550) return 2;
  if (score >= 900) return 1;
  return 0;
}

export const clampLane = (value: number): Lane => Math.max(0, Math.min(2, value)) as Lane;

export function encounterDelay(intensity: 1 | 2 | 3): number {
  if (intensity === 3) return 1150;
  if (intensity === 2) return 1380;
  return 1650;
}
