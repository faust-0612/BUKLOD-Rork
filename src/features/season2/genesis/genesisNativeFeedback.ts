/** Gesture-triggered, silent, non-blocking feedback; never affect production or navigation. */
import { AccessibilityInfo, AppState } from 'react-native';
import { getGenesisNativeFoundation } from './genesisNativeFoundation';
export async function pulseGenesisTouch(kind: 'selection'|'success'): Promise<void> {
  if (!getGenesisNativeFoundation().cosmeticHaptics || AppState.currentState !== 'active') return;
  try {
    if (await AccessibilityInfo.isReduceMotionEnabled()) return;
    const Haptics = await import('expo-haptics');
    if (kind === 'success') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else await Haptics.selectionAsync();
  } catch { /* Absent native vibration must not affect app operation. */ }
}
