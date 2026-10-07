import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  readOfflineCache,
  readOfflineCacheSync,
  writeOfflineCache,
} from '@/lib/buklodOfflineSync';
import { useNetwork } from '@/providers/NetworkProvider';

type Options<T> = {
  cacheKey: string;
  enabled?: boolean;
  fetcher: () => Promise<T>;
  merge?: (cached: T, fresh: T) => T;
  refreshIntervalMs?: number;
};

function initialCacheState<T>(cacheKey: string, enabled: boolean) {
  if (!enabled || !cacheKey) {
    return {
      data: null as T | null,
      loading: false,
      fromCache: false,
    };
  }

  const cached = readOfflineCacheSync<T>(cacheKey);

  if (cached != null) {
    return {
      data: cached,
      loading: false,
      fromCache: true,
    };
  }

  return {
    data: null as T | null,
    loading: true,
    fromCache: false,
  };
}

export function useBuklodOfflineCache<T>({
  cacheKey,
  enabled = true,
  fetcher,
  merge,
  refreshIntervalMs,
}: Options<T>) {
  const { online } = useNetwork();

  const initial = initialCacheState<T>(cacheKey, enabled);
  const [data, setData] = useState<T | null>(initial.data);
  const [loading, setLoading] = useState(initial.loading);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(initial.fromCache);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const mergeRef = useRef(merge);
  mergeRef.current = merge;

  useEffect(() => {
    if (!enabled || !cacheKey) {
      setData(null);
      setLoading(false);
      setFromCache(false);
      return;
    }

    const cached = readOfflineCacheSync<T>(cacheKey);
    if (cached != null) {
      setData(cached);
      setFromCache(true);
      setLoading(false);
      return;
    }

    setLoading(true);
  }, [cacheKey, enabled]);

  const hydrate = useCallback(async () => {
    if (!enabled || !cacheKey) {
      setLoading(false);
      return;
    }

    setError(null);

    const cached =
      readOfflineCacheSync<T>(cacheKey) ??
      (await readOfflineCache<T>(cacheKey));

    if (cached != null) {
      setData(cached);
      setFromCache(true);
      setLoading(false);
    }

    if (!online) {
      if (cached == null) {
        setLoading(false);
        setError('Offline — no saved data yet.');
      }
      return;
    }

    setSyncing(true);

    try {
      const fresh = await fetcherRef.current();
      const next =
        cached != null && mergeRef.current
          ? mergeRef.current(cached, fresh)
          : fresh;

      setData(next);
      setFromCache(false);
      setError(null);
      await writeOfflineCache(cacheKey, next, 'network');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Could not refresh.';

      if (cached == null) {
        setError(message);
      }
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  }, [cacheKey, enabled, online]);

  const refresh = useCallback(async () => {
    if (!enabled || !online) {
      return;
    }

    setRefreshing(true);
    setSyncing(true);

    try {
      const fresh = await fetcherRef.current();
      setData((current) => {
        const next =
          current != null && mergeRef.current
            ? mergeRef.current(current, fresh)
            : fresh;

        void writeOfflineCache(cacheKey, next, 'network');
        return next;
      });
      setFromCache(false);
      setError(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Could not refresh.';
      setError(message);
    } finally {
      setRefreshing(false);
      setSyncing(false);
    }
  }, [cacheKey, enabled, online]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!enabled || !online || !refreshIntervalMs) {
      return;
    }

    const timer = setInterval(() => {
      void refresh();
    }, refreshIntervalMs);

    return () => clearInterval(timer);
  }, [enabled, online, refresh, refreshIntervalMs]);

  return {
    data,
    loading,
    refreshing,
    syncing,
    error,
    fromCache,
    online,
    refresh,
    hydrate,
  };
}
