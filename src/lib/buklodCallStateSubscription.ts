/**
 * Safely track Stream callingState changes during ring/cancel/leave.
 *
 * Stream's observable emits its current state synchronously on subscribe.
 * That initial snapshot is not a state transition: mirroring it to React
 * setState can produce a re-subscribe/render loop during teardown.
 */
type Unsubscribable = { unsubscribe: () => void };
type ObservableLike = {
  subscribe: (next: () => void) => Unsubscribable | void;
};
type CallLike = {
  state?: { callingState$?: ObservableLike | null } | null;
} | null | undefined;

export function subscribeBuklodCallingStateChanges(
  calls: readonly CallLike[] | null | undefined,
  onChange: () => void,
): () => void {
  let listening = true;
  const subscriptions: Unsubscribable[] = [];

  for (const call of calls ?? []) {
    const observable = call?.state?.callingState$;
    if (!observable || typeof observable.subscribe !== 'function') continue;
    try {
      let initialSnapshot = true;
      const subscription = observable.subscribe(() => {
        if (initialSnapshot || !listening) return;
        onChange();
      });
      initialSnapshot = false;
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscriptions.push(subscription);
      }
    } catch {
      // The SDK may dispose a call between reading the state and subscribing.
    }
  }

  return () => {
    listening = false;
    for (const subscription of subscriptions) {
      try {
        subscription.unsubscribe();
      } catch {
        // Subscription may already be detached by Stream call.leave().
      }
    }
  };
}
