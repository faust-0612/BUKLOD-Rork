// Lightweight spectral harmony suggestions from the uploaded recording.
// Not an exact transcription: solo melodies and polyphonic audio can admit multiple chord interpretations.
export type ChordHint = { root: number; minor: boolean; confidence: number };
export type HarmonySuggestion = {
  plan: ChordHint[];
  averageConfidence: number;
  lowConfidenceBars: number;
  bars: number;
  key: string;
};
const FFT_SIZE = 2048;
function fftMagnitudes(real: Float64Array, imaginary: Float64Array) {
  const n = real.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = real[i]; real[i] = real[j]; real[j] = tr;
      const ti = imaginary[i]; imaginary[i] = imaginary[j]; imaginary[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = -2 * Math.PI / len;
    const wlenR = Math.cos(angle), wlenI = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let wr = 1, wi = 0;
      for (let j = 0; j < len / 2; j++) {
        const a = i + j, b = a + len / 2;
        const ur = real[a], ui = imaginary[a];
        const vr = real[b] * wr - imaginary[b] * wi;
        const vi = real[b] * wi + imaginary[b] * wr;
        real[a] = ur + vr; imaginary[a] = ui + vi;
        real[b] = ur - vr; imaginary[b] = ui - vi;
        const nextWr = wr * wlenR - wi * wlenI;
        wi = wr * wlenI + wi * wlenR;
        wr = nextWr;
      }
    }
  }
}
function scoreChord(chroma: Float32Array, root: number, minor: boolean): number {
  const third = (root + (minor ? 3 : 4)) % 12;
  const fifth = (root + 7) % 12;
  const inside = 1.0 * chroma[root] + .83 * chroma[third] + .72 * chroma[fifth];
  const scale = 1 + .83 + .72;
  const outside = chroma.reduce((s, n, i) =>
    s + ((i === root || i === third || i === fifth) ? 0 : n), 0);
  return inside / scale - outside * .22 / 9;
}
export function estimateSongTempo(mono: Float32Array, rate: number): {bpm:number; confidence:string} {
  const step = Math.max(1, Math.round(rate * .02));
  const count = Math.min(Math.floor(mono.length / step), 2500);
  if (count < 30) return { bpm: 100, confidence: 'insufficient audio' };
  const env = new Float32Array(count);
  let previous = 0;
  for (let i = 0; i < count; i++) {
    let sum = 0;
    const start = i * step;
    for (let j = 0; j < step && start + j < mono.length; j += 16) {
      sum += Math.abs(mono[start+j]);
    }
    const volume = sum / Math.max(1, Math.ceil(step / 16));
    env[i] = Math.max(0, volume - previous);
    previous = volume;
  }
  let best = -1, second = -1, bestBpm = 100;
  for (let bpm = 65; bpm <= 160; bpm++) {
    const lag = Math.round(60 / bpm / .02);
    let sum = 0;
    for (let i = lag; i < count; i++) sum += env[i] * env[i-lag];
    if (sum > best) {
      second = best;
      best = sum;
      bestBpm = bpm;
    } else if (sum > second) second = sum;
  }
  return {
    bpm: bestBpm,
    confidence: best > 0 && second > 0 && (best - second) / best > .08
      ? 'rough estimate' : 'low confidence'
  };
}
export function analyzeSourceHarmony(
  mono: Float32Array,
  sampleRate: number,
  bpm: number
): HarmonySuggestion {
  const seconds = mono.length / sampleRate;
  const barDuration = Math.max(.8, Math.min(5, 240 / Math.max(60, Math.min(180, bpm))));
  const bars = Math.ceil(seconds / barDuration);
  const sums = Array.from({ length: bars }, () => new Float32Array(12));
  const counts = new Uint16Array(bars);
  const downsample = Math.max(1, Math.round(sampleRate / 11025));
  const reducedRate = sampleRate / downsample;
  const step = Math.max(1, Math.floor(sampleRate * .32));
  const windowLength = FFT_SIZE * downsample;
  const real = new Float64Array(FFT_SIZE);
  const imaginary = new Float64Array(FFT_SIZE);
  const hann = new Float64Array(FFT_SIZE);
  for (let k = 0; k < FFT_SIZE; k++) hann[k] = .5 - .5 * Math.cos(2 * Math.PI * k / (FFT_SIZE - 1));
  for (let start = 0; start + windowLength < mono.length; start += step) {
    const bar = Math.min(bars - 1, Math.floor((start / sampleRate) / barDuration));
    let power = 0;
    for (let j = 0; j < FFT_SIZE; j++) {
      real[j] = mono[start + j * downsample] * hann[j];
      imaginary[j] = 0;
      power += real[j] * real[j];
    }
    if (power < .0008) continue;
    fftMagnitudes(real, imaginary);
    const local = new Float32Array(12);
    for (let j = 10; j < FFT_SIZE / 2; j++) {
      const hz = j * reducedRate / FFT_SIZE;
      if (hz < 80 || hz > 1550) continue;
      const midi = Math.round(69 + 12 * Math.log2(hz / 440));
      const pitchClass = ((midi % 12) + 12) % 12;
      const magnitude = Math.hypot(real[j], imaginary[j]);
      local[pitchClass] += Math.sqrt(magnitude) / Math.sqrt(hz / 100);
    }
    const total = local.reduce((sum, n) => sum + n, 0);
    if (total < .0001) continue;
    for (let p = 0; p < 12; p++) sums[bar][p] += local[p] / total;
    counts[bar]++;
  }
  const keyNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const pitchProfile = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
  const allChroma = new Float32Array(12);
  for (const row of sums) for (let p = 0; p < 12; p++) allChroma[p] += row[p];
  let bestKey = 0, bestKeyScore = -Infinity;
  for (let k = 0; k < 12; k++) {
    let score = 0;
    for (let p = 0; p < 12; p++) score += allChroma[p] * pitchProfile[(p-k+12)%12];
    if (score > bestKeyScore) { bestKeyScore = score; bestKey = k; }
  }
  const plan: ChordHint[] = [];
  let confidenceSum = 0, lowConfidenceBars = 0;
  for (let b = 0; b < bars; b++) {
    const chroma = sums[b];
    const frames = counts[b];
    if (frames === 0) {
      plan.push({ root: b ? plan[b - 1].root : 0, minor: b ? plan[b - 1].minor : false, confidence: 0 });
      lowConfidenceBars++; continue;
    }
    let max = -Infinity, second = -Infinity, bestRoot = 0, bestMinor = false;
    for (let r = 0; r < 12; r++) {
      for (const minor of [false, true]) {
        const score = scoreChord(chroma, r, minor) +
          (b && plan[b - 1].root === r && plan[b - 1].minor === minor ? .003 : 0);
        if (score > max) {
          second = max; max = score; bestRoot = r; bestMinor = minor;
        } else if (score > second) second = score;
      }
    }
    const confidence = Math.max(0, Math.min(1, (max - second) * 1.8));
    if (confidence < .12) lowConfidenceBars++;
    confidenceSum += confidence;
    plan.push({ root: bestRoot, minor: bestMinor, confidence });
  }
  return {
    plan,
    averageConfidence: bars ? confidenceSum / bars : 0,
    lowConfidenceBars,
    bars,
    key: keyNames[bestKey]
  };
}
