import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  countUnsyncedPendingActions,
  flushPendingActions,
  listPendingActions,
  registerPendingActionHandler,
  subscribePendingActions,
  type BuklodPendingAction,
} from '@/lib/buklodOfflineSync';
import { SCALE_LIMITS } from '@/lib/performanceScale';
import { hydrateCommunityMediaUrlCache } from '@/lib/buklodMediaUrl';
import { supabase } from '@/lib/supabase';
import { useNetwork } from '@/providers/NetworkProvider';

type OfflineSyncValue = {
  online: boolean;
  pendingCount: number;
  pendingActions: BuklodPendingAction[];
  flushNow: () => Promise<void>;
};

const BuklodOfflineSyncContext =
  createContext<OfflineSyncValue>({
    online: true,
    pendingCount: 0,
    pendingActions: [],
    flushNow: async () => {},
  });

function registerDefaultPendingHandlers() {
  registerPendingActionHandler(
    'org_upsert_record',
    async (action) => {
      const payload = action.payload;
      const { error } = await (supabase as any).rpc(
        'buklod_org_upsert_record_v1',
        {
          _scope_id: payload._scope_id,
          _module_key: payload._module_key,
          _record_id: payload._record_id ?? null,
          _title: payload._title,
          _body: payload._body ?? null,
          _status: payload._status,
          _is_pinned: payload._is_pinned,
          _starts_at: payload._starts_at ?? null,
          _ends_at: payload._ends_at ?? null,
          _payload: payload._payload ?? {},
        },
      );

      if (error) {
        throw error;
      }
    },
  );

  registerPendingActionHandler(
    'org_delete_record',
    async (action) => {
      const payload = action.payload;
      const { error } = await (supabase as any).rpc(
        'buklod_org_delete_record_v1',
        {
          _scope_id: payload._scope_id,
          _record_id: payload._record_id,
        },
      );

      if (error) {
        throw error;
      }
    },
  );
}

let handlersRegistered = false;

export function BuklodOfflineSyncProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isConnected, isInternetReachable } = useNetwork();
  const online =
    isConnected && isInternetReachable !== false;

  const [pendingActions, setPendingActions] = useState<
    BuklodPendingAction[]
  >([]);
  const [pendingCount, setPendingCount] = useState(0);

  const reloadPending = useCallback(async () => {
    const [actions, count] = await Promise.all([
      listPendingActions(),
      countUnsyncedPendingActions(),
    ]);
    setPendingActions(actions);
    setPendingCount(count);
  }, []);

  const flushNow = useCallback(async () => {
    if (!online) {
      return;
    }

    await flushPendingActions();
    await reloadPending();
  }, [online, reloadPending]);

  useEffect(() => {
    if (!handlersRegistered) {
      registerDefaultPendingHandlers();
      handlersRegistered = true;
    }

    void hydrateCommunityMediaUrlCache();
    void reloadPending();
    return subscribePendingActions(() => {
      void reloadPending();
    });
  }, [reloadPending]);

  useEffect(() => {
    if (!online) {
      return;
    }

    void flushNow();
  }, [online, flushNow]);

  useEffect(() => {
    if (!online) {
      return;
    }

    const timer = setInterval(() => {
      void flushNow();
    }, SCALE_LIMITS.offlineBackgroundRefreshMs);

    return () => clearInterval(timer);
  }, [online, flushNow]);

  const value = useMemo(
    () => ({
      online,
      pendingCount,
      pendingActions,
      flushNow,
    }),
    [online, pendingCount, pendingActions, flushNow],
  );

  return (
    <BuklodOfflineSyncContext.Provider value={value}>
      {children}
    </BuklodOfflineSyncContext.Provider>
  );
}

export function useBuklodOfflineSync() {
  return useContext(BuklodOfflineSyncContext);
}
