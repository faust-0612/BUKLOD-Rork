import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@buklod/cache/v1/';
const CACHE_INDEX_KEY = '@buklod/cache/v1-index';
const DEFAULT_TTL_MS = 15 * 60 * 1000;
const MAX_INDEX_ENTRIES = 240;

type CacheEnvelope<T> = {
  version: 1;
  storedAt: number;
  expiresAt: number;
  data: T;
};

type CacheIndexRow = {
  storageKey: string;
  storedAt: number;
};

export type OfflineCacheRead<T> = {
  data: T;
  storedAt: number;
  isStale: boolean;
};

function safePart(value: string | null | undefined): string {
  return String(value ?? 'global')
    .trim()
    .replace(/[^a-zA-Z0-9_.:-]/g, '_')
    .slice(0, 140);
}

function storageKey(key: string, userId?: string | null): string {
  return `${CACHE_PREFIX}${safePart(userId)}/${safePart(key)}`;
}

async function readIndex(): Promise<CacheIndexRow[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function touchIndex(key: string, storedAt: number): Promise<void> {
  try {
    const rows = await readIndex();
    const next = [
      { storageKey: key, storedAt },
      ...rows.filter((row) => row?.storageKey !== key),
    ]
      .filter((row) => typeof row?.storageKey === 'string')
      .sort((a, b) => Number(b.storedAt || 0) - Number(a.storedAt || 0));

    const keep = next.slice(0, MAX_INDEX_ENTRIES);
    const evicted = next.slice(MAX_INDEX_ENTRIES).map((row) => row.storageKey);

    await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(keep));
    if (evicted.length) {
      await AsyncStorage.multiRemove(evicted);
    }
  } catch {
    // Cache index maintenance must never break the caller.
  }
}

export async function setOfflineCache<T>(
  key: string,
  data: T,
  options?: {
    ttlMs?: number;
    userId?: string | null;
  },
): Promise<void> {
  const now = Date.now();
  const ttlMs = Math.max(1_000, Number(options?.ttlMs ?? DEFAULT_TTL_MS));
  const target = storageKey(key, options?.userId);

  const envelope: CacheEnvelope<T> = {
    version: 1,
    storedAt: now,
    expiresAt: now + ttlMs,
    data,
  };

  await AsyncStorage.setItem(target, JSON.stringify(envelope));
  await touchIndex(target, now);
}

export async function getOfflineCache<T>(
  key: string,
  options?: {
    userId?: string | null;
    allowStale?: boolean;
  },
): Promise<OfflineCacheRead<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(key, options?.userId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (
      !parsed ||
      parsed.version !== 1 ||
      typeof parsed.storedAt !== 'number' ||
      typeof parsed.expiresAt !== 'number'
    ) {
      return null;
    }

    const isStale = Date.now() > parsed.expiresAt;
    if (isStale && !options?.allowStale) {
      return null;
    }

    return {
      data: parsed.data,
      storedAt: parsed.storedAt,
      isStale,
    };
  } catch {
    return null;
  }
}

export async function removeOfflineCache(
  key: string,
  userId?: string | null,
): Promise<void> {
  const target = storageKey(key, userId);
  cacheGenerations.set(target, (cacheGenerations.get(target) ?? 0) + 1);
  await AsyncStorage.removeItem(target);
}

export async function clearOfflineCacheForUser(
  userId?: string | null,
): Promise<void> {
  const prefix = `${CACHE_PREFIX}${safePart(userId)}/`;
  const keys = await AsyncStorage.getAllKeys();
  const matches = keys.filter((key) => key.startsWith(prefix));
  if (matches.length) {
    for (const key of matches) cacheGenerations.set(key, (cacheGenerations.get(key) ?? 0) + 1);
    await AsyncStorage.multiRemove(matches);
  }
}

export async function pruneOfflineCache(options?: {
  olderThanMs?: number;
}): Promise<number> {
  const olderThanMs = Math.max(
    60_000,
    Number(options?.olderThanMs ?? 14 * 24 * 60 * 60 * 1000),
  );
  const cutoff = Date.now() - olderThanMs;
  const rows = await readIndex();
  const stale = rows.filter((row) => Number(row.storedAt || 0) < cutoff);
  const keep = rows.filter((row) => Number(row.storedAt || 0) >= cutoff);

  if (stale.length) {
    await AsyncStorage.multiRemove(stale.map((row) => row.storageKey));
  }
  await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(keep));
  return stale.length;
}

export async function staleWhileRevalidate<T>(args: {
  key: string;
  userId?: string | null;
  ttlMs?: number;
  fetcher: () => Promise<T>;
  onFresh?: (value: T) => void;
}): Promise<{
  value: T;
  source: 'network' | 'cache';
  stale: boolean;
}> {
  const cached = await getOfflineCache<T>(args.key, {
    userId: args.userId,
    allowStale: true,
  });

  try {
    const fresh = await args.fetcher();
    await setOfflineCache(args.key, fresh, {
      userId: args.userId,
      ttlMs: args.ttlMs,
    });
    args.onFresh?.(fresh);
    return { value: fresh, source: 'network', stale: false };
  } catch (error) {
    if (cached) {
      return {
        value: cached.data,
        source: 'cache',
        stale: cached.isStale,
      };
    }
    throw error;
  }
}

/**
 * Device-persistent stale-while-revalidate for authorized read models.
 * Returns a previously saved snapshot immediately, then refreshes once per
 * user/key in the background. Callers must check their mounted/account scope
 * before applying onFresh. Never use for writes or permission decisions.
 */
const refreshes = new Map<string, Promise<void>>();
const cacheGenerations = new Map<string, number>();

export async function readCachedThenSync<T>(args: {
  key: string;
  userId: string;
  ttlMs?: number;
  fetcher: () => Promise<T>;
  onFresh?: (value: T) => void;
  onError?: (error: unknown) => void;
  offline?: boolean;
}): Promise<{ value: T; source: 'cache' | 'network'; stale: boolean; syncing: boolean }> {
  if (!args.userId?.trim()) {
    throw new Error('Persistent scoped cache requires an authenticated user ID.');
  }
  const cached = await getOfflineCache<T>(args.key, {
    userId: args.userId,
    allowStale: true,
  });
  const target = storageKey(args.key, args.userId);
  if (args.offline) {
    if (cached) return { value: cached.data, source: 'cache', stale: cached.isStale, syncing: false };
    throw new Error('No saved offline data for this screen.');
  }

  const refresh = () => {
    let pending = refreshes.get(target);
    if (!pending) {
      const generation = cacheGenerations.get(target) ?? 0;
      pending = (async () => {
        const fresh = await args.fetcher();
        if ((cacheGenerations.get(target) ?? 0) !== generation) return;
        await setOfflineCache(args.key, fresh, {
          userId: args.userId,
          ttlMs: args.ttlMs,
        });
        if ((cacheGenerations.get(target) ?? 0) !== generation) {
          await AsyncStorage.removeItem(target);
          return;
        }
        args.onFresh?.(fresh);
      })().finally(() => {
        refreshes.delete(target);
      });
      refreshes.set(target, pending);
    }
    return pending;
  };

  if (cached) {
    // No re-download within TTL; expired snapshots remain visible while
    // a single refresh reconciles changes.
    if (!cached.isStale) {
      return { value: cached.data, source: 'cache', stale: false, syncing: false };
    }
    void refresh().catch(error => args.onError?.(error));
    return { value: cached.data, source: 'cache', stale: true, syncing: true };
  }

  await refresh();
  const fresh = await getOfflineCache<T>(args.key, { userId: args.userId, allowStale: true });
  if (!fresh) throw new Error('Network read completed without a persisted snapshot.');
  return { value: fresh.data, source: 'network', stale: false, syncing: false };
}

/*
 * SECURITY:
 * Never cache auth tokens, passwords, recovery PINs, face embeddings,
 * payment secrets, private cryptographic material, or other credentials.
 * Cache only UI/read models already authorized for the signed-in user.
 */