import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  STARTING_HEARTS, TRAIL_LENGTH, advanceTrail,
  clampLane, encounterDelay, makeTrail, starsForScore,
} from '../src/features/games/jawo/forestTrailEngine.ts';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const initial = () => ({ hearts: STARTING_HEARTS, score: 0, combo: 0, bestCombo: 0, lights: 0 });

test('Jawo three-act game is finite, seeded, replay-variable and every encounter is avoidable', () => {
  assert.equal(TRAIL_LENGTH, 24);
  const first = makeTrail(58320);
  assert.deepEqual(first, makeTrail(58320));
  assert.notDeepEqual(first, makeTrail(91036));
  for (let seed = 0; seed < 64; seed++) {
    const route = makeTrail(seed);
    assert.equal(route.length, TRAIL_LENGTH);
    for (const [index, encounter] of route.entries()) {
      assert.equal(encounter.id, index);
      assert.equal(encounter.intensity, 1 + Math.floor(index / 8));
      assert.ok([0, 1, 2].includes(encounter.obstacleLane));
      assert.ok([0, 1, 2].includes(encounter.lightLane));
      assert.notEqual(encounter.obstacleLane, encounter.lightLane);
      assert.equal([0, 1, 2].filter(lane => lane !== encounter.obstacleLane && lane !== encounter.lightLane).length, 1);
    }
  }
});

test('Jawo score, hearts and rewards obey local-only finite rules', () => {
  const e = makeTrail(25)[0];
  const hit = advanceTrail(initial(), e.obstacleLane, e);
  assert.equal(hit.hearts, 2);
  assert.equal(hit.score, 0);
  assert.equal(hit.combo, 0);
  const collected = advanceTrail(initial(), e.lightLane, e);
  assert.equal(collected.lights, 1);
  assert.equal(collected.score, 149);
  assert.equal(collected.outcome, 'light');
  const safeLane = [0, 1, 2].find(lane => lane !== e.obstacleLane && lane !== e.lightLane);
  const safe = advanceTrail(initial(), safeLane, e);
  assert.equal(safe.score, 61);
  assert.equal(safe.outcome, 'clear');
  assert.equal(safe.lights, 0);
  const last = advanceTrail({ hearts: 1, score: 10, combo: 4, bestCombo: 9, lights: 2 }, e.obstacleLane, e);
  assert.equal(last.hearts, 0);
  assert.equal(last.score, 0);
  assert.equal(last.combo, 0);
  assert.equal(last.bestCombo, 9);
  assert.equal(clampLane(-1), 0);
  assert.equal(clampLane(99), 2);
  assert.deepEqual([899, 900, 1549, 1550, 2249, 2250].map(starsForScore), [0, 1, 1, 2, 2, 3]);
});

test('Jawo obstacles remain telegraphed with bounded increasing difficulty', () => {
  assert.ok(encounterDelay(1) > encounterDelay(2));
  assert.ok(encounterDelay(2) > encounterDelay(3));
  assert.ok(encounterDelay(3) >= 1100);
  const runner = read('src/features/games/jawo/ForestTrailGameV2.tsx');
  assert.match(runner, /encounterCallbackRef\.current\(\)/);
  assert.match(runner, /\[approach, intensity, phase, stepIndex\]/);
  assert.match(runner, /AppState\.addEventListener\('change'/);
  assert.match(runner, /advanceTrail\(/);
  assert.match(runner, /GAME SCORE • NOT REAL POINTS/);
  assert.match(runner, /characterId="jawo"/);
  assert.doesNotMatch(runner, /supabase\.|\.rpc\(/);
});

test('Kingdom map, other two Jawo games, character companion and existing rewards remain', () => {
  const route = read('src/app/games/jawo-forest-trail.tsx');
  for (const token of ['TrailMazeGameV1', 'MatchThreeGameV1', 'ForestTrailGameV2', 'KingdomInteriorCenter', 'BuklodGameStage']) {
    assert.ok(route.includes(token), token);
  }
  assert.match(route, /compactGameId=\{GAME_ID\}/);
  assert.match(route, /showCharacterCompanion=\{activeGameId !== GAME_ID\}/);
  const center = read('src/features/games/kingdom/platform/KingdomInteriorCenter.tsx');
  assert.match(center, /compactGameId\?: string/);
  assert.match(center, /onActiveGameChange\?\.\(option\.id\)/);
  for (const platform of ['web', 'native']) {
    const stage = read(`src/features/games/runtime/BuklodGameStage.${platform}.tsx`);
    assert.match(stage, /showCharacterCompanion = true/);
    assert.match(stage, /showCharacterCompanion \? <BuklodGameCharacterCompanion/);
  }
  const engine = read('src/features/games/jawo/forestTrailEngine.ts');
  assert.doesNotMatch(engine, /supabase\.|\.rpc\(/);
  assert.ok(read('src/features/games/kingdom/platform/KingdomMasteryCheck.tsx').includes('KingdomMasteryCheck'));
});
