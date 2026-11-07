/**
 * Offline deterministic, seeded Bible word-search puzzle engine.
 * The displayed spellings follow the puzzle's English names even in TL UI,
 * so word paths and solutions remain stable across language toggles.
 */
export type WordCell = { row: number; col: number };
export type WordEntry = { word: string; reference: string };
export type WordPuzzle = { size: number; grid: string[][]; words: WordEntry[]; placements: Record<string, WordCell[]> };

export const SCRIPTURE_WORD_LEVELS: readonly { en: string; tl: string; words: readonly WordEntry[] }[] = [
  { en: 'People of Faith', tl: 'Mga Tauhan ng Pananampalataya', words: [
    { word: 'DAVID', reference: '1 Samuel 17' },
    { word: 'RUTH', reference: 'Ruth 1' },
    { word: 'NOAH', reference: 'Genesis 6' },
    { word: 'JONAH', reference: 'Jonah 1' },
  ] },
  { en: 'Courage and Service', tl: 'Tapang at Paglilingkod', words: [
    { word: 'ESTHER', reference: 'Esther 5' },
    { word: 'DANIEL', reference: 'Daniel 6' },
    { word: 'SAMUEL', reference: '1 Samuel 3' },
    { word: 'MOSES', reference: 'Exodus 14' },
    { word: 'PAUL', reference: 'Acts 16' },
  ] },
  { en: 'Books and Witnesses', tl: 'Mga Aklat at Saksi', words: [
    { word: 'GENESIS', reference: 'Genesis 1' },
    { word: 'EXODUS', reference: 'Exodus 1' },
    { word: 'MATTHEW', reference: 'Matthew 1' },
    { word: 'MARK', reference: 'Mark 1' },
    { word: 'PETER', reference: 'Matthew 14' },
    { word: 'ACTS', reference: 'Acts 1' },
  ] },
];

const DIRECTIONS: readonly (readonly [number, number])[] = [
  [0, 1], [1, 0], [0, -1], [-1, 0],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const inBounds = (v: number, size: number) => Number.isInteger(v) && v >= 0 && v < size;

function seededRandom(seed: number): () => number {
  let x = seed | 0;
  return () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

function pathFor(row: number, col: number, dr: number, dc: number, length: number): WordCell[] {
  return Array.from({ length }, (_, i) => ({ row: row + dr * i, col: col + dc * i }));
}

export function makeScriptureWordPuzzle(level: number): WordPuzzle {
  const config = SCRIPTURE_WORD_LEVELS[level];
  if (!config || !Number.isInteger(level)) throw new Error('Unknown Bible word-search level');
  const size = 12;
  const grid = Array.from({ length: size }, () => Array<string>(size).fill(''));
  const rng = seededRandom(0x51b10d + level * 10103);
  const placements: Record<string, WordCell[]> = {};
  for (const { word } of [...config.words].sort((a, b) => b.word.length - a.word.length)) {
    if (!/^[A-Z]+$/.test(word)) throw new Error('Word puzzle requires uppercase A-Z');
    const options: WordCell[][] = [];
    for (const [dr, dc] of DIRECTIONS) {
      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          const cells = pathFor(row, col, dr, dc, word.length);
          if (cells.every(({ row: r, col: c }, i) =>
            inBounds(r, size) && inBounds(c, size) &&
            (grid[r][c] === '' || grid[r][c] === word[i]))) options.push(cells);
        }
      }
    }
    if (!options.length) throw new Error('Could not place Bible word: ' + word);
    const cells = options[Math.floor(rng() * options.length)];
    for (let i = 0; i < cells.length; i++) grid[cells[i].row][cells[i].col] = word[i];
    placements[word] = cells;
  }
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!grid[row][col]) grid[row][col] = LETTERS[Math.floor(rng() * LETTERS.length)];
    }
  }
  return { size, grid, words: config.words.map(entry => ({ ...entry })), placements };
}

export function readScriptureWordLine(
  grid: readonly (readonly string[])[],
  start: WordCell,
  end: WordCell,
): { word: string; cells: WordCell[] } | null {
  const size = grid.length;
  if (size < 1 || grid.some(row => row.length !== size)) return null;
  if (![start.row, start.col, end.row, end.col].every(v => inBounds(v, size))) return null;
  const dr = end.row - start.row, dc = end.col - start.col;
  if (dr === 0 && dc === 0) return null;
  if (!(dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc))) return null;
  const length = Math.max(Math.abs(dr), Math.abs(dc)) + 1;
  const cells = pathFor(start.row, start.col, Math.sign(dr), Math.sign(dc), length);
  const word = cells.map(({ row, col }) => grid[row][col]).join('');
  return { word, cells };
}

export function scriptureWordAt(
  puzzle: WordPuzzle, start: WordCell, end: WordCell,
  found: readonly string[] = [],
): WordEntry | null {
  const line = readScriptureWordLine(puzzle.grid, start, end);
  if (!line) return null;
  const forward = puzzle.words.find(w => w.word === line.word && !found.includes(w.word));
  const reverse = puzzle.words.find(w => w.word === line.word.split('').reverse().join('') && !found.includes(w.word));
  return forward ?? reverse ?? null;
}
