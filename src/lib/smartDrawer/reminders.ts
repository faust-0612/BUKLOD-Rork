import { Platform } from 'react-native';

import { loadSmartDrawerSettings } from './settings';
import type { SmartDrawerItem } from './types';

const CHANNEL_ID = 'buklod-smart-drawer';

export async function cancelSmartDrawerReminders(ids: string[]) {
  if (Platform.OS === 'web' || !ids.length) return;

  const Notifications = await import('expo-notifications');
  await Promise.all(
    ids.map(id =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined),
    ),
  );
}

export async function scheduleSmartDrawerReminders(
  item: SmartDrawerItem,
): Promise<string[]> {
  if (
    Platform.OS === 'web' ||
    !item.dueAt ||
    item.reminderMuted ||
    item.status !== 'ACTIVE'
  ) {
    return [];
  }

  const dueMs = Date.parse(item.dueAt);
  if (!Number.isFinite(dueMs) || dueMs <= Date.now()) {
    return [];
  }

  const Notifications = await import('expo-notifications');

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') {
    throw new Error(
      'Notification permission is off. The item was saved, but BUKLOD could not schedule its reminder.',
    );
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'BUKLOD Smart Drawer',
      importance: Notifications.AndroidImportance.HIGH,
      enableVibrate: true,
      vibrationPattern: [0, 180, 120, 180],
      showBadge: true,
    });
  }

  const settings = await loadSmartDrawerSettings(item.userId);
  const targets: Array<{ at: number; label: string }> = [];

  if (settings.reminderStyle === 'PERSISTENT') {
    const dayBefore = dueMs - 24 * 60 * 60 * 1000;
    if (dayBefore > Date.now() + 5 * 60 * 1000) {
      targets.push({ at: dayBefore, label: 'Coming up tomorrow' });
    }
  }

  if (settings.reminderStyle !== 'MINIMAL') {
    const advance = dueMs - 60 * 60 * 1000;
    if (advance > Date.now() + 5 * 60 * 1000) {
      targets.push({ at: advance, label: 'Coming up' });
    }
  }

  targets.push({ at: dueMs, label: 'Due now' });

  const ids: string[] = [];

  for (const target of targets) {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: target.label,
        body: item.title || 'BUKLOD Smart Drawer reminder',
        sound: true,
        data: {
          route: `/drawer/item/${item.id}`,
          source: 'smart-drawer',
          itemId: item.id,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(target.at),
        channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
      },
    });
    ids.push(id);
  }

  return ids;
}
