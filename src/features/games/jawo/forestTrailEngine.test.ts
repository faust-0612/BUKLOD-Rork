import {
  STARTING_HEARTS, TRAIL_LENGTH, advanceTrail, clampLane,
  encounterDelay, makeTrail, starsForScore,
} from './forestTrailEngine';

const initial = () => ({ hearts: STARTING_HEARTS, score: 0, combo: 0, bestCombo: 0, lights: 0 });

describe('Jawo Forest Trail gameplay engine', () => {
  test('seeds are reproducible, retries vary, and all 24 encounters have a safe lane', () => {
    const route = makeTrail(12345);
    expect(route).toEqual(makeTrail(12345));
    expect(route).not.toEqual(makeTrail(98765));
    expect(route).toHaveLength(TRAIL_LENGTH);
    route.forEach((step, index) => {
      expect(step.id).toBe(index);
      expect(step.obstacleLane).not.toBe(step.lightLane);
      const lanes = [0, 1, 2];
      expect(lanes.filter(lane => lane !== step.obstacleLane && lane !== step.lightLane)).toHaveLength(1);
      expect(step.intensity).toBe((Math.floor(index / 8) + 1));
    });
  });

  test('the approach window remains usable as difficulty increases', () => {
    expect(encounterDelay(1)).toBeGreaterThan(encounterDelay(2));
    expect(encounterDelay(2)).toBeGreaterThan(encounterDelay(3));
    expect(encounterDelay(3)).toBeGreaterThanOrEqual(1000);
  });

  test('hit loses exactly one heart without making score negative', () => {
    const step = makeTrail(555)[0];
    const next = advanceTrail(initial(), step.obstacleLane, step);
    expect(next.outcome).toBe('impact');
    expect(next.hearts).toBe(2);
    expect(next.score).toBe(0);
    expect(next.combo).toBe(0);
  });

  test('light and clear lanes both build combo but only lights collect', () => {
    const step = makeTrail(777)[0];
    const light = advanceTrail(initial(), step.lightLane, step);
    const safeLane = ([0, 1, 2] as const).find(l => l !== step.obstacleLane && l !== step.lightLane)!;
    const clear = advanceTrail(initial(), safeLane, step);
    expect(light.outcome).toBe('light');
    expect(light.lights).toBe(1);
    expect(light.combo).toBe(1);
    expect(light.score).toBeGreaterThan(clear.score);
    expect(clear.outcome).toBe('clear');
    expect(clear.lights).toBe(0);
    expect(clear.combo).toBe(1);
  });

  test('hits end a run at zero hearts and preserve high combo', () => {
    const step = makeTrail(444)[0];
    const next = advanceTrail({ hearts: 1, score: 30, combo: 4, bestCombo: 7, lights: 3 }, step.obstacleLane, step);
    expect(next.hearts).toBe(0);
    expect(next.score).toBe(0);
    expect(next.combo).toBe(0);
    expect(next.bestCombo).toBe(7);
  });

  test('lane boundaries and star thresholds stay compatible with original rewards', () => {
    expect(clampLane(-10)).toBe(0);
    expect(clampLane(9)).toBe(2);
    expect(starsForScore(899)).toBe(0);
    expect(starsForScore(900)).toBe(1);
    expect(starsForScore(1550)).toBe(2);
    expect(starsForScore(2250)).toBe(3);
  });
});
