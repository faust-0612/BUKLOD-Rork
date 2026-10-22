import React, {
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { AppState } from 'react-native';
import { usePathname } from 'expo-router';

import {
  enqueueBuklodMainHealthIssue,
  flushBuklodMainHealthQueue,
  pollBuklodMainRecoveryCommands,
  verifyBuklodMainRecovery,
} from '@/lib/buklodMainHealth';
import { supabase } from '@/lib/supabase';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import {
  getOfflineQueueSnapshot,
} from '@/lib/offlineSyncQueue';
import {
  getMyBuklodScopes,
} from '@/lib/buklodScope';
import { useAuth } from '@/providers/AuthProvider';
import { useNetwork } from '@/providers/NetworkProvider';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';

const POLL_MS = 30_000;
const SYNC_STUCK_MS = 60_000;
const LOCAL_RETRY_COOLDOWN_MS = 5 * 60_000;

type RecoveryCommand = {
  command_id?: string;
  recovery_run_id?: string;
  action_kind?: string;
  action_payload?: Record<string, unknown> | null;
  expires_at?: string | null;
};

function safeRoute(pathname: string | null | undefined) {
  const route = String(pathname ?? '')
    .trim()
    .replace(/^\/+/, '')
    .slice(0, 160);
  return /^[A-Za-z0-9_./:-]+$/.test(route)
    ? route
    : 'unknown';
}

export default function BuklodMainHealthAgent() {
  const pathname = usePathname();
  const {
    user,
    session,
    refreshProfile,
    refreshRoles,
    refreshMembership,
  } = useAuth();
  const {
    online,
    status,
    pendingCount,
    syncNow,
    refreshNetwork,
  } = useNetwork();
  const {
    activeScope,
    error: scopeError,
    refresh: refreshScope,
  } = useBuklodScope();

  const activeRef = useRef(true);
  const executingRef = useRef(false);
  const pendingSinceRef = useRef<number | null>(null);
  const lastSyncRecoveryRef = useRef(0);
  const lastScopeRecoveryRef = useRef(0);
  const lastAuthRecoveryRef = useRef(0);
  const userIdRef = useRef<string | null>(null);

  userIdRef.current = user?.id ?? null;

  const emitUnresolved = useCallback(
    async (input: Parameters<typeof enqueueBuklodMainHealthIssue>[1]) => {
      const userId = userIdRef.current;
      if (!userId) return;
      await enqueueBuklodMainHealthIssue(userId, input);
      if (online) {
        await flushBuklodMainHealthQueue(userId).catch(() => undefined);
      }
    },
    [online],
  );

  const verifyCommand = useCallback(
    async (
      command: RecoveryCommand,
      verificationType: string,
      success: boolean,
      evidenceCode: string,
      safeMetrics?: Record<string, string | number | boolean | null>,
    ) => {
      const recoveryRunId = String(
        command.recovery_run_id ?? '',
      ).trim();
      if (!recoveryRunId) return;

      await verifyBuklodMainRecovery({
        recoveryRunId,
        verificationType,
        success,
        evidenceCode,
        safeMetrics,
      }).catch(() => undefined);
    },
    [],
  );

  const executeCommand = useCallback(
    async (command: RecoveryCommand) => {
      const initialUserId = userIdRef.current;
      const action = String(command.action_kind ?? '')
        .trim()
        .toUpperCase();

      if (!initialUserId) return;

      const stillSameAccount = async () => {
        const { data } = await supabase.auth.getSession();
        return data.session?.user?.id === initialUserId;
      };

      if (!(await stillSameAccount())) {
        return;
      }

      if (action === 'REQUEST_CLIENT_SESSION_REFRESH') {
        let success = false;
        const started = Date.now();

        try {
          const refreshed = await withBuklodTimeout(
            supabase.auth.refreshSession(),
            8_000,
            'BUKLOD session recovery',
          );

          success =
            !refreshed.error &&
            refreshed.data.session?.user?.id === initialUserId &&
            (await stillSameAccount());

          if (success) {
            await Promise.all([
              refreshProfile(),
              refreshRoles(),
              refreshMembership(),
            ]);
          }
        } catch {
          success = false;
        }

        await verifyCommand(
          command,
          'AUTH_HEARTBEAT',
          success,
          success
            ? 'AUTH_VERIFIED'
            : 'AUTH_REFRESH_FAILED',
          {
            latency_ms: Date.now() - started,
            protected_route_ok: success,
            user_context_ok: success,
          },
        );
        return;
      }

      if (action === 'REQUEST_CLIENT_SYNC_RESUME') {
        const started = Date.now();
        let before = 0;
        let after = 0;
        let success = false;

        try {
          before = (await getOfflineQueueSnapshot()).pendingCount;
          await withBuklodTimeout(
            syncNow(),
            12_000,
            'BUKLOD sync recovery',
          );
          after = (await getOfflineQueueSnapshot()).pendingCount;
          success =
            (await stillSameAccount()) &&
            after <= before;
        } catch {
          success = false;
        }

        await verifyCommand(
          command,
          'SYNC_ACK',
          success,
          success
            ? 'SYNC_ACK_VERIFIED'
            : 'SYNC_RECOVERY_FAILED',
          {
            latency_ms: Date.now() - started,
            pending_work_count: before,
            remaining_pending_count: after,
            server_ack: success,
            duplicate_count: 0,
          },
        );
        return;
      }

      if (action === 'REQUEST_CLIENT_ORG_RERESOLVE') {
        const started = Date.now();
        let success = false;

        try {
          await withBuklodTimeout(
            refreshScope(),
            8_000,
            'BUKLOD Organization context recovery',
          );

          const scopes = await withBuklodTimeout(
            getMyBuklodScopes(),
            8_000,
            'BUKLOD Organization context verification',
          );

          const currentScopeStillAuthorized =
            !activeScope?.scope_id ||
            scopes.some(
              row => row.scope_id === activeScope.scope_id,
            ) ||
            activeScope.scope_type === 'PUBLIC';

          success =
            currentScopeStillAuthorized &&
            (await stillSameAccount());
        } catch {
          success = false;
        }

        await verifyCommand(
          command,
          'ORG_CONTEXT',
          success,
          success
            ? 'ORG_CONTEXT_VERIFIED'
            : 'ORG_CONTEXT_RECOVERY_FAILED',
          {
            latency_ms: Date.now() - started,
            authorized_scope_ok: success,
            user_context_ok: success,
          },
        );
        return;
      }

      if (action === 'REQUEST_CLIENT_ROUTE_RECOVERY') {
        /*
         * Deliberately no blind navigation/reset. Route recovery requires
         * local screen context; until a route-specific executor proves that
         * context, verification fails and BSOC must not call it AUTO_HEALED.
         */
        await verifyCommand(
          command,
          'ROUTE_RENDER',
          false,
          'ROUTE_RECOVERY_REQUIRES_LOCAL_CONTEXT',
          {
            route_rendered: false,
            current_state_ok: true,
          },
        );
        return;
      }

      if (action === 'REQUEST_CLIENT_PUSH_REFRESH') {
        /*
         * Push repair remains human/feature-owner controlled until the
         * Notification provider exposes a bounded registration refresh API.
         */
        await verifyCommand(
          command,
          'PUSH_REGISTRATION',
          false,
          'PUSH_REFRESH_EXECUTOR_NOT_READY',
          {
            registration_ok: false,
            current_state_ok: true,
          },
        );
        return;
      }

      await verifyCommand(
        command,
        'UNKNOWN',
        false,
        'UNSUPPORTED_RECOVERY_COMMAND',
        { current_state_ok: true },
      );
    },
    [
      activeScope?.scope_id,
      activeScope?.scope_type,
      refreshMembership,
      refreshProfile,
      refreshRoles,
      refreshScope,
      syncNow,
      verifyCommand,
    ],
  );

  const poll = useCallback(async () => {
    if (
      executingRef.current ||
      !online ||
      !userIdRef.current
    ) {
      return;
    }

    executingRef.current = true;
    try {
      const commands =
        (await pollBuklodMainRecoveryCommands()) as RecoveryCommand[];

      for (const command of commands.slice(0, 5)) {
        if (!activeRef.current) break;

        const expiresAt = Date.parse(
          String(command.expires_at ?? ''),
        );
        if (
          Number.isFinite(expiresAt) &&
          expiresAt <= Date.now()
        ) {
          continue;
        }

        await executeCommand(command);

        if (!userIdRef.current) break;
      }
    } catch {
      // BSOC is optional. Main must continue to operate when it is down.
    } finally {
      executingRef.current = false;
    }
  }, [executeCommand, online]);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!user?.id || !online) return;

    void flushBuklodMainHealthQueue(user.id).catch(
      () => undefined,
    );
    void poll();

    const timer = setInterval(() => {
      if (AppState.currentState === 'active') {
        void poll();
      }
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [online, poll, user?.id]);

  useEffect(() => {
    if (!user?.id || !online) {
      pendingSinceRef.current = null;
      return;
    }

    if (pendingCount <= 0) {
      pendingSinceRef.current = null;
      return;
    }

    if (!pendingSinceRef.current) {
      pendingSinceRef.current = Date.now();
      return;
    }

    const stuckFor =
      Date.now() - pendingSinceRef.current;
    if (stuckFor < SYNC_STUCK_MS) return;

    const now = Date.now();
    if (
      now - lastSyncRecoveryRef.current <
      LOCAL_RETRY_COOLDOWN_MS
    ) {
      return;
    }
    lastSyncRecoveryRef.current = now;

    void (async () => {
      let after = pendingCount;
      let healed = false;

      try {
        await refreshNetwork();
        await withBuklodTimeout(
          syncNow(),
          12_000,
          'BUKLOD local sync self-heal',
        );
        after = (await getOfflineQueueSnapshot()).pendingCount;
        healed = after < pendingCount || after === 0;
      } catch {
        healed = false;
      }

      if (healed) {
        pendingSinceRef.current =
          after > 0 ? Date.now() : null;
        return;
      }

      await emitUnresolved({
        category: 'SYNC',
        severity: 'ERROR',
        safeErrorCode: 'SYNC-408',
        errorSignature: 'SYNC_QUEUE_STUCK',
        correlationKey: 'BUKLOD_MAIN_SYNC_QUEUE_STUCK',
        routeModule: safeRoute(pathname),
        networkState: online ? 'ONLINE' : 'OFFLINE',
        authState: session ? 'AUTH_OK' : 'SIGNED_OUT',
        syncState: 'STUCK',
        localStorageState: 'AVAILABLE',
        pendingWorkCount: after,
        lastSuccessfulAction: 'SYNC_ATTEMPT',
        localSelfHealAttempted: true,
        localSelfHealResult: 'FAILED',
        privacyClassification: 'OPERATIONAL',
      });
    })();
  }, [
    emitUnresolved,
    online,
    pathname,
    pendingCount,
    refreshNetwork,
    session,
    syncNow,
    user?.id,
  ]);

  useEffect(() => {
    if (!user?.id || !online || !scopeError) return;

    const now = Date.now();
    if (
      now - lastScopeRecoveryRef.current <
      LOCAL_RETRY_COOLDOWN_MS
    ) {
      return;
    }
    lastScopeRecoveryRef.current = now;

    void (async () => {
      let healed = false;

      try {
        await withBuklodTimeout(
          refreshScope(),
          8_000,
          'BUKLOD local Organization context self-heal',
        );
        const scopes = await withBuklodTimeout(
          getMyBuklodScopes(),
          8_000,
          'BUKLOD Organization context verification',
        );

        healed =
          scopes.some(row => row.scope_type === 'PUBLIC') &&
          (await supabase.auth.getSession()).data.session?.user?.id ===
            user.id;
      } catch {
        healed = false;
      }

      if (healed) return;

      await emitUnresolved({
        category: 'ORG_CONTEXT',
        severity: 'ERROR',
        safeErrorCode: 'ORG-409',
        errorSignature: 'ORG_CONTEXT_STALE',
        correlationKey: 'BUKLOD_MAIN_ORG_CONTEXT_STALE',
        routeModule: safeRoute(pathname),
        networkState: 'ONLINE',
        authState: session ? 'AUTH_OK' : 'SIGNED_OUT',
        syncState: status === 'syncing' ? 'SYNCING' : 'IDLE',
        localStorageState: 'AVAILABLE',
        pendingWorkCount: pendingCount,
        lastSuccessfulAction: 'ORG_CONTEXT_REFRESH',
        localSelfHealAttempted: true,
        localSelfHealResult: 'FAILED',
        privacyClassification: 'OPERATIONAL',
      });
    })();
  }, [
    emitUnresolved,
    online,
    pathname,
    pendingCount,
    refreshScope,
    scopeError,
    session,
    status,
    user?.id,
  ]);

  useEffect(() => {
    if (!user?.id || !session || !online) return;

    const now = Date.now();
    if (
      now - lastAuthRecoveryRef.current <
      LOCAL_RETRY_COOLDOWN_MS
    ) {
      return;
    }

    const expiresAtMs =
      Number(session.expires_at ?? 0) * 1000;
    if (
      !Number.isFinite(expiresAtMs) ||
      expiresAtMs - Date.now() > 90_000
    ) {
      return;
    }

    lastAuthRecoveryRef.current = now;

    void (async () => {
      let healed = false;

      try {
        const refreshed = await withBuklodTimeout(
          supabase.auth.refreshSession(),
          8_000,
          'BUKLOD local session self-heal',
        );
        healed =
          !refreshed.error &&
          refreshed.data.session?.user?.id === user.id;
      } catch {
        healed = false;
      }

      if (healed) return;

      await emitUnresolved({
        category: 'AUTH',
        severity: 'ERROR',
        safeErrorCode: 'AUTH-401',
        errorSignature: 'AUTH_SESSION_STALE',
        correlationKey: 'BUKLOD_MAIN_AUTH_SESSION_STALE',
        routeModule: safeRoute(pathname),
        networkState: 'ONLINE',
        authState: 'STALE',
        syncState: status === 'syncing' ? 'SYNCING' : 'IDLE',
        localStorageState: 'AVAILABLE',
        pendingWorkCount: pendingCount,
        lastSuccessfulAction: 'AUTH_SESSION_REFRESH',
        localSelfHealAttempted: true,
        localSelfHealResult: 'FAILED',
        privacyClassification: 'OPERATIONAL',
      });
    })();
  }, [
    emitUnresolved,
    online,
    pathname,
    pendingCount,
    session,
    status,
    user?.id,
  ]);

  return null;
}
