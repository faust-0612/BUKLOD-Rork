/**
 * Limits full-resolution Wall upgrades after their tiny previews have painted.
 * A cancelled queued tile cannot hold a slot or start a stale network request.
 * Only mounted Wall images request slots; fullscreen originals are unaffected.
 * Mounted photos are never discarded because earlier tiles filled the queue.
 * FlashList unmount cancellation bounds the default waiting queue in practice.
 */
export type SharpSlot = () => void;
export type SharpRequest = { granted: Promise<SharpSlot | null>; cancel: () => void };

export function createCommunityWallSharpGate(maxActive = 2, maxWaiting = Number.POSITIVE_INFINITY) {
  type Waiter = { resolve: (slot: SharpSlot | null) => void; cancelled: boolean };
  const queue: Waiter[] = [];
  let active = 0;

  const makeRelease = (): SharpSlot => {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      active -= 1;
      drain();
    };
  };

  const drain = () => {
    while (active < maxActive && queue.length) {
      const next = queue.shift()!;
      if (next.cancelled) continue;
      active += 1;
      next.resolve(makeRelease());
    }
  };

  const request = (): SharpRequest => {
    let waiter!: Waiter;
    const granted = new Promise<SharpSlot | null>(resolve => {
      waiter = { resolve, cancelled: false };
      if (active < maxActive && !queue.length) {
        active += 1;
        resolve(makeRelease());
      } else if (queue.length < maxWaiting) {
        queue.push(waiter);
      } else {
        waiter.cancelled = true;
        resolve(null);
      }
    });
    return {
      granted,
      cancel: () => {
        if (waiter.cancelled) return;
        waiter.cancelled = true;
        const index = queue.indexOf(waiter);
        if (index >= 0) {
          queue.splice(index, 1);
          waiter.resolve(null);
        }
      },
    };
  };

  return { request, stats: () => ({ active, queued: queue.length }) };
}

export const communityWallSharpGate = createCommunityWallSharpGate();
