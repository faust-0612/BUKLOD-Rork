/** Jawo Trail Maze: seeded, connected, finite, offline labyrinth engine. */
export type MazeCell = { row: number; col: number };
export type MazeDirection = 'up' | 'down' | 'left' | 'right';
export type MazeLevel = {
  size: number; grid: number[][]; exit: MazeCell;
  relics: MazeCell[]; seed: number; maxMoves: number;
};
export type MazeRun = {
  level: number; board: MazeLevel; position: MazeCell;
  found: string[]; moves: number; status: 'playing' | 'won' | 'lost'; score: number;
};
export const MAZE_SPECS = [
  { size: 13, seed: 0x1637a, relics: 2 },
  { size: 17, seed: 0x14237, relics: 3 },
  { size: 21, seed: 0x51213, relics: 4 },
] as const;

const key = (cell: MazeCell) => cell.row + ':' + cell.col;
function random(seed: number) {
  let x = seed | 0;
  return () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}
function shuffle<T>(list: T[], rand: () => number): T[] {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function makeMazeLevel(level: number): MazeLevel {
  const spec = MAZE_SPECS[level];
  if (!spec || !Number.isInteger(level)) throw new Error('Invalid maze level');
  const size = spec.size;
  const grid = Array.from({ length: size }, () => Array<number>(size).fill(1));
  const rand = random(spec.seed);
  const stack: MazeCell[] = [{ row: 1, col: 1 }];
  grid[1][1] = 0;
  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const available = shuffle([
      { row: current.row + 2, col: current.col, wr: current.row + 1, wc: current.col },
      { row: current.row - 2, col: current.col, wr: current.row - 1, wc: current.col },
      { row: current.row, col: current.col + 2, wr: current.row, wc: current.col + 1 },
      { row: current.row, col: current.col - 2, wr: current.row, wc: current.col - 1 },
    ], rand).filter(next =>
      next.row >= 1 && next.col >= 1 && next.row <= size - 2 && next.col <= size - 2 &&
      grid[next.row][next.col] === 1);
    if (!available.length) { stack.pop(); continue; }
    const next = available[0];
    grid[next.wr][next.wc] = 0;
    grid[next.row][next.col] = 0;
    stack.push({ row: next.row, col: next.col });
  }
  // DFS makes every open position reachable from the entrance.
  const exit = { row: size - 2, col: size - 2 };
  const open: MazeCell[] = [];
  for (let row = 1; row < size - 1; row++)
    for (let col = 1; col < size - 1; col++) {
      if (grid[row][col] === 0 && !(row === 1 && col === 1) &&
          !(row === exit.row && col === exit.col)) open.push({ row, col });
    }
  const spaced = shuffle(open.filter(cell => cell.row + cell.col >= size), rand);
  const relics = spaced.slice(0, spec.relics);
  if (relics.length !== spec.relics || grid[exit.row][exit.col] !== 0)
    throw new Error('Maze generation was not solvable');
  return { size, grid, exit, relics, seed: spec.seed, maxMoves: size * size * 4 };
}
export function createMazeRun(level: number): MazeRun {
  return {
    level, board: makeMazeLevel(level), position: { row: 1, col: 1 },
    found: [], moves: 0, status: 'playing', score: 0,
  };
}
export function mazeNeighbors(board: MazeLevel, cell: MazeCell): MazeCell[] {
  return [[-1, 0], [1, 0], [0, -1], [0, 1]]
    .map(([dr, dc]) => ({ row: cell.row + dr, col: cell.col + dc }))
    .filter(c => c.row >= 0 && c.col >= 0 && c.row < board.size && c.col < board.size &&
      board.grid[c.row][c.col] === 0);
}
export function mazeReachable(board: MazeLevel): Set<string> {
  const result = new Set<string>(['1:1']);
  const queue: MazeCell[] = [{ row: 1, col: 1 }];
  for (let i = 0; i < queue.length; i++) {
    for (const cell of mazeNeighbors(board, queue[i])) {
      if (!result.has(key(cell))) { result.add(key(cell)); queue.push(cell); }
    }
  }
  return result;
}
export function moveMaze(run: MazeRun, direction: MazeDirection): MazeRun {
  if (run.status !== 'playing') throw new Error('Maze already finished');
  const delta = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }[direction];
  if (!delta) throw new Error('Invalid maze direction');
  const destination = { row: run.position.row + delta[0], col: run.position.col + delta[1] };
  if (!mazeNeighbors(run.board, run.position)
      .some(cell => cell.row === destination.row && cell.col === destination.col)) return run;
  const found = [...run.found];
  if (run.board.relics.some(c => key(c) === key(destination)) && !found.includes(key(destination)))
    found.push(key(destination));
  const moves = run.moves + 1;
  const atExit = destination.row === run.board.exit.row && destination.col === run.board.exit.col;
  const won = atExit && found.length === run.board.relics.length;
  const lost = moves >= run.board.maxMoves;
  return {
    ...run, position: destination, moves, found,
    status: won ? 'won' : lost ? 'lost' : 'playing',
    score: won ? Math.max(100, 2400 - moves * 12 + found.length * 250) : 0,
  };
}
