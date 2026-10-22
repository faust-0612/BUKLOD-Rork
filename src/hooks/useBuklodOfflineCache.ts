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
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
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
  const { isConnected, isInternetReachable } = useNetwork();
  const online =
    isConnected && isInternetReachable !== false;

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

  const [dataScope, setDataScope] = useState(cacheKey);
  const dataRef = useRef(data);
  dataRef.current = dataScope === cacheKey ? data : initial.data;
  const mountedRef = useRef(true);
  const requestRef = useRef({ id: 0, cacheKey, enabled, online });
  if (requestRef.current.cacheKey !== cacheKey ||
      requestRef.current.enabled !== enabled || requestRef.current.online !== online) {
    requestRef.current = { id: requestRef.current.id + 1, cacheKey, enabled, online };
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current.id += 1;
    };
  }, []);

  useEffect(() => {
    const next = initialCacheState<T>(cacheKey, enabled);
    dataRef.current = next.data;
    setData(next.data);
    setDataScope(cacheKey);
    setLoading(next.loading);
    setFromCache(next.fromCache);
    setError(null);
    setRefreshing(false);
    setSyncing(false);
  }, [cacheKey, enabled]);

  const pendingRef = useRef<{ key: string; task: Promise<T> } | null>(null);
  const fetchBounded = useCallback((fetcher: () => Promise<T>) => {
    if (pendingRef.current?.key === cacheKey) return pendingRef.current.task;
    const task = withBuklodTimeout(Promise.resolve().then(fetcher), 12000, 'Saved content refresh');
    pendingRef.current = { key: cacheKey, task };
    const clear = () => { if (pendingRef.current?.task === task) pendingRef.current = null; };
    void task.then(clear, clear);
    return task;
  }, [cacheKey]);

  const hydrate = useCallback(async () => {
    if (!mountedRef.current || requestRef.current.cacheKey !== cacheKey) return;
    const requestId = ++requestRef.current.id;
    const isCurrent = () => mountedRef.current && requestId === requestRef.current.id;
    if (!enabled || !cacheKey) {
      setLoading(false);
      return;
    }
    const fetchCurrent = fetcherRef.current;
    const mergeCurrent = mergeRef.current;
    let cached = dataRef.current;
    setError(null);
    setRefreshing(false);
    setSyncing(false);
    try {
      cached = readOfflineCacheSync<T>(cacheKey) ?? (await readOfflineCache<T>(cacheKey));
      if (!isCurrent()) return;
      if (cached != null) {
        dataRef.current = cached;
        setData(cached);
        setFromCache(true);
        setLoading(false);
      }
      if (!online) {
        if (cached == null) setError('Offline — no saved data yet.');
        return;
      }
      setSyncing(true);
      const fresh = await fetchBounded(fetchCurrent);
      if (!isCurrent()) return;
      const next = cached != null && mergeCurrent ? mergeCurrent(cached, fresh) : fresh;
      dataRef.current = next;
      setData(next);
      setFromCache(false);
      setError(null);
      await writeOfflineCache(cacheKey, next, 'network');
    } catch (err: unknown) {
      if (isCurrent() && cached == null) {
        setError(err instanceof Error ? err.message : 'Could not refresh.');
      }
    } finally {
      if (isCurrent()) {
        setSyncing(false);
        setLoading(false);
      }
    }
  }, [cacheKey, enabled, online, fetchBounded]);

  const refresh = useCallback(async () => {
    if (!mountedRef.current || !cacheKey || !enabled || !online ||
        requestRef.current.cacheKey !== cacheKey) return;
    const requestId = ++requestRef.current.id;
    const isCurrent = () => mountedRef.current && requestId === requestRef.current.id;
    const fetchCurrent = fetcherRef.current;
    const mergeCurrent = mergeRef.current;
    setRefreshing(true);
    setSyncing(true);
    try {
      const fresh = await fetchBounded(fetchCurrent);
      if (!isCurrent()) return;
      const current = dataRef.current;
      const next = current != null && mergeCurrent ? mergeCurrent(current, fresh) : fresh;
      dataRef.current = next;
      setData(next);
      setFromCache(false);
      setError(null);
      await writeOfflineCache(cacheKey, next, 'network');
    } catch (err: unknown) {
      if (isCurrent()) setError(err instanceof Error ? err.message : 'Could not refresh.');
    } finally {
      if (isCurrent()) {
        setRefreshing(false);
        setSyncing(false);
        setLoading(false);
      }
    }
  }, [cacheKey, enabled, online, fetchBounded]);

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
    data: enabled ? (dataScope === cacheKey ? data : initial.data) : null,
    loading: enabled && online && (dataScope === cacheKey ? loading : initial.loading),
    refreshing,
    syncing,
    error,
    fromCache: enabled && (dataScope === cacheKey ? fromCache : initial.fromCache),
    online,
    refresh,
    hydrate,
  };
}
