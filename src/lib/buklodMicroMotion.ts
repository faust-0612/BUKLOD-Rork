/**
 * Zero-network UI micro-motion event bus. Keeps animation out of business
 * state, media playback, ads and route lifecycles.
 */
export type BuklodMicroMotionKind =
  | 'tap'
  | 'reaction'
  | 'success'
  | 'reward';

export type BuklodMicroMotionSignal = {
  kind: BuklodMicroMotionKind;
  pageX: number;
  pageY: number;
  emoji?: string;
};

type Listener = (event: BuklodMicroMotionSignal) => void;

export const BUKLOD_MAX_ACTIVE_MICRO_MOTIONS = 3;

export const BUKLOD_MICRO_MOTION_COOLDOWN_MS: Record<BuklodMicroMotionKind, number> = {
  tap: 280,
  reaction: 125,
  success: 180,
  reward: 180,
};

const listeners = new Set<Listener>();
const lastSentAt: Record<BuklodMicroMotionKind, number> = {
  tap: -Infinity,
  reaction: -Infinity,
  success: -Infinity,
  reward: -Infinity,
};

export function normalizeBuklodMicroMotion(
  event: BuklodMicroMotionSignal,
): BuklodMicroMotionSignal | null {
  if (!event || !['tap', 'reaction', 'success', 'reward'].includes(event.kind)) {
    return null;
  }
  if (!Number.isFinite(event.pageX) || !Number.isFinite(event.pageY)) {
    return null;
  }
  if (event.pageX < 0 || event.pageY < 0 || (event.pageX === 0 && event.pageY === 0)) {
    return null;
  }
  return {
    kind: event.kind,
    pageX: event.pageX,
    pageY: event.pageY,
    emoji: typeof event.emoji === 'string' ? event.emoji.slice(0, 8) : undefined,
  };
}

export function shouldEmitBuklodMicroMotion(
  kind: BuklodMicroMotionKind,
  now: number,
  lastAt: number,
) {
  return Number.isFinite(now) && now - lastAt >= BUKLOD_MICRO_MOTION_COOLDOWN_MS[kind];
}

export function subscribeBuklodMicroMotion(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Best-effort visual acknowledgement, never a claim that a mutation saved. */
export function emitBuklodMicroMotion(raw: BuklodMicroMotionSignal) {
  if (listeners.size === 0) return false;
  const event = normalizeBuklodMicroMotion(raw);
  if (!event) return false;
  const now = Date.now();
  if (!shouldEmitBuklodMicroMotion(event.kind, now, lastSentAt[event.kind])) {
    return false;
  }
  lastSentAt[event.kind] = now;
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // Visual feedback must never block the action that produced it.
    }
  }
  return true;
}
