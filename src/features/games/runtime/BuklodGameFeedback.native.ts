import * as Haptics from 'expo-haptics';
import { createAudioPlayer } from 'expo-audio';

import type { BuklodGameFeedbackEvent } from './feedbackTypes';
import { tryPlayRorkGameFeedback } from './rorkAudio';

const reactionSound = require('../../../../assets/sounds/buklod-reaction.wav');
const rewardSound = require('../../../../assets/sounds/buklod-points-claim.wav');

function playNativeSound(
  source: number,
  playbackRate: number,
  volume: number,
  cleanupDelay = 1100,
) {
  try {
    const player = createAudioPlayer(source);
    player.volume = volume;
    player.playbackRate = playbackRate;
    void player.seekTo(0).then(() => player.play()).catch(() => player.play());
    setTimeout(() => {
      try { player.remove(); } catch { /* sound must never block gameplay */ }
    }, cleanupDelay);
  } catch {
    // Audio is enhancement only. Haptics and gameplay continue if unavailable.
  }
}

export async function playBuklodGameFeedback(event: BuklodGameFeedbackEvent) {
  try {
    const usedRork = tryPlayRorkGameFeedback(event, 0.30);
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
