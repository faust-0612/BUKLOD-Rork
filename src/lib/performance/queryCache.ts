export type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  staleUntil: number;
};

const memoryCache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export type CacheOptions = {
  ttlMs?: number;
  staleMs?: number;
  force?: boolean;
};

export async function cachedQuery<T>(
  key: string,
  loader: () => Promise<T>,
  options: CacheOptions = {},
): Promise<T> {
  const ttlMs = options.ttlMs ?? 30_000;
  const staleMs = options.staleMs ?? 120_000;
  const now = Date.now();
  const cached = memoryCache.get(key) as CacheEntry<T> | undefined;

  if (!options.force && cached && cached.expiresAt > now) {
    return cached.value;
  }

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const request = loader()
    .then((value) => {
      memoryCache.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
        staleUntil: Date.now() + ttlMs + staleMs,
      });
      return value;
    })
    .catch((error) => {
      const fallback = memoryCache.get(key) as CacheEntry<T> | undefined;
      if (fallback && fallback.staleUntil > Date.now()) return fallback.value;
      throw error;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, request);
  return request;
}

export function peekCache<T>(key: string): T | undefined {
  const cached = memoryCache.get(key) as CacheEntry<T> | undefined;
  return cached?.value;
}

export function invalidateCache(prefix?: string) {
  if (!prefix) {
    memoryCache.clear();
    return;
  }

  for (const key of memoryCache.keys()) {
    if (key === prefix || key.startsWith(prefix)) memoryCache.delete(key);
  }
}

export function clearInflight(prefix?: string) {
  if (!prefix) {
    inflight.clear();
    return;
  }

  for (const key of inflight.keys()) {
    if (key === prefix || key.startsWith(prefix)) inflight.delete(key);
  }
}
