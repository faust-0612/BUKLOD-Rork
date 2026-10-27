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

/** Cancel only Drawer alarms belonging to the previous signed-in account. */
export async function cancelSmartDrawerRemindersForUser(userId: string) {
  if (Platform.OS === 'web' || !userId) return 0;
  const Notifications = await import('expo-notifications');
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const owned = scheduled.filter(request => {
    const data = request.content.data;
    return data?.source === 'smart-drawer' && data?.userId === userId;
  });
  await cancelSmartDrawerReminders(owned.map(request => request.identifier));
  return owned.length;
}

/** Remove another account's (or legacy unscoped) private alarms on sign-in. */
export async function cancelSmartDrawerRemindersForOtherUsers(userId: string) {
  if (Platform.OS === 'web' || !userId) return 0;
  const Notifications = await import('expo-notifications');
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const stale = scheduled.filter(request => {
    const data = request.content.data;
    return data?.source === 'smart-drawer' && data?.userId !== userId;
  });
  await cancelSmartDrawerReminders(stale.map(request => request.identifier));
  return stale.length;
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
  try {
    for (const target of targets) {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: target.label,
          body: item.title || 'BUKLOD Smart Drawer reminder',
          sound: true,
          data: {
            kind: 'smart_drawer_reminder',
            route: `/drawer/item/${encodeURIComponent(item.id)}`,
            source: 'smart-drawer',
            userId: item.userId,
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
  } catch (error) {
    // A failed second or third schedule must not leave orphaned alarms that
    // are impossible to cancel on the next edit.
    await cancelSmartDrawerReminders(ids);
    throw error;
  }

  return ids;
}
