import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async notification => {
    const kind = String(notification.request.content.data?.kind ?? '');
    // Suppress only routine PTT foreground cards. Closed-app PTT receive,
    // Priority and SOS continue through the existing transport pipeline.
    const show = kind !== 'ptt_incoming';
    return {
      shouldPlaySound: show && ['community_emergency', 'ptt_sos', 'ptt_priority'].includes(kind),
      shouldSetBadge: show,
      shouldShowBanner: show,
      shouldShowList: show,
    };
  },
});

/* PATCH_171C_TOKEN_CHANNEL_V2 */
export async function registerPushToken(userId: string) {
  // Standalone media QA must never claim or mutate a member device's production push token.
  if (process.env.EXPO_PUBLIC_BUKLOD_MEDIA_QA === 'true') return null;
  if (Platform.OS === 'web') return null;

  // Dedicated SOS channel must exist BEFORE the token advertises capability.
  let emergencyChannelReady = false;
  if (Platform.OS === 'android') {
    // The installed native binary, not an OTA JS flag, is authoritative.
    // Prevent old Genesis APKs from claiming a nonexistent raw alarm resource.
    if (Updates.runtimeVersion === '2.0.1-genesis-sos') try {
      await Notifications.setNotificationChannelAsync('buklod-emergency-v2', {
        name: 'BUKLOD Emergency SOS',
        description: 'Urgent nearby BUKLOD emergency alerts',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'buklod_alert.wav',
        vibrationPattern: [0, 600, 250, 600, 250, 850],
        enableVibrate: true,
        lightColor: '#C62828',
        showBadge: true,
      });
      emergencyChannelReady = Boolean(
        await Notifications.getNotificationChannelAsync('buklod-emergency-v2')
      );
    } catch (error) {
      console.warn('BUKLOD SOS channel unavailable; regular push fallback remains.', error);
    }
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

  // Upgrade only this device's token AFTER the native channel exists.
  // Older APKs retain the safe, preexisting activity push channel.
  if (emergencyChannelReady) {
    const { error: capabilityError } = await supabase.rpc(
      'buklod_help_register_emergency_channel',
      { p_expo_push_token: token },
    );
    if (capabilityError) console.warn('BUKLOD SOS channel registration:', capabilityError.message);
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
