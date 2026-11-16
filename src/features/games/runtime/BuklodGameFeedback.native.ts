import * as Haptics from 'expo-haptics';
import { AppState } from 'react-native';
import { getBuklodSoundSettings, isBuklodGameSoundEnabled, getBuklodGameSoundVolume } from '@/lib/buklodSounds';
import { createAudioPlayer } from 'expo-audio';

import type { BuklodGameFeedbackEvent } from './feedbackTypes';
import { tryPlayRorkGameFeedback } from './rorkAudio';
import { emitBuklodGameCharacterMotion } from './characterMotionBus';
import { createBuklodGameFeedbackLimiter } from './feedbackThrottle';

const reactionSound = require('../../../../assets/sounds/kingdom-premium/collect-crystal.wav');
const impactSound = require('../../../../assets/sounds/kingdom-premium/impact-wood.wav');
const rewardSound = require('../../../../assets/sounds/kingdom-premium/victory.wav');
const unlockSound = require('../../../../assets/sounds/kingdom-premium/unlock.wav');
const failSound = require('../../../../assets/sounds/kingdom-premium/failure.wav');
const tapSound = require('../../../../assets/sounds/kingdom-premium/ui-soft.wav');
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
  // At most six short-lived voices, no player allocation if feedback is off.
  if (activeFallbackPlayers >= MAX_ACTIVE_FALLBACK_PLAYERS) return;
  activeFallbackPlayers += 1;
  let player: ReturnType<typeof createAudioPlayer> | null = null;
  let readySub: { remove(): void } | null = null;
  let stateSub: { remove(): void } | null = null;
  let released = false;
  let started = false;
  const cleanup = () => {
    if (released) return;
    released = true;
    readySub?.remove();
    stateSub?.remove();
    try { player?.pause(); } catch { /* already disposed */ }
    try { player?.remove(); } catch { /* enhancement only */ }
    activeFallbackPlayers = Math.max(0, activeFallbackPlayers - 1);
  };
  try {
    player = createAudioPlayer(source, { updateInterval: 200 });
    player.volume = volume;
    player.playbackRate = playbackRate;
    const readyPlayer = player;
    const startWhenReady = () => {
      if (released || started || !readyPlayer.isLoaded) return;
      if (AppState.currentState !== 'active' || !isBuklodGameSoundEnabled()) {
        cleanup();
        return;
      }
      started = true;
      try { readyPlayer.play(); } catch { cleanup(); }
    };
    readySub = readyPlayer.addListener('playbackStatusUpdate', status => {
      if (status.isLoaded) startWhenReady();
    });
    stateSub = AppState.addEventListener('change', state => {
      if (state !== 'active') cleanup();
    });
    startWhenReady();
    setTimeout(cleanup, cleanupDelay + 500);
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
        if (canSound && !usedRork) playNativeSound(event === 'unlock' ? unlockSound : rewardSound, event === 'unlock' ? 1.10 : 1, volume, 1500);
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
