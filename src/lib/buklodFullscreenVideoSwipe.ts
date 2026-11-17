export type FullscreenVideoSwipeDirection = 'up' | 'down';
/** Ignore tiny/diagonal gestures so reaction pickers and taps still work. */
export function resolveFullscreenVideoSwipe(
  translationX: number,
  translationY: number,
): FullscreenVideoSwipeDirection | null {
  if (!Number.isFinite(translationX) || !Number.isFinite(translationY)) return null;
  if (Math.abs(translationY) < 46 || Math.abs(translationX) > Math.abs(translationY) * 0.75) return null;
  return translationY < 0 ? 'up' : 'down';
}
