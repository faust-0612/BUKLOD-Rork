type Unsubscribe = () => void;

type RegistryEntry = {
  refs: number;
  unsubscribe: Unsubscribe;
  teardownTimer: ReturnType<typeof setTimeout> | null;
};

type SharedRegistryEntry<T = unknown> = RegistryEntry & {
  listeners: Set<(payload: T) => void>;
};

const registry = new Map<string, RegistryEntry>();
const sharedRegistry = new Map<string, SharedRegistryEntry<any>>();

const DEFAULT_REALTIME_TEARDOWN_GRACE_MS = 1_500;

function safeUnsubscribe(unsubscribe: Unsubscribe) {
  try {
    unsubscribe();
  } catch {
    // Best-effort cleanup. Realtime teardown must never crash navigation/logout.
  }
}

/**
 * Deduplicates identical realtime subscriptions across remounts/components.
 *
 * A short teardown grace prevents rapid unmount/remount cycles (navigation,
 * StrictMode, layout swaps) from repeatedly opening and closing the same
 * Supabase channel. If the same key is acquired again before the grace window
 * ends, the existing underlying subscription is reused.
 */
export function acquireRealtimeSubscription(
  key: string,
  subscribe: () => Unsubscribe,
  teardownGraceMs = DEFAULT_REALTIME_TEARDOWN_GRACE_MS,
): Unsubscribe {
  const existing = registry.get(key);

  if (existing) {
    if (existing.teardownTimer) {
      clearTimeout(existing.teardownTimer);
      existing.teardownTimer = null;
    }

    existing.refs += 1;
    return () =>
      releaseRealtimeSubscription(key, teardownGraceMs);
  }

  registry.set(key, {
    refs: 1,
    unsubscribe: subscribe(),
    teardownTimer: null,
  });

  return () =>
    releaseRealtimeSubscription(key, teardownGraceMs);
}

export function releaseRealtimeSubscription(
  key: string,
  teardownGraceMs = DEFAULT_REALTIME_TEARDOWN_GRACE_MS,
) {
  const existing = registry.get(key);
  if (!existing) return;

  existing.refs = Math.max(0, existing.refs - 1);
  if (existing.refs > 0 || existing.teardownTimer) return;

  existing.teardownTimer = setTimeout(() => {
    const latest = registry.get(key);
    if (!latest || latest.refs > 0) return;

    safeUnsubscribe(latest.unsubscribe);
    registry.delete(key);
  }, Math.max(0, teardownGraceMs));
}

/**
 * Shared realtime subscription with callback fan-out.
 *
 * Use this when multiple consumers need the same logical realtime stream but
 * each consumer still needs to receive events. Only the first consumer opens
 * the underlying Supabase channel. Events are fanned out to all active
 * listeners, and quick remounts reuse the channel during the grace window.
 */
export function acquireSharedRealtimeSubscription<T>(
  key: string,
  listener: (payload: T) => void,
  subscribe: (emit: (payload: T) => void) => Unsubscribe,
  teardownGraceMs = DEFAULT_REALTIME_TEARDOWN_GRACE_MS,
): Unsubscribe {
  let entry = sharedRegistry.get(key) as
    | SharedRegistryEntry<T>
    | undefined;

  if (!entry) {
    const listeners = new Set<(payload: T) => void>();
    const emit = (payload: T) => {
      for (const nextListener of [...listeners]) {
        try {
          nextListener(payload);
        } catch {
          // A faulty screen listener must not break the shared realtime stream.
        }
      }
    };

    entry = {
      refs: 0,
      listeners,
      unsubscribe: subscribe(emit),
      teardownTimer: null,
    };

    sharedRegistry.set(key, entry);
  }

  if (entry.teardownTimer) {
    clearTimeout(entry.teardownTimer);
    entry.teardownTimer = null;
  }

  entry.refs += 1;
  entry.listeners.add(listener);

  let released = false;

  return () => {
    if (released) return;
    released = true;

    const current = sharedRegistry.get(key) as
      | SharedRegistryEntry<T>
      | undefined;

    if (!current) return;

    current.listeners.delete(listener);
    current.refs = Math.max(0, current.refs - 1);

    if (current.refs > 0 || current.teardownTimer) return;

    current.teardownTimer = setTimeout(() => {
      const latest = sharedRegistry.get(key) as
        | SharedRegistryEntry<T>
        | undefined;

      if (!latest || latest.refs > 0) return;

      safeUnsubscribe(latest.unsubscribe);
      latest.listeners.clear();
      sharedRegistry.delete(key);
    }, Math.max(0, teardownGraceMs));
  };
}

export function activeRealtimeSubscriptionCount() {
  return registry.size + sharedRegistry.size;
}

export function clearRealtimeRegistry() {
  for (const [, entry] of registry) {
    if (entry.teardownTimer) {
      clearTimeout(entry.teardownTimer);
    }
    safeUnsubscribe(entry.unsubscribe);
  }

  for (const [, entry] of sharedRegistry) {
    if (entry.teardownTimer) {
      clearTimeout(entry.teardownTimer);
    }
    safeUnsubscribe(entry.unsubscribe);
    entry.listeners.clear();
  }

  registry.clear();
  sharedRegistry.clear();
}
