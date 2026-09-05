type Unsubscribe = () => void;

type RegistryEntry = {
  refs: number;
  unsubscribe: Unsubscribe;
};

const registry = new Map<string, RegistryEntry>();

/**
 * Deduplicates identical realtime subscriptions across remounts/components.
 * The first subscriber owns the underlying subscription; subsequent callers
 * share it. The underlying channel is removed only when the last reference
 * releases it.
 */
export function acquireRealtimeSubscription(
  key: string,
  subscribe: () => Unsubscribe,
): Unsubscribe {
  const existing = registry.get(key);
  if (existing) {
    existing.refs += 1;
    return () => releaseRealtimeSubscription(key);
  }

  registry.set(key, {
    refs: 1,
    unsubscribe: subscribe(),
  });

  return () => releaseRealtimeSubscription(key);
}

export function releaseRealtimeSubscription(key: string) {
  const existing = registry.get(key);
  if (!existing) return;

  existing.refs -= 1;
  if (existing.refs > 0) return;

  try {
    existing.unsubscribe();
  } finally {
    registry.delete(key);
  }
}

export function activeRealtimeSubscriptionCount() {
  return registry.size;
}

export function clearRealtimeRegistry() {
  for (const [, entry] of registry) {
    try {
      entry.unsubscribe();
    } catch {
      // Best-effort cleanup during logout/session reset.
    }
  }
  registry.clear();
}
