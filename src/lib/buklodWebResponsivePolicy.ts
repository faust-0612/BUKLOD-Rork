/**
 * BUKLOD_WEB_RESPONSIVE_SOURCE_R1
 *
 * Shared, pure route/viewport decisions for the web presentation layers.
 * Callers supply paths normalized by normalizeBuklodPathname().
 *
 * Two thresholds are intentional: scoped desktop chrome starts at 1100px;
 * public Home/Wall are still hosted by the minimal public shell and only
 * receive a centered feed canvas at 1200px. These are different layers,
 * not competing navigation shells. Never apply these rules to Android.
 */
export const BUKLOD_DESKTOP_PUBLIC_FEED_MIN_WIDTH = 1200;
export const BUKLOD_DESKTOP_PUBLIC_FEED_MAX_WIDTH = 940;

export function shouldUseBuklodDesktopScopedShell(
  normalizedPathname: string,
  width: number,
  minWidth: number,
): boolean {
  return (
    Number.isFinite(width) &&
    width >= minWidth &&
    (normalizedPathname === '/scope' ||
      normalizedPathname.startsWith('/scope/'))
  );
}

export function shouldUseBuklodDesktopPublicFeed(
  normalizedPathname: string,
  width: number,
): boolean {
  return (
    Number.isFinite(width) &&
    width >= BUKLOD_DESKTOP_PUBLIC_FEED_MIN_WIDTH &&
    (normalizedPathname === '/hub' ||
      normalizedPathname === '/buklod' ||
      normalizedPathname.startsWith('/buklod/'))
  );
}
