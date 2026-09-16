export type CachedQueryOptions = {
  ttlMs?: number;
  staleMs?: number;
};

type CacheEntry<T> = {
  value: T;
  resolvedAt: number;
};

const resolvedQueryCache = new Map<string, CacheEntry<unknown>>();
const inFlightQueries = new Map<string, Promise<unknown>>();

function normalizeDuration(value: number | undefined) {
  const duration = Number(value ?? 0);

  if (!Number.isFinite(duration) || duration <= 0) {
    return 0;
  }

  return duration;
}

/**
 * Collapse identical concurrent reads/writes behind one promise.
 *
 * ttlMs controls reuse of a successfully resolved value. staleMs only
 * permits a previously resolved value to be used when a refresh fails.
 * With ttlMs=0 and staleMs=0, no resolved data is retained: only requests
 * that are simultaneously in flight are coalesced.
 */
export async function cachedQuery<T>(
  key: string,
  load: () => Promise<T>,
  options: CachedQueryOptions = {}
): Promise<T> {
  const normalizedKey = String(key ?? '').trim();

  if (!normalizedKey) {
    return load();
  }

  const ttlMs = normalizeDuration(options.ttlMs);
  const staleMs = normalizeDuration(options.staleMs);
  const now = Date.now();
  const cached = resolvedQueryCache.get(normalizedKey) as
    | CacheEntry<T>
    | undefined;

  if (
    cached &&
    ttlMs > 0 &&
    now - cached.resolvedAt <= ttlMs
  ) {
    return cached.value;
  }

  const existing = inFlightQueries.get(normalizedKey) as
    | Promise<T>
    | undefined;

  if (existing) {
    return existing;
  }

  const request = (async () => {
    try {
      const value = await load();

      if (ttlMs > 0 || staleMs > 0) {
        resolvedQueryCache.set(normalizedKey, {
          value,
          resolvedAt: Date.now(),
        });
      } else {
        resolvedQueryCache.delete(normalizedKey);
      }

      return value;
    } catch (error) {
      const fallback = resolvedQueryCache.get(normalizedKey) as
        | CacheEntry<T>
        | undefined;

      if (
        fallback &&
        staleMs > 0 &&
        Date.now() - fallback.resolvedAt <= ttlMs + staleMs
      ) {
        return fallback.value;
      }

      throw error;
    } finally {
      inFlightQueries.delete(normalizedKey);
    }
  })();

  inFlightQueries.set(normalizedKey, request);
  return request;
}
