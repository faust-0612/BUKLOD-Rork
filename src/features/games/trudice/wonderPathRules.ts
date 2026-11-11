/** Pure, replayable gameplay for Trudice's Wonder Path. No account/points side effects. */
export type WonderStation = 0 | 1 | 2 | 3;
export type WonderMode = 'follow' | 'spotlight' | 'avoid' | 'reverse' | 'rescue';
export type WonderChallenge = {
  round: number;
  mode: WonderMode;
  cues: WonderStation[];
  answer: WonderStation[];
  blocked: WonderStation | null;
  titleEn: string;
  titleTl: string;
  instructionsEn: string;
  instructionsTl: string;
};
export const WONDER_TOTAL_ROUNDS = 5;
export const WONDER_STARTING_HEARTS = 3;

function nextRandom(seed: number) {
  // Avalanche nearby replay seeds before xorshift; otherwise adjacent seeds
  // may generate the exact same four-station ordering over and over.
  let state = (seed ^ 0x9e3779b9) >>> 0;
  state = Math.imul(state ^ (state >>> 16), 0x7feb352d);
  state = Math.imul(state ^ (state >>> 15), 0x846ca68b);
  state = (state ^ (state >>> 16)) >>> 0 || 0x6d2b79f5;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}
function shuffledStations(random: () => number): WonderStation[] {
  const ids: WonderStation[] = [0, 1, 2, 3];
  for (let index = ids.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [ids[index], ids[swap]] = [ids[swap], ids[index]];
  }
  return ids;
}
function extendPath(stations: readonly WonderStation[], length: number, random: () => number): WonderStation[] {
  // Always begin with every available station; then add non-repeating steps.
  const route = [...stations];
  while (route.length < length) {
    const candidates = stations.filter(id => id !== route[route.length - 1]);
    route.push(candidates[Math.floor(random() * candidates.length)]);
  }
  return route.slice(0, length);
}
export function buildWonderChallenge(round: number, runSeed: number): WonderChallenge {
  if (!Number.isInteger(round) || round < 1 || round > WONDER_TOTAL_ROUNDS ||
      !Number.isFinite(runSeed)) throw new Error('Invalid Wonder Path round or seed');
  const random = nextRandom((runSeed | 0) ^ Math.imul(round, 0x9e3779b1));
  const shuffled = shuffledStations(random);
  if (round === 1) return {
    round, mode: 'follow', cues: shuffled, answer: [...shuffled], blocked: null,
    titleEn: 'The Lantern Trail', titleTl: 'Landas ng mga Ilaw',
    instructionsEn: 'Watch four different playground stops, then follow the same route.',
    instructionsTl: 'Panoorin ang apat na lugar, saka sundan ang tamang pagkakasunod.',
  };
  if (round === 2) {
    const [twice, other, last] = shuffled;
    return {
      round, mode: 'spotlight', cues: [twice, other, twice, last], answer: [twice], blocked: null,
      titleEn: 'Find the Double Glow', titleTl: 'Hanapin ang Dobleng Ilaw',
      instructionsEn: 'Watch carefully. Which station lights up TWICE? Tap only that station.',
      instructionsTl: 'Aling lugar ang umilaw nang DALAWANG BESES? I-tap iyon lamang.',
    };
  }
  if (round === 3) {
    const [blocked, ...safe] = shuffled;
    const cues = extendPath(safe, 5, random);
    return {
      round, mode: 'avoid', cues, answer: [...cues], blocked,
      titleEn: 'The Safe Crossing', titleTl: 'Ligtas na Tawiran',
      instructionsEn: 'Replay the glowing route without stepping on the red blocked station.',
      instructionsTl: 'Sundan ang mga ilaw; iwasan ang pulang nakaharang na lugar.',
    };
  }
  if (round === 4) {
    const cues = extendPath(shuffled, 6, random);
    return {
      round, mode: 'reverse', cues, answer: [...cues].reverse(), blocked: null,
      titleEn: 'Mirror the Magic', titleTl: 'Baliktaring Mahika',
      instructionsEn: 'Watch the glowing route. Then tap the stations in REVERSE order.',
      instructionsTl: 'Tandaan ang ruta. I-tap ang mga lugar nang PABALIKTAD.',
    };
  }
  const [blocked, ...safe] = shuffled;
  const cues = extendPath(safe, 7, random);
  return {
    round, mode: 'rescue', cues, answer: [...cues], blocked,
    titleEn: 'Rescue the Wonder Stars', titleTl: 'Sagipin ang Wonder Stars',
    instructionsEn: 'Complete the seven-step rescue path. Avoid the red station to restore the haven.',
    instructionsTl: 'Kumpletuhin ang pitong hakbang at iwasan ang pulang lugar para maibalik ang hardin.',
  };
}
export function checkWonderStep(challenge: WonderChallenge, index: number, station: number):
  'correct' | 'wrong' | 'cleared' {
  if (!Number.isInteger(index) || index < 0 || index >= challenge.answer.length ||
      !Number.isInteger(station) || station < 0 || station > 3 ||
      challenge.blocked === station) return 'wrong';
  if (challenge.answer[index] !== station) return 'wrong';
  return index === challenge.answer.length - 1 ? 'cleared' : 'correct';
}
