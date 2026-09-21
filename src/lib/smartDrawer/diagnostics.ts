import { Platform } from 'react-native';

import {
  getSmartDrawerSummary,
  listSmartDrawerPendingSync,
} from './localStore';

export type SmartDrawerDiagnostics = {
  storeMode: 'SQLITE_LOCAL' | 'WEB_LOCAL_FALLBACK';
  activeCount: number;
  dueSoonCount: number;
  overdueCount: number;
  activeListCount: number;
  localOnlyCount: number;
  notificationPermission:
    | 'granted'
    | 'denied'
    | 'undetermined'
    | 'unsupported'
    | 'unknown';
  cloudSync: 'NOT_ENABLED';
};

export async function getSmartDrawerDiagnostics(
  userId: string,
): Promise<SmartDrawerDiagnostics> {
  const summary = await getSmartDrawerSummary(userId);
  const pending = await listSmartDrawerPendingSync(userId, 100);

  let notificationPermission:
    SmartDrawerDiagnostics['notificationPermission'] =
      Platform.OS === 'web'
        ? 'unsupported'
        : 'unknown';

  if (Platform.OS !== 'web') {
    try {
      const Notifications =
        await import('expo-notifications');
      const permission =
        await Notifications.getPermissionsAsync();

      notificationPermission =
        permission.status === 'granted'
          ? 'granted'
          : permission.status === 'denied'
            ? 'denied'
            : 'undetermined';
    } catch {
      notificationPermission = 'unknown';
    }
  }

  return {
    storeMode:
      Platform.OS === 'web'
        ? 'WEB_LOCAL_FALLBACK'
        : 'SQLITE_LOCAL',
    activeCount: summary.totalActive,
    dueSoonCount: summary.dueSoon,
    overdueCount: summary.overdue,
    activeListCount: summary.activeLists,
    localOnlyCount: pending.filter(
      item => item.syncState === 'LOCAL_ONLY',
    ).length,
    notificationPermission,
    cloudSync: 'NOT_ENABLED',
  };
}
