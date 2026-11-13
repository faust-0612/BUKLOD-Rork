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
  let noiseSeed = ((Math.floor(e.at * 1000) + 27) * ¶»§q«^