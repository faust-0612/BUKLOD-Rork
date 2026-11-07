/** Deterministic Mastermind-style code-breaking rules; game mastery only. */
export const CODE_LEVELS = [
  { en: 'Open the Gate', tl: 'Buksan ang Pinto', digits: 3, palette: 5, attempts: 8, seed: 0x24123 },
  { en: 'The Hidden Observatory', tl: 'Ang Nakatagong Obserbatoryo', digits: 4, palette: 6, attempts: 7, seed: 0x29477 },
  { en: 'The Last Relic', tl: 'Ang Huling Relikya', digits: 5, palette: 7, attempts: 7, seed: 0x34253 },
] as const;

export type CodeFeedback = { exact: number; displaced: number };
export type CodeGuess = { digits: number[]; feedback: CodeFeedback };
export type CodeRound = {
  level: number;
  secret: number[];
  history: CodeGuess[];
  hintedIndex: number | null;
  status: 'playing' | 'won' | 'lost';
  score: number;
};

function seeded(seed: number): () => number {
  let state = (seed | 0) || 1;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

export function makeCodeSecret(level: number): number[] {
  const config = CODE_LEVELS[level];
  if (!config || !Number.isInteger(level)) throw new Error('Invalid code level');
  const rand = seeded(config.seed);
  const items = Array.from({ length: config.palette }, (_, i) => i + 1);
  for (let index = items.length - 1; index > 0; index--) {
    const candidate = Math.floor(rand() * (index + 1));
    [items[index], items[candidate]] = [items[candidate], items[index]];
  }
  return items.slice(0, config.digits);
}

export function codeGuessValid(guess: readonly number[], config: { digits: number; palette: number }): boolean {
  return guess.length === config.digits &&
    guess.every(digit => Number.isInteger(digit) && digit >= 1 && digit <= config.palette) &&
    new Set(guess).size === config.digits;
}

export function evaluateCodeGuess(secret: readonly number[], guess: readonly number[]): CodeFeedback {
  if (secret.length !== guess.length || new Set(secret).size !== secret.length ||
      new Set(guess).size !== guess.length) throw new Error('Non-unique or mismatched code');
  let exact = 0, shared = 0;
  for (let i = 0; i < secret.length; i++) {
    if (secret[i] === guess[i]) exact++;
    if (secret.includes(guess[i])) shared++;
  }
  return { exact, displaced: shared - exact };
}

export function createCodeRound(level: number): CodeRound {
  return { level, secret: makeCodeSecret(level), history: [], hintedIndex: null, status: 'playing', score: 0 };
}

export function applyCodeGuess(round: CodeRound, guess: readonly number[]): CodeRound {
  if (round.status !== 'playing') throw new Error('Code round already finished');
  const config = CODE_LEVELS[round.level];
  if (!config || !codeGuessValid(guess, config)) throw new Error('Illegal code guess');
  const feedback = evaluateCodeGuess(round.secret, guess);
  const history = [...round.history, { digits: [...guess], feedback }];
  const won = feedback.exact === config.digits;
  const lost = !won && history.length >= config.attempts;
  return {
    ...round, history,
    status: won ? 'won' : lost ? 'lost' : 'playing',
    score: won ? (config.attempts - history.length + 1) * 130 +
      (round.hintedIndex === null ? 150 : 0) : 0,
  };
}

export function applyCodeHint(round: CodeRound): CodeRound {
  if (round.status !== 'playing' || round.hintedIndex !== null) return round;
  return { ...round, hintedIndex: 0 };
}
