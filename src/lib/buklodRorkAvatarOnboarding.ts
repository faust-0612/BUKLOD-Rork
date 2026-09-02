import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '@supabase/supabase-js';

import {
  BUKLOD_CHARACTER_STORAGE_KEY,
  type BuklodCharacterState,
} from '@/lib/buklodCharacter';
import { supabase } from '@/lib/supabase';

export const RORK_AVATAR_ONBOARDING_STORAGE_KEY =
  'buklod_rork_avatar_onboarding_completed_v1';

export const RORK_AVATAR_ONBOARDING_METADATA_KEY =
  'rork_avatar_onboarding_completed';

function storageKey(userId: string) {
  return `${RORK_AVATAR_ONBOARDING_STORAGE_KEY}:${userId}`;
}

function characterStorageKey(userId: string) {
  return `${BUKLOD_CHARACTER_STORAGE_KEY}:${userId}`;
}

export function readRorkOnboardingFromUser(
  user: User | null | undefined
): boolean {
  const meta = user?.user_metadata as
    | Record<string, unknown>
    | undefined;

  if (!meta) return false;

  const value = meta[RORK_AVATAR_ONBOARDING_METADATA_KEY];

  return value === true || value === '1' || value === 'true';
}

export async function isRorkAvatarOnboardingCompleted(
  userId: string | null | undefined,
  user?: User | null
): Promise<boolean> {
  if (!userId) return false;

  if (readRorkOnboardingFromUser(user)) {
    return true;
  }

  try {
    const local = await AsyncStorage.getItem(storageKey(userId));
    return local === '1' || local === 'true';
  } catch {
    return false;
  }
}

function legacyCharacterIndicatesCompleted(
  parsed: Partial<BuklodCharacterState>
): boolean {
  if (parsed.bodyChosen === false) {
    return false;
  }

  if (parsed.bodyChosen === true) {
    return true;
  }

  // Pre-bodyChosen saves: any persisted character state counts as established.
  return Boolean(parsed.body || parsed.equipment);
}

/**
 * One-time compatibility for accounts that already saved a Rork character
 * before the dedicated onboarding flag existed.
 */
export async function migrateLegacyRorkAvatarOnboardingIfNeeded(
  userId: string,
  user?: User | null
): Promise<boolean> {
  if (await isRorkAvatarOnboardingCompleted(userId, user)) {
    return true;
  }

  try {
    const keyedRaw = await AsyncStorage.getItem(
      characterStorageKey(userId)
    );
    const legacyRaw =
      keyedRaw ??
      (await AsyncStorage.getItem(BUKLOD_CHARACTER_STORAGE_KEY));

    if (!legacyRaw) {
      return false;
    }

    const parsed = JSON.parse(legacyRaw) as Partial<BuklodCharacterState>;

    if (!legacyCharacterIndicatesCompleted(parsed)) {
      return false;
    }

    await markRorkAvatarOnboardingCompleted(userId, user);
    return true;
  } catch {
    return false;
  }
}

export async function markRorkAvatarOnboardingCompleted(
  userId: string,
  user?: User | null
): Promise<void> {
  await AsyncStorage.setItem(storageKey(userId), '1');

  const { data: sessionData } = await supabase.auth.getSession();
  const existingMeta =
    (user?.user_metadata as Record<string, unknown> | undefined) ??
    (sessionData.session?.user?.user_metadata as
      | Record<string, unknown>
      | undefined) ??
    {};

  const { error } = await supabase.auth.updateUser({
    data: {
      ...existingMeta,
      [RORK_AVATAR_ONBOARDING_METADATA_KEY]: true,
    },
  });

  if (error) {
    console.warn(
      'Rork avatar onboarding metadata save failed:',
      error.message
    );
  }
}
