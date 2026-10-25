import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { router } from 'expo-router';

import { StreamVideoRN } from '@/lib/streamVideoSdk';

import {
  getBuklodPttRuntimeState,
  pttDown,
  pttUp,
  subscribeBuklodPttRuntime,
  type BuklodPttRuntimeState,
} from './buklodPttRuntime';
import type { BuklodPttKind } from './buklodPttCore';

const CHANNEL_ID = 'buklod-ptt-duty-v1';
const CATEGORY_ID = 'buklod_ptt_duty';
const TALK_ACTION = 'PTT_TALK';
const STOP_ACTION = 'PTT_STOP';

let armedKind: BuklodPttKind = 'NORMAL';
let started = false;
let shownId: string | null = null;
let signature = '';
let syncing = false;
let queued = false;
let configured = false;

export function setBuklodPttArmedKind(kind: BuklodPttKind) {
  armedKind = kind;
}

export function getBuklodPttArmedKind() {
  return armedKind;
}

function channelLabel(channel: number) {
  return `CH${String(channel).padStart(2, '0')}`;
}

function applyKeepAliveCopy(state: BuklodPttRuntimeState) {
  if (Platform.OS !== 'android') return;

  const connection = state.connection;
  const texts = connection
    ? {
        title: `BUKLOD PTT · ${channelLabel(connection.channel)}`,
        body: state.transmitting ? 'Nagsasalita' : 'Nakikinig',
      }
    : {
        title: 'Call in progress',
        body: 'Tap to return to the call',
      };

  try {
    StreamVideoRN.updateConfig?.({
      foregroundService: {
        android: {
          notificationTexts: texts,
        },
      },
    });
  } catch {}
}

async function ensureDutyNotification() {
  if (configured || Platform.OS === 'web') return;
  configured = true;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'BUKLOD PTT',
      description: 'On-duty push-to-talk.',
      importance: Notifications.AndroidImportance.DEFAULT,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      enableVibrate: false,
      showBadge: false,
      sound: null,
    });
  }

  await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
    {
      identifier: TALK_ACTION,
      buttonTitle: 'Talk',
      options: {
        opensAppToForeground: false,
        isAuthenticationRequired: false,
        isDestructive: false,
      },
    },
    {
      identifier: STOP_ACTION,
      buttonTitle: 'Stop',
      options: {
        opensAppToForeground: false,
        isAuthenticationRequired: false,
        isDestructive: false,
      },
    },
  ]);
}

// Clear only BUKLOD duty notifications, never unrelated alerts or
// the Stream foreground-service notification managed by native code.
async function dismissStaleDutyNotifications() {
  const presented = await Notifications.getPresentedNotificationsAsync();
  await Promise.all(presented
    .filter(item => item.request.content.data?.kind === 'ptt_duty')
    .map(item => Notifications.dismissNotificationAsync(item.request.identifier)
      .catch(() => undefined)));
}

async function syncDutyNotification(state: BuklodPttRuntimeState) {
  applyKeepAliveCopy(state);

  if (Platform.OS !== 'android') return;

  const connection = state.connection;
  const nextSignature = connection
    ? `${connection.callId}|${connection.channel}|${state.transmitting ? 'tx' : 'rx'}`
    : '';

  if (nextSignature === signature && (connection ? shownId : !shownId)) {
    return;
  }

  if (syncing) {
    queued = true;
    return;
  }

  syncing = true;
  signature = nextSignature;

  try {
    if (!connection) {
      await dismissStaleDutyNotifications();
      if (shownId) {
        await Notifications.dismissNotificationAsync(shownId).catch(() => undefined);
        shownId = null;
      }
      return;
    }

    const permission = await Notifications.getPermissionsAsync();
    let status = permission.status;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return;

    await ensureDutyNotification();

    // On restart shownId is lost, so dismiss matching presented duty
    // notifications as well as the current in-memory one.
    await dismissStaleDutyNotifications();
    if (shownId) {
      await Notifications.dismissNotificationAsync(shownId).catch(() => undefined);
      shownId = null;
    }

    const label = channelLabel(connection.channel);
    shownId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `BUKLOD PTT · ${label}`,
        body: state.transmitting
          ? 'Nagsasalita. Pindutin ang Stop para makinig.'
          : 'Nakikinig. Pindutin ang Talk para magsalita.',
        sticky: true,
        autoDismiss: false,
        sound: false,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        categoryIdentifier: CATEGORY_ID,
        data: {
          kind: 'ptt_duty',
          channel: connection.channel,
          scope_id: connection.scope.id,
        },
      },
      trigger: null,
    });
  } catch {
  } finally {
    syncing = false;
    if (queued) {
      queued = false;
      void syncDutyNotification(getBuklodPttRuntimeState());
    }
  }
}

export function startBuklodPttDutyNotifications() {
  if (started || Platform.OS === 'web') return;
  started = true;
  subscribeBuklodPttRuntime((state) => {
    void syncDutyNotification(state);
  });
}

export function handleBuklodPttDutyResponse(response: {
  actionIdentifier?: string;
  notification?: { request?: { content?: { data?: any } } };
} | null | undefined) {
  const data = response?.notification?.request?.content?.data;
  if (data?.kind !== 'ptt_duty') return false;

  const action = String(response?.actionIdentifier || '');

  if (action === TALK_ACTION) {
    void pttDown(armedKind).catch(() => undefined);
    return true;
  }

  if (action === STOP_ACTION) {
    void pttUp().catch(() => undefined);
    return true;
  }

  try {
    router.push('/personal-home/ptt' as any);
  } catch {}

  return true;
}
