import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

import {
  BLOCK_SIZE, BLOCK_TARGET, blockHand, emptyBlockBoard, createBlockState,
  canPlaceBlock, hasBlockMove, placeBlock,
} from '../src/features/games/mitch/blockForgeRules.ts';
import {
  SCRIPTURE_WORD_LEVELS, makeScriptureWordPuzzle,
  readScriptureWordLine, scriptureWordAt,
} from '../src/features/games/christian/scriptureWordRules.ts';

test('Kingdom Block Forge: initial 8x8 state, legal hand and stable generation', () => {
  const state = createBlockState();
  assert.equal(state.board.length, BLOCK_SIZE);
  assert.ok(state.board.every(row => row.length === BLOCK_SIZE && row.every(v => v === 0)));
  assert.deepEqual(state.hand, blockHand(0));
  assert.deepEqual(blockHand(19), blockHand(19));
  assert.equal(state.status, 'playing');
  assert.equal(state.score, 0);
  assert.equal(hasBlockMove(state.board, state.hand), true);
  assert.equal(BLOCK_TARGET, 1200);
});

test('Kingdom Block Forge: simultaneous row and column clear, no board mutation', () => {
  const board = emptyBlockBoard();
  for (let i = 0; i < BLOCK_SIZE - 1; i++) {
    board[BLOCK_SIZE - 1][i] = 1;
    board[i][BLOCK_SIZE - 1] = 1;
  }
  const source = { ...createBlockState(), board, hand: [0, null, null] };
  assert.equal(canPlaceBlock(board, 0, 7, 7), true);
  const result = placeBlock(source, 0, 7, 7);
  assert.equal(result.cleared, 2);
  assert.equal(result.score, 25 + 170 * 4);
  assert.equal(result.moves, 1);
  assert.equal(result.round, 1);
  assert.deepEqual(result.hand, blockHand(1));
  assert.ok(result.board.every(row => row.every(v => v === 0)));
  assert.equal(source.board[7][0], 1, 'source unchanged');
  assert.equal(source.board[7][7], 0, 'source unchanged');
});

test('Kingdom Block Forge: illegal placement and overlapping pieces rejected', () => {
  const first = createBlockState();
  assert.equal(canPlaceBlock(first.board, first.hand[0], 7, 7), false); // first 2x2 piece
  assert.throws(() => placeBlock(first, 0, 7, 7), /Illegal/);
  assert.throws(() => placeBlock(first, -1, 0, 0), /Illegal/);
  const played = placeBlock(first, 0, 0, 0);
  assert.equal(first.score, 0);
  assert.throws(() => placeBlock(played, 1, 0, 0), /Illegal/);
  assert.throws(() => placeBlock({ ...played, status: 'lost' }, 1, 4, 4), /Finished/);
});

test('Kingdom Word Search: all 3 seeded levels are reproducible with 100% placed words', () => {
  assert.equal(SCRIPTURE_WORD_LEVELS.length, 3);
  for (let level = 0; level < SCRIPTURE_WORD_LEVELS.length; level++) {
    const puzzle = makeScriptureWordPuzzle(level);
    assert.deepEqual(makeScriptureWordPuzzle(level), puzzle, 'grid must be reproducible');
    assert.equal(puzzle.size, 12);
    assert.equal(puzzle.grid.length, 12);
    assert.ok(puzzle.grid.every(line => line.length === 12 && line.every(letter => /^[A-Z]$/.test(letter))));
    assert.equal(new Set(puzzle.words.map(entry => entry.word)).size, puzzle.words.length);
    for (const entry of puzzle.words) {
      const path = puzzle.placements[entry.word];
      assert.equal(path.length, entry.word.length);
      const line = readScriptureWordLine(puzzle.grid, path[0], path[path.length - 1]);
      assert.equal(line?.word, entry.word, entry.word + ' should be discoverable in the grid');
      assert.equal(scriptureWordAt(puzzle, path[0], path[path.length - 1])?.word, entry.word);
      assert.equal(scriptureWordAt(puzzle, path[path.length - 1], path[0])?.word, entry.word, 'reverse select is legal');
      assert.equal(scriptureWordAt(puzzle, path[0], path[path.length - 1], [entry.word]), null, 'cannot double-claim word');
      assert.ok(entry.reference.length > 2);
    }
  }
  assert.throws(() => makeScriptureWordPuzzle(-1), /Unknown/);
  assert.throws(() => makeScriptureWordPuzzle(3), /Unknown/);
});

test('Kingdom Word Search: rejects diagonal false-lines and invalid squares', () => {
  const p = makeScriptureWordPuzzle(0);
  assert.equal(readScriptureWordLine(p.grid, { row: 0, col: 0 }, { row: 1, col: 2 }), null);
  assert.equal(readScriptureWordLine(p.grid, { row: 0, col: 0 }, { row: 0, col: 0 }), null);
  assert.equal(readScriptureWordLine(p.grid, { row: -1, col: 0 }, { row: 2, col: 0 }), null);
  assert.equal(scriptureWordAt(p, { row: 0, col: 0 }, { row: 1, col: 2 }), null);
});

test('Kingdom R2 interior guards: no map edits, old games accessible, zero economy grants', () => {
  const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  const map = read('src/features/games/kingdom/BuklodKingdomMap.tsx');
  const mapHash = createHash('sha1').update('blob ' + Buffer.byteLength(map) + '\0').update(map).digest('hex');
  assert.equal(mapHash, '88a4b1b4a70fc4acd59579419058b47f21be2554');
  const christian = read('src/app/games/christian-civic-leadership.tsx');
  const mitch = read('src/app/games/mitch-restore-mural.tsx');
  for (const name of ['CivicLeadershipGameV1', 'BibleCrownGameV1', 'ScriptureWordSearchGameV1']) assert.ok(christian.includes(name));
  for (const name of ['RestoreMuralGameV1', 'BlockForgeGameV1']) assert.ok(mitch.includes(name));
  const blockUi = read('src/features/games/mitch/BlockForgeGameV1.tsx');
  const wordUi = read('src/features/games/christian/ScriptureWordSearchGameV1.tsx');
  for (const source of [blockUi, wordUi]) {
    assert.ok(source.includes('reward: { xp: 0, kingdomXp: 0 }'));
    assert.ok(source.includes('onFinish?.('));
    assert.ok(!source.includes('.rpc('));
    assert.ok(!source.includes('showBuklodInterstitial'));
  }
});
