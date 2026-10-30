/**
 * Limits full-resolution Wall upgrades after their tiny previews have painted.
 * A cancelled queued tile cannot hold a slot or start a stale network request.
 * Only mounted Wall images request slots; fullscreen originals are unaffected.
 * Mounted photos are never discarded because earlier tiles filled the queue.
 * FlashList unmount cancellation bounds the default waiting queue in practice.
 */
import { classifyNetworkQuality } from '@/lib/buklodNetworkQuality';

export type SharpSlot = () => void;
export type SharpRequest = { granted: Promise<SharpSlot | null>; cancel: () => void };

export function createCommunityWallSharpGate(
  maxActive = 2,
  maxWaiting = Number.POSITIVE_INFINITY,
  currentLimit: () => number = () => maxActive,
) {
  const availableSlots = () => Math.max(1, Math.min(maxActive, Math.floor(currentLimit()) || 1));
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
    while (active < availableSlots() && queue.length) {
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
      if (active < availableSlots() && !queue.length) {
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

// Two originals on healthy networks, one on degraded 2G/3G. Visible
// thumbnails are not part of this gate and always receive image priority.
export const communityWallSharpGate = createCommunityWallSharpGate(
  2,
  Number.POSITIVE_INFINITY,
  () => classifyNetworkQuality() === 'degraded' ? 1 : 2,
);
