import * as Haptics from 'expo-haptics';

import type { BuklodGameFeedbackEvent } from './feedbackTypes';

export async function playBuklodGameFeedback(event: BuklodGameFeedbackEvent) {
  try {
    switch (event) {
      case 'move':
        await Haptics.selectionAsync();
        return;
      case 'collect':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return;
      case 'impact':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        return;
      case 'success':
      case 'unlock':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      case 'failure':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
    }
  } catch {
    // Game feedback must never block gameplay.
  }
}
