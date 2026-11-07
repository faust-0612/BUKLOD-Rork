/** Trudice Picture Pairs: seeded memory deck, two-card turn machine. */
export type PairCard = { id: number; symbol: number };
export type PairRound = {
  level: number;
  deck: PairCard[];
  up: number[];
  matched: number[];
  turns: number;
  misses: number;
  status: 'playing' | 'won';
  score: number;
};
export const PAIR_LEVELS = [
  { pairs: 6, columns: 4, seed: 0x13d6f },
  { pairs: 8, columns: 4, seed: 0x33fd1 },
  { pairs: 10, columns: 5, seed: 0x54ed3 },
] as const;
export const PAIR_SYMBOLS = ['🌻', '🦋', '🍀', '🌈', '🐝', '🌷', '⭐', '🎨', '🪄', '🧩'] as const;
function randSeed(seed: number) {
  let n = seed | 0;
  return () => {
    n ^= n << 13; n ^= n >>> 17; n ^= n << 5;
    return (n >>> 0) / 4294967296;
  };
}
export function createPairRound(level: number): PairRound {
  const spec = PAIR_LEVELS[level];
  if (!spec || !Number.isInteger(level)) throw new Error('Invalid memory level');
  const rng = randSeed(spec.seed);
  const deck = Array.from({ length: spec.pairs * 2 }, (_, i) => ({ id: i, symbol: i % spec.pairs }));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return { level, deck, up: [], matched: [], turns: 0, misses: 0, status: 'playing', score: 0 };
}
/** Flip is synchronous and returns original reference on ignored/locked input. */
export function flipPair(run: PairRound, id: number): PairRound {
  if (run.status !== 'playing' || run.up.length >= 2 ||
      run.matched.includes(id) || run.up.includes(id)) return run;
  const card = run.deck.find(x => x.id === id);
  if (!card) return run;
  if (run.up.length === 0) return { ...run, up: [id] };
  const first = run.deck.find(x => x.id === run.up[0]);
  if (!first) return run;
  const turns = run.turns + 1;
  if (first.symbol !== card.symbol)
    return { ...run, up: [run.up[0], id], turns, misses: run.misses + 1 };
  const matched = [...run.matched, run.up[0], id];
  const won = matched.length === run.deck.length;
  return {
    ...run, up: [], turns, matched,
    score: run.score + Math.max(50, 200 - run.misses * 5),
    status: won ? 'won' : 'playing',
  };
}
/** Called after an animation delay; ignores stale resolutions after a match or restart. */
export function settlePairMismatch(run: PairRound, expectedIds: readonly number[]): PairRound {
  if (run.status !== 'playing' || run.up.length !== 2 ||
      run.up[0] !== expectedIds[0] || run.up[1] !== expectedIds[1]) return run;
  return { ...run, up: [] };
}
