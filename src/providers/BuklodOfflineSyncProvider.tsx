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
import { hydrateCommunityMediaUrlCache } from '@/lib/buklodMediaUrl';
import { supabase } from '@/lib/supabase';
import { useNetwork } from '@/providers/NetworkProvider';

type OfflineSyncValue = {
  online: boolean;
  syncing: boolean;
  pendingCount: number;
  pendingActions: BuklodPendingAction[];
  flushNow: (options?: { maxItems?: number }) => Promise<void>;
};

const BuklodOfflineSyncContext =
  createContext<OfflineSyncValue>({
    online: false,
    syncing: false,
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
  const { online } = useNetwork();

  const [pendingActions, setPendingActions] = useState<
    BuklodPendingAction[]
  >([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const reloadPending = useCallback(async () => {
    const [actions, count] = await Promise.all([
      listPendingActions(),
      countUnsyncedPendingActions(),
    ]);
    setPendingActions(actions);
    setPendingCount(count);
  }, []);

  const flushNow = useCallback(async (options?: { maxItems?: number }) => {
    if (!online) {
      return;
    }

    setSyncing(true);
    try {
      await flushPendingActions({ maxItems: options?.maxItems });
      await reloadPending();
    } finally {
      setSyncing(false);
    }
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

  const value = useMemo(
    () => ({
      online,
      syncing,
      pendingCount,
      pendingActions,
      flushNow,
    }),
    [online, syncing, pendingCount, pendingActions, flushNow],
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

