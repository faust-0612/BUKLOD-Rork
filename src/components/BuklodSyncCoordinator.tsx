import React, {
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { SCALE_LIMITS } from '@/lib/performanceScale';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import {
  WALL_COMMENT_QUEUE_KIND,
  parsePendingWallComment,
} from '@/lib/buklodCommunityOfflineComment';
import { notifyBuklodCommunityMentions } from '@/lib/buklodNotifyMentions';
import { recordConfirmedCommunityComment } from '@/lib/buklodCommunityCommentAdCadence';
import { warmBuklodAdOpportunity } from '@/lib/buklodAdOpportunities';
import { useBuklodOfflineSync } from '@/providers/BuklodOfflineSyncProvider';
import { useNetwork } from '@/providers/NetworkProvider';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { removeOfflineCache } from '@/lib/offlineCache';
import {
  AUTO_SYNC_ACTIONS_PER_QUEUE,
  buklodReconnectDelayMs,
} from '@/lib/buklodReconnectPacing';
import {
  OfflineQueueDeferredError,
  OfflineQueuePermanentError,
  registerOfflineQueueHandler,
} from '@/lib/offlineSyncQueue';

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
  const scheduledSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    // Offline Wall comments use the same account-safe queue as other features.
    // The backend v5 RPC owns idempotency: a lost response cannot create a
    // second comment or duplicate the server's reward side effects.
    return registerOfflineQueueHandler(WALL_COMMENT_QUEUE_KIND, async item => {
      if (!user?.id || item.userId !== user.id) {
        throw new OfflineQueueDeferredError();
      }
      const payload = parsePendingWallComment(item.payload);
      if (!payload) {
        throw new OfflineQueuePermanentError('Invalid saved comment.');
      }
      const { data: sessionData, error: sessionError } =
        await withBuklodTimeout(supabase.auth.getSession(), 12_000, 'Community comment session');
      if (sessionError || sessionData.session?.user?.id !== item.userId) {
        throw new OfflineQueueDeferredError();
      }
      const { error } = await withBuklodTimeout(
        (supabase as any).rpc('add_buklod_post_comment_v5', {
          p_post_id: payload.postId,
          p_body: payload.body,
          p_parent_id: payload.parentId,
          p_request_key: item.id,
        }),
        18_000,
        'Community comment sync',
      );
      if (error) {
        const code = String(error.code ?? '');
        if (code === '28000' || Number(error.status) === 401) {
          throw new OfflineQueueDeferredError();
        }
        if (['42501', '22023', '23505'].includes(code) || Number(error.status) === 403) {
          throw new OfflineQueuePermanentError(String(error.message ?? 'Comment was rejected.'));
        }
        throw error;
      }

      // Only server-confirmed comments enter the existing ad cadence.
      const adCount = recordConfirmedCommunityComment(item.userId);
      if (adCount.shouldWarm) warmBuklodAdOpportunity('community_comment_overage');
      if (payload.mentionIds.length) {
        void notifyBuklodCommunityMentions({
          postId: payload.postId,
          mentionedUserIds: payload.mentionIds,
          context: 'comment',
        }).catch(() => undefined);
      }
    });
  }, [user?.id]);

  const runSync = useCallback(async () => {
    if (!onlineRef.current || !user?.id || runningRef.current) {
      return;
    }

    const now = Date.now();
    if (now - lastRunRef.current < MIN_SYNC_GAP_MS) {
      return;
    }

    runningRef.current = true;
    lastRunRef.current = now;

    try {
      await syncNow({
        maxItems: AUTO_SYNC_ACTIONS_PER_QUEUE,
        userId: user.id,
      })
        .catch(() => undefined);

      if (!onlineRef.current) {
        return;
      }

      await flushNow({ maxItems: AUTO_SYNC_ACTIONS_PER_QUEUE })
        .catch(() => undefined);
    } finally {
      runningRef.current = false;
    }
  }, [flushNow, syncNow, user?.id]);

  // One pending reconnect timer per device, shared by NetInfo and AppState.
  // If both announce reconnection, reschedule instead of double-flushing.
  const scheduleSync = useCallback(() => {
    if (scheduledSyncTimerRef.current) {
      clearTimeout(scheduledSyncTimerRef.current);
    }
    scheduledSyncTimerRef.current = setTimeout(() => {
      scheduledSyncTimerRef.current = null;
      void runSync();
    }, buklodReconnectDelayMs());
  }, [runSync]);

  useEffect(() => {
    if (!online) {
      if (scheduledSyncTimerRef.current) {
        clearTimeout(scheduledSyncTimerRef.current);
        scheduledSyncTimerRef.current = null;
      }
      return;
    }

    scheduleSync();

    return () => {
      if (scheduledSyncTimerRef.current) {
        clearTimeout(scheduledSyncTimerRef.current);
        scheduledSyncTimerRef.current = null;
      }
    };
  }, [online, scheduleSync]);

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
    let active = true;
    const subscription = AppState.addEventListener(
      'change',
      (nextState) => {
        if (nextState !== 'active') {
          return;
        }

        void refreshNetwork()
          .catch(() => undefined)
          .finally(() => {
            if (!active) return;
            if (onlineRef.current) scheduleSync();
          });
      },
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, [refreshNetwork, scheduleSync]);

  return null;
}
