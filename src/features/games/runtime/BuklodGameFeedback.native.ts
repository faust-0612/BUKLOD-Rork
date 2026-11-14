import * as Haptics from 'expo-haptics';
import { AppState } from 'react-native';
import { getBuklodSoundSettings, isBuklodGameSoundEnabled, getBuklodGameSoundVolume } from '@/lib/buklodSounds';
import type { BuklodGameFeedbackEvent } from './feedbackTypes';
import { tryPlayRorkGameFeedback } from './rorkAudio';
import { emitBuklodGameCharacterMotion } from './characterMotionBus';
import { createBuklodGameFeedbackLimiter } from './feedbackThrottle';
void getBuklodSoundSettings();
const allowFeedback = createBuklodGameFeedbackLimiter();
export async function playBuklodGameFeedback(event: BuklodGameFeedbackEvent) {
  if (!allowFeedback(event)) return;
  emitBuklodGameCharacterMotion(event);
  try {
    if (AppState.currentState === 'active' && isBuklodGameSoundEnabled())
      tryPlayRorkGameFeedback(event, getBuklodGameSoundVolume());
    // Optional sound failure stays haptic-only: never use generic notification chimes.
    switch (event) {
      case 'move': await Haptics.selectionAsync(); return;
      case 'collect': await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); return;
      case 'impact': await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); return;
      case 'success':
      case 'unlock': await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); return;
      case 'failure': await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return;
    }
  } catch { /* Audio never blocks gameplay. */ }
}
