import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import {
  SUDOKU_LEVELS, makeSudokuPuzzle, countSudokuSolutions,
  isSudokuPlacementValid, createSudokuEntry, enterSudokuDigit,
} from '../src/features/games/van/sudokuRules.ts';
import {
  CODE_LEVELS, makeCodeSecret, codeGuessValid, evaluateCodeGuess,
  createCodeRound, applyCodeGuess, applyCodeHint,
} from '../src/features/games/quin/codeBreakerRules.ts';

test('Sudoku: 3 deterministic puzzles have ONE solution, valid completed grids and immutable starts', () => {
  assert.equal(SUDOKU_LEVELS.length, 3);
  for (let i = 0; i < SUDOKU_LEVELS.length; i++) {
    const puzzle = makeSudokuPuzzle(i);
    assert.deepEqual(makeSudokuPuzzle(i), puzzle, 'same level produces same grid');
    assert.equal(puzzle.clues, puzzle.starting.flat().filter(Boolean).length);
    assert.ok(puzzle.clues >= SUDOKU_LEVELS[i].targetClues, 'unique puzzle may need extra clues');
    assert.ok(puzzle.clues < 81, 'puzzle has blanks');
    assert.equal(countSudokuSolutions(puzzle.starting, 2), 1);
    assert.equal(countSudokuSolutions(puzzle.solution, 2), 1);
    for (let row = 0; row < 9; row++) for (let col = 0; col < 9; col++) {
      assert.ok(puzzle.solution[row][col] >= 1 && puzzle.solution[row][col] <= 9);
      assert.equal(isSudokuPlacementValid(puzzle.solution, row, col, puzzle.solution[row][col]), true);
      if (puzzle.starting[row][col]) assert.equal(puzzle.starting[row][col], puzzle.solution[row][col]);
    }
  }
  assert.throws(() => makeSudokuPuzzle(-1), /Invalid/);
  assert.throws(() => makeSudokuPuzzle(3), /Invalid/);
});

test('Sudoku: legal-entry scoring, wrong-entry penalty, fixed-cell protection, last-cell win', () => {
  const puzzle = makeSudokuPuzzle(0);
  const original = createSudokuEntry(puzzle);
  const fixedIndex = puzzle.starting.flat().findIndex(v => v !== 0);
  const fixedRow = Math.floor(fixedIndex / 9), fixedCol = fixedIndex % 9;
  assert.equal(enterSudokuDigit(puzzle, original, fixedRow, fixedCol, puzzle.solution[fixedRow][fixedCol]).effect, 'ignored');
  const blankIndex = original.board.flat().findIndex(v => v === 0);
  const r = Math.floor(blankIndex / 9), c = blankIndex % 9;
  const bad = puzzle.solution[r][c] % 9 + 1;
  const mistake = enterSudokuDigit(puzzle, original, r, c, bad);
  assert.equal(mistake.effect, 'wrong');
  assert.equal(mistake.next.mistakes, 1);
  assert.equal(mistake.next.board[r][c], 0);
  assert.equal(original.mistakes, 0, 'source untouched');
  const correct = enterSudokuDigit(puzzle, original, r, c, puzzle.solution[r][c]);
  assert.equal(correct.effect, 'correct');
  assert.equal(correct.next.score, 100);
  assert.equal(original.board[r][c], 0, 'source untouched');
  assert.equal(enterSudokuDigit(puzzle, correct.next, r, c, puzzle.solution[r][c]).effect, 'ignored');
  const almost = createSudokuEntry(puzzle);
  almost.board = puzzle.solution.map(line => [...line]);
  almost.board[r][c] = 0;
  const end = enterSudokuDigit(puzzle, almost, r, c, puzzle.solution[r][c]);
  assert.equal(end.effect, 'complete');
  assert.equal(end.next.completed, true);
  const invalid = puzzle.starting.map(line => [...line]);
  invalid[fixedRow][fixedCol] = 10;
  assert.equal(countSudokuSolutions(invalid), 0);
});

test('Code Breaker: three deterministic, unique, valid secret combinations', () => {
  assert.equal(CODE_LEVELS.length, 3);
  for (let level = 0; level < CODE_LEVELS.length; level++) {
    const config = CODE_LEVELS[level];
    const secret = makeCodeSecret(level);
    assert.deepEqual(makeCodeSecret(level), secret);
    assert.equal(secret.length, config.digits);
    assert.equal(codeGuessValid(secret, config), true);
    assert.equal(new Set(secret).size, secret.length);
    assert.equal(evaluateCodeGuess(secret, secret).exact, secret.length);
    assert.equal(evaluateCodeGuess(secret, secret).displaced, 0);
    assert.equal(codeGuessValid([...secret.slice(0, -1), secret[0]], config), false);
    assert.equal(codeGuessValid([...secret, config.palette], config), false);
  }
  assert.throws(() => makeCodeSecret(-1), /Invalid/);
  assert.throws(() => makeCodeSecret(3), /Invalid/);
});

test('Code Breaker: exact vs displaced clues, hint idempotency, history and win/loss', () => {
  assert.deepEqual(evaluateCodeGuess([1, 2, 3, 4], [1, 3, 4, 5]), { exact: 1, displaced: 2 });
  assert.deepEqual(evaluateCodeGuess([1, 2, 3, 4], [4, 3, 2, 1]), { exact: 0, displaced: 4 });
  assert.throws(() => evaluateCodeGuess([1, 1, 3], [1, 2, 3]), /Non-unique/);
  const round = createCodeRound(0);
  const hint = applyCodeHint(round);
  assert.equal(hint.hintedIndex, 0);
  assert.equal(round.hintedIndex, null);
  assert.equal(applyCodeHint(hint), hint);
  assert.throws(() => applyCodeGuess(round, [1, 1, 1]), /Illegal/);
  const win = applyCodeGuess(hint, hint.secret);
  assert.equal(win.status, 'won');
  assert.equal(win.history.length, 1);
  assert.ok(win.score > 0);
  assert.equal(round.history.length, 0);
  assert.throws(() => applyCodeGuess(win, win.secret), /finished/);
  let lost = createCodeRound(0);
  const pool = Array.from({ length: CODE_LEVELS[0].palette }, (_, i) => i + 1);
  const wrong = pool.filter(x => !lost.secret.includes(x));
  // Reverse the exact sequence: guaranteed wrong because all unique digits.
  const invalidCode = [...lost.secret].reverse();
  assert.equal(evaluateCodeGuess(lost.secret, invalidCode).exact < lost.secret.length, true);
  for (let i = 0; i < CODE_LEVELS[0].attempts; i++) lost = applyCodeGuess(lost, invalidCode);
  assert.equal(lost.status, 'lost');
  assert.equal(lost.history.length, CODE_LEVELS[0].attempts);
  assert.equal(lost.score, 0);
});

test('R3 source guard: unchanged Kingdom map, originals preserved, local-only rewards', () => {
  const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const map = read('src/features/games/kingdom/BuklodKingdomMap.tsx');
  const sha = createHash('sha1').update('blob ' + Buffer.byteLength(map) + '\0').update(map).digest('hex');
  assert.equal(sha, '88a4b1b4a70fc4acd59579419058b47f21be2554');
  const van = read('src/app/games/van-living-city-dispatch.tsx');
  const quin = read('src/app/games/quin-discovery-expedition.tsx');
  assert.ok(van.includes('LivingCityDispatchGameV1') && van.includes('SudokuMasterGameV1'));
  assert.ok(quin.includes('DiscoveryExpeditionGameV1') && quin.includes('CodeBreakerGameV1'));
  const shell = read('src/features/games/kingdom/platform/KingdomInteriorCenter.tsx');
  assert.ok(shell.includes('recordKingdomPreviewResult') && shell.includes('recordBuklodKingdomPreviewResult'));
  assert.ok(!shell.includes('supabase'));
  assert.ok(!shell.includes('showBuklodInterstitial'));
  for (const path of ['src/features/games/van/SudokuMasterGameV1.tsx', 'src/features/games/quin/CodeBreakerGameV1.tsx']) {
    const src = read(path);
    assert.ok(src.includes('reward: { xp: 0, kingdomXp: 0 }'));
  }
});
