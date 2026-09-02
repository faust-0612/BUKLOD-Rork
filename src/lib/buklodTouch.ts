import type { GestureResponderEvent } from 'react-native';

/**
 * Canonical BUKLOD touch timing, hit targets, and movement thresholds.
 * Use these everywhere so tap / long-press / swipe feel consistent.
 */

/** Standard long-press (profile, reactions, message actions). */
export const BUKLOD_LONG_PRESS_MS = 420;

/**
 * Icon / compact control expansion. Keep small so nearby controls
 * do not overlap. Large buttons should not add extra slop.
 */
export const BUKLOD_HIT_SLOP = 8;

/** Dense text, chips, and name labels. */
export const BUKLOD_HIT_SLOP_TIGHT = 4;

/**
 * Avatar circles stay limited to the visible disc.
 * Accessibility comes from the avatar size itself (typically 38–52).
 */
export const BUKLOD_HIT_SLOP_AVATAR = 0;

/**
 * Cancel a tap / long-press if the finger moves this far.
 * Distinguishes scroll and swipe from a deliberate press without a delay.
 */
export const BUKLOD_PRESS_MOVE_CANCEL_PX = 10;

/** Pan / reposition gestures need a clear start, not a tiny nudge. */
export const BUKLOD_PAN_MIN_DISTANCE_PX = 16;

/** Dominant-axis swipe must exceed this before paging / dismissing. */
export const BUKLOD_SWIPE_AXIS_THRESHOLD_PX = 18;

/** |primary| must exceed |cross| by this ratio. */
export const BUKLOD_SWIPE_AXIS_DOMINANCE = 1.35;

/**
 * How far a finger may slide off a control and still complete the press.
 * Larger values make distant accidental releases count as taps.
 */
export const BUKLOD_PRESS_RETENTION = {
  top: 6,
  left: 6,
  right: 6,
  bottom: 6,
} as const;

/** Comfortable minimum visible control size. Do not fake this with huge hitSlop. */
export const BUKLOD_MIN_TARGET_PX = 44;

/**
 * @deprecated Movement cancel in BuklodPressable replaces delayed press.
 * Kept at 0 so remaining call sites do not add artificial lag.
 */
export const BUKLOD_FEED_ACTION_PRESS_DELAY_MS = 0;

export function buklodHitSlop(
  amount: number = BUKLOD_HIT_SLOP,
) {
  return {
    top: amount,
    left: amount,
    right: amount,
    bottom: amount,
  };
}

export function stopBuklodNestedPress(
  event?: {
    stopPropagation?: () => void;
  } | null,
) {
  event?.stopPropagation?.();
}

export function buklodMovementExceeded(
  origin: { x: number; y: number } | null | undefined,
  pageX: number,
  pageY: number,
  threshold: number = BUKLOD_PRESS_MOVE_CANCEL_PX,
) {
  if (!origin) {
    return false;
  }

  const dx = pageX - origin.x;
  const dy = pageY - origin.y;
  return dx * dx + dy * dy > threshold * threshold;
}

export function buklodDominantSwipe(
  translationX: number,
  translationY: number,
  axis: 'x' | 'y',
) {
  const primary = Math.abs(axis === 'x' ? translationX : translationY);
  const cross = Math.abs(axis === 'x' ? translationY : translationX);

  return (
    primary >= BUKLOD_SWIPE_AXIS_THRESHOLD_PX &&
    primary >= cross * BUKLOD_SWIPE_AXIS_DOMINANCE
  );
}

export function buklodTouchPagePoint(
  event: GestureResponderEvent,
) {
  const native = event.nativeEvent;
  const touch = native.touches?.[0];

  return {
    x: Number(touch?.pageX ?? native.pageX ?? 0),
    y: Number(touch?.pageY ?? native.pageY ?? 0),
  };
}
