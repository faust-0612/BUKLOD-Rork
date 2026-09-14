import { Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export const BUKLOD_EMERGENCY_CHANNEL_ID = 'buklod-emergency-v1';
export const BUKLOD_EMERGENCY_CATEGORY_ID = 'buklod_emergency';
export const BUKLOD_EMERGENCY_ACK_ACTION = 'buklod_emergency_ack';
export const BUKLOD_EMERGENCY_ON_MY_WAY_ACTION = 'buklod_emergency_on_my_way';

export type BuklodEmergencyAlertModeState = {
  platform: string;
  supported: boolean;
  channelReady: boolean;
  bypassDnd: boolean;
  importance: number | null;
};

function emergencyChannelInput(): Notifications.NotificationChannelInput {
  return {
    name: 'BUKLOD Emergency Alerts',
    description: 'Urgent nearby BUKLOD SOS alerts. Enable Do Not Disturb access if you want these alerts to interrupt DND.',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    enableVibrate: true,
    vibrationPattern: [0, 900, 250, 900, 250, 1200],
    enableLights: true,
    lightColor: '#D92D20',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    showBadge: true,
    bypassDnd: true,
    audioAttributes: {
      usage: Notifications.AndroidAudioUsage.ALARM,
      contentType: Notifications.AndroidAudioContentType.SONIFICATION,
    },
  };
}

export async function registerBuklodEmergencyNotificationCategory() {
  await Notifications.setNotificationCategoryAsync(
    BUKLOD_EMERGENCY_CATEGORY_ID,
    [
      {
        identifier: BUKLOD_EMERGENCY_ACK_ACTION,
        buttonTitle: 'ACKNOWLEDGE',
        options: {
          opensAppToForeground: true,
          isAuthenticationRequired: false,
          isDestructive: false,
        },
      },
      {
        identifier: BUKLOD_EMERGENCY_ON_MY_WAY_ACTION,
        buttonTitle: 'ON MY WAY',
        options: {
          opensAppToForeground: true,
          isAuthenticationRequired: false,
          isDestructive: false,
        },
      },
    ],
  );
}

export async function ensureBuklodEmergencyChannel() {
  if (Platform.OS !== 'android') return null;
  return Notifications.setNotificationChannelAsync(
    BUKLOD_EMERGENCY_CHANNEL_ID,
    emergencyChannelInput(),
  );
}

export async function getBuklodEmergencyAlertModeState(): Promise<BuklodEmergencyAlertModeState> {
  if (Platform.OS !== 'android') {
    return {
      platform: Platform.OS,
      supported: Platform.OS === 'ios',
      channelReady: false,
      bypassDnd: false,
      importance: null,
    };
  }

  const channel = await Notifications.getNotificationChannelAsync(BUKLOD_EMERGENCY_CHANNEL_ID);
  return {
    platform: Platform.OS,
    supported: true,
    channelReady: Boolean(channel),
    bypassDnd: Boolean(channel?.bypassDnd),
    importance: channel?.importance ?? null,
  };
}

export async function rebuildBuklodEmergencyChannelForDnd() {
  if (Platform.OS !== 'android') return getBuklodEmergencyAlertModeState();
  await Notifications.deleteNotificationChannelAsync(BUKLOD_EMERGENCY_CHANNEL_ID).catch(() => undefined);
  await ensureBuklodEmergencyChannel();
  return getBuklodEmergencyAlertModeState();
}

export async function openBuklodDndAccessSettings() {
  if (Platform.OS !== 'android') {
    await Linking.openSettings();
    return;
  }

  try {
    await Linking.sendIntent('android.settings.NOTIFICATION_POLICY_ACCESS_SETTINGS');
  } catch {
    await Linking.openSettings();
  }
}

export async function openBuklodNotificationSettings() {
  await Linking.openSettings();
}

export async function sendBuklodEmergencyLocalTest() {
  await registerBuklodEmergencyNotificationCategory();
  if (Platform.OS === 'android') await ensureBuklodEmergencyChannel();

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'BUKLOD EMERGENCY ALERT TEST',
      body: 'This is a private test on this phone only. No nearby BUKLOD user was alerted.',
      sound: 'default',
      data: {
        kind: 'community_emergency_test',
        local_test: true,
      },
      interruptionLevel: Platform.OS === 'ios' ? 'timeSensitive' : undefined,
    },
    trigger: Platform.OS === 'android'
      ? { channelId: BUKLOD_EMERGENCY_CHANNEL_ID }
      : null,
  });
}

export function emergencyResponseTypeForAction(actionIdentifier: string) {
  if (actionIdentifier === BUKLOD_EMERGENCY_ON_MY_WAY_ACTION) return 'ON_MY_WAY' as const;
  if (
    actionIdentifier === BUKLOD_EMERGENCY_ACK_ACTION ||
    actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER
  ) {
    return 'ACKNOWLEDGED' as const;
  }
  return null;
}
