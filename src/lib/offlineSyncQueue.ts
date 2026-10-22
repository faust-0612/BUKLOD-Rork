import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@buklod/offline-sync/v1';
const MAX_QUEUE_ITEMS = 500;
const RETRY_DELAYS_MS = [
  2_000,
  5_000,
  15_000,
  60_000,
  5 * 60_000,
  15 * 60_000,
  60 * 60_000,
];

export type OfflineQueueItem = {
  id: string;
  kind: string;
  payload: unknown;
  userId: string | null;
  dedupeKey: string | null;
  createdAt: number;
  updatedAt: number;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: number;
  lastError: string | null;
};

export type OfflineQueueSnapshot = {
  pendingCount: number;
  items: OfflineQueueItem[];
};

export type OfflineQueueHandler = (
  item: OfflineQueueItem,
) => Promise<void>;

export class OfflineQueuePermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OfflineQueuePermanentError';
  }
}

const handlers = new Map<string, OfflineQueueHandler>();
const listeners = new Set<(snapshot: OfflineQueueSnapshot) => void>();

let mutationChain: Promise<unknown> = Promise.resolve();
let draining: Promise<OfflineQueueSnapshot> | null = null;

function queueMutation<T>(fn: () => Promise<T>): Promise<T> {
  const next = mutationChain.then(fn, fn);
  mutationChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function id(): string {
  return `oq_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function cleanError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : String(error ?? 'Sync failed.');
  return message.replace(/\s+/g, ' ').trim().slice(0, 600);
}

async function readQueue(): Promise<OfflineQueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: OfflineQueueItem[]): Promise<void> {
  const safe = items
    .filter((item) => item && typeof item.id === 'string')
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(-MAX_QUEUE_ITEMS);

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(safe));
  const snapshot = { pendingCount: safe.length, items: safe };
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch {
      // Listener errors must not break persistence.
    }
  });
}

export async function getOfflineQueueSnapshot(): Promise<OfflineQueueSnapshot> {
  const items = await readQueue();
  return { pendingCount: items.length, items };
}

export function subscribeOfflineQueue(
  listener: (snapshot: OfflineQueueSnapshot) => void,
): () => void {
  listeners.add(listener);
  void getOfflineQueueSnapshot().then(listener).catch(() => undefined);
  return () => listeners.delete(listener);
}

export function registerOfflineQueueHandler(
  kind: string,
  handler: OfflineQueueHandler,
): () => void {
  handlers.set(kind, handler);
  return () => {
    if (handlers.get(kind) === handler) {
      handlers.delete(kind);
    }
  };
}

export async function enqueueOfflineAction(args: {
  kind: string;
  payload: unknown;
  userId?: string | null;
  dedupeKey?: string | null;
  maxAttempts?: number;
}): Promise<OfflineQueueItem> {
  if (!args.kind.trim()) {
    throw new Error('Offline queue action kind is required.');
  }

  return queueMutation(async () => {
    const items = await readQueue();
    const now = Date.now();
    const dedupeKey = args.dedupeKey?.trim() || null;

    if (dedupeKey) {
      const existingIndex = items.findIndex(
        (row) =>
          row.kind === args.kind &&
          row.dedupeKey === dedupeKey &&
          row.userId === (args.userId ?? null),
      );

      if (existingIndex >= 0) {
        const updated: OfflineQueueItem = {
          ...items[existingIndex],
          payload: args.payload,
          updatedAt: now,
          nextAttemptAt: now,
          lastError: null,
        };
        items[existingIndex] = updated;
        await writeQueue(items);
        return updated;
      }
    }

    const row: OfflineQueueItem = {
      id: id(),
      kind: args.kind.trim(),
      payload: args.payload,
      userId: args.userId ?? null,
      dedupeKey,
      createdAt: now,
      updatedAt: now,
      attempts: 0,
      maxAttempts: Math.max(1, Number(args.maxAttempts ?? 8)),
      nextAttemptAt: now,
      lastError: null,
    };

    items.push(row);
    await writeQueue(items);
    return row;
  });
}

export async function removeOfflineQueueItem(itemId: string): Promise<void> {
  await queueMutation(async () => {
    const items = await readQueue();
    await writeQueue(items.filter((row) => row.id !== itemId));
  });
}

export async function clearOfflineQueueForUser(
  userId: string,
): Promise<void> {
  await queueMutation(async () => {
    const items = await readQueue();
    await writeQueue(items.filter((row) => row.userId !== userId));
  });
}

async function processOne(item: OfflineQueueItem): Promise<void> {
  const handler = handlers.get(item.kind);
  if (!handler) {
    return;
  }

  try {
    await handler(item);
    await removeOfflineQueueItem(item.id);
  } catch (error) {
    await queueMutation(async () => {
      const items = await readQueue();
      const index = items.findIndex((row) => row.id === item.id);
      if (index < 0) return;

      const current = items[index];
      const attempts = current.attempts + 1;
      const permanent = error instanceof OfflineQueuePermanentError;
      const exhausted = attempts >= current.maxAttempts;

      if (permanent || exhausted) {
        items[index] = {
          ...current,
          attempts,
          updatedAt: Date.now(),
          nextAttemptAt: Number.MAX_SAFE_INTEGER,
          lastError: cleanError(error),
        };
      } else {
        const delay =
          RETRY_DELAYS_MS[
            Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)
          ] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];

        items[index] = {
          ...current,
          attempts,
          updatedAt: Date.now(),
          nextAttemptAt: Date.now() + delay,
          lastError: cleanError(error),
        };
      }

      await writeQueue(items);
    });
  }
}

export async function drainOfflineQueue(options?: {
  concurrency?: number;
}): Promise<OfflineQueueSnapshot> {
  if (draining) return draining;

  draining = (async () => {
    const now = Date.now();
    const snapshot = await getOfflineQueueSnapshot();
    const eligible = snapshot.items.filter(
      (item) =>
        item.nextAttemptAt <= now &&
        item.attempts < item.maxAttempts &&
        handlers.has(item.kind),
    );

    const concurrency = Math.max(
      1,
      Math.min(3, Number(options?.concurrency ?? 2)),
    );

    let cursor = 0;
    const workers = Array.from(
      { length: Math.min(concurrency, eligible.length) },
      async () => {
        while (cursor < eligible.length) {
          const item = eligible[cursor];
          cursor += 1;
          if (item) {
            await processOne(item);
          }
        }
      },
    );

    await Promise.all(workers);
    return getOfflineQueueSnapshot();
  })();

  try {
    return await draining;
  } finally {
    draining = null;
  }
}

/*
 * SECURITY / CONFLICT POLICY:
 * Do not enqueue passwords, tokens, face embeddings, payment secrets,
 * role/admin mutations, grade releases, locked-grade changes, or other
 * high-impact server-authoritative writes. Those remain online-only.
 *
 * Each feature explicitly registers its own replay handler. This prevents
 * the shared queue from blindly replaying arbitrary Supabase mutations.
 */