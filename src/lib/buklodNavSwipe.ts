/** Optional, inexpensive horizontal swipe shortcut; never steals vertical scroll.
 * A visible More button and long-press remain the accessible alternatives.
 */
export type BuklodTouchPoint = { x: number; y: number };
export function isBuklodNavigationOptionsSwipe(
  start: BuklodTouchPoint | null | undefined,
  end: BuklodTouchPoint | null | undefined,
): boolean {
  if (!start || !end || ![start.x,start.y,end.x,end.y].every(Number.isFinite)) return false;
  const dx = end.x - start.x;
  const dy = Math.abs(end.y - start.y);
  return dx <= -72 && dy <= 30 && Math.abs(dx) > dy * 2;
}
