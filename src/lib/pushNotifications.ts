import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import {
  ensureBuklodEmergencyChannel,
  registerBuklodEmergencyNotificationCategory,
} from '@/lib/buklodEmergencyAlertMode';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/* PATCH_171C_TOKEN_CHANNEL_V2 */
export async function registerPushToken(userId: string) {
  if (Platform.OS === 'web') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('buklod-activity-v2',{
      name:'BUKLOD Activity Alerts',
      importance:Notifications.AndroidImportance.MAX,
      vibrationPattern:[0,250,250,250],
      enableVibrate:true,
      showBadge:true
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;

  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (status !== 'granted') {
    return null;
  }

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId;

  if (!projectId) {
    console.warn('BUKLOD: Expo EAS projectId not found. Push token registration skipped.');
    return null;
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

  /* PATCH_171H_DEVICE_TOKEN_CLAIM_RPC
   * A physical Expo token can survive account switches on the same device.
   * Claim it through a narrow authenticated SECURITY DEFINER RPC instead of
   * trying to update another user's RLS-protected row directly.
   */
  const { error } = await supabase.rpc(
    'claim_device_token',
    {
      p_expo_push_token: token,
      p_platform: Platform.OS,
    }
  );

  if (error) {
    console.warn('BUKLOD: Could not save Expo push token:', error.message);
    return null;
  }

  /* BUKLOD_EMERGENCY_ALERT_MODE_R2_CAPABILITY
   * Route an Android SOS to buklod-emergency-v1 only after this exact device
   * has created the channel. Older/unopened clients remain on the proven
   * buklod-activity-v2 fallback so staged rollout cannot hide emergency alerts.
   */
  try {
    if (Platform.OS === 'android') {
      await ensureBuklodEmergencyChannel();
    }
    await registerBuklodEmergencyNotificationCategory();

    const { error: capabilityError } = await (supabase as any).rpc(
      'mark_device_emergency_alert_mode_r2',
      { p_expo_push_token: token },
    );
    if (capabilityError) {
      console.warn('BUKLOD: Emergency Alert Mode capability not registered:', capabilityError.message);
    }
  } catch (capabilityError) {
    console.warn('BUKLOD: Emergency Alert Mode channel setup unavailable:', capabilityError);
  }

  return token;
}

export function attachNotificationListeners(
  onReceived?: (notification: Notifications.Notification) => void,
  onResponse?: (response: Notifications.NotificationResponse) => void,
) {
  const received = Notifications.addNotificationReceivedListener((notification) => {
    onReceived?.(notification);
  });

  const response = Notifications.addNotificationResponseReceivedListener((event) => {
    onResponse?.(event);
  });

  return () => {
    received.remove();
    response.remove();
  };
}
