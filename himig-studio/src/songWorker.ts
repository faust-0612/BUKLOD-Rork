import { createMusicEvents } from './arrangement';
import { analyzeSourceHarmony, estimateSongTempo } from './sourceHarmony';
import type { Config, Part } from './arrangement';

type RenderTask = {
  type: 'render';
  mono: Float32Array;
  backing?: Float32Array;
  sampleRate: number;
  mode: 'preserve' | 'polish' | 'suggest';
  config: Config;
  backingLevel: number;
  gain: number;
};
type NoteEvent = {
  at: number; end: number; note: number; vol: number;
  part: Part; pan: number;
};
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<RenderTask>) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};
const TWO_PI = Math.PI * 2;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const yieldThread = () => new Promise<void>(resolve => setTimeout(resolve, 0));
function progress(percent: number, message: string) {
  scope.postMessage({ type: 'progress', percent, message });
}
function renderPart(e: NoteEvent, left: Float32Array, right: Float32Array, from: number, rate: number) {
  const start = Math.max(0, Math.floor(e.at * rate) - from);
  const end = Math.min(left.length, Math.ceil(e.end * rate) - from);
  if (end <= start) return;
  const frequency = 440 * Math.pow(2, (e.note - 69) / 12);
  const duration = e.end - e.at;
  const panL = Math.sqrt((1 - clamp(e.pan, -1, 1)) / 2);
  const panR = Math.sqrt((1 + clamp(e.pan, -1, 1)) / 2);
  let noiseSeed = ((Math.floor(e.at * 1000) + 27) * 1664525 + e.note * 1013904223) >>> 0;
  for (let j = start; j < end; j++) {
    const t = (from + j) / rate - e.at;
    if (t < 0 || t >= duration) continue;
    const attack = Math.min(1, t / (e.part === 'strings' ? .11 : .008));
    const release = Math.min(1, (duration - t) / (e.part === 'strings' ? .12 : .035));
    const envelope = Math.max(0, Math.min(attack, release));
    let signal: number;
    if (e.part === 'drums') {
      if (e.note === 36) {
        const phase = TWO_PI * (135 * t - 80 * t * t);
        signal = Math.sin(phase) * Math.exp(-28 * t) * 1.5;
      } else {
        noiseSeed = (Math.imul(noiseSeed, 1664525) + 1013904223) >>> 0;
        const white = noiseSeed / 2147483648 - 1;
        signal = white * Math.exp(-(e.note === 42 ? 78 : 24) * t) *
          (e.note === 42 ? .62 : 1.3);
      }
    } else {
      const angle = TWO_PI * frequency * t;
      const fundamental = Math.sin(angle);
      if (e.part === 'piano') {
        signal = (fundamental + .3 * Math.sin(angle * 2) + .1 * Math.sin(angle * 3)) *
          Math.exp(-1.45 * t);
      } else if (e.part === 'guitar') {
        signal = (fundamental + .45 * Math.sin(angle * 2) + .2 * Math.sin(angle * 3)) *
          Math.exp(-6.3 * t);
      } else if (e.part === 'bass') {
        signal = (fundamental * .85 + .19 * Math.sin(angle * 2)) *
          Math.exp(-1.15 * t);
      } else {
        signal = (fundamental + .19 * Math.sin(angle * 2) +
          .065 * Math.sin(angle * 3)) * (.83 + .06 * Math.sin(TWO_PI * 4.9 * t));
      }
    }
    const amp = signal * envelope * e.vol;
    left[j] += amp * panL;
    right[j] += amp * panR;
  }
}

async function render(task: RenderTask) {
  const { mono, sampleRate: rate, config, mode, backing, backingLevel, gain } = task;
  const frameCount = mono.length;
  if (rate < 8000 || rate > 48000 || frameCount < 64 ||
      frameCount / rate > 240 || !Number.isFinite(gain)) {
    throw new Error('Audio format, length or level is unsupported.');
  }
  if (!config.parts.length) throw new Error('Choose at least one instrument.');
  progress(1, 'Analyzing tempo, key and harmonic movement from the uploaded song');
  const tempoDetection = config.bpm === 0
    ? estimateSongTempo(mono, rate)
    : { bpm: config.bpm, confidence: 'manual' };
  const harmony = config.progression === 'source' || config.key === '__AUTO__'
    ? analyzeSourceHarmony(mono, rate, tempoDetection.bpm)
    : null;
  const resolvedConfig: Config = {
    ...config,
    bpm: tempoDetection.bpm,
    key: config.key === '__AUTO__' ? (harmony?.key || 'C') : config.key
  };
  if (harmony && harmony.lowConfidenceBars / Math.max(1,harmony.bars) > .90) {
    throw new Error('The recording does not provide enough reliable harmony evidence. Choose a manually confirmed chord progression to avoid inaccurate accompaniment.');
  }
  const { events, chords } = createMusicEvents(resolvedConfig, frameCount / rate, config.progression === 'source' ? harmony?.plan : undefined);
  if (!events.length) throw new Error('No instrument notes were scheduled.');
  // Stereo output is allocated once; small per-chunk buffers keep Android memory bounded.
  const stereo = new Int16Array(frameCount * 2);
  const chunk = Math.floor(rate * 1.5);
  let previous = 0, hp = 0, envelope = 0, low = 0;
  const hpAlpha = (1 / (TWO_PI * 78)) / ((1 / (TWO_PI * 78)) + 1 / rate);
  const lowAlpha = 1 - Math.exp(-TWO_PI * 3200 / rate);
  const attack = Math.exp(-1 / (rate * .009));
  const release = Math.exp(-1 / (rate * .085));
  const echoSizeL = Math.max(1, Math.ceil(rate * .052));
  const echoSizeR = Math.max(1, Math.ceil(rate * .074));
  const echoL = new Float32Array(echoSizeL), echoR = new Float32Array(echoSizeR);
  let musicSum = 0, outputSum = 0;
  const selected = new Set(config.parts);
  const strength = config.strength / 100;
  const vocal = config.vocal / 100;
  const ambience = config.ambience / 100;
  progress(2, 'Starting offline vocal and instrument processing');
  for (let start = 0; start < frameCount; start += chunk) {
    const end = Math.min(frameCount, start + chunk);
    const length = end - start;
    const left = new Float32Array(length);
    const right = new Float32Array(length);
    const startTime = start / rate;
    const endTime = end / rate;
    // Every instrument note is synthesized in this worker, with no soundfont downloads.
    for (const e of events) {
      if (selected.has(e.part) && e.at < endTime && e.end > startTime) {
        renderPart(e, left, right, start, rate);
      }
    }
    for (let i = 0; i < length; i++) {
      const p = start + i;
      const input = mono[p];
      let clean = input;
      if (mode !== 'suggest') {
        hp = hpAlpha * (hp + input - previous);
        previous = input;
        low += lowAlpha * (hp - low);
        const sibilance = hp - low;
        const essGain = mode === 'polish'
          ? 1 - Math.min(.35, Math.max(0, (Math.abs(sibilance) - .045) * 2))
          : 1;
        const sample = low + essGain * sibilance;
        const abs = Math.abs(sample);
        const smooth = abs > envelope ? attack : release;
        envelope = smooth * envelope + (1 - smooth) * abs;
        const threshold = mode === 'preserve' ? .35 : .25;
        const ratio = mode === 'preserve' ? 1.5 : 2.7;
        const compression = envelope > threshold
          ? Math.pow(threshold / Math.max(.00001, envelope), 1 - 1 / ratio)
          : 1;
        const noiseReduction = Math.min(1, .15 + envelope * 170);
        clean = sample * compression * noiseReduction * gain;
      }
      const lPos = p % echoSizeL;
      const rPos = p % echoSizeR;
      const lEcho = echoL[lPos], rEcho = echoR[rPos];
      echoL[lPos] = clean * .55 + lEcho * .21;
      echoR[rPos] = clean * .55 + rEcho * .2;
      const oldBacking = backing && p < backing.length ? backing[p] * backingLevel : 0;
      const duck = 1 - Math.min(.2, Math.abs(clean) * .3);
      const instrumentalL = left[i] * strength * duck + oldBacking;
      const instrumentalR = right[i] * strength * duck + oldBacking;
      musicSum += (instrumentalL * instrumentalL + instrumentalR * instrumentalR) / 2;
      const mixL = (clean * vocal + lEcho * ambience * .3 + instrumentalL) * .82;
      const mixR = (clean * vocal + rEcho * ambience * .31 + instrumentalR) * .82;
      const limitedL = clamp(Math.tanh(mixL * 1.2) / Math.tanh(1.2), -.96, .96);
      const limitedR = clamp(Math.tanh(mixR * 1.2) / Math.tanh(1.2), -.96, .96);
      stereo[p * 2] = Math.round(limitedL * 32767);
      stereo[p * 2 + 1] = Math.round(limitedR * 32767);
      outputSum += (limitedL * limitedL + limitedR * limitedR) / 2;
    }
    progress(2 + Math.round(96 * end / frameCount),
      'Rendering original voice + ' + config.parts.join(', ') + ' · ' +
      Math.round(100 * end / frameCount) + '%');
    await yieldThread();
  }
  const backingRms = Math.sqrt(musicSum / frameCount);
  const rms = Math.sqrt(outputSum / frameCount);
  if (rms < .0001 || backingRms < .00003)
    throw new Error('Render produced silence. Please check the recording and instrument levels.');
  const result = {
    eventCount: events.length,
    chords, sampled: [],
    synthesized: config.parts.filter(part => part !== 'drums'),
    rms, backingRms,
    harmonyConfidence: harmony?.averageConfidence,
    lowConfidenceBars: harmony?.lowConfidenceBars,
    totalBars: harmony?.bars,
    resolvedConfig,
    songAnalysis: { key: resolvedConfig.key, bpm: resolvedConfig.bpm, confidence: tempoDetection.confidence }
  };
  scope.postMessage({ type: 'complete', stereo, result }, [stereo.buffer]);
}
scope.onmessage = (event: MessageEvent<RenderTask>) => {
  if (event.data?.type !== 'render') return;
  void render(event.data).catch(e => {
    scope.postMessage({
      type: 'error',
      message: e instanceof Error ? e.message : 'Audio worker failed.'
    });
  });
};
