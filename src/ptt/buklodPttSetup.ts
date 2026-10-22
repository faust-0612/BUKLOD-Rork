import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import * as Notifications from 'expo-notifications';
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import {
  Linking,
  PermissionsAndroid,
  Platform,
} from 'react-native';

export type BuklodPttRouteMode = 'AUTO' | 'INTERNET' | 'NEARBY';

export type BuklodPttSetupItemKey =
  | 'microphone'
  | 'notifications'
  | 'nearby'
  | 'wifi'
  | 'bluetooth'
  | 'background';

export type BuklodPttSetupItem = {
  key: BuklodPttSetupItemKey;
  label: string;
  ok: boolean;
  actionLabel: string | null;
  action: (() => Promise<void>) | null;
};

export type BuklodPttSetupSnapshot = {
  microphone: boolean;
  notifications: boolean;
  nearby: boolean;
  wifiOn: boolean | null;
  bluetoothOn: boolean | null;
  internet: boolean;
  wifiConnected: boolean;
  connectionType: string;
  items: BuklodPttSetupItem[];
};

const ONBOARDING_KEY = 'buklod.ptt.onboarding.v1';
const ROUTE_MODE_KEY = 'buklod.ptt.routeMode.v1';

async function openAndroidIntent(action: string) {
  try {
    await Linking.sendIntent(action);
  } catch {
    await Linking.openSettings();
  }
}

export async function openWifiSettings() {
  if (Platform.OS === 'android') {
    await openAndroidIntent('android.settings.WIFI_SETTINGS');
    return;
  }
  await Linking.openSettings();
}

export async function openBluetoothSettings() {
  if (Platform.OS === 'android') {
    await openAndroidIntent('android.settings.BLUETOOTH_SETTINGS');
    return;
  }
  await Linking.openSettings();
}

export async function openAppSettings() {
  await Linking.openSettings();
}

async function ensureMicrophone(): Promise<boolean> {
  try {
    const current = await getRecordingPermissionsAsync();
    if (current.granted) return true;
    const next = await requestRecordingPermissionsAsync();
    return Boolean(next.granted);
  } catch {
    if (Platform.OS === 'android') {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
    return false;
  }
}

async function ensureNotifications(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted || current.status === 'granted') return true;
    const next = await Notifications.requestPermissionsAsync();
    return Boolean(next.granted || next.status === 'granted');
  } catch {
    return false;
  }
}

async function ensureNearbyPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  try {
    const api = typeof Platform.Version === 'number' ? Platform.Version : 0;
    const perms: string[] = [];

    if (api >= 31 && PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT) {
      perms.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
    }
    if (api >= 31 && PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN) {
      perms.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN);
    }
    if (api >= 33 && (PermissionsAndroid.PERMISSIONS as any).NEARBY_WIFI_DEVICES) {
      perms.push((PermissionsAndroid.PERMISSIONS as any).NEARBY_WIFI_DEVICES);
    }

    if (!perms.length) return true;

    const checks = await Promise.all(
      perms.map((perm) => PermissionsAndroid.check(perm as any)),
    );
    if (checks.every(Boolean)) return true;

    const result = await PermissionsAndroid.requestMultiple(perms as any);
    return perms.every(
      (perm) => result[perm as keyof typeof result] === PermissionsAndroid.RESULTS.GRANTED,
    );
  } catch {
    return false;
  }
}

export async function loadBuklodPttRouteMode(): Promise<BuklodPttRouteMode> {
  try {
    const value = await AsyncStorage.getItem(ROUTE_MODE_KEY);
    if (value === 'INTERNET' || value === 'NEARBY' || value === 'AUTO') {
      return value;
    }
  } catch {}
  return 'AUTO';
}

export async function saveBuklodPttRouteMode(mode: BuklodPttRouteMode) {
  try {
    await AsyncStorage.setItem(ROUTE_MODE_KEY, mode);
  } catch {}
}

export async function hasSeenBuklodPttOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function markBuklodPttOnboardingSeen() {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
  } catch {}
}

export async function refreshBuklodPttSetup(): Promise<BuklodPttSetupSnapshot> {
  let net: NetInfoState | null = null;
  try {
    net = await NetInfo.fetch();
  } catch {
    net = null;
  }

  let microphone = false;
  try {
    microphone = Boolean((await getRecordingPermissionsAsync()).granted);
  } catch {
    if (Platform.OS === 'android') {
      try {
        microphone = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        );
      } catch {
        microphone = false;
      }
    }
  }

  let notifications = false;
  try {
    const permission = await Notifications.getPermissionsAsync();
    notifications = Boolean(permission.granted || permission.status === 'granted');
  } catch {
    notifications = false;
  }

  let nearby = Platform.OS !== 'android';
  if (Platform.OS === 'android') {
    try {
      const api = typeof Platform.Version === 'number' ? Platform.Version : 0;
      const checks: Promise<boolean>[] = [];
      if (api >= 31 && PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT) {
        checks.push(
          PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT),
        );
      }
      if (api >= 33 && (PermissionsAndroid.PERMISSIONS as any).NEARBY_WIFI_DEVICES) {
        checks.push(
          PermissionsAndroid.check(
            (PermissionsAndroid.PERMISSIONS as any).NEARBY_WIFI_DEVICES,
          ),
        );
      }
      nearby = checks.length ? (await Promise.all(checks)).every(Boolean) : true;
    } catch {
      nearby = false;
    }
  }

  const connectionType = String(net?.type || 'unknown');
  const wifiConnected = connectionType === 'wifi';
  const internet =
    net?.isConnected === true && net?.isInternetReachable === true;
  const wifiOn = wifiConnected ? true : connectionType === 'none' ? false : null;
  const bluetoothOn = nearby ? null : null;

  const items: BuklodPttSetupItem[] = [
    {
      key: 'microphone',
      label: 'Microphone',
      ok: microphone,
      actionLabel: microphone ? null : 'ALLOW MICROPHONE',
      action: microphone
        ? null
        : async () => {
            const ok = await ensureMicrophone();
            if (!ok) await openAppSettings();
          },
    },
    {
      key: 'notifications',
      label: 'Notifications',
      ok: notifications,
      actionLabel: notifications ? null : 'ALLOW NOTIFICATIONS',
      action: notifications
        ? null
        : async () => {
            const ok = await ensureNotifications();
            if (!ok) await openAppSettings();
          },
    },
    {
      key: 'nearby',
      label: 'Nearby devices',
      ok: nearby,
      actionLabel: nearby ? null : 'ALLOW NEARBY DEVICES',
      action: nearby
        ? null
        : async () => {
            const ok = await ensureNearbyPermission();
            if (!ok) await openAppSettings();
          },
    },
    {
      key: 'wifi',
      label: 'Wi-Fi',
      ok: wifiOn !== false,
      actionLabel: wifiOn === false ? 'TURN ON WI-FI' : null,
      action: wifiOn === false ? openWifiSettings : null,
    },
    {
      key: 'bluetooth',
      label: 'Bluetooth',
      ok: true,
      actionLabel: null,
      action: null,
    },
    {
      key: 'background',
      label: 'Background operation',
      ok: notifications,
      actionLabel: notifications ? null : 'ALLOW BACKGROUND',
      action: notifications
        ? null
        : async () => {
            const ok = await ensureNotifications();
            if (!ok) await openAppSettings();
          },
    },
  ];

  return {
    microphone,
    notifications,
    nearby,
    wifiOn,
    bluetoothOn,
    internet,
    wifiConnected,
    connectionType,
    items,
  };
}

export function resolveBuklodPttRoute(
  mode: BuklodPttRouteMode,
  setup: BuklodPttSetupSnapshot,
  nearbyPeerCount = 0,
): 'INTERNET' | 'NEARBY' {
  if (mode === 'INTERNET') return 'INTERNET';
  if (mode === 'NEARBY') return 'NEARBY';
  // AUTO: Nearby when peers are actually present; otherwise Internet when needed.
  if (nearbyPeerCount > 0 && (setup.wifiConnected || setup.nearby)) {
    return 'NEARBY';
  }
  if (setup.internet) return 'INTERNET';
  return 'NEARBY';
}
