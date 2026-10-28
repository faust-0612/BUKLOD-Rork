/*
 * BUKLOD_AVATAR_BATCH_R1
 *
 * Look up the real stored avatar path before asking the image renderer to
 * download it. Most members have no avatar; guessing /avatar.jpg for each
 * visible member creates 404 bursts and a redundant per-avatar RPC fallback.
 *
 * The batcher is presentation-only and scoped to the signed-in viewer.
 */

export type AvatarRow = {
  user_id: string;
  avatar_url: string | null;
};

type AvatarValue = string | null | undefined;
type Deferred = {
  viewerId: string;
  userId: string;
  resolve: (value: AvatarValue) => void;
};

export function createBuklodAvatarBatchLookup(
  fetchBatch: (viewerId: string, ids: string[]) => Promise<AvatarRow[]>,
  options: {
    batchSize?: number;
    delayMs?: number;
    positiveTtlMs?: number;
    negativeTtlMs?: number;
    now?: () => number;
  } = {},
) {
  const batchSize = Math.max(1, Math.min(40, options.batchSize ?? 32));
  const delayMs = Math.max(0, options.delayMs ?? 25);
  const positiveTtlMs = options.positiveTtlMs ?? 5 * 60_000;
  const negativeTtlMs = options.negativeTtlMs ?? 60_000;
  const now = options.now ?? Date.now;

  const cache = new Map<string, { value: string | null; until: number }>();
  const pending = new Map<string, Promise<AvatarValue>>();
  const queue = new Map<string, Deferred>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let flushing = false;

  const keyFor = (viewerId: string, userId: string) => `${viewerId}:${userId}`;

  function peek(viewerId: string, userId: string) {
    const key = keyFor(viewerId, userId);
    const hit = cache.get(key);
    if (hit && hit.until > now()) return { found: true, value: hit.value };
    if (hit) cache.delete(key);
    return { found: false, value: null };
  }

  function remember(key: string, value: string | null) {
    cache.delete(key);
    cache.set(key, {
      value,
      until: now() + (value ? positiveTtlMs : negativeTtlMs),
    });
    while (cache.size > 800) {
      const oldest = cache.keys().next().value;
      if (!oldest) break;
      cache.delete(oldest);
    }
  }

  async function flush() {
    if (flushing) return;
    flushing = true;
    try {
      while (queue.size) {
        const first = queue.values().next().value as Deferred;
        const selected: Array<[string, Deferred]> = [];
        for (const entry of queue) {
          if (selected.length >= batchSize) break;
          if (entry[1].viewerId === first.viewerId) selected.push(entry);
        }
        for (const [key] of selected) queue.delete(key);

        let byUser: Map<string, string | null> | null = null;
        try {
          const rows = await fetchBatch(first.viewerId, selected.map(([, d]) => d.userId));
          byUser = new Map(
            rows.map(row => [String(row.user_id).toLowerCase(), String(row.avatar_url ?? '').trim() || null]),
          );
        } catch {
          // Undefined means a transient lookup failure; the old canonical
          // URL remains available as a compatibility fallback in the caller.
        }

        for (const [key, deferred] of selected) {
          const value = byUser ? (byUser.get(deferred.userId) ?? null) : undefined;
          if (value !== undefined) remember(key, value);
          pending.delete(key);
          deferred.resolve(value);
        }
      }
    } finally {
      flushing = false;
      if (queue.size && !timer) schedule();
    }
  }

  function schedule() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, delayMs);
  }

  function resolve(viewerId: string, userId: string): Promise<AvatarValue> {
    const viewer = String(viewerId ?? '').trim().toLowerCase();
    const user = String(userId ?? '').trim().toLowerCase();
    const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
    if (!viewer || !uuidPattern.test(user)) return Promise.resolve(undefined);
    const warm = peek(viewer, user);
    if (warm.found) return Promise.resolve(warm.value);

    const key = keyFor(viewer, user);
    const existing = pending.get(key);
    if (existing) return existing;

    let settle!: (value: AvatarValue) => void;
    const task = new Promise<AvatarValue>(resolveTask => { settle = resolveTask; });
    pending.set(key, task);
    queue.set(key, { viewerId: viewer, userId: user, resolve: settle });
    schedule();
    return task;
  }

  return { peek, resolve };
}
