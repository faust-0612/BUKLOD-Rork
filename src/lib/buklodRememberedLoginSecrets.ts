/**
 * BUKLOD remembered-password storage, native only.
 *
 * Passwords must NEVER be written to AsyncStorage (including web localStorage).
 * On native, migrate the old plaintext cache to encrypted SecureStore and
 * remove the original. On web, forget old plaintext cache rather than migrate
 * it into another browser-accessible store.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const BUKLOD_LEGACY_REMEMBERED_CREDENTIALS_KEY =
  'buklod.remembered_credentials.v1';
export const BUKLOD_NATIVE_REMEMBERED_CREDENTIALS_KEY =
  'buklod.remembered_credentials.secure.v2';

export type BuklodRememberedLogin = {
  identifier: string;
  password: string;
  userId?: string;
};

function parseRememberedLogin(raw: string | null): BuklodRememberedLogin | null {
  if (!raw || raw.length > 8192) return null;
  try {
    const item = JSON.parse(raw);
    if (typeof item?.identifier !== 'string' || !item.identifier.trim() ||
        item.identifier.length > 512 || typeof item?.password !== 'string' ||
        !item.password || item.password.length > 4096) return null;
    return {
      identifier: item.identifier,
      password: item.password,
      ...(typeof item.userId === 'string' && item.userId ? { userId: item.userId } : {}),
    };
  } catch {
    return null;
  }
}

export async function readBuklodRememberedLogin(): Promise<BuklodRememberedLogin | null> {
  const legacy = await AsyncStorage.getItem(BUKLOD_LEGACY_REMEMBERED_CREDENTIALS_KEY);
  if (Platform.OS === 'web') {
    // Explicitly remove previous browser-stored passwords; no browser fallback.
    if (legacy !== null) await AsyncStorage.removeItem(BUKLOD_LEGACY_REMEMBERED_CREDENTIALS_KEY);
    return null;
  }

  let current: string | null = null;
  try {
    current = await SecureStore.getItemAsync(BUKLOD_NATIVE_REMEMBERED_CREDENTIALS_KEY);
    if (!current && legacy) {
      const parsed = parseRememberedLogin(legacy);
      if (parsed) {
        current = JSON.stringify(parsed);
        // Never remove the legacy copy *before* confirming the secure write.
        await SecureStore.setItemAsync(BUKLOD_NATIVE_REMEMBERED_CREDENTIALS_KEY, current);
      }
    }
  } finally {
    // Even if the keystore is unavailable, do not leave a plaintext secret.
    if (legacy !== null) await AsyncStorage.removeItem(BUKLOD_LEGACY_REMEMBERED_CREDENTIALS_KEY);
  }
  return parseRememberedLogin(current);
}

export async function writeBuklodRememberedLogin(
  credentials: BuklodRememberedLogin | null,
): Promise<void> {
  try {
    if (Platform.OS !== 'web') {
      const validated = credentials
        ? parseRememberedLogin(JSON.stringify(credentials))
        : null;
      if (validated) {
        await SecureStore.setItemAsync(
          BUKLOD_NATIVE_REMEMBERED_CREDENTIALS_KEY,
          JSON.stringify(validated),
        );
      } else {
        await SecureStore.deleteItemAsync(BUKLOD_NATIVE_REMEMBERED_CREDENTIALS_KEY);
      }
    }
  } finally {
    // Clean up legacy Android and web plaintext storage after every login.
    await AsyncStorage.removeItem(BUKLOD_LEGACY_REMEMBERED_CREDENTIALS_KEY);
  }
}

export async function clearMatchingBuklodRememberedLogin(options: {
  userId?: string | null;
  identifiers?: string[];
}): Promise<void> {
  try {
    if (Platform.OS === 'web') return;

    const raw = await SecureStore.getItemAsync(BUKLOD_NATIVE_REMEMBERED_CREDENTIALS_KEY);
    const current = parseRememberedLogin(raw);
    if (!current) return;

    const userId = String(options.userId ?? '').trim();
    const identifiers = new Set((options.identifiers ?? [])
      .map(item => String(item ?? '').trim().toLowerCase()).filter(Boolean));

    if ((userId && current.userId === userId) ||
        identifiers.has(current.identifier.trim().toLowerCase())) {
      await SecureStore.deleteItemAsync(BUKLOD_NATIVE_REMEMBERED_CREDENTIALS_KEY);
    }
  } finally {
    // Legacy cache must never survive password reset or invalid-credential recovery.
    await AsyncStorage.removeItem(BUKLOD_LEGACY_REMEMBERED_CREDENTIALS_KEY);
  }
}
