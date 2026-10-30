import { useCallback, useEffect, useRef, useState } from 'react';
import { acquireSharedRealtimeSubscription } from '@/lib/performance';
import { supabase } from '@/lib/supabase';
import { subscribeConnectRead } from '@/lib/connectReadSync';
import { invalidateBuklodConnectUnreadCaches } from '@/lib/buklodR4RequestShield';
import { useAuth } from '@/providers/AuthProvider';
import { SCALE_LIMITS } from '@/lib/performanceScale';

const REALTIME_FILTER_CHUNK = 100;
const UNREAD_FALLBACK_POLL_MS =
  SCALE_LIMITS.connectUnreadPollMs;

function uniqueIds(
  values: Array<string | null | undefined>
) {
  return Array.from(
    new Set(
      values
        .map(value => String(value ?? '').trim())
        .filter(Boolean)
    )
  );
}

function sumUnread(
  rows: unknown
) {
  if (!Array.isArray(rows)) {
    return 0;
  }

  return rows.reduce(
    (total, row) => {
      const value =
        Math.max(
          0,
          Number(
            (row as { unread_count?: unknown })
              ?.unread_count ?? 0
          ) || 0
        );

      return total + value;
    },
    0
  );
}

function chunkIds(
  ids: string[],
  size = REALTIME_FILTER_CHUNK
) {
  const chunks: string[][] = [];

  for (
    let index = 0;
    index < ids.length;
    index += size
  ) {
    chunks.push(
      ids.slice(index, index + size)
    );
  }

  return chunks;
}

export function useBuklodConnectUnread() {
  const { profile } = useAuth();

  const profileId =
    (profile as any)?.id as
      | string
      | undefined;

  const [
    unreadCount,
    setUnreadCount,
  ] = useState(0);
  const [
    personalUnread,
    setPersonalUnread,
  ] = useState(0);
  const [
    communityUnread,
    setCommunityUnread,
  ] = useState(0);

  // Share the initial thread/room bootstrap between refresh and subscription setup.
  const bootstrapRef = useRef<{
    profileId: string;
    promise: Promise<[any, any]>;
  } | null>(null);

  const fetchThreadRooms = useCallback(() => {
    if (!profileId) return Promise.resolve([{ data: [], error: null }, { data: [], error: null }] as [any, any]);
    if (bootstrapRef.current?.profileId === profileId) return bootstrapRef.current.promise;
    const promise = Promise.all([
      (supabase as any).rpc('buklod_connect_personal_threads'),
      (supabase as any).rpc('buklod_connect_community_rooms'),
    ]) as Promise<[any, any]>;
    bootstrapRef.current = { profileId, promise };
    void promise.finally(() => {
      if (bootstrapRef.current?.promise === promise) bootstrapRef.current = null;
    }).catch(() => {});
    return promise;
  }, [profileId]);

  const refreshSequenceRef = useRef(0);
  const refresh = useCallback(
    async () => {
      const sequence = ++refreshSequenceRef.current;
      if (!profileId) {
        setUnreadCount(0);
        setPersonalUnread(0);
        setCommunityUnread(0);
        return;
      }

      const [countResult, [personalResult, roomResult]] =
        await Promise.all([
          (supabase as any).rpc('buklod_connect_unread_count'),
          fetchThreadRooms(),
        ]);

      if (sequence !== refreshSequenceRef.current) return;

      if (!countResult.error) {
        const data = countResult.data;
        const raw =
          Array.isArray(data)
            ? data[0] ?? 0
            : data ?? 0;

        const numeric =
          Number(
            typeof raw === 'object'
              ? raw?.unread_count ??
                  raw?.count ??
                  0
              : raw
          );

        setUnreadCount(
          Number.isFinite(numeric)
            ? Math.max(0, numeric)
            : 0
        );
      }

      if (!personalResult.error) {
        setPersonalUnread(
          sumUnread(personalResult.data)
        );
      }

      if (!roomResult.error) {
        setCommunityUnread(
          sumUnread(roomResult.data)
        );
      }
    },
    [
      profileId,
      fetchThreadRooms,
    ]
  );

  useEffect(
    () => {
      void refresh();

      if (!profileId) {
        return;
      }

      let active = true;
      const unsubscribeRead = subscribeConnectRead(readerId => {
        if (readerId !== profileId) return;
        // A bootstrap started before the read can contain stale counts.
        // Ignore it and request a fresh, post-write snapshot instead.
        bootstrapRef.current = null;
        void refresh();
      });
      let releaseRealtime:
        (() => void)
        | null = null;
      let pollTimer:
        ReturnType<typeof setInterval>
        | null = null;

      const setup =
        async () => {
          const [personalResult, roomResult] = await fetchThreadRooms();

          if (!active) {
            return;
          }

          const personalRows =
            personalResult.error
              ? []
              : personalResult.data ?? [];

          const roomRows =
            roomResult.error
              ? []
              : roomResult.data ?? [];

          const threadIds =
            uniqueIds(
              personalRows.map(
                (row: any) =>
                  row?.thread_id
              )
            ).sort();

          const scopeIds =
            uniqueIds(
              roomRows.map(
                (row: any) =>
                  row?.scope_id
              )
            ).sort();

          if (
            threadIds.length > 0 ||
            scopeIds.length > 0
          ) {
            const registryKey =
              `connect-unread-filtered:${profileId}:threads=${threadIds.join(',')}:scopes=${scopeIds.join(',')}`;

            releaseRealtime =
              acquireSharedRealtimeSubscription(
                registryKey,
                () => {
                  invalidateBuklodConnectUnreadCaches('both');
                  bootstrapRef.current = null;
                  void refresh();
                },
                emit => {
                  let nextChannel: any =
                    supabase.channel(
                      registryKey
                    );

                  for (
                    const ids of
                    chunkIds(threadIds)
                  ) {
                    nextChannel =
                      nextChannel.on(
                        'postgres_changes',
                        {
                          event: 'INSERT',
                          schema: 'public',
                          table:
                            'buklod_connect_direct_messages',
                          filter:
                            `thread_id=in.(${ids.join(',')})`,
                        },
                        (payload: unknown) => {
                          emit(payload);
                        }
                      );
                  }

                  for (
                    const ids of
                    chunkIds(scopeIds)
                  ) {
                    nextChannel =
                      nextChannel.on(
                        'postgres_changes',
                        {
                          event: 'INSERT',
                          schema: 'public',
                          table:
                            'buklod_connect_scope_messages',
                          filter:
                            `scope_id=in.(${ids.join(',')})`,
                        },
                        (payload: unknown) => {
                          emit(payload);
                        }
                      );
                  }

                  const subscribed =
                    nextChannel.subscribe();

                  return () => {
                    void supabase
                      .removeChannel(
                        subscribed
                      );
                  };
                }
              );
          }

          /*
           * Safety fallback:
           * - catches a brand-new conversation/scope
           *   created after subscriptions were built
           * - avoids global unfiltered message listeners
           */
          pollTimer =
            setInterval(
              () => {
                void refresh();
              },
              UNREAD_FALLBACK_POLL_MS
            );
        };

      void setup();

      return () => {
        active = false;
        unsubscribeRead();

        if (pollTimer) {
          clearInterval(
            pollTimer
          );
        }

        if (releaseRealtime) {
          releaseRealtime();
        }
      };
    },
    [
      profileId,
      refresh,
      fetchThreadRooms,
    ]
  );

  return {
    unreadCount,
    personalUnread,
    communityUnread,
    refresh,
  };
}
