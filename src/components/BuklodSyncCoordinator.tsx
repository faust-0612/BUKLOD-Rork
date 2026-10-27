import React, {
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { SCALE_LIMITS } from '@/lib/performanceScale';
import { useBuklodOfflineSync } from '@/providers/BuklodOfflineSyncProvider';
import { useNetwork } from '@/providers/NetworkProvider';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { removeOfflineCache } from '@/lib/offlineCache';
import {
  OfflineQueueDeferredError,
  OfflineQueuePermanentError,
  registerOfflineQueueHandler,
} from '@/lib/offlineSyncQueue';

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
  const { user } = useAuth();
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

  useEffect(() => {
    // ABC completion is the only Show Faith mutation replayed here. The
    // database uniquely constrains (user_id, lesson_id/source_key), so a
    // lost acknowledgement or interrupted retry cannot grant points twice.
    return registerOfflineQueueHandler('faith_abc_completion_v1', async item => {
      if (!user?.id || item.userId !== user.id) {
        throw new OfflineQueueDeferredError();
      }
      const lessonId = String(
        (item.payload as { lessonId?: unknown } | null)?.lessonId ?? ''
      ).trim();
      if (!/^(prelim-0[12]|lesson-(0[1-9]|1[0-9]|2[0-6]))$/.test(lessonId)) {
        throw new OfflineQueuePermanentError('Invalid ABC lesson.');
      }

      const { data: { user: verified }, error: authError } =
        await supabase.auth.getUser();
      if (authError || verified?.id !== item.userId) {
        throw new OfflineQueueDeferredError();
      }
      const { error } = await (supabase as any).rpc(
        'complete_my_abc_growth_lesson_v1',
        { p_lesson_id: lessonId }
      );
      if (error) {
        if (error.status === 400 || error.status === 403) {
          throw new OfflineQueuePermanentError(String(error.message));
        }
        throw error;
      }

      // Only a server-confirmed completion advances local state.
      const key = `buklod.faith.abc.completed.v1.${item.userId}`;
      let completed: Record<string, boolean> = {};
      try {
        const raw = await AsyncStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            completed = parsed;
          }
        }
      } catch {
        // A malformed cache must not lose a confirmed completion.
      }
      completed[lessonId] = true;
      await AsyncStorage.setItem(key, JSON.stringify(completed));
      await removeOfflineCache('faith-abc-progress:v1', item.userId)
        .catch(() => undefined);
    });
  }, [user?.id]);

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
    if (!online) {
      return;
    }

    const interval = setInterval(() => {
      void runSync();
    }, SCALE_LIMITS.offlineBackgroundRefreshMs);

    return () => clearInterval(interval);
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
