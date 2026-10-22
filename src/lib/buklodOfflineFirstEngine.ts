/**
 * BUKLOD Offline-First Read Architecture
 *
 * All feature read loaders should call this adapter, not start full downloads
 * during mount. Local snapshots render first, with network delta refresh only
 * when stale and reachable. The caller must supply an authorized account and
 * scope; never cache credentials, protected secrets or mutation responses.
 *
 * Integration contract:
 * - fetchDelta(cursor, signal) MUST return only changed rows plus tombstones.
 * - persist atomically before notifying the view.
 * - stable IDs and monotonic revision cursors are required.
 * - sign-out/revocation must invalidate protected scopes separately.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { enqueueBuklodRead, type SyncDataKind } from './buklodSyncCoordinator';

export type SyncDelta<T> = {
  upserts: T[];
  deletedIds: string[];
  nextCursor: string;
};
type Snapshot<T> = {
  schema: 1;
  cursor: string;
  rows: T[];
  syncedAt: number;
};
const PREFIX = '@buklod/offline-first/v1/';
const inFlight = new Map<string, Promise<unknown>>();
const memory = new Map<string, Snapshot<unknown>>();
// Revocation generations prevent an in-flight read from restoring invalidated data.
const generations = new Map<string, number>();
// Never silently discard records while retaining a cursor that says they were synced.
// Dataset-specific pagination/retention must be implemented by each loader.
const DEFAULT_REFRESH_MS = 5 * 60 * 1000;

function keyFor(account: string, scope: string, dataset: string) {
  if (![account, scope, dataset].every(x => x && /^[\w:.-]{1,160}$/.test(x))) {
    throw new Error('BUKLOD offline cache requires a valid account, scope and dataset');
  }
  return PREFIX + account + '/' + scope + '/' + dataset;
}
async function load<T>(key: string): Promise<Snapshot<T> | null> {
  const cached = memory.get(key) as Snapshot<T> | undefined;
  if (cached) return cached;
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Snapshot<T>;
    if (parsed.schema !== 1 || !Array.isArray(parsed.rows) ||
        typeof parsed.cursor !== 'string' || typeof parsed.syncedAt !== 'number') return null;
    memory.set(key, parsed);
    return parsed;
  } catch { return null; }
}
export async function readBuklodOfflineFirst<T extends { id: string }>(args: {
  accountId: string;
  permissionScope: string;
  dataset: string;
  view: string;
  kind?: SyncDataKind;
  online: boolean;
  /** Do not use cache to decide authorization; the caller verifies access. */
  authorized: boolean;
  refreshAfterMs?: number;
  fetchDelta: (cursor: string, signal: AbortSignal) => Promise<SyncDelta<T>>;
  onUpdated?: (rows: T[]) => void;
  onSyncError?: (error: unknown) => void;
}): Promise<{ rows: T[]; source: 'device' | 'network'; syncing: boolean }> {
  if (!args.authorized) throw new Error('BUKLOD scope not authorized');
  const key = keyFor(args.accountId, args.permissionScope, args.dataset);
  const cached = await load<T>(key);
  const refreshDue = !cached || Date.now() - cached.syncedAt >=
    (args.refreshAfterMs ?? DEFAULT_REFRESH_MS);
  if (!args.online || !refreshDue) {
    return { rows: cached?.rows ?? [], source: 'device', syncing: false };
  }
  const sync = () => {
    const existing = inFlight.get(key);
    if (existing) return existing as Promise<T[]>;
    const generation = generations.get(key) ?? 0;
    const task = enqueueBuklodRead({
      key, view: args.view, kind: args.kind ?? 'other', priority: 'visible',
      run: async signal => {
        const base = (await load<T>(key)) ?? { schema: 1 as const, cursor: '', rows: [], syncedAt: 0 };
        const delta = await args.fetchDelta(base.cursor, signal);
        if (signal.aborted || (generations.get(key) ?? 0) !== generation) {
          throw new Error('BUKLOD sync cancelled or scope revoked');
        }
        if (!delta || !Array.isArray(delta.upserts) || !Array.isArray(delta.deletedIds) ||
            typeof delta.nextCursor !== 'string') throw new Error('Invalid sync delta');
        const removed = new Set(delta.deletedIds);
        const rows = new Map(base.rows.filter(row => !removed.has(row.id)).map(row => [row.id, row]));
        for (const row of delta.upserts) {
          if (!row || typeof row.id !== 'string') throw new Error('Invalid delta record ID');
          if (!removed.has(row.id)) rows.set(row.id, row);
        }
        const next: Snapshot<T> = {
          schema: 1, cursor: delta.nextCursor,
          rows: Array.from(rows.values()), syncedAt: Date.now(),
        };
        // Serialize against revocation: stale responses must never resurrect data.
        if ((generations.get(key) ?? 0) !== generation || signal.aborted) {
          throw new Error('BUKLOD sync scope changed');
        }
        await AsyncStorage.setItem(key, JSON.stringify(next));
        if ((generations.get(key) ?? 0) !== generation || signal.aborted) {
          await AsyncStorage.removeItem(key);
          throw new Error('BUKLOD sync scope revoked during persistence');
        }
        memory.set(key, next);
        args.onUpdated?.(next.rows);
        return next.rows;
      },
    }).finally(() => inFlight.delete(key));
    inFlight.set(key, task);
    return task;
  };
  if (cached) {
    void sync().catch(error => args.onSyncError?.(error));
    return { rows: cached.rows, source: 'device', syncing: true };
  }
  try {
    const rows = await sync();
    return { rows, source: 'network', syncing: false };
  } catch (error) {
    args.onSyncError?.(error);
    // No cached snapshot exists: do not misrepresent a failed request as an
    // authoritative empty feed. The caller must show a retry/offline state.
    throw error;
  }
}
/** Call on account sign-out or access revocation, never merely on app close. */
export async function invalidateBuklodOfflineScope(accountId: string, permissionScope: string, dataset: string) {
  const key = keyFor(accountId, permissionScope, dataset);
  generations.set(key, (generations.get(key) ?? 0) + 1);
  memory.delete(key);
  await AsyncStorage.removeItem(key);
}
