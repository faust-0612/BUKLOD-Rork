/** Horizontal Marites story navigation is passive to child zoom and photo paging. */
export type MaritesSwipePoint = { x: number; y: number };
export type MaritesSwipeContext = {
  enabled: boolean;
  photoCount: number;
  photoIndex: number;
  elapsedMs: number;
};

/** Returns previous (-1), next (+1), or null for a touch that should remain in the active media. */
export function resolveMaritesStorySwipe(
  start: MaritesSwipePoint | null,
  end: MaritesSwipePoint,
  context: MaritesSwipeContext,
): -1 | 1 | null {
  if (!start || !context.enabled || !Number.isFinite(context.elapsedMs) || context.elapsedMs > 1000) return null;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy) * 1.5) return null;
  const direction = dx < 0 ? 1 : -1;
  // The inner photo pager owns swipes until its first or final photo is reached.
  const count = Math.max(0, Math.trunc(context.photoCount || 0));
  const page = Math.max(0, Math.min(count - 1, Math.trunc(context.photoIndex || 0)));
  if (count > 1 && ((direction === 1 && page < count - 1) || (direction === -1 && page > 0))) return null;
  return direction;
}
