import type { BuklodGameFeedbackEvent } from './feedbackTypes';
import { tryPlayRorkGameFeedback } from './rorkAudio';

type AudioContextLike = {
  currentTime: number;
  state?: string;
  destination: unknown;
  resume?: () => Promise<void>;
  createOscillator: () => any;
  createGain: () => any;
};

let audioContext: AudioContextLike | null = null;

function getAudioContext(): AudioContextLike | null {
  try {
    const scope = globalThis as any;
    const AudioContextCtor = scope.AudioContext ?? scope.webkitAudioContext;
    if (!AudioContextCtor) return null;
    if (!audioContext) audioContext = new AudioContextCtor();
    return audioContext;
  } catch {
    return null;
  }
}

async function ensureRunning(ctx: AudioContextLike) {
  try {
    if (ctx.state === 'suspended' && ctx.resume) await ctx.resume();
  } catch {
    // Sound is enhancement only and must never block gameplay.
  }
}

function tone(
  ctx: AudioContextLike,
  frequency: number,
  startOffset: number,
  duration: number,
  volume: number,
  type: 'sine' | 'triangle' | 'square' = 'sine',
) {
  try {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = ctx.currentTime + startOffset;
    const end = start + duration;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + Math.min(0.018, duration / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(end + 0.015);
  } catch {
    // Never interrupt a game because browser audio is unavailable.
  }
}

export async function playBuklodGameFeedback(event: BuklodGameFeedbackEvent) {
  if (tryPlayRorkGameFeedback(event, 0.24)) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  await ensureRunning(ctx);

  switch (event) {
    case 'move':
      tone(ctx, 330, 0, 0.055, 0.035, 'triangle');
      return;
    case 'collect':
      tone(ctx, 660, 0, 0.07, 0.055, 'sine');
      tone(ctx, 880, 0.055, 0.09, 0.045, 'sine');
      return;
    case 'impact':
      tone(ctx, 105, 0, 0.14, 0.07, 'square');
      tone(ctx, 78, 0.035, 0.16, 0.045, 'triangle');
      return;
    case 'success':
    case 'unlock':
      tone(ctx, 523.25, 0, 0.13, 0.055, 'sine');
      tone(ctx, 659.25, 0.09, 0.15, 0.055, 'sine');
      tone(ctx, 783.99, 0.18, 0.2, 0.06, 'sine');
      return;
    case 'failure':
      tone(ctx, 246.94, 0, 0.15, 0.05, 'triangle');
      tone(ctx, 196, 0.11, 0.19, 0.055, 'triangle');
      return;
  }
}
