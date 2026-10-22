import type { AssetClass } from '@/lib/kabihasnang-ligaw/types';

export type AudioChannel = 'music' | 'ambient';

export type AudioDecision = {
  channel: AudioChannel;
  audible: boolean;
  yielded: boolean;
  autoplay: false;
  assetStatus: AssetClass;
  message: 'silent_missing' | 'silent_unapproved' | 'silent_failed' | 'yielded' | 'playing' | 'paused';
};

export function resolveAudioChannel(input: {
  channel: AudioChannel;
  assetStatus: AssetClass;
  userIntentPlaying: boolean;
  otherAudioPlaying: boolean;
  failed: boolean;
}): AudioDecision {
  const base = {
    channel: input.channel,
    autoplay: false as const,
    assetStatus: input.assetStatus,
  };

  if (input.assetStatus === 'MISSING' || input.assetStatus === 'REJECTED') {
    return { ...base, audible: false, yielded: false, message: 'silent_missing' };
  }
  if (input.assetStatus !== 'APPROVED') {
    return { ...base, audible: false, yielded: false, message: 'silent_unapproved' };
  }
  if (input.failed) {
    return { ...base, audible: false, yielded: false, message: 'silent_failed' };
  }
  if (!input.userIntentPlaying) {
    return { ...base, audible: false, yielded: false, message: 'paused' };
  }
  if (input.otherAudioPlaying) {
    return { ...base, audible: false, yielded: true, message: 'yielded' };
  }
  return { ...base, audible: true, yielded: false, message: 'playing' };
}

export function resumeAfterYield(input: {
  hadUserIntent: boolean;
  otherAudioPlaying: boolean;
  assetStatus: AssetClass;
}): boolean {
  return input.hadUserIntent && !input.otherAudioPlaying && input.assetStatus === 'APPROVED';
}
