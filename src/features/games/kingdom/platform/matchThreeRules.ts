/**
 * Shared BUKLOD Kingdom match-three engine.
 * Three distinct character environments reuse identical pure move validation,
 * cascade, deterministic refill and no-dead-end generation.
 *
 * All values are game-only: never award Character Points from this module.
 */
export type MatchGameId = 'phan-market-match' | 'jawo-nature-match' | 'vhen-harvest-match';
export type MatchCell = { row: number; col: number };
export type MatchSwap = { from: MatchCell; to: MatchCell };
export type MatchRound = {
  gameId: MatchGameId; level: number; board: number[][];
  collected: number[]; goals: number[]; movesLeft: number;
  rngState: number; score: number; cascades: number; reshuffles: number;
  status: 'playing' | 'won' | 'lost';
};
const SIZE = 7;
const TYPES = 5;
export const MATCH_LEVELS: Record<MatchGameId, readonly { goals: readonly number[]; moves: number; seed: number }[]> = {
  'phan-market-match': [
    { goals: [8, 8, 0, 0, 0], moves: 22, seed: 51163 },
    { goals: [10, 9, 8, 0, 0], moves: 23, seed: 51167 },
    { goals: [12, 12, 9, 8, 0], moves: 25, seed: 51171 },
  ],
  'jawo-nature-match': [
    { goals: [0, 8, 8, 0, 0], moves: 22, seed: 31143 },
    { goals: [9, 0, 10, 8, 0], moves: 24, seed: 31149 },
    { goals: [8, 8, 10, 10, 0], moves: 26, seed: 31153 },
  ],
  'vhen-harvest-match': [
    { goals: [0, 8, 0, 8, 0], moves: 22, seed: 41137 },
    { goals: [8, 0, 8, 0, 10], moves: 24, seed: 41141 },
    { goals: [9, 10, 0, 9, 9], moves: 26, seed: 41147 },
  ],
};
const isBoard = (board: readonly (readonly number[])[]) => board.length === SIZE &&
  board.every(line => line.length === SIZE && line.every(x => Number.isInteger(x) && x >= 0 && x < TYPES));
const copy = (board: readonly (readonly number[])[]) => board.map(line => [...line]);
const same = (a: MatchCell, b: MatchCell) => a.row === b.row && a.col === b.col;
const inside = (cell: MatchCell) => Number.isInteger(cell.row) && Number.isInteger(cell.col) &&
  cell.row >= 0 && cell.col >= 0 && cell.row < SIZE && cell.col < SIZE;
const coord = (r: number, c: number) => r + ':' + c;

function nextNumber(state: number): number {
  let x = state | 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  return x | 0;
}
function draw(state: number): { state: number; value: number } {
  const next = nextNumber(state || 1);
  return { state: next, value: (next >>> 0) % TYPES };
}
export function match3Matches(board: readonly (readonly number[])[]): MatchCell[] {
  if (!isBoard(board)) return [];
  const matched = new Set<string>();
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE;) {
      let end = col + 1;
      while (end < SIZE && board[row][end] === board[row][col]) end++;
      if (end - col >= 3) for (let j = col; j < end; j++) matched.add(coord(row, j));
      col = end;
    }
  }
  for (let col = 0; col < SIZE; col++) {
    for (let row = 0; row < SIZE;) {
      let end = row + 1;
      while (end < SIZE && board[end][col] === board[row][col]) end++;
      if (end - row >= 3) for (let j = row; j < end; j++) matched.add(coord(j, col));
      row = end;
    }
  }
  return [...matched].map(key => {
    const [row, col] = key.split(':').map(Number);
    return { row, col };
  });
}
function swapCells(board: number[][], a: MatchCell, b: MatchCell): void {
  [board[a.row][a.col], board[b.row][b.col]] = [board[b.row][b.col], board[a.row][a.col]];
}
export function match3LegalSwaps(board: readonly (readonly number[])[]): MatchSwap[] {
  if (!isBoard(board)) return [];
  const result: MatchSwap[] = [];
  for (let row = 0; row < SIZE; row++) for (let col = 0; col < SIZE; col++) {
    const from = { row, col };
    for (const to of [{ row, col: col + 1 }, { row: row + 1, col }]) {
      if (!inside(to) || board[from.row][from.col] === board[to.row][to.col]) continue;
      const proposed = copy(board);
      swapCells(proposed, from, to);
      if (match3Matches(proposed).length) result.push({ from, to });
    }
  }
  return result;
}
/** Generates a board without automatic matches and at least one legal swap. */
function playableBoard(seed: number): { board: number[][]; seed: number } {
  let rng = seed | 0;
  for (let attempt = 0; attempt < 150; attempt++) {
    const board = Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(0));
    for (let row = 0; row < SIZE; row++) for (let col = 0; col < SIZE; col++) {
      let options = [0, 1, 2, 3, 4].filter(value =>
        !(col >= 2 && board[row][col - 1] === value && board[row][col - 2] === value) &&
        !(row >= 2 && board[row - 1][col] === value && board[row - 2][col] === value));
      const value = draw(rng);
      rng = value.state;
      board[row][col] = options[value.value % options.length];
    }
    if (match3LegalSwaps(board).length) return { board, seed: rng };
    rng = nextNumber(rng ^ (attempt + 917));
  }
  throw new Error('Could not generate legal match-three board');
}
export function createMatch3Round(gameId: MatchGameId, level: number): MatchRound {
  const spec = MATCH_LEVELS[gameId]?.[level];
  if (!spec || !Number.isInteger(level)) throw new Error('Invalid match-three game or level');
  const { board, seed } = playableBoard(spec.seed);
  return { gameId, level, board, rngState: seed, collected: [0, 0, 0, 0, 0],
    goals: [...spec.goals], movesLeft: spec.moves, score: 0, cascades: 0,
    reshuffles: 0, status: 'playing' };
}
export function performMatch3Swap(run: MatchRound, from: MatchCell, to: MatchCell): MatchRound {
  if (run.status !== 'playing') throw new Error('Match round already ended');
  if (!inside(from) || !inside(to) || same(from, to) ||
      Math.abs(from.row - to.row) + Math.abs(from.col - to.col) !== 1) return run;
  const board = copy(run.board);
  swapCells(board, from, to);
  let matches = match3Matches(board);
  if (!matches.length) return run;
  const collected = [...run.collected];
  let score = run.score, cascades = 0, rng = run.rngState;
  while (matches.length && cascades < 30) {
    cascades++;
    const clear = new Set(matches.map(cell => coord(cell.row, cell.col)));
    for (const { row, col } of matches) {
      collected[board[row][col]]++;
      score += 45 * cascades;
    }
    for (let col = 0; col < SIZE; col++) {
      const survivors: number[] = [];
      for (let row = SIZE - 1; row >= 0; row--)
        if (!clear.has(coord(row, col))) survivors.push(board[row][col]);
      for (let row = SIZE - 1; row >= 0; row--) {
        if (SIZE - 1 - row < survivors.length) board[row][col] = survivors[SIZE - 1 - row];
        else {
          const next = draw(rng);
          rng = next.state;
          board[row][col] = next.value;
        }
      }
    }
    matches = match3Matches(board);
  }
  let reshuffles = run.reshuffles;
  if (matches.length || !match3LegalSwaps(board).length) {
    // Avoid dead-end or unbounded cascade; next board is always playable.
    const fresh = playableBoard(rng ^ 0x27731);
    for (let row = 0; row < SIZE; row++) board[row] = fresh.board[row];
    rng = fresh.seed;
    reshuffles++;
  }
  const movesLeft = run.movesLeft - 1;
  const won = run.goals.every((goal, i) => collected[i] >= goal);
  return { ...run, board, collected, movesLeft, rngState: rng, score,
    cascades: run.cascades + cascades, reshuffles,
    status: won ? 'won' : movesLeft === 0 ? 'lost' : 'playing' };
}
