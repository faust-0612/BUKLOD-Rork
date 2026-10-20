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
import { reportBuklodMainHealthIssue } from '@/lib/buklodMainHealth';
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

  const scopeRef = useRef({ cacheKey, enabled, online, generation: 0 });
  if (scopeRef.current.cacheKey !== cacheKey || scopeRef.current.enabled !== enabled || scopeRef.current.online !== online) {
    scopeRef.current = { cacheKey, enabled, online, generation: scopeRef.current.generation + 1 };
  }
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const pendingRef = useRef<{ scope: object; task: Promise<T> } | null>(null);
  const request = useCallback((scope: object) => {
    if (pendingRef.current?.scope === scope) return pendingRef.current.task;
    const load = fetcherRef.current;
    const task = Promise.resolve().then(() => load());
    pendingRef.current = { scope, task };
    void task.finally(() => {
      if (pendingRef.current?.task === task) pendingRef.current = null;
    }).catch(() => undefined);
    return task;
  }, []);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const mergeRef = useRef(merge);
  mergeRef.current = merge;

  useEffect(() => {
    if (!enabled || !cacheKey) {
      setData(null);
      setLoading(false);
      setFromCache(false);
      setError(null);
      setRefreshing(false);
      setSyncing(false);
      return;
    }

    const cached = readOfflineCacheSync<T>(cacheKey);
    if (cached != null) {
      setData(cached);
      setFromCache(true);
      setLoading(false);
      return;
    }

    setData(null);
    setFromCache(false);
    setError(null);
    setRefreshing(false);
    setSyncing(false);
    setLoading(true);
  }, [cacheKey, enabled]);

  const run = useCallback(async (manual: boolean) => {
    const scope = scopeRef.current;
    const current = () => mountedRef.current && scopeRef.current === scope;
    if (!enabled || !cacheKey) return;
    if (manual) setRefreshing(true);
    setError(null);
    let cached: T | null = readOfflineCacheSync<T>(cacheKey);
    try {
      if (cached == null) {
        cached = await withBuklodTimeout(readOfflineCache<T>(cacheKey), 1_500, 'Saved content');
      }
    } catch { /* Network refresh may still recover unavailable local storage. */ }
    if (!current()) return;
    if (cached != null) {
      setData(cached);
      setFromCache(true);
      setLoading(false);
    }
    if (!online) {
      setLoading(false);
      setRefreshing(false);
      setSyncing(false);
      if (cached == null) setError('Offline — no saved data yet.');
      return;
    }
    setSyncing(true);
    try {
      const fresh = await withBuklodTimeout(request(scope), 12_000, 'Content refresh');
      if (!current()) return;
      const next = cached != null && mergeRef.current ? mergeRef.current(cached, fresh) : fresh;
      setData(next);
      setFromCache(false);
      setError(null);
      // Storage cannot hold the loading indicator or turn a successful read into failure.
      void writeOfflineCache(cacheKey, next, 'network').catch(() => undefined);
    } catch (err: unknown) {
      if (!current()) return;
      setError(err instanceof Error ? err.message : 'Could not refresh.');
      // Fixed operational labels only: cache keys may contain account identifiers.
      void reportBuklodMainHealthIssue({
        category: 'LOADING', severity: 'WARNING', safeErrorCode: 'CONTENT_REFRESH_FAILED',
        errorSignature: 'CONTENT_REFRESH_FAILED', correlationKey: 'OFFLINE_CACHE_REFRESH',
        routeModule: 'offline-cache', privacyClassification: 'OPERATIONAL',
      }).catch(() => undefined);
    } finally {
      if (current()) {
        setSyncing(false);
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [cacheKey, enabled, online, request]);
  const hydrate = useCallback(() => run(false), [run]);
  const refresh = useCallback(() => run(true), [run]);

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

