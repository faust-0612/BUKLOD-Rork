import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
  | 'degraded'
  | 'syncing';

type BuklodConnectivityStatus =
  Exclude<BuklodNetworkStatus, 'syncing'>;

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

function classifyNetworkState(
  state: NetInfoState | null,
): BuklodConnectivityStatus {
  if (!state) return 'unknown';

  if (state.isConnected === false) {
    return 'offline';
  }

  if (state.isConnected !== true) {
    return 'unknown';
  }

  if (state.isInternetReachable === true) {
    return 'online';
  }

  /*
   * Browsers commonly expose only navigator.onLine through NetInfo and may
   * leave isInternetReachable=null. Do not strand the web app in DEGRADED
   * forever when the browser itself confirms a connected transport.
   */
  if (
    Platform.OS === 'web' &&
    state.isInternetReachable == null
  ) {
    return 'online';
  }

  /*
   * Connected transport without confirmed internet is not ONLINE.
   * This covers captive portals, weak data, and NetInfo's initial
   * reachability probe without forcing the app into a hard-offline UI.
   */
  return 'degraded';
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

  const connectivity = classifyNetworkState(state);
  const online = connectivity === 'online';

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
    if (!online) return;

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
  }, [online]);

  useEffect(() => {
    mountedRef.current = true;

    const unsubscribeQueue = subscribeOfflineQueue((snapshot) => {
      if (mountedRef.current) {
        setPendingCount(snapshot.pendingCount);
      }
    });

    void getOfflineQueueSnapshot()
      .then((snapshot) => {
        if (mountedRef.current) {
          setPendingCount(snapshot.pendingCount);
        }
      })
      .catch(() => undefined);

    void pruneOfflineCache().catch(() => undefined);

    return () => {
      mountedRef.current = false;
      unsubscribeQueue();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(setState);
    void refreshNetwork();
    return unsubscribe;
  }, [refreshNetwork]);

  useEffect(() => {
    if (online) {
      setLastOnlineAt(Date.now());
    }
  }, [online]);

  const status: BuklodNetworkStatus =
    syncing && online
      ? 'syncing'
      : connectivity;

  const value = useMemo<NetworkContextValue>(
    () => ({
      isConnected: state?.isConnected === true,
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