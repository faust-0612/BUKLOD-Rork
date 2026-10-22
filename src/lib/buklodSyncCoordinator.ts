/**
 * BUKLOD view-aware sync coordinator.
 * A single shared queue for authorized READ refreshes. Mutations, auth,
 * realtime subscriptions and protected permission checks never enter this queue.
 * Callers own persistence (offlineCache) and incremental cursor queries.
 */
import { classifyNetworkQuality, subscribeNetworkQuality } from './buklodNetworkQuality';

export type SyncPriority = 'visible' | 'interaction' | 'nearby' | 'background';
export type SyncDataKind = 'video' | 'photo' | 'connect' | 'other';
const kindRanks: Record<SyncDataKind, number> = { video: 0, photo: 1, connect: 2, other: 3 };
type Job<T> = {
  key: string;
  priority: number;
  kindPriority: number;
  deadlineMs: number;
  seq: number;
  run: (signal: AbortSignal) => Promise<T>;
  controller: AbortController;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
  scope: string;
};
const ranks: Record<SyncPriority, number> = { visible: 0, interaction: 1, nearby: 2, background: 3 };
const pending: Job<unknown>[] = [];
const running = new Map<string, Promise<unknown>>();
const queued = new Map<string, Promise<unknown>>();
const active = new Map<string, Job<unknown>>();
// Per-kind deadlines: visible UI never waits on the queue for a media download.
// These are safety ceilings, not intentional loading delays.
const READ_DEADLINE_MS: Record<SyncDataKind, number> = {
  connect: 6_000, photo: 8_000, video: 15_000, other: 7_000,
};
let sequence = 0;
let currentView = '';
let online = true;
let degraded = false;
let activeCount = 0;
// Keep queue state in sync with the existing NetInfo/latency observations.
// The quality module owns network detection; this module only consumes it.
function applyObservedQuality() {
  const quality = classifyNetworkQuality();
  configureBuklodSyncNetwork({ online: quality !== 'offline', degraded: quality === 'degraded' });
}
subscribeNetworkQuality(applyObservedQuality);

// One active read per feature boundary; a slow feature cannot monopolize the pool.
const MAX_PER_SCOPE = 1;
const MAX_NORMAL = 2; // never flood backend when many screens mount
function limit() { return degraded ? 1 : MAX_NORMAL; }
function drain() {
  if (!online) return;
  pending.sort((a, b) => a.priority - b.priority || a.kindPriority - b.kindPriority || a.seq - b.seq);
  while (activeCount < limit() && pending.length) {
    const nextIndex = pending.findIndex(candidate =>
      [...active.values()].filter(job => job.scope === candidate.scope).length < MAX_PER_SCOPE
    );
    if (nextIndex < 0) break;
    const [job] = pending.splice(nextIndex, 1);
    queued.delete(job.key);
    if (job.controller.signal.aborted) {
      job.reject(new Error('BUKLOD sync cancelled'));
      continue;
    }
    activeCount++;
    active.set(job.key, job);
    // Abort the underlying fetch when possible and settle the UI even if
    // the transport ignores cancellation. Late results cannot enter the queue.
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const task = Promise.race([
      Promise.resolve().then(() => job.run(job.controller.signal)),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          job.controller.abort();
          reject(new Error('BUKLOD read timeout; retain local snapshot'));
        }, job.deadlineMs);
      }),
    ]).finally(() => { if (timeout) clearTimeout(timeout); });
    running.set(job.key, task);
    void task.then(job.resolve, job.reject).finally(() => {
      activeCount--;
      active.delete(job.key);
      running.delete(job.key);
      drain();
    });
  }
}
export function configureBuklodSyncNetwork(state: { online: boolean; degraded: boolean }) {
  online = state.online;
  degraded = state.degraded;
  if (!online) {
    // Cancel queued reads, not writes; the caller retains persisted snapshots.
    for (const job of pending.splice(0)) {
      queued.delete(job.key);
      job.controller.abort();
      job.reject(new Error('BUKLOD offline: saved data remains available'));
    }
    // Also cancel active reads: a transport that ignores abort must not
    // persist a late response after connectivity has been lost.
    for (const job of active.values()) job.controller.abort();
  }
  drain();
}
export function setBuklodSyncView(view: string) {
  currentView = view;
  for (let i = pending.length - 1; i >= 0; i--) {
    const job = pending[i];
    if (job.scope !== view && job.priority > ranks.interaction) {
      pending.splice(i, 1);
      queued.delete(job.key);
      job.controller.abort();
      job.reject(new Error('BUKLOD view changed'));
    }
  }
  drain();
}
export function enqueueBuklodRead<T>(args: {
  /** Include user ID, permission scope, dataset and cursor/version. */
  key: string;
  view: string;
  priority: SyncPriority;
  kind?: SyncDataKind;
  run: (signal: AbortSignal) => Promise<T>;
}): Promise<T> {
  if (!args.key || !args.view) return Promise.reject(new Error('Sync scope required'));
  // Require an explicit namespace so unrelated features cannot share a dedup key.
  // Offline-first storage keys use slash-separated account/scope/dataset paths.
  // Requiring a colon rejected those valid keys before any network read ran.
  const namespaced = args.key.includes(':') || args.key.startsWith('@buklod/offline-first/v1/');
  if (!namespaced) return Promise.reject(new Error('Sync key must be namespaced'));
  const duplicate = running.get(args.key) ?? queued.get(args.key);
  if (duplicate) return duplicate as Promise<T>;
  if (!online) return Promise.reject(new Error('BUKLOD offline: use local snapshot'));
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  const job: Job<T> = {
    key: args.key, scope: args.view, priority: ranks[args.priority],
    kindPriority: kindRanks[args.kind ?? 'other'],
    deadlineMs: degraded ? Math.min(20_000, Math.round(READ_DEADLINE_MS[args.kind ?? 'other'] * 1.5)) : READ_DEADLINE_MS[args.kind ?? 'other'],
    seq: ++sequence, run: args.run, controller: new AbortController(),
    resolve, reject,
  };
  queued.set(args.key, promise);
  pending.push(job as Job<unknown>);
  drain();
  return promise;
}
export function getBuklodSyncQueueState() {
  return { pending: pending.length, active: activeCount, view: currentView, online, degraded };
}
