import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';

export type BuklodAuthSnapshot = {
  profile: {
    id: string;
    [key: string]: unknown;
  };
  roles: string[];
  membershipState: string;
};

function snapshotKey(userId: string) {
  return `buklod:auth-snapshot:v1:${userId}`;
}

export async function readAuthSnapshot(
  userId?: string | null,
): Promise<BuklodAuthSnapshot | null> {
  const id = String(userId ?? '').trim();
  if (!id) {
    return null;
  }

  try {
    const raw = await AsyncStorage.getItem(snapshotKey(id));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as BuklodAuthSnapshot;
    if (!parsed?.profile?.id) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export async function writeAuthSnapshot(
  userId: string,
  snapshot: BuklodAuthSnapshot,
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      snapshotKey(userId),
      JSON.stringify(snapshot),
    );
  } catch {
    // Cache is optional.
  }
}

export async function clearAuthSnapshot(
  userId?: string | null,
): Promise<void> {
  const id = String(userId ?? '').trim();
  if (!id) {
    return;
  }

  try {
    await AsyncStorage.removeItem(snapshotKey(id));
  } catch {
    // ignore
  }
}

export async function readPersistedSupabaseSession(): Promise<Session | null> {
  const url = String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '');
  let projectRef = '';

  try {
    projectRef = new URL(url).hostname.split('.')[0] || '';
  } catch {
    projectRef = '';
  }

  const keys = [
    projectRef ? `sb-${projectRef}-auth-token` : '',
    'supabase.auth.token',
  ].filter(Boolean);

  for (const key of keys) {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) {
        continue;
      }

      const parsed = JSON.parse(raw);
      const session =
        parsed?.currentSession ??
        parsed?.session ??
        parsed;

      if (session?.access_token && session?.user?.id) {
        return session as Session;
      }
    } catch {
      // try next key
    }
  }

  return null;
}
