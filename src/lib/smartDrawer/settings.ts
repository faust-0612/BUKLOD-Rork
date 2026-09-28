import AsyncStorage from '@react-native-async-storage/async-storage';

export type SmartDrawerReminderStyle =
  | 'MINIMAL'
  | 'NORMAL'
  | 'PERSISTENT';

export type SmartDrawerSettings = {
  reminderStyle: SmartDrawerReminderStyle;
  recentlyRemovedRetentionDays: number;
};

const PREFIX = '@buklod/smart-drawer/settings/v1/';

export const DEFAULT_SMART_DRAWER_SETTINGS: SmartDrawerSettings = {
  reminderStyle: 'NORMAL',
  recentlyRemovedRetentionDays: 30,
};

function key(userId: string) {
  return `${PREFIX}${userId}`;
}

export async function loadSmartDrawerSettings(
  userId: string,
): Promise<SmartDrawerSettings> {
  if (!userId) return DEFAULT_SMART_DRAWER_SETTINGS;

  try {
    const raw = await AsyncStorage.getItem(key(userId));
    if (!raw) return DEFAULT_SMART_DRAWER_SETTINGS;

    const parsed = JSON.parse(raw) as Partial<SmartDrawerSettings>;
    const style: SmartDrawerReminderStyle =
      parsed.reminderStyle === 'MINIMAL' ||
      parsed.reminderStyle === 'PERSISTENT'
        ? parsed.reminderStyle
        : 'NORMAL';

    const retention = Number(parsed.recentlyRemovedRetentionDays);
    return {
      reminderStyle: style,
      recentlyRemovedRetentionDays:
        Number.isFinite(retention) && retention >= 7 && retention <= 365
          ? Math.round(retention)
          : DEFAULT_SMART_DRAWER_SETTINGS.recentlyRemovedRetentionDays,
    };
  } catch {
    return DEFAULT_SMART_DRAWER_SETTINGS;
  }
}

export async function saveSmartDrawerSettings(
  userId: string,
  settings: SmartDrawerSettings,
) {
  if (!userId) {
    throw new Error('Sign in again before updating Drawer settings.');
  }

  const safe: SmartDrawerSettings = {
    reminderStyle: settings.reminderStyle,
    recentlyRemovedRetentionDays: Math.max(
      7,
      Math.min(365, Math.round(settings.recentlyRemovedRetentionDays)),
    ),
  };

  await AsyncStorage.setItem(key(userId), JSON.stringify(safe));
  return safe;
}
