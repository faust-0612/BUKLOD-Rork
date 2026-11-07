import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import {
  MATCH_LEVELS, createMatch3Round, match3Matches,
  match3LegalSwaps, performMatch3Swap,
} from '../src/features/games/kingdom/platform/matchThreeRules.ts';

const IDS = ['phan-market-match', 'jawo-nature-match', 'vhen-harvest-match'];

test('Kingdom R8: each of 3 themes has 3 deterministic playable 7x7 boards and no automatic matches', () => {
  for (const id of IDS) {
    assert.equal(MATCH_LEVELS[id].length, 3);
    for (let level = 0; level < 3; level++) {
      const round = createMatch3Round(id, level);
      assert.deepEqual(createMatch3Round(id, level), round);
      assert.equal(round.board.length, 7);
      assert.ok(round.board.every(row => row.length === 7 && row.every(v => Number.isInteger(v) && v >= 0 && v <= 4)));
      assert.equal(match3Matches(round.board).length, 0, 'no matches before player input');
      assert.ok(match3LegalSwaps(round.board).length > 0, 'at least one move available');
      assert.equal(round.collected.length, 5);
      assert.equal(round.goals.length, 5);
      assert.equal(round.status, 'playing');
    }
  }
  assert.throws(() => createMatch3Round('phan-market-match', -1), /Invalid/);
  assert.throws(() => createMatch3Round('phan-market-match', 3), /Invalid/);
});

test('Kingdom R8: only adjacent matching swaps consume moves; originals remain immutable', () => {
  for (const id of IDS) {
    const original = createMatch3Round(id, 0);
    const a = original.board.map(line => [...line]);
    assert.equal(performMatch3Swap(original, { row: 0, col: 0 }, { row: 4, col: 4 }), original);
    assert.equal(performMatch3Swap(original, { row: -1, col: 0 }, { row: 0, col: 0 }), original);
    const swap = match3LegalSwaps(original.board)[0];
    const next = performMatch3Swap(original, swap.from, swap.to);
    assert.notEqual(next, original);
    assert.deepEqual(original.board, a, 'do not mutate original grid');
    assert.equal(next.movesLeft, original.movesLeft - 1);
    assert.ok(next.score >= 135);
    assert.ok(next.cascades >= 1);
    assert.ok(next.collected.reduce((sum, n) => sum + n, 0) >= 3);
    assert.equal(match3Matches(next.board).length, 0, 'all cascades resolved before rendering');
    if (next.status === 'playing')
      assert.ok(match3LegalSwaps(next.board).length > 0, 'no stuck board');
  }
});

test('Kingdom R8: game loops have bounded moves, deterministic results, valid no-dead-end reshuffles', () => {
  for (const id of IDS) {
    const a = createMatch3Round(id, 0);
    let run = a;
    const picks = [];
    for (let i = 0; i < 30 && run.status === 'playing'; i++) {
      const options = match3LegalSwaps(run.board);
      assert.ok(options.length > 0);
      const best = options[0];
      picks.push(best);
      const next = performMatch3Swap(run, best.from, best.to);
      assert.notEqual(next, run);
      assert.ok(next.movesLeft >= 0 && next.movesLeft < run.movesLeft);
      assert.equal(match3Matches(next.board).length, 0);
      run = next;
    }
    assert.ok(run.status === 'won' || run.status === 'lost', 'finite gameplay');
    let replay = createMatch3Round(id, 0);
    for (const move of picks) replay = performMatch3Swap(replay, move.from, move.to);
    assert.deepEqual(replay, run, 'no nondeterministic refills or score');
    assert.throws(() => performMatch3Swap(run, { row: 0, col: 0 }, { row: 0, col: 1 }), /ended/);
  }
});

test('Kingdom R8: three original character stations are retained and score stays local', () => {
  const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const cases = [
    ['src/app/games/phan-enterprise-builder.tsx', 'EnterpriseBuilderGameV1', 'phan-market-match'],
    ['src/app/games/jawo-forest-trail.tsx', 'ForestTrailGameV2', 'jawo-nature-match'],
    ['src/app/games/vhen-farm-to-market.tsx', 'FarmToMarketGameV1', 'vhen-harvest-match'],
  ];
  for (const [path, original, id] of cases) {
    const file = read(path);
    assert.ok(file.includes('KingdomInteriorCenter'));
    assert.ok(file.includes(original));
    assert.ok(file.includes(id));
    assert.ok(file.includes('BuklodGameStage'));
  }
  const ui = read('src/features/games/kingdom/platform/MatchThreeGameV1.tsx');
  assert.ok(ui.includes('reward: { xp: 0, kingdomXp: 0 }'));
  assert.ok(!ui.includes('supabase.'));
  assert.ok(!ui.includes('showBuklodInterstitial'));
  const map = read('src/features/games/kingdom/BuklodKingdomMap.tsx');
  assert.equal(createHash('sha1').update('blob ' + Buffer.byteLength(map) + '\0').update(map).digest('hex'),
    '88a4b1b4a70fc4acd59579419058b47f21be2554');
  const catalog = JSON.parse(read('src/features/games/kingdom/platform/game-catalog.json'));
  const games = catalog.characters.flatMap(x => x.games);
  assert.equal(catalog.characters.length, 13);
  assert.equal(games.length, 39);
  assert.equal(games.filter(x => x.status === 'existing').length, 13);
  assert.equal(games.filter(x => x.status === 'pilot').length, 12);
  assert.equal(games.filter(x => x.status === 'planned').length, 14);
});
