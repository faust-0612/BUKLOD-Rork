import React, {
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { AppState } from 'react-native';

import { useBuklodOfflineSync } from '@/providers/BuklodOfflineSyncProvider';
import { useNetwork } from '@/providers/NetworkProvider';

const RECONNECT_SETTLE_MS = 1_000;
const MIN_SYNC_GAP_MS = 5_000;

/*
 * BUKLOD_OFFLINE_RUNTIME_R1
 *
 * This is the single normal auto-sync entry point. NetworkProvider owns
 * connectivity + the generic queue; BuklodOfflineSyncProvider owns feature
 * pending actions. The coordinator wakes both sequentially only after usable
 * internet is confirmed, avoiding reconnect request bursts.
 */
export default function BuklodSyncCoordinator() {
  const {
    online,
    refreshNetwork,
    syncNow,
  } = useNetwork();
  const {
    flushNow,
  } = useBuklodOfflineSync();

  const onlineRef = useRef(online);
  const runningRef = useRef(false);
  const lastRunRef = useRef(0);

  onlineRef.current = online;

  const runSync = useCallback(async () => {
    if (!onlineRef.current || runningRef.current) {
      return;
    }

    const now = Date.now();
    if (now - lastRunRef.current < MIN_SYNC_GAP_MS) {
      return;
    }

    runningRef.current = true;
    lastRunRef.current = now;

    try {
      await syncNow().catch(() => undefined);

      if (!onlineRef.current) {
        return;
      }

      await flushNow().catch(() => undefined);
    } finally {
      runningRef.current = false;
    }
  }, [flushNow, syncNow]);

  useEffect(() => {
    if (!online) {
      return;
    }

    const timer = setTimeout(() => {
      void runSync();
    }, RECONNECT_SETTLE_MS);

    return () => clearTimeout(timer);
  }, [online, runSync]);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState) => {
        if (nextState !== 'active') {
          return;
        }

        void refreshNetwork()
          .catch(() => undefined)
          .finally(() => {
            setTimeout(() => {
              void runSync();
            }, RECONNECT_SETTLE_MS);
          });
      },
    );

    return () => subscription.remove();
  }, [refreshNetwork, runSync]);

  return null;
}
