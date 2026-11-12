import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const BUKLOD_SUGGESTED_LOGINS_KEY =
  'buklod.suggested_logins.v2';
export const BUKLOD_REMEMBERED_CREDENTIALS_KEY =
  'buklod.remembered_credentials.v1';
export const BUKLOD_PASSWORD_RECOVERY_NOTICE_KEY =
  'buklod.auth.password_recovery_notice.v1';

type SuggestedLoginLike = {
  userId?: string;
  identifier?: string;
  hasPassword?: boolean;
  [key: string]: unknown;
};

export type BuklodPasswordRecoveryNotice = {
  userId: string | null;
  loginIdentifier: string | null;
  createdAt: string;
};

function normalize(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function suggestedLoginPasswordKey(userId: string) {
  return `buklod.suggested_login.password.${userId}`;
}

async function removeSecret(key: string) {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(key);
    return;
  }

  await SecureStore.deleteItemAsync(key);
}

function parseSuggestedLogins(raw: string | null): SuggestedLoginLike[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function clearSavedSuggestedLoginPassword(options: {
  userId?: string | null;
  loginIdentifier?: string | null;
}) {
  const targetUserId = String(options.userId ?? '').trim();
  const targetIdentifier = normalize(options.loginIdentifier);

  const raw = await AsyncStorage.getItem(
    BUKLOD_SUGGESTED_LOGINS_KEY
  );
  const items = parseSuggestedLogins(raw);

  const matchedUserIds = new Set<string>();
  const matchedIdentifiers = new Set<string>();

  if (targetUserId) {
    matchedUserIds.add(targetUserId);
  }

  const next = items.map(item => {
    const userId = String(item?.userId ?? '').trim();
    const identifier = normalize(item?.identifier);
    const matches =
      (!!targetUserId && userId === targetUserId) ||
      (!!targetIdentifier && identifier === targetIdentifier);

    if (!matches) {
      return item;
    }

    if (userId) matchedUserIds.add(userId);
    if (identifier) matchedIdentifiers.add(identifier);

    return {
      ...item,
      hasPassword: false,
    };
  });

  if (items.length > 0) {
    await AsyncStorage.setItem(
      BUKLOD_SUGGESTED_LOGINS_KEY,
      JSON.stringify(next)
    );
  }

  await Promise.allSettled(
    Array.from(matchedUserIds).map(userId =>
      removeSecret(
        suggestedLoginPasswordKey(userId)
      )
    )
  );

  const rememberedRaw =
    await AsyncStorage.getItem(
      BUKLOD_REMEMBERED_CREDENTIALS_KEY
    );

  if (rememberedRaw) {
    try {
      const remembered = JSON.parse(rememberedRaw);
      const rememberedIdentifier =
        normalize(remembered?.identifier);

      if (
        rememberedIdentifier &&
        (
          matchedIdentifiers.has(
            rememberedIdentifier
          ) ||
          (
            !!targetIdentifier &&
            rememberedIdentifier ===
              targetIdentifier
          )
        )
      ) {
        await AsyncStorage.removeItem(
          BUKLOD_REMEMBERED_CREDENTIALS_KEY
        );
      }
    } catch {
      await AsyncStorage.removeItem(
        BUKLOD_REMEMBERED_CREDENTIALS_KEY
      );
    }
  }

  return {
    matchedUserIds:
      Array.from(matchedUserIds),
    matchedIdentifiers:
      Array.from(matchedIdentifiers),
  };
}

/**
 * Mirror a confirmed profile photo to the pre-login account card.
 * This changes only avatarUrl for the exact user and never persists secrets.
 * The authoritative public Storage URL stays under the existing owner RLS.
 */
export async function updateSavedSuggestedLoginAvatar(
  userId: string,
  avatarUrl: string | null
): Promise<boolean> {
  const target = normalize(userId);
  if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(target)) {
    return false;
  }
  const cleanUrl = typeof avatarUrl === 'string' && /^https:\/\//i.test(avatarUrl.trim())
    ? avatarUrl.trim()
    : null;
  const raw = await AsyncStorage.getItem(BUKLOD_SUGGESTED_LOGINS_KEY);
  if (!raw) return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return false;
  }
  if (!Array.isArray(parsed)) return false;
  let changed = false;
  const next = parsed.map((item: SuggestedLoginLike) => {
    if (!item || normalize(item.userId) !== target) return item;
    if (item.avatarUrl === cleanUrl) return item;
    changed = true;
    return { ...item, avatarUrl: cleanUrl };
  });
  if (changed) {
    await AsyncStorage.setItem(BUKLOD_SUGGESTED_LOGINS_KEY, JSON.stringify(next));
  }
  return changed;
}

export async function recordPasswordResetOnThisDevice(options: {
  userId?: string | null;
  loginIdentifier?: string | null;
}) {
  await clearSavedSuggestedLoginPassword(options);

  const notice: BuklodPasswordRecoveryNotice = {
    userId:
      String(options.userId ?? '').trim() ||
      null,
    loginIdentifier:
      String(options.loginIdentifier ?? '').trim() ||
      null,
    createdAt:
      new Date().toISOString(),
  };

  await AsyncStorage.setItem(
    BUKLOD_PASSWORD_RECOVERY_NOTICE_KEY,
    JSON.stringify(notice)
  );

  return notice;
}

export async function consumePasswordRecoveryNotice():
  Promise<BuklodPasswordRecoveryNotice | null> {
  const raw =
    await AsyncStorage.getItem(
      BUKLOD_PASSWORD_RECOVERY_NOTICE_KEY
    );

  if (!raw) return null;

  await AsyncStorage.removeItem(
    BUKLOD_PASSWORD_RECOVERY_NOTICE_KEY
  );

  try {
    const parsed = JSON.parse(raw);
    return {
      userId:
        typeof parsed?.userId === 'string'
          ? parsed.userId
          : null,
      loginIdentifier:
        typeof parsed?.loginIdentifier === 'string'
          ? parsed.loginIdentifier
          : null,
      createdAt:
        typeof parsed?.createdAt === 'string'
          ? parsed.createdAt
          : new Date(0).toISOString(),
    };
  } catch {
    return {
      userId: null,
      loginIdentifier: null,
      createdAt: new Date(0).toISOString(),
    };
  }
}
