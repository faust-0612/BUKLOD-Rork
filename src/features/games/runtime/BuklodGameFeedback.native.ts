import * as Haptics from 'expo-haptics';
import { createAudioPlayer } from 'expo-audio';

import type { BuklodGameFeedbackEvent } from './feedbackTypes';
import { tryPlayRorkGameFeedback } from './rorkAudio';
import { emitBuklodGameCharacterMotion } from './characterMotionBus';
import { createBuklodGameFeedbackLimiter } from './feedbackThrottle';

const reactionSound = require('../../../../assets/sounds/buklod-reaction.wav');
const rewardSound = require('../../../../assets/sounds/buklod-points-claim.wav');

const allowFeedback = createBuklodGameFeedbackLimiter();
let activeFallbackPlayers = 0;
const MAX_ACTIVE_FALLBACK_PLAYERS = 6;

function playNativeSound(
  source: number,
  playbackRate: number,
  volume: number,
  cleanupDelay = 1100,
) {
  // Fast puzzle taps must never spawn an unbounded number of native players.
  if (activeFallbackPlayers >= MAX_ACTIVE_FALLBACK_PLAYERS) return;
  activeFallbackPlayers += 1;
  let player: ReturnType<typeof createAudioPlayer> | null = null;
  let released = false;
  const cleanup = () => {
    if (released) return;
    released = true;
    try { player?.remove(); } catch { /* sound must never block gameplay */ }
    activeFallbackPlayers = Math.max(0, activeFallbackPlayers - 1);
  };
  try {
    player = createAudioPlayer(source);
    player.volume = volume;
    player.playbackRate = playbackRate;
    void player.seekTo(0).then(() => {
      if (!released) player?.play();
    }).catch(() => {
      if (!released) {
        try { player?.play(); } catch { /* optional feedback */ }
      }
    });
    setTimeout(cleanup, cleanupDelay);
  } catch {
    cleanup();
  }
}

export async function playBuklodGameFeedback(event: BuklodGameFeedbackEvent) {
  if (!allowFeedback(event)) return;
  emitBuklodGameCharacterMotion(event);
  try {
    // Use Rork SFX only after they are actually loaded; otherwise keep the
    // shipped local WAV path. Haptics always remain active.
    const usedRork = tryPlayRorkGameFeedback(event, 0.28);
    switch (event) {
      case 'move':
        if (!usedRork) playNativeSound(reactionSound, 1.55, 0.18, 700);
        await Haptics.selectionAsync();
        return;
      case 'collect':
        if (!usedRork) playNativeSound(reactionSound, 1.85, 0.28, 800);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return;
      case 'impact':
        if (!usedRork) playNativeSound(reactionSound, 0.72, 0.32, 1050);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        return;
      case 'success':
      case 'unlock':
        if (!usedRork) playNativeSound(rewardSound, event === 'unlock' ? 1.18 : 1, 0.42, 1500);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      case 'failure':
        if (!usedRork) playNativeSound(reactionSound, 0.5, 0.30, 1300);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
    }
  } catch {
    // Game feedback must never block gameplay.
  }
}
