/**
 * BUKLOD = Offline-First + Online-Synchronized.
 * Local data powers the interface; internet keeps it current.
 *
 * Central cache + pending-action queue using existing AsyncStorage.
 * No new native dependencies.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { SCALE_LIMITS } from '@/lib/performanceScale';
import { peekCommunityMediaUrl } from '@/lib/buklodMediaUrl';

const CACHE_PREFIX = '@buklod/offline/cache/v1/';
const PENDING_KEY = '@buklod/offline/pending/v1';
const META_KEY = '@buklod/offline/meta/v1';

export type BuklodSyncStatus =
  | 'saved_offline'
  | 'waiting_to_sync'
  | 'syncing'
  | 'synced'
  | 'failed_to_sync';

export type BuklodPendingActionType =
  | 'org_upsert_record'
  | 'org_delete_record'
  | 'community_post_draft';

export type BuklodPendingAction = {
  id: string;
  type: BuklodPendingActionType;
  scopeKey: string;
  label: string;
  payload: Record<string, unknown>;
  status: BuklodSyncStatus;
  createdAt: string;
  updatedAt: string;
  retryCount: number;
  lastError?: string;
};

type CacheEnvelope<T> = {
  v: 1;
  updatedAt: string;
  data: T;
};

type CacheMeta = Record<
  string,
  {
    updatedAt: string;
    source: 'cache' | 'network';
  }
>;

type PendingListener = () => void;

const pendingListeners = new Set<PendingListener>();

type PendingHandler = (
  action: BuklodPendingAction,
) => Promise<void>;

const pendingHandlers = new Map<
  BuklodPendingActionType,
  PendingHandler
>();

let flushInFlight: Promise<void> | null = null;

const memoryCache = new Map<string, unknown>();

function notifyPendingListeners() {
  for (const listener of pendingListeners) {
    try {
      listener();
    } catch {
      // ignore listener failures
    }
  }
}

function cacheStorageKey(cacheKey: string) {
  return `${CACHE_PREFIX}${cacheKey}`;
}

function createActionId() {
  return `pending_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function buklodSyncStatusLabel(
  status: BuklodSyncStatus,
): string {
  switch (status) {
    case 'saved_offline':
      return 'Saved Offline';
    case 'waiting_to_sync':
      return 'Waiting to Sync';
    case 'syncing':
      return 'Syncing…';
    case 'synced':
      return 'Synced';
    case 'failed_to_sync':
      return 'Failed to Sync';
    default:
      return 'Unknown';
  }
}

export function readOfflineCacheSync<T>(
  cacheKey: string,
): T | null {
  if (!cacheKey) {
    return null;
  }

  const hit = memoryCache.get(cacheKey);
  return hit === undefined ? null : (hit as T);
}

export async function readOfflineCache<T>(
  cacheKey: string,
): Promise<T | null> {
  const memoryHit = readOfflineCacheSync<T>(cacheKey);
  if (memoryHit != null) {
    return memoryHit;
  }

  try {
    const raw = await AsyncStorage.getItem(
      cacheStorageKey(cacheKey),
    );
    if (!raw) {
      return null;
    }

    const envelope = JSON.parse(raw) as CacheEnvelope<T>;
    if (!envelope || envelope.v !== 1) {
      return null;
    }

    const data = envelope.data ?? null;
    if (data != null) {
      memoryCache.set(cacheKey, data);
    }

    return data;
  } catch {
    return null;
  }
}

export async function writeOfflineCache<T>(
  cacheKey: string,
  data: T,
  source: 'cache' | 'network' = 'network',
): Promise<void> {
  const envelope: CacheEnvelope<T> = {
    v: 1,
    updatedAt: new Date().toISOString(),
    data,
  };

  memoryCache.set(cacheKey, data);

  await AsyncStorage.setItem(
    cacheStorageKey(cacheKey),
    JSON.stringify(envelope),
  );

  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    const meta = raw
      ? (JSON.parse(raw) as CacheMeta)
      : {};

    meta[cacheKey] = {
      updatedAt: envelope.updatedAt,
      source,
    };

    await AsyncStorage.setItem(
      META_KEY,
      JSON.stringify(meta),
    );
  } catch {
    // meta is optional
  }
}

export async function readCacheUpdatedAt(
  cacheKey: string,
): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    if (!raw) {
      return null;
    }

    const meta = JSON.parse(raw) as CacheMeta;
    return meta[cacheKey]?.updatedAt ?? null;
  } catch {
    return null;
  }
}

export function keepStableCommunityMedia<
  T extends {
    id?: string | number;
    media_path?: string | null;
    media_url?: string | null;
    media_items?: any[];
  },
>(previous: T[], next: T[]): T[] {
  const prevById = new Map(
    previous.map(row => [String(row.id ?? ''), row]),
  );

  return next.map(row => {
    const old = prevById.get(String(row.id ?? ''));
    const path = String(row.media_path ?? old?.media_path ?? '').trim();
    const stableUrl =
      peekCommunityMediaUrl(
        path,
        old?.media_url || row.media_url || null,
      );

    const oldItems = Array.isArray(old?.media_items)
      ? old.media_items
      : [];
    const nextItems = Array.isArray(row.media_items)
      ? row.media_items
      : oldItems;

    const mediaItems = nextItems.map((item: any, index: number) => {
      const itemPath = String(
        item?.media_path ?? oldItems[index]?.media_path ?? '',
      ).trim();
      return {
        ...oldItems[index],
        ...item,
        media_path: itemPath || item?.media_path,
        media_url:
          peekCommunityMediaUrl(
            itemPath,
            oldItems[index]?.media_url || item?.media_url || null,
          ),
      };
    });

    return {
      ...old,
      ...row,
      media_path: path || row.media_path,
      media_url: stableUrl,
      media_items: mediaItems,
    };
  });
}

export function mergeCommunityFeedPosts<T extends { id?: string | number }>(
  cached: T[],
  fresh: T[],
): T[] {
  const byId = new Map<string, T>();

  for (const row of cached) {
    if (row?.id != null) {
      byId.set(String(row.id), row);
    }
  }

  for (const row of fresh) {
    if (row?.id != null) {
      byId.set(String(row.id), row);
    }
  }

  const merged = Array.from(byId.values());

  merged.sort((a, b) => {
    const aTime = Date.parse(
      String((a as { created_at?: string }).created_at ?? ''),
    );
    const bTime = Date.parse(
      String((b as { created_at?: string }).created_at ?? ''),
    );

    if (Number.isFinite(aTime) && Number.isFinite(bTime)) {
      return bTime - aTime;
    }

    return 0;
  });

  return merged.slice(
    0,
    SCALE_LIMITS.offlineCommunityCachePosts,
  );
}

async function readPendingActions(): Promise<BuklodPendingAction[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed as BuklodPendingAction[];
  } catch {
    return [];
  }
}

async function writePendingActions(
  actions: BuklodPendingAction[],
) {
  await AsyncStorage.setItem(
    PENDING_KEY,
    JSON.stringify(actions),
  );
  notifyPendingListeners();
}

export function subscribePendingActions(
  listener: PendingListener,
) {
  pendingListeners.add(listener);
  return () => {
    pendingListeners.delete(listener);
  };
}

export async function listPendingActions(): Promise<BuklodPendingAction[]> {
  return readPendingActions();
}

export async function countUnsyncedPendingActions(): Promise<number> {
  const actions = await readPendingActions();
  return actions.filter(
    (item) =>
      item.status === 'saved_offline' ||
      item.status === 'waiting_to_sync' ||
      item.status === 'failed_to_sync',
  ).length;
}

export function registerPendingActionHandler(
  type: BuklodPendingActionType,
  handler: PendingHandler,
) {
  pendingHandlers.set(type, handler);
}

export async function enqueuePendingAction(input: {
  type: BuklodPendingActionType;
  scopeKey: string;
  label: string;
  payload: Record<string, unknown>;
  status?: BuklodSyncStatus;
}): Promise<BuklodPendingAction> {
  const now = new Date().toISOString();
  const action: BuklodPendingAction = {
    id: createActionId(),
    type: input.type,
    scopeKey: input.scopeKey,
    label: input.label,
    payload: input.payload,
    status: input.status ?? 'saved_offline',
    createdAt: now,
    updatedAt: now,
    retryCount: 0,
  };

  const actions = await readPendingActions();
  actions.push(action);
  await writePendingActions(actions);
  return action;
}

async function updatePendingAction(
  id: string,
  patch: Partial<BuklodPendingAction>,
) {
  const actions = await readPendingActions();
  const next = actions.map((item) => {
    if (item.id !== id) {
      return item;
    }

    return {
      ...item,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
  });

  await writePendingActions(next);
}

export async function removePendingAction(id: string) {
  const actions = await readPendingActions();
  await writePendingActions(
    actions.filter((item) => item.id !== id),
  );
}

export async function flushPendingActions(options?: {
  onlyType?: BuklodPendingActionType;
}): Promise<{
  processed: number;
  failed: number;
}> {
  if (flushInFlight) {
    await flushInFlight;
    return { processed: 0, failed: 0 };
  }

  let processed = 0;
  let failed = 0;

  flushInFlight = (async () => {
    const actions = await readPendingActions();

    for (const action of actions) {
      if (options?.onlyType && action.type !== options.onlyType) {
        continue;
      }

      if (
        action.status === 'synced' ||
        action.status === 'syncing'
      ) {
        continue;
      }

      if (
        action.retryCount >=
        SCALE_LIMITS.offlineSyncMaxRetries
      ) {
        await updatePendingAction(action.id, {
          status: 'failed_to_sync',
        });
        failed += 1;
        continue;
      }

      const handler = pendingHandlers.get(action.type);
      if (!handler) {
        continue;
      }

      await updatePendingAction(action.id, {
        status: 'syncing',
      });

      try {
        await handler(action);
        await removePendingAction(action.id);
        processed += 1;
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : String(error);

        const nextRetry = action.retryCount + 1;
        await updatePendingAction(action.id, {
          status:
            nextRetry >= SCALE_LIMITS.offlineSyncMaxRetries
              ? 'failed_to_sync'
              : 'waiting_to_sync',
          retryCount: nextRetry,
          lastError: message,
        });
        failed += 1;
      }
    }
  })();

  try {
    await flushInFlight;
  } finally {
    flushInFlight = null;
  }

  return { processed, failed };
}

export function communityFeedCacheKey(
  userId: string,
  locationScopeId: string | null,
) {
  return `community_feed:${userId}:${locationScopeId ?? 'all'}`;
}

export function scopeHomeCacheKey(scopeId: string) {
  return `scope_home:${scopeId}`;
}

export function orgMembersCacheKey(
  scopeId: string,
  action: string,
) {
  return `org_members:${scopeId}:${action}`;
}

export function orgAdminRecordsCacheKey(
  scopeId: string,
  moduleKey: string,
) {
  return `org_admin_records:${scopeId}:${moduleKey}`;
}

export function attendanceReportCacheKey(
  scopeId: string,
  dateFrom: string,
  dateTo: string,
  eventId: string = 'all',
  eventTitle: string = '',
) {
  const seriesKey = eventTitle.trim()
    ? `series:${eventTitle.trim().toLowerCase()}`
    : eventId;

  return `attendance_report:${scopeId}:${dateFrom}:${dateTo}:${seriesKey}`;
}

export function adminAttendancePlatformStatsCacheKey() {
  return 'admin_attendance_platform_stats';
}

export function adminFocusAppPlatformStatsCacheKey() {
  return 'admin_focus_app_platform_stats';
}

export function adminAttendanceScopeAdoptionCacheKey() {
  return 'admin_attendance_scope_adoption';
}

export function adminDashboardStatsCacheKey() {
  return 'admin_dashboard_stats';
}

export function adminFocusAppPaymentsCacheKey(status: string) {
  return `admin_focus_app_payments:${status}`;
}
