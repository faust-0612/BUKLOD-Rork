/** Pure geometry helper shared by initial and settled ad-slot checks. */
export type AdSlotRect = { x: number; y: number; width: number; height: number };
export type AdViewportRect = { width: number; height: number };

export function isBuklodAdSlotVisible(rect: AdSlotRect, viewport: AdViewportRect): boolean {
  const { x, y, width, height } = rect;
  const { width: viewportWidth, height: viewportHeight } = viewport;
  if (![x, y, width, height, viewportWidth, viewportHeight].every(Number.isFinite)) {
    return false;
  }
  return width >= 8 && height >= 8 &&
    y < viewportHeight - 8 && y + height > 8 &&
    x < viewportWidth && x + width > 0;
}
