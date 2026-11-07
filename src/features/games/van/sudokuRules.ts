/**
 * Offline, deterministic Sudoku. Generator removes clues only when a unique
 * solution remains; no remote calls and no user-facing economy values.
 */
export type SudokuBoard = number[][];
export type SudokuPuzzle = {
  level: number;
  seed: number;
  clues: number;
  starting: SudokuBoard;
  solution: SudokuBoard;
};
export const SUDOKU_LEVELS = [
  { en: 'First Steps', tl: 'Unang Hakbang', targetClues: 44, seed: 0x25120 },
  { en: 'Pattern Explorer', tl: 'Tagahanap ng Pattern', targetClues: 38, seed: 0x25199 },
  { en: 'Mind Architect', tl: 'Arkitekto ng Isip', targetClues: 32, seed: 0x25224 },
] as const;

const SIZE = 9;
const FULL_MASK = 0b1111111110;
const clone = (board: readonly (readonly number[])[]): SudokuBoard => board.map(line => [...line]);

function seeded(seed: number): () => number {
  let x = (seed | 0) || 1;
  return () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function rearrange(rand: () => number): number[] {
  return shuffle([0, 1, 2], rand).flatMap(group =>
    shuffle([0, 1, 2], rand).map(index => group * 3 + index));
}

export function isSudokuPlacementValid(board: readonly (readonly number[])[], row: number, col: number, value: number): boolean {
  if (!Number.isInteger(value) || value < 1 || value > 9 ||
      !Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row > 8 || col < 0 || col > 8 ||
      board.length !== SIZE || board.some(line => line.length !== SIZE)) return false;
  for (let i = 0; i < SIZE; i++) {
    if (i !== col && board[row][i] === value) return false;
    if (i !== row && board[i][col] === value) return false;
  }
  const startR = Math.floor(row / 3) * 3, startC = Math.floor(col / 3) * 3;
  for (let r = startR; r < startR + 3; r++) for (let c = startC; c < startC + 3; c++) {
    if ((r !== row || c !== col) && board[r][c] === value) return false;
  }
  return true;
}

export function countSudokuSolutions(source: readonly (readonly number[])[], limit = 2): number {
  if (source.length !== SIZE || source.some(row => row.length !== SIZE) ||
      !Number.isInteger(limit) || limit < 1) return 0;
  const board = clone(source);
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    if (!Number.isInteger(board[r][c]) || board[r][c] < 0 || board[r][c] > 9 ||
        (board[r][c] !== 0 && !isSudokuPlacementValid(board, r, c, board[r][c]))) return 0;
  }
  let solutions = 0;
  function visit(): void {
    if (solutions >= limit) return;
    let bestR = -1, bestC = -1, bestMask = 0, bestOptions = 10;
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      if (board[r][c] !== 0) continue;
      let taken = 0;
      for (let j = 0; j < SIZE; j++) {
        taken |= 1 << board[r][j];
        taken |= 1 << board[j][c];
      }
      const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
      for (let i = br; i < br + 3; i++) for (let j = bc; j < bc + 3; j++) taken |= 1 << board[i][j];
      const available = FULL_MASK & ~taken;
      let count = 0;
      for (let value = 1; value <= 9; value++) if (available & (1 << value)) count++;
      if (count === 0) return;
      if (count < bestOptions) {
        bestOptions = count; bestR = r; bestC = c; bestMask = available;
      }
    }
    if (bestR === -1) { solutions++; return; }
    for (let value = 1; value <= 9; value++) {
      if (!(bestMask & (1 << value))) continue;
      board[bestR][bestC] = value;
      visit();
      board[bestR][bestC] = 0;
      if (solutions >= limit) return;
    }
  }
  visit();
  return solutions;
}

export function makeSudokuPuzzle(level: number): SudokuPuzzle {
  const spec = SUDOKU_LEVELS[level];
  if (!spec || !Number.isInteger(level)) throw new Error('Invalid Sudoku level');
  const rand = seeded(spec.seed);
  const rows = rearrange(rand);
  const cols = rearrange(rand);
  const digitMap = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rand);
  const solution = rows.map(r => cols.map(c => digitMap[(r * 3 + Math.floor(r / 3) + c) % 9]));
  const board = clone(solution);
  for (const cell of shuffle(Array.from({ length: 81 }, (_, i) => i), rand)) {
    if (board.flat().filter(v => v !== 0).length <= spec.targetClues) break;
    const r = Math.floor(cell / 9), c = cell % 9, previous = board[r][c];
    board[r][c] = 0;
    if (countSudokuSolutions(board, 2) !== 1) board[r][c] = previous;
  }
  const clues = board.flat().filter(Boolean).length;
  if (countSudokuSolutions(board) !== 1) throw new Error('Sudoku generator failed uniqueness invariant');
  return { level, seed: spec.seed, clues, starting: board, solution };
}

export type SudokuEntry = { board: SudokuBoard; mistakes: number; score: number; completed: boolean };
export function createSudokuEntry(puzzle: SudokuPuzzle): SudokuEntry {
  return { board: clone(puzzle.starting), mistakes: 0, score: 0, completed: false };
}

export function enterSudokuDigit(
  puzzle: SudokuPuzzle, current: SudokuEntry, row: number, col: number, digit: number,
): { next: SudokuEntry; effect: 'correct' | 'wrong' | 'ignored' | 'complete' } {
  if (current.completed || !Number.isInteger(row) || !Number.isInteger(col) ||
      row < 0 || row > 8 || col < 0 || col > 8 ||
      !Number.isInteger(digit) || digit < 1 || digit > 9 || puzzle.starting[row][col] !== 0 ||
      current.board[row][col] !== 0) return { next: current, effect: 'ignored' };
  if (digit !== puzzle.solution[row][col]) {
    return { next: { ...current, mistakes: current.mistakes + 1 }, effect: 'wrong' };
  }
  const board = clone(current.board);
  board[row][col] = digit;
  const completed = board.every(line => line.every(value => value !== 0));
  return {
    next: { ...current, board, score: current.score + 100, completed },
    effect: completed ? 'complete' : 'correct',
  };
}
