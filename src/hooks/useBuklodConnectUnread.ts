import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
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

  const refresh = useCallback(
    async () => {
      if (!profileId) {
        setUnreadCount(0);
        return;
      }

      const {
        data,
        error,
      } =
        await (supabase as any).rpc(
          'buklod_connect_unread_count'
        );

      if (error) {
        return;
      }

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
    },
    [
      profileId,
    ]
  );

  useEffect(
    () => {
      void refresh();

      if (!profileId) {
        return;
      }

      let active = true;
      let channel: any = null;
      let pollTimer:
        ReturnType<typeof setInterval>
        | null = null;

      const setup =
        async () => {
          const [
            personalResult,
            roomResult,
          ] =
            await Promise.all([
              (supabase as any).rpc(
                'buklod_connect_personal_threads'
              ),
              (supabase as any).rpc(
                'buklod_connect_community_rooms'
              ),
            ]);

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
            );

          const scopeIds =
            uniqueIds(
              roomRows.map(
                (row: any) =>
                  row?.scope_id
              )
            );

          const sessionKey = `${Date.now()}:${Math.random()
            .toString(36)
            .slice(2)}`;

          let nextChannel: any =
            supabase.channel(
              `connect-unread-filtered-${profileId}:${sessionKey}`
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
                () => {
                  void refresh();
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
                () => {
                  void refresh();
                }
              );
          }

          if (
            threadIds.length > 0 ||
            scopeIds.length > 0
          ) {
            channel =
              nextChannel.subscribe();
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

        if (pollTimer) {
          clearInterval(
            pollTimer
          );
        }

        if (channel) {
          void supabase
            .removeChannel(
              channel
            );
        }
      };
    },
    [
      profileId,
      refresh,
    ]
  );

  return {
    unreadCount,
    refresh,
  };
}
