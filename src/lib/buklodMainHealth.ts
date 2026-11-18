import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { enqueueDeferredBuklodFailure, drainDeferredBuklodFailures } from '@/lib/buklodDeferredHealth';

export type BuklodHealthCategory =
  | 'AUTH'
  | 'SESSION'
  | 'NETWORK'
  | 'SYNC'
  | 'ROUTE'
  | 'LOADING'
  | 'LOCAL_STORAGE'
  | 'SUBMISSION'
  | 'NOTIFICATION'
  | 'PERMISSION'
  | 'API'
  | 'CACHE'
  | 'ENTITLEMENT'
  | 'ORG_CONTEXT'
  | 'DEVICE_CONFLICT'
  | 'SERVICE_DEPENDENCY'
  | 'UNKNOWN';

export type BuklodHealthSeverity =
  | 'INFO'
  | 'WARNING'
  | 'ERROR'
  | 'CRITICAL';

export type BuklodLocalHealResult =
  | 'NOT_ATTEMPTED'
  | 'SUCCESS'
  | 'FAILED'
  | 'INELIGIBLE'
  | 'UNKNOWN';

export type BuklodRenderForensics = {
  causeCode: string;
  originArea: string;
  sourcePath?: string | null;
  sourceLine?: number | null;
  sourceColumn?: number | null;
  bundleLine?: number | null;
  bundleColumn?: number | null;
  runtimeVersion?: string | null;
  otaUpdateId?: string | null;
  updateChannel?: string | null;
};

export type BuklodHealthIssue = {
  category: BuklodHealthCategory;
  severity: BuklodHealthSeverity;
  safeErrorCode: string;
  errorSignature: string;
  correlationKey: string;
  renderForensics?: BuklodRenderForensics | null;
  routeModule?: string | null;
  networkState?: string | null;
  authState?: string | null;
  syncState?: string | null;
  localStorageState?: string | null;
  notificationState?: string | null;
  lastSuccessfulAction?: string | null;
  pendingWorkCount?: number;
  knownIncidentHint?: string | null;
  localSelfHealAttempted?: boolean;
  localSelfHealResult?: BuklodLocalHealResult;
  privacyClassification?:
    | 'OPERATIONAL'
    | 'MINIMAL'
    | 'SECURITY_REVIEW_REQUIRED';
};

type QueuedHealthIssue = BuklodHealthIssue & {
  clientEventId: string;
  detectedAt: string;
  firstQueuedAt: string;
  lastQueuedAt: string;
  repeatCount: number;
};

const APP_ID = 'BUKLOD_MAIN';
const QUEUE_PREFIX = '@buklod/main-health-v1/queue/';
const DEVICE_REF_KEY = '@buklod/main-health-v1/device-ref';
const SESSION_REF_PREFIX = '@buklod/main-health-v1/session-ref/';
const MAX_QUEUE = 20;
const DEDUPE_WINDOW_MS = 5 * 60_000;
const MAX_QUEUE_AGE_MS = 30 * 60_000;
const CODE_RE = /^[A-Z0-9_.:-]{2,160}$/;
const ROUTE_RE = /^[A-Za-z0-9_./:-]{1,160}$/;
const STATE_RE = /^[A-Z0-9_.:-]{2,64}$/;

function queueKey(userId: string) {
  return QUEUE_PREFIX + userId;
}

function cleanCode(value: string, fallback: string, max = 160) {
  const candidate = String(value ?? '')
    .trim()
    .toUpperCase()
    .slice(0, max);
  return CODE_RE.test(candidate) ? candidate : fallback;
}

function cleanState(value: string | null | undefined) {
  const candidate = String(value ?? '')
    .trim()
    .toUpperCase()
    .slice(0, 64);
  return STATE_RE.test(candidate) ? candidate : null;
}

function cleanRoute(value: string | null | undefined) {
  const candidate = String(value ?? '').trim().slice(0, 160);
  return ROUTE_RE.test(candidate) ? candidate : 'unknown';
}

const FORENSIC_CAUSES = new Set([
  'UNKNOWN','HOOK_ORDER','RENDER_LOOP','INVALID_ELEMENT','INVALID_CHILD',
  'NULLISH_ACCESS','INVALID_CALL','MISSING_PROVIDER','TYPE_ERROR','REFERENCE_ERROR',
]);
const FORENSIC_AREAS = new Set([
  'UNKNOWN','PROVIDER','SCOPE','CONNECT','CHARACTER','MEDIA',
  'AUTH','ROUTE','COMPONENT','LIB',
]);
const OTA_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safePositiveFrame(input: unknown): number | null {
  const value = typeof input === 'number' ? input : NaN;
  return Number.isSafeInteger(value) && value > 0 && value <= 100_000_000 ? value : null;
}
function normalizeRenderForensics(input: BuklodRenderForensics | null | undefined): BuklodRenderForensics | null {
  if (!input || !FORENSIC_CAUSES.has(input.causeCode) || !FORENSIC_AREAS.has(input.originArea)) return null;
  const path = String(input.sourcePath ?? '');
  const safePath = path.length <= 180 &&
    /^src\/(app|components|providers|lib)\/[A-Za-z0-9_./\[\]()\-]+\.(?:tsx?|jsx?)$/.test(path) &&
    !path.includes('..') ? path : null;
  const runtime = String(input.runtimeVersion ?? '');
  const channel = String(input.updateChannel ?? '').toLowerCase();
  return {
    causeCode: input.causeCode,
    originArea: input.originArea,
    sourcePath: safePath,
    sourceLine: safePath ? safePositiveFrame(input.sourceLine) : null,
    sourceColumn: safePath ? safePositiveFrame(input.sourceColumn) : null,
    bundleLine: safePositiveFrame(input.bundleLine),
    bundleColumn: safePositiveFrame(input.bundleColumn),
    runtimeVersion: /^[A-Za-z0-9_.-]{1,60}$/.test(runtime) ? runtime : null,
    otaUpdateId: OTA_UUID_RE.test(String(input.otaUpdateId ?? '')) ? String(input.otaUpdateId) : null,
    updateChannel: /^(production|staging|preview|development)$/.test(channel) ? channel : null,
  };
}

function boundedCount(value: number | undefined) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1_000_000, Math.floor(value ?? 0)));
}

function randomOpaqueRef(prefix: string) {
  const partA = Math.random().toString(36).slice(2, 12);
  const partB = Date.now().toString(36);
  return `${prefix}-${partB}-${partA}`;
}

async function getOrCreateDeviceRef() {
  const existing = await AsyncStorage.getItem(DEVICE_REF_KEY);
  if (existing) return existing;
  const next = randomOpaqueRef('device');
  await AsyncStorage.setItem(DEVICE_REF_KEY, next);
  return next;
}

async function getOrCreateSessionRef(userId: string) {
  const key = SESSION_REF_PREFIX + userId;
  const existing = await AsyncStorage.getItem(key);
  if (existing) return existing;
  const next = randomOpaqueRef('session');
  await AsyncStorage.setItem(key, next);
  return next;
}

function normalizeIssue(input: BuklodHealthIssue): BuklodHealthIssue {
  return {
    category: input.category,
    severity: input.severity,
    safeErrorCode: cleanCode(input.safeErrorCode, 'SYS-500', 96),
    errorSignature: cleanCode(
      input.errorSignature,
      'UNKNOWN_ERROR',
      120,
    ),
    correlationKey: cleanCode(
      input.correlationKey,
      'BUKLOD_MAIN_UNKNOWN',
      160,
    ),
    renderForensics: normalizeRenderForensics(input.renderForensics),
    routeModule: cleanRoute(input.routeModule),
    networkState: cleanState(input.networkState),
    authState: cleanState(input.authState),
    syncState: cleanState(input.syncState),
    localStorageState: cleanState(input.localStorageState),
    notificationState: cleanState(input.notificationState),
    lastSuccessfulAction: cleanState(input.lastSuccessfulAction),
    pendingWorkCount: boundedCount(input.pendingWorkCount),
    knownIncidentHint: cleanState(input.knownIncidentHint),
    localSelfHealAttempted: Boolean(input.localSelfHealAttempted),
    localSelfHealResult:
      input.localSelfHealResult ?? 'NOT_ATTEMPTED',
    privacyClassification:
      input.privacyClassification ?? 'OPERATIONAL',
  };
}

async function readQueue(userId: string): Promise<QueuedHealthIssue[]> {
  try {
    const raw = await AsyncStorage.getItem(queueKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - MAX_QUEUE_AGE_MS;
    return parsed
      .filter(item => {
        const at = Date.parse(String(item?.lastQueuedAt ?? ''));
        return Number.isFinite(at) && at >= cutoff;
      })
      .slice(-MAX_QUEUE);
  } catch {
    return [];
  }
}

async function writeQueue(
  userId: string,
  rows: QueuedHealthIssue[],
) {
  await AsyncStorage.setItem(
    queueKey(userId),
    JSON.stringify(rows.slice(-MAX_QUEUE)),
  );
}

export async function enqueueBuklodMainHealthIssue(
  userId: string,
  input: BuklodHealthIssue,
) {
  if (!userId) return;

  const issue = normalizeIssue(input);
  const now = new Date().toISOString();
  const rows = await readQueue(userId);
  const recent = [...rows]
    .reverse()
    .find(row => {
      const age =
        Date.now() - Date.parse(String(row.lastQueuedAt ?? ''));
      return (
        age >= 0 &&
        age <= DEDUPE_WINDOW_MS &&
        row.errorSignature === issue.errorSignature &&
        row.correlationKey === issue.correlationKey &&
        row.routeModule === issue.routeModule
      );
    });

  if (recent) {
    recent.lastQueuedAt = now;
    recent.repeatCount = Math.min(
      1000,
      Number(recent.repeatCount ?? 1) + 1,
    );
    recent.severity =
      issue.severity === 'CRITICAL'
        ? 'CRITICAL'
        : issue.severity === 'ERROR' &&
            recent.severity !== 'CRITICAL'
          ? 'ERROR'
          : recent.severity;
    recent.pendingWorkCount = Math.max(
      recent.pendingWorkCount ?? 0,
      issue.pendingWorkCount ?? 0,
    );
    recent.localSelfHealAttempted =
      recent.localSelfHealAttempted ||
      issue.localSelfHealAttempted;
    recent.localSelfHealResult =
      issue.localSelfHealResult === 'SUCCESS'
        ? 'SUCCESS'
        : issue.localSelfHealResult === 'FAILED' &&
            recent.localSelfHealResult !== 'SUCCESS'
          ? 'FAILED'
          : recent.localSelfHealResult;
  } else {
    rows.push({
      ...issue,
      clientEventId: randomOpaqueRef('health'),
      detectedAt: now,
      firstQueuedAt: now,
      lastQueuedAt: now,
      repeatCount: 1,
    });
  }

  await writeQueue(userId, rows);
}

export async function flushBuklodMainHealthQueue(
  userId: string,
) {
  if (!userId) return { sent: 0, pending: 0 };

  const rows = await readQueue(userId);
  if (!rows.length) return { sent: 0, pending: 0 };

  const [deviceRef, sessionRef] = await Promise.all([
    getOrCreateDeviceRef(),
    getOrCreateSessionRef(userId),
  ]);

  const remaining: QueuedHealthIssue[] = [];
  let sent = 0;

  for (const row of rows) {
    try {
      const { data: receipt, error } = await withBuklodTimeout<{
        data: {event_id?: string} | null;
        error: unknown | null;
      }>(
        (supabase as any).rpc('buklod_record_health_event_v1', {
          p_client_event_id: row.clientEventId,
          p_app_id: APP_ID,
          p_app_version: Constants.expoConfig?.version ?? '',
          p_platform: Platform.OS,
          p_environment:
            process.env.EXPO_PUBLIC_APP_ENV === 'production'
              ? 'production'
              : process.env.EXPO_PUBLIC_APP_ENV === 'staging'
                ? 'staging'
                : 'development',
          p_route_module: cleanRoute(row.routeModule),
          p_health_category: row.category,
          p_severity: row.severity,
          p_safe_error_code: row.safeErrorCode,
          p_error_signature: row.errorSignature,
          p_device_ref: deviceRef,
          p_session_ref: sessionRef,
          p_network_state: row.networkState,
          p_auth_state: row.authState,
          p_sync_state: row.syncState,
          p_local_storage_state: row.localStorageState,
          p_notification_state: row.notificationState,
          p_last_successful_action: row.lastSuccessfulAction,
          p_pending_work_count: boundedCount(
            row.pendingWorkCount,
          ),
          p_known_incident_hint: row.knownIncidentHint,
          p_local_self_heal_attempted:
            row.localSelfHealAttempted,
          p_local_self_heal_result:
            row.localSelfHealResult,
          p_correlation_key: row.correlationKey,
          p_privacy_classification:
            row.privacyClassification,
          p_detected_at: row.detectedAt,
        }),
        8_000,
        'BUKLOD health event',
      );

      if (error) throw error;
      // Separate additive RPC: original health event remains backward compatible.
      // A failed forensic attachment leaves this row queued; replay is safe because
      // health events dedupe by clientEventId and forensics by health_event_id.
      // Non-render incidents use exactly the existing one-request path.
      if (row.renderForensics) {
        if (!receipt?.event_id || !/^[0-9a-f-]{36}$/i.test(receipt.event_id))
          throw new Error('Missing health receipt for render forensics');
        const forensic = normalizeRenderForensics(row.renderForensics);
        if (forensic) {
          const {error: attachError} = await withBuklodTimeout<{
            data: unknown; error: unknown | null;
          }>(
            (supabase as any).rpc('buklod_attach_render_forensics_v1', {
              p_health_event_id: receipt.event_id,
              p_cause_code: forensic.causeCode,
              p_origin_area: forensic.originArea,
              p_source_path: forensic.sourcePath,
              p_source_line: forensic.sourceLine,
              p_source_column: forensic.sourceColumn,
              p_bundle_line: forensic.bundleLine,
              p_bundle_column: forensic.bundleColumn,
              p_runtime_version: forensic.runtimeVersion,
              p_ota_update_id: forensic.otaUpdateId,
              p_update_channel: forensic.updateChannel,
            }),
            5_000,
            'BUKLOD render diagnostics',
          );
          if (attachError) throw attachError;
        }
      }
      sent += 1;
    } catch {
      remaining.push(row);
    }
  }

  await writeQueue(userId, remaining);
  return { sent, pending: remaining.length };
}

export async function reportBuklodMainHealthIssue(
  input: BuklodHealthIssue,
) {
  try {
    const { data } = await withBuklodTimeout(supabase.auth.getSession(), 1_500, 'Health local session');
    const userId = data.session?.user?.id ?? '';
    if (!userId) {
      await enqueueDeferredBuklodFailure(input.category === 'LOADING' ? 'CONTENT_REFRESH_FAILED' : 'CLIENT_OPERATION_FAILED');
      return;
    }

    await enqueueBuklodMainHealthIssue(userId, input);

    if (
      typeof navigator === 'undefined' ||
      navigator.onLine !== false
    ) {
      await flushBuklodMainHealthQueue(userId);
    }
  } catch {
    // No raw errors or identifying context are retained in the signed-out queue.
    await enqueueDeferredBuklodFailure('CLIENT_OPERATION_FAILED').catch(() => undefined);
  }
}

export async function flushDeferredBuklodHealth(userId: string) {
  if (!userId) return;
  await drainDeferredBuklodFailures(async event => {
    try {
      const { data } = await withBuklodTimeout(supabase.auth.getSession(), 1_500, 'Health delivery session');
      if (data.session?.user?.id !== userId) return false;
      const { data: receipt, error } = await withBuklodTimeout(
        (supabase as any).rpc('buklod_record_health_event_v1', {
          p_client_event_id: event.id,
          p_app_id: APP_ID,
          p_app_version: Constants.expoConfig?.version ?? '',
          p_platform: Platform.OS,
          p_environment: process.env.EXPO_PUBLIC_APP_ENV === 'production' ? 'production' :
            process.env.EXPO_PUBLIC_APP_ENV === 'staging' ? 'staging' : 'development',
          p_route_module: 'deferred-client',
          p_health_category: event.code.startsWith('AUTH_') ? 'AUTH' : event.code === 'CONTENT_REFRESH_FAILED' ? 'LOADING' : 'UNKNOWN',
          p_severity: 'WARNING',
          p_safe_error_code: event.code,
          p_error_signature: event.code,
          p_device_ref: null,
          p_session_ref: null,
          p_network_state: 'UNKNOWN',
          p_auth_state: 'DEFERRED_DEVICE_EVENT',
          p_sync_state: 'UNKNOWN',
          p_local_storage_state: 'AVAILABLE',
          p_notification_state: 'UNKNOWN',
          p_last_successful_action: null,
          p_pending_work_count: 0,
          p_known_incident_hint: null,
          p_local_self_heal_attempted: false,
          p_local_self_heal_result: 'NOT_ATTEMPTED',
          p_correlation_key: 'DEFERRED_CLIENT_FAILURE',
          p_privacy_classification: 'MINIMAL',
          p_detected_at: event.detectedAt,
        }), 8_000, 'Deferred health delivery',
      ) as { data: { event_id?: string } | null; error: unknown };
      return !error && typeof receipt?.event_id === 'string' && receipt.event_id.length > 0;
    } catch { return false; }
  });
}

export async function pollBuklodMainRecoveryCommands() {
  const { data, error } = await withBuklodTimeout<{
    data: unknown;
    error: unknown | null;
  }>(
    (supabase as any).rpc('buklod_poll_recovery_commands_v1', {
      p_app_id: APP_ID,
      p_limit: 5,
    }),
    8_000,
    'BUKLOD recovery command poll',
  );

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function verifyBuklodMainRecovery(input: {
  recoveryRunId: string;
  verificationType: string;
  success: boolean;
  evidenceCode: string;
  safeMetrics?: Record<
    string,
    string | number | boolean | null
  >;
}) {
  const safeMetrics = Object.fromEntries(
    Object.entries(input.safeMetrics ?? {})
      .filter(([key, value]) => {
        if (
          ![
            'latency_ms',
            'pending_work_count',
            'protected_route_ok',
            'server_ack',
            'duplicate_count',
            'current_state_ok',
            'authorized_scope_ok',
            'user_context_ok',
            'registration_ok',
            'route_rendered',
            'remaining_pending_count',
          ].includes(key)
        ) {
          return false;
        }

        return (
          value === null ||
          typeof value === 'number' ||
          typeof value === 'boolean' ||
          (typeof value === 'string' &&
            value.length <= 80 &&
            /^[A-Za-z0-9_.:-]*$/.test(value))
        );
      })
      .slice(0, 12),
  );

  const { data, error } = await withBuklodTimeout<{
    data: unknown;
    error: unknown | null;
  }>(
    (supabase as any).rpc(
      'buklod_record_recovery_verification_v1',
      {
        p_recovery_run_id: input.recoveryRunId,
        p_verification_type: cleanCode(
          input.verificationType,
          'UNKNOWN',
          80,
        ),
        p_success: Boolean(input.success),
        p_evidence_code: cleanCode(
          input.evidenceCode,
          'UNKNOWN',
          96,
        ),
        p_safe_metrics: safeMetrics,
      },
    ),
    8_000,
    'BUKLOD recovery verification',
  );

  if (error) throw error;
  return data;
}

export const BUKLOD_MAIN_HEALTH_CONTRACT = {
  appId: APP_ID,
  queueMax: MAX_QUEUE,
  dedupeWindowMs: DEDUPE_WINDOW_MS,
  maxQueueAgeMs: MAX_QUEUE_AGE_MS,
  privateContentFields: 'NOT_SUPPORTED',
  remoteActionAllowlist: [
    'REQUEST_CLIENT_SESSION_REFRESH',
    'REQUEST_CLIENT_SYNC_RESUME',
    'REQUEST_CLIENT_ROUTE_RECOVERY',
    'REQUEST_CLIENT_PUSH_REFRESH',
    'REQUEST_CLIENT_ORG_RERESOLVE',
  ] as const,
};

