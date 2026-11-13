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
function scoreChord(chr¶»§q«^