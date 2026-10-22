import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { StreamVideoRN } from '@/lib/streamVideoSdk';
import { pttUp, subscribeBuklodPttRuntime } from './buklodPttRuntime';
import type { BuklodPttKind } from './buklodPttCore';

let armedKind: BuklodPttKind = 'NORMAL';
let started = false;
export function setBuklodPttArmedKind(kind: BuklodPttKind) { armedKind = kind; }
export function getBuklodPttArmedKind() { return armedKind; }

async function dismissLegacyDutyNotifications() {
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(presented.filter(item => item.request.content.data?.kind === 'ptt_duty')
      .map(item => Notifications.dismissNotificationAsync(item.request.identifier)));
  } catch {}
}

export function startBuklodPttDutyNotifications() {
  if (started || Platform.OS === 'web') return;
  started = true;
  void dismissLegacyDutyNotifications();
  subscribeBuklodPttRuntime(state => {
    if (Platform.OS !== 'android') return;
    try {
      StreamVideoRN.updateConfig?.({
        foregroundService: { android: { notificationTexts: state.connection ? {
          title: `BUKLOD PTT · CH${String(state.connection.channel).padStart(2, '0')}`,
          body: 'Nagsasalita',
        } : {
          title: 'Call in progress', body: 'Tap to return to the call',
        } } },
      });
    } catch {}
    // Stream owns the foreground notice only while the held-button call exists.
    // Do not recreate the old sticky listen/Talk notification.
  });
}

export function handleBuklodPttDutyResponse(response: {
  actionIdentifier?: string;
  notification?: { request?: { content?: { data?: any } } };
} | null | undefined) {
  if (response?.notification?.request?.content?.data?.kind !== 'ptt_duty') return false;
  if (response.actionIdentifier === 'PTT_STOP') {
    void pttUp();
  } else {
    // A notification tap has no release event, so it must never start transmitting.
    try { router.push('/personal-home/ptt' as any); } catch {}
  }
  void dismissLegacyDutyNotifications();
  return true;
}
