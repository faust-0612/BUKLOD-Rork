/**
 * Pure, offline, deterministic Block Forge rules.
 * Board coordinates are row/column, zero based; no rewards or network I/O.
 */
export const BLOCK_SIZE = 8;
export const BLOCK_TARGET = 1200;
export type BlockCell = readonly [number, number];
export type BlockShape = { id: string; cells: readonly BlockCell[] };
export const BLOCK_SHAPES: readonly BlockShape[] = [
  { id: 'single', cells: [[0, 0]] },
  { id: 'domino', cells: [[0, 0], [0, 1]] },
  { id: 'bar3', cells: [[0, 0], [0, 1], [0, 2]] },
  { id: 'column3', cells: [[0, 0], [1, 0], [2, 0]] },
  { id: 'square', cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
  { id: 'corner', cells: [[0, 0], [1, 0], [1, 1]] },
  { id: 'zig', cells: [[0, 0], [0, 1], [1, 1], [1, 2]] },
  { id: 'hook', cells: [[0, 0], [1, 0], [2, 0], [2, 1]] },
] as const;

export type BlockState = {
  board: number[][];
  hand: (number | null)[];
  round: number;
  score: number;
  cleared: number;
  moves: number;
  status: 'playing' | 'won' | 'lost';
};

export const emptyBlockBoard = (): number[][] =>
  Array.from({ length: BLOCK_SIZE }, () => Array<number>(BLOCK_SIZE).fill(0));

export function blockHand(round: number): number[] {
  if (!Number.isInteger(round) || round < 0) throw new Error('Invalid block round');
  // Stable per-round hand; never depend on global random state or user ID.
  return [(round * 3 + 4) % BLOCK_SHAPES.length, (round * 5 + 1) % BLOCK_SHAPES.length, (round * 7 + 0) % BLOCK_SHAPES.length];
}

export function createBlockState(): BlockState {
  return { board: emptyBlockBoard(), hand: blockHand(0), round: 0, score: 0, cleared: 0, moves: 0, status: 'playing' };
}

export function canPlaceBlock(board: readonly (readonly number[])[], shapeId: number, row: number, col: number): boolean {
  const shape = BLOCK_SHAPES[shapeId];
  if (!shape || !Number.isInteger(row) || !Number.isInteger(col) ||
      board.length !== BLOCK_SIZE || board.some(line => line.length !== BLOCK_SIZE)) return false;
  return shape.cells.every(([dr, dc]) => {
    const r = row + dr, c = col + dc;
    return r >= 0 && c >= 0 && r < BLOCK_SIZE && c < BLOCK_SIZE && board[r][c] === 0;
  });
}

export function hasBlockMove(board: readonly (readonly number[])[], hand: readonly (number | null)[]): boolean {
  return hand.some(id => id !== null && BLOCK_SHAPES[id] !== undefined &&
    Array.from({ length: BLOCK_SIZE * BLOCK_SIZE }).some((_, n) =>
      canPlaceBlock(board, id, Math.floor(n / BLOCK_SIZE), n % BLOCK_SIZE)));
}

export function placeBlock(state: BlockState, slot: number, row: number, col: number): BlockState {
  if (state.status !== 'playing') throw new Error('Finished game');
  const id = state.hand[slot];
  if (!Number.isInteger(slot) || slot < 0 || slot >= state.hand.length || id == null ||
      !canPlaceBlock(state.board, id, row, col)) throw new Error('Illegal block placement');
  const next = state.board.map(line => [...line]);
  const shape = BLOCK_SHAPES[id];
  for (const [dr, dc] of shape.cells) next[row + dr][col + dc] = 1;

  // Evaluate ALL complete rows and columns from the same snapshot.
  const rows = Array.from({ length: BLOCK_SIZE }, (_, n) => n).filter(r => next[r].every(Boolean));
  const cols = Array.from({ length: BLOCK_SIZE }, (_, n) => n).filter(c => next.every(line => line[c] !== 0));
  for (const r of rows) next[r].fill(0);
  for (const c of cols) for (const line of next) line[c] = 0;

  const clearedThisMove = rows.length + cols.length;
  const points = shape.cells.length * 25 + 170 * clearedThisMove * clearedThisMove;
  let hand = state.hand.map((item, i) => i === slot ? null : item);
  let round = state.round;
  if (hand.every(item => item === null)) {
    round += 1;
    hand = blockHand(round);
  }
  const score = state.score + points;
  return {
    board: next,
    hand,
    round,
    score,
    cleared: state.cleared + clearedThisMove,
    moves: state.moves + 1,
    status: score >= BLOCK_TARGET ? 'won' : hasBlockMove(next, hand) ? 'playing' : 'lost',
  };
}
