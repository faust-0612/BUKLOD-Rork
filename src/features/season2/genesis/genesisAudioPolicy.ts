/**
 * No procedural beeps, generic sound substitution or autoplay in social media.
 * Only licensed, mastered and verified local/streaming audio may enter the registry.
 * Playback implementation must share BUKLOD's audio-focus owner and obey device settings.
 */
export type GenesisAudioSurface =
  | 'home-hero' | 'kingdom' | 'character' | 'reward' | 'bible'
  | 'wall' | 'connect' | 'reels' | 'call' | 'ad';

export interface GenesisAudioContext {
  surface: GenesisAudioSurface;
  enabledByUser: boolean;
  approvedAsset: boolean;
  foreground: boolean;
  sceneFocused: boolean;
  otherMediaPlaying: boolean;
  callActive: boolean;
  adVisible: boolean;
  reducedAudio?: boolean;
}

export function resolveGenesisAudioPermission(context: GenesisAudioContext) {
  if (!['home-hero', 'kingdom', 'character', 'reward', 'bible'].includes(context.surface)) {
    return { allowed: false, reason: 'social-surface-silent' as const };
  }
  if (!context.approvedAsset) return { allowed: false, reason: 'asset-not-mastered' as const };
  if (!context.enabledByUser) return { allowed: false, reason: 'not-opted-in' as const };
  if (!context.foreground || !context.sceneFocused) return { allowed: false, reason: 'scene-offscreen' as const };
  if (context.otherMediaPlaying || context.callActive || context.adVisible || context.reducedAudio) {
    return { allowed: false, reason: 'audio-priority' as const };
  }
  return { allowed: true, reason: 'user-approved' as const };
}
