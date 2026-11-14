import type { BuklodGameFeedbackEvent } from './feedbackTypes';
import { getBuklodSoundSettings, isBuklodGameSoundEnabled, getBuklodGameSoundVolume } from '@/lib/buklodSounds';
import { tryPlayRorkGameFeedback } from './rorkAudio';
import { emitBuklodGameCharacterMotion } from './characterMotionBus';
import { createBuklodGameFeedbackLimiter } from './feedbackThrottle';
void getBuklodSoundSettings();
const allowFeedback = createBuklodGameFeedbackLimiter();
export async function playBuklodGameFeedback(event: BuklodGameFeedbackEvent) {
  if (!allowFeedback(event)) return;
  emitBuklodGameCharacterMotion(event);
  if (isBuklodGameSoundEnabled()) tryPlayRorkGameFeedback(event, getBuklodGameSoundVolume());
  // No synthesized WebAudio ringtone fallback.
}
