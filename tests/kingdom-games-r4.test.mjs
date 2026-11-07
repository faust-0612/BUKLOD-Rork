import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

import {
  DOMINO_TILES, DOMINO_ROUNDS, createDominoRound, dominoLegalMoves,
  dominoPipSum, dominoChainValid, playDomino, drawDomino,
  passDomino, takeDominoAiTurn,
} from '../src/features/games/elesur/dominoRules.ts';

const tile = (a, b) => DOMINO_TILES.find(t => t.a === Math.min(a, b) && t.b === Math.max(a, b)).id;
const asPlaced = (a, b, id, player = 1) => ({ id, left: a, right: b, player });

test('Domino Village: complete double-six tile set and seeded fair deal', () => {
  assert.equal(DOMINO_TILES.length, 28);
  assert.equal(new Set(DOMINO_TILES.map(t => t.id)).size, 28);
  assert.equal(DOMINO_TILES.filter(t => t.a === t.b).length, 7);
  assert.ok(DOMINO_TILES.every(t => t.a >= 0 && t.b <= 6 && t.a <= t.b));
  assert.equal(DOMINO_ROUNDS, 3);
  for (let r = 0; r < DOMINO_ROUNDS; r++) {
    const state = createDominoRound(r);
    assert.deepEqual(createDominoRound(r), state, 'round must be repeatable');
    assert.equal(state.chain.length, 1);
    assert.equal(state.hands[0].length + state.hands[1].length, 13);
    assert.equal(state.stock.length, 14);
    const ids = [...state.hands[0], ...state.hands[1], ...state.stock, ...state.chain.map(t => t.id)];
    assert.equal(ids.length, 28);
    assert.equal(new Set(ids).size, 28);
    assert.equal(dominoChainValid(state), true);
  }
  assert.throws(() => createDominoRound(-1), /Invalid/);
});

test('Domino Village: legal chain placement keeps source unchanged and turn advances', () => {
  let round = createDominoRound(0);
  if (round.turn === 1) round = takeDominoAiTurn(round);
  while (!round.winner && round.turn === 0 && dominoLegalMoves(round, 0).length === 0 && round.stock.length) {
    round = drawDomino(round, 0);
  }
  assert.equal(round.turn, 0);
  const options = dominoLegalMoves(round, 0);
  if (!options.length) {
    const passed = passDomino(round, 0);
    assert.ok(passed.turn === 1 || passed.winner !== null);
  } else {
    const move = options[0];
    const previous = structuredClone(round);
    const next = playDomino(round, 0, move.id, move.side);
    assert.equal(dominoChainValid(next), true);
    assert.equal(next.chain.length, previous.chain.length + 1);
    assert.equal(next.hands[0].length, previous.hands[0].length - 1);
    assert.equal(previous.hands[0].includes(move.id), true);
    assert.equal(next.hands[0].includes(move.id), false);
    assert.equal(round.chain.length, previous.chain.length, 'no source mutation');
    assert.ok(next.turn === 1 || next.winner !== null);
    assert.throws(() => playDomino(round, 1, move.id, move.side), /not permitted/);
  }
});

test('Domino Village: draw is legal only without matches; blocked round uses lower remaining pips', () => {
  const state = {
    ...createDominoRound(0),
    hands: [[tile(0, 0)], [tile(1, 1)]],
    chain: [asPlaced(6, 6, tile(6, 6))],
    stock: [tile(2, 2)], turn: 0, winner: null, award: { human: 0, ai: 0 },
  };
  assert.equal(dominoLegalMoves(state, 0).length, 0);
  assert.throws(() => passDomino(state, 0), /Pass not allowed/);
  const drawn = drawDomino(state, 0);
  assert.equal(drawn.stock.length, 0);
  assert.equal(drawn.hands[0].length, 2);
  assert.equal(state.hands[0].length, 1);
  assert.equal(dominoLegalMoves(drawn, 0).length, 0);
  const blocked = passDomino(drawn, 0);
  assert.equal(blocked.winner, 'ai');
  assert.equal(blocked.award.ai, 4); // The human has 0-0 (0 pips) and 2-2 (4 pips).
  assert.equal(blocked.award.human, 0);
  assert.equal(dominoChainValid(blocked), true);
  assert.throws(() => drawDomino(blocked, 0), /Cannot draw/);
});

test('Domino Village: player who empties hand wins and earns opponent remaining pips', () => {
  const state = {
    ...createDominoRound(0),
    hands: [[tile(0, 6)], [tile(1, 1), tile(2, 2)]],
    chain: [asPlaced(6, 6, tile(6, 6))],
    stock: [], turn: 0, winner: null, award: { human: 0, ai: 0 },
  };
  const next = playDomino(state, 0, tile(0, 6), 'right');
  assert.equal(dominoChainValid(next), true);
  assert.equal(next.winner, 'human');
  assert.equal(next.award.human, dominoPipSum([tile(1, 1), tile(2, 2)]));
  assert.equal(next.award.human, 6);
  assert.equal(next.hands[0].length, 0);
  assert.equal(state.hands[0].length, 1);
  assert.throws(() => playDomino(next, 0, tile(0, 6), 'left'), /not permitted/);
});

test('Domino Village: AI cannot play illegal chain and yields control in bounded moves', () => {
  for (let level = 0; level < DOMINO_ROUNDS; level++) {
    let round = createDominoRound(level);
    if (round.turn !== 1) {
      // Construct AI turn by swapping turn without changing board to test move legality.
      round = { ...round, turn: 1 };
    }
    const result = takeDominoAiTurn(round);
    assert.equal(dominoChainValid(result), true);
    assert.ok(result.turn === 0 || result.winner !== null);
    assert.ok(result.stock.length <= round.stock.length);
    assert.ok(result.chain.length <= round.chain.length + 1);
    assert.ok(result.hands[1].length >= 0);
  }
});

test('Domino Village: preserve original ELESUR station, economy isolation and unchanged Kingdom map', () => {
  const read = filename => fs.readFileSync(new URL('../' + filename, import.meta.url), 'utf8');
  const map = read('src/features/games/kingdom/BuklodKingdomMap.tsx');
  const blobHash = createHash('sha1').update('blob ' + Buffer.byteLength(map) + '\0').update(map).digest('hex');
  assert.equal(blobHash, '88a4b1b4a70fc4acd59579419058b47f21be2554');
  const route = read('src/app/games/elesur-village-builder.tsx');
  assert.ok(route.includes('VillageBuilderGameV1'));
  assert.ok(route.includes('DominoVillageGameV1'));
  assert.ok(route.includes("gameId={GAME_ID}"));
  const ui = read('src/features/games/elesur/DominoVillageGameV1.tsx');
  assert.ok(ui.includes('reward: { xp: 0, kingdomXp: 0 }'));
  assert.ok(!ui.includes('.rpc('));
  assert.ok(!ui.includes('showBuklodInterstitial'));
});
