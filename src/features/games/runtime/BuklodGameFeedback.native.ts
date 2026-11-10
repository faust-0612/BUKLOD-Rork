import * as Haptics from 'expo-haptics';
import { AppState } from 'react-native';
import { getBuklodSoundSettings, isBuklodGameSoundEnabled, getBuklodGameSoundVolume } from '@/lib/buklodSounds';
import { createAudioPlayer } from 'expo-audio';

import type { BuklodGameFeedbackEvent } from './feedbackTypes';
import { tryPlayRorkGameFeedback } from './rorkAudio';
import { emitBuklodGameCharacterMotion } from './characterMotionBus';
import { createBuklodGameFeedbackLimiter } from './feedbackThrottle';

const reactionSound = require('../../../../assets/sounds/buklod-reaction.wav');
const impactSound = require('../../../../assets/sounds/buklod_community.wav');
const successSound = require('../../../../assets/sounds/buklod_approval.wav');
const unlockSound = require('../../../../assets/sounds/buklod_achievement.wav');
const failSound = require('../../../../assets/sounds/buklod_error.wav');
const tapSound = require('../../../../assets/sounds/buklod_message_sent.wav');
void getBuklodSoundSettings();

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
    const canSound = AppState.currentState === 'active' && isBuklodGameSoundEnabled();
    const volume = getBuklodGameSoundVolume();
    const usedRork = canSound && tryPlayRorkGameFeedback(event, volume);
    switch (event) {
      case 'move':
        if (canSound && !usedRork) playNativeSound(tapSound, 1.32, volume * 0.65, 700);
        await Haptics.selectionAsync();
        return;
      case 'collect':
        if (canSound && !usedRork) playNativeSound(reactionSound, 1.7, volume, 800);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return;
      case 'impact':
        if (canSound && !usedRork) playNativeSound(impactSound, 0.8, volume, 1050);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        return;
      case 'success':
      case 'unlock':
        if (canSound && !usedRork) playNativeSound(event === 'unlock' ? unlockSound : successSound, event === 'unlock' ? 1.10 : 1, volume, 1500);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      case 'failure':
        if (canSound && !usedRork) playNativeSound(failSound, 0.9, volume * 0.80, 1200);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
    }
  } catch {
    // Game feedback must never block gameplay.
  }
}
