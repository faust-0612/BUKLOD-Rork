import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@buklod/cache/v1/';
const CACHE_INDEX_KEY = '@buklod/cache/v1-index';
const DEFAULT_TTL_MS = 15 * 60 * 1000;
const MAX_INDEX_ENTRIES = 240;
const MAX_SAVED_FAITH_ENTRIES = 160;
const SAVED_FAITH_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

// Keep downloaded Bible, Word, and Lesson content beyond routine UI-cache
// pruning. Storage remains user-scoped with a bounded faith-content LRU.
function isSavedFaithContent(key: string): boolean {
  return /\/(?:bible-|daily-bible-|word-|lesson-|learning-|formation-)/.test(key);
}

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

let indexWriteTail: Promise<void> = Promise.resolve();

function serializeIndexMutation<T>(operation: () => Promise<T>): Promise<T> {
  // Prefetch downloads can finish concurrently. Serialized mutations prevent
  // lost entries in the AsyncStorage cache index.
  const result = indexWriteTail.then(operation, operation);
  indexWriteTail = result.then(() => undefined, () => undefined);
  return result;
}

async function touchIndex(key: string, storedAt: number): Promise<void> {
  await serializeIndexMutation(async () => {
  try {
    const rows = await readIndex();
    const next = [
      { storageKey: key, storedAt },
      ...rows.filter((row) => row?.storageKey !== key),
    ]
      .filter((row) => typeof row?.storageKey === 'string')
      .sort((a, b) => Number(b.storedAt || 0) - Number(a.storedAt || 0));

    const faithRows = next.filter((row) => isSavedFaithContent(row.storageKey));
    const otherRows = next.filter((row) => !isSavedFaithContent(row.storageKey));
    const keep = [...faithRows.slice(0, MAX_SAVED_FAITH_ENTRIES), ...otherRows.slice(0, MAX_INDEX_ENTRIES)];
    const keptKeys = new Set(keep.map((row) => row.storageKey));
    const evicted = next.filter((row) => !keptKeys.has(row.storageKey)).map((row) => row.storageKey);

    await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(keep));
    if (evicted.length) {
      await AsyncStorage.multiRemove(evicted);
    }
  } catch {
    // Cache index maintenance must never break the caller.
  }
  });
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
  await AsyncStorage.removeItem(storageKey(key, userId));
}

export async function clearOfflineCacheForUser(
  userId?: string | null,
): Promise<void> {
  const prefix = `${CACHE_PREFIX}${safePart(userId)}/`;
  const keys = await AsyncStorage.getAllKeys();
  const matches = keys.filter((key) => key.startsWith(prefix));
  if (matches.length) {
    await AsyncStorage.multiRemove(matches);
  }
}

export async function pruneOfflineCache(options?: {
  olderThanMs?: number;
}): Promise<number> {
  return serializeIndexMutation(async () => {
  const olderThanMs = Math.max(
    60_000,
    Number(options?.olderThanMs ?? 14 * 24 * 60 * 60 * 1000),
  );
  const cutoff = Date.now() - olderThanMs;
  const rows = await readIndex();
  const faithCutoff = Date.now() - SAVED_FAITH_RETENTION_MS;
  const stale = rows.filter((row) => Number(row.storedAt || 0) <
    (isSavedFaithContent(row.storageKey) ? faithCutoff : cutoff));
  const staleKeys = new Set(stale.map((row) => row.storageKey));
  const keep = rows.filter((row) => !staleKeys.has(row.storageKey));

  if (stale.length) {
    await AsyncStorage.multiRemove(stale.map((row) => row.storageKey));
  }
  await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(keep));
  return stale.length;
  });
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

/*
 * SECURITY:
 * Never cache auth tokens, passwords, recovery PINs, face embeddings,
 * payment secrets, private cryptographic material, or other credentials.
 * Cache only UI/read models already authorized for the signed-in user.
 */