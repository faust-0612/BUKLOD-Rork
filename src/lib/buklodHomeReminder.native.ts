import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type BuklodHomeReminderScheduleResult = {
  id: string;
  delivery: 'system';
};

export async function scheduleBuklodHomeReminder(args: {
  at: Date;
  message: string;
}): Promise<BuklodHomeReminderScheduleResult> {
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') {
    throw new Error('Notification permission is required to schedule this reminder.');
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('buklod-home-reminders', {
      name: 'BUKLOD Home Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      enableVibrate: true,
      showBadge: true,
    });
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'BUKLOD Home',
      body: args.message,
      sound: true,
      data: { route: '/personal-home/reminders', source: 'buklod-home' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: args.at,
      channelId: Platform.OS === 'android' ? 'buklod-home-reminders' : undefined,
    },
  });

  return { id, delivery: 'system' };
}

export async function cancelBuklodHomeReminder(id: string) {
  if (!id) return;
  await Notifications.cancelScheduledNotificationAsync(id);
}
