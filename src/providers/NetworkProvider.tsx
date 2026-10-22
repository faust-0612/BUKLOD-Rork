import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, InteractionManager } from 'react-native';

import { noteNetInfoHint } from '@/lib/buklodNetworkQuality';
import {
  drainOfflineQueue,
  getOfflineQueueSnapshot,
  subscribeOfflineQueue,
} from '@/lib/offlineSyncQueue';
import { pruneOfflineCache } from '@/lib/offlineCache';

export type BuklodNetworkStatus =
  | 'unknown'
  | 'online'
  | 'offline'
  | 'syncing';

type NetworkContextValue = {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  online: boolean;
  status: BuklodNetworkStatus;
  pendingCount: number;
  lastOnlineAt: number | null;
  lastSyncAt: number | null;
  connectionType: string;
  syncNow: () => Promise<void>;
  refreshNetwork: () => Promise<void>;
};

export const NetworkContext = createContext<NetworkContextValue | null>(null);

function stateIsOnline(state: NetInfoState | null): boolean {
  if (!state) return true;
  return (
    state.isConnected !== false &&
    state.isInternetReachable !== false
  );
}

export function NetworkProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<NetInfoState | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastOnlineAt, setLastOnlineAt] = useState<number | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

  const mountedRef = useRef(true);
  const lastAutoSyncRef = useRef(0);

  const online = stateIsOnline(state);

  useEffect(() => {
    const details = state?.details as {
      cellularGeneration?: string | null;
    } | null;
    noteNetInfoHint({
      isConnected: state ? state.isConnected : null,
      isInternetReachable: state ? state.isInternetReachable : null,
      type: state?.type ?? null,
      cellularGeneration: details?.cellularGeneration ?? null,
    });
  }, [state]);

  const refreshNetwork = useCallback(async () => {
    try {
      const next = await NetInfo.fetch();
      if (mountedRef.current) {
        setState(next);
      }
    } catch {
      // Keep last reliable state.
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (!stateIsOnline(state)) return;

    setSyncing(true);
    try {
      const result = await drainOfflineQueue({ concurrency: 2 });
      if (mountedRef.current) {
        setPendingCount(result.pendingCount);
        setLastSyncAt(Date.now());
      }
    } finally {
      if (mountedRef.current) {
        setSyncing(false);
      }
    }
  }, [state]);

  useEffect(() => {
    mountedRef.current = true;

    const unsubscribeQueue = subscribeOfflineQueue((snapshot) => {
      if (mountedRef.current) {
        setPendingCount(snapshot.pendingCount);
      }
    });

    /* PERF_STARTUP_R1: offline queue/cache work after first interactions. */
    const task = InteractionManager.runAfterInteractions(() => {
      void getOfflineQueueSnapshot()
        .then((snapshot) => {
          if (mountedRef.current) {
            setPendingCount(snapshot.pendingCount);
          }
        })
        .catch(() => undefined);

      void pruneOfflineCache().catch(() => undefined);
    });

    return () => {
      mountedRef.current = false;
      task.cancel();
      unsubscribeQueue();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(setState);
    void refreshNetwork();
    return unsubscribe;
  }, [refreshNetwork]);

  useEffect(() => {
    if (!online) return;

    setLastOnlineAt(Date.now());

    const now = Date.now();
    if (now - lastAutoSyncRef.current < 3_000) return;
    lastAutoSyncRef.current = now;

    const timer = setTimeout(() => {
      void syncNow().catch(() => undefined);
    }, 900);

    return () => clearTimeout(timer);
  }, [online, syncNow]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;

      void refreshNetwork();
      if (stateIsOnline(state)) {
        void syncNow().catch(() => undefined);
      }
    });

    return () => subscription.remove();
  }, [refreshNetwork, state, syncNow]);

  const status: BuklodNetworkStatus = !state
    ? 'unknown'
    : !online
      ? 'offline'
      : syncing
        ? 'syncing'
        : 'online';

  const value = useMemo<NetworkContextValue>(
    () => ({
      isConnected: state?.isConnected !== false,
      isInternetReachable: state?.isInternetReachable ?? null,
      online,
      status,
      pendingCount,
      lastOnlineAt,
      lastSyncAt,
      connectionType: String(state?.type ?? 'unknown'),
      syncNow,
      refreshNetwork,
    }),
    [
      state,
      online,
      status,
      pendingCount,
      lastOnlineAt,
      lastSyncAt,
      syncNow,
      refreshNetwork,
    ],
  );

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork(): NetworkContextValue {
  const value = useContext(NetworkContext);
  if (!value) {
    throw new Error('useNetwork must be used inside NetworkProvider');
  }
  return value;
}