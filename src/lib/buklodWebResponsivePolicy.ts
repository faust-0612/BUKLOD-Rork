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

/** Desktop-wide unified dashboard chrome is only enabled for authenticated
 * dashboard routes, never auth, call, immersive video, system or scoped views. */
export const BUKLOD_DESKTOP_DASHBOARD_MIN_WIDTH = 1200;
/** BUKLOD_DESKTOP_COLUMN_SIZING_R2
 * The responsive rails have a fixed footprint; only the routed content
 * may flex. This prevents React Native Web's ScrollView flex defaults from
 * squeezing the Wall into an unreadable mobile-sized strip.
 */
export function resolveBuklodDesktopRailWidths(width: number): {
  left: number; right: number;
} {
  if (Number.isFinite(width) && width >= 1400) {
    return { left: 280, right: 318 };
  }
  return { left: 220, right: 270 };
}

export function shouldUseBuklodPublicDesktopShell(
  normalizedPathname: string,
  width: number,
): boolean {
  if (!Number.isFinite(width) || width < BUKLOD_DESKTOP_DASHBOARD_MIN_WIDTH) return false;
  return (
    normalizedPathname === '/hub' ||
    normalizedPathname === '/buklod' ||
    normalizedPathname === '/messages' ||
    normalizedPathname === '/me' ||
    normalizedPathname === '/learn' ||
    normalizedPathname === '/clusters' ||
    normalizedPathname.startsWith('/clusters/') ||
    normalizedPathname === '/bible' ||
    normalizedPathname.startsWith('/bible/') ||
    normalizedPathname === '/notifications' ||
    normalizedPathname === '/community-contribution' ||
    // Wide desktop: regular secondary dashboards remain within Main chrome.
    normalizedPathname === '/scope' || normalizedPathname.startsWith('/scope/') ||
    normalizedPathname === '/points' || normalizedPathname.startsWith('/points/') ||
    normalizedPathname === '/personal-home' || normalizedPathname.startsWith('/personal-home/') ||
    normalizedPathname === '/profile' || normalizedPathname.startsWith('/profile/') ||
    normalizedPathname === '/word' || normalizedPathname.startsWith('/word/') ||
    normalizedPathname === '/prayer' || normalizedPathname.startsWith('/prayer/') ||
    normalizedPathname === '/member' || normalizedPathname.startsWith('/member/') ||
    normalizedPathname === '/connect' || normalizedPathname.startsWith('/connect/')
  );
}
