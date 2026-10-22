import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { isRemovedBuklodRadioPayload } from '@/lib/buklodRemovedRadioPolicy';

const legacyTask = 'BUKLOD_PTT_BACKGROUND_RX_V1';
// Rejection-only tombstone for persisted old tasks. Never starts a radio/mic.
if (Platform.OS !== 'web') {
  if (!TaskManager.isTaskDefined(legacyTask)) {
    TaskManager.defineTask(legacyTask, async () => {});
  }
  void Notifications.unregisterTaskAsync(legacyTask)
    .catch(() => TaskManager.unregisterTaskAsync(legacyTask))
    .catch(() => undefined);
  void Notifications.getPresentedNotificationsAsync()
    .then(notices => Promise.all(notices
      .filter(notice => isRemovedBuklodRadioPayload(notice.request.content.data))
      .map(notice => Notifications.dismissNotificationAsync(notice.request.identifier).catch(() => undefined))))
    .catch(() => undefined);
  void Notifications.getAllScheduledNotificationsAsync()
    .then(notices => Promise.all(notices
      .filter(notice => isRemovedBuklodRadioPayload(notice.content.data))
      .map(notice => Notifications.cancelScheduledNotificationAsync(notice.identifier).catch(() => undefined))))
    .catch(() => undefined);
}
