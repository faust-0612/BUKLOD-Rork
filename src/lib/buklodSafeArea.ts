import { useMemo } from 'react';

import { usePathname } from 'expo-router';
import {
  StyleSheet,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { useAuth } from '@/providers/AuthProvider';
import { getBuklodNavTypographyExtraHeight } from '@/lib/buklodNavTypography';

/** Visible chrome of the global persistent bottom nav (excluding system inset). */
export const BUKLOD_PERSISTENT_NAV_MIN_HEIGHT = 61;
export const BUKLOD_PERSISTENT_NAV_TOP_PADDING = 6;
export const BUKLOD_PERSISTENT_NAV_MIN_BOTTOM_PADDING = 7;

/** Normalize expo-router path variants (`/scope/index` → `/scope`, `/(tabs)/me` → `/me`). */
export function normalizeBuklodPathname(
  pathname: string,
): string {
  let path =
    String(pathname ?? '').trim() ||
    '/';

  path = path.replace(
    /\/\([^/)]+\)/g,
    '',
  );

  if (!path) {
    path = '/';
  }

  if (
    path === '/scope/index' ||
    path.startsWith('/scope/index/')
  ) {
    return path.replace(
      /^\/scope\/index/,
      '/scope',
    );
  }

  return path;
}

/**
 * Canonical scoped workspace routes (Organization / MZB / Cluster dashboards).
 * Global bottom navigation must be hidden here.
 */
export function isBuklodScopedWorkspacePath(
  pathname: string,
): boolean {
  const normalized =
    normalizeBuklodPathname(pathname);

  return (
    normalized === '/scope' ||
    normalized.startsWith('/scope/')
  );
}

export function isBuklodScopedWorkspaceScopeType(
  scopeType: string | null | undefined,
): boolean {
  const type = String(scopeType ?? '')
    .trim()
    .toUpperCase();

  return (
    type === 'ORGANIZATION' ||
    type === 'CLUSTER'
  );
}

export function isBuklodProfileRoute(
  pathname: string,
): boolean {
  const normalized =
    normalizeBuklodPathname(pathname);

  return (
    normalized === '/me' ||
    normalized.startsWith('/me/') ||
    normalized === '/profile' ||
    normalized.startsWith('/profile/') ||
    normalized.startsWith('/member/')
  );
}

export function isBuklodPersistentNavHidden(
  pathname: string,
): boolean {
  const normalized =
    normalizeBuklodPathname(pathname);

  return (
    normalized === '/scope' ||
    normalized.startsWith('/scope/') ||
    normalized === '/mzb' ||
    normalized.startsWith('/mzb/') ||
    normalized === '/' ||
    normalized.startsWith('/login') ||
    normalized.startsWith('/register') ||
    normalized.startsWith('/onboarding') ||
    normalized === '/privacy' ||
    normalized.startsWith('/privacy/') ||
    normalized === '/delete-account' ||
    normalized.startsWith('/delete-account/') ||
    normalized.startsWith('/reels') ||
    normalized.startsWith('/system/') ||
    normalized.startsWith('/admin/') ||
    normalized.startsWith('/pilot/') ||
    normalized.startsWith('/dev/')
  );
}

/**
 * Global public bottom nav is shown on personal Profile even when the user
 * opened it from a scoped Organization / Sub-organization / Cluster home.
 */
export function shouldShowBuklodPublicBottomNav(
  pathname: string,
): boolean {
  const normalized =
    normalizeBuklodPathname(pathname);

  if (isBuklodPersistentNavHidden(normalized)) {
    return false;
  }

  if (isBuklodProfileRoute(normalized)) {
    return true;
  }

  return !isBuklodScopedWorkspacePath(normalized);
}

export function getBuklodPersistentNavOccupiedHeight(
  bottomInset: number,
  fontScale = 1,
): number {
  return (
    BUKLOD_PERSISTENT_NAV_MIN_HEIGHT +
    BUKLOD_PERSISTENT_NAV_TOP_PADDING +
    getBuklodNavTypographyExtraHeight(fontScale) +
    Math.max(
      bottomInset,
      BUKLOD_PERSISTENT_NAV_MIN_BOTTOM_PADDING,
    )
  );
}

/**
 * Height reserved at the bottom when the global BUKLOD nav is visible.
 * Returns 0 inside scoped workspaces and immersive routes.
 */
export function useBuklodPersistentNavOccupiedHeight(): number {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const pathname = usePathname();
  const { session, profile } = useAuth();

  return useMemo(() => {
    if (
      !session ||
      !profile ||
      !shouldShowBuklodPublicBottomNav(pathname)
    ) {
      return 0;
    }

    return getBuklodPersistentNavOccupiedHeight(
      insets.bottom,
      fontScale,
    );
  }, [
    insets.bottom,
    fontScale,
    pathname,
    profile,
    session,
  ]);
}

type ScrollInsetOptions = {
  /** Additional padding after nav / system inset. */
  extra?: number;
  /**
   * Reserve global bottom nav height inside scroll content.
   * Default false — root layout already shrinks the stack above the nav.
   */
  includePersistentNav?: boolean;
};

/**
 * Merge screen content padding with required safe-area minimums.
 * Screen styles apply first; top/bottom safe-area values always win if larger.
 */
export function mergeBuklodSafeContentInsets(
  contentStyle: StyleProp<ViewStyle> | undefined,
  safeInsets: {
    paddingTop: number;
    paddingBottom: number;
  },
): StyleProp<ViewStyle> {
  const flat = StyleSheet.flatten(contentStyle) ?? {};
  const uniformPadding =
    typeof flat.padding === 'number'
      ? flat.padding
      : 0;

  const contentTop =
    typeof flat.paddingTop === 'number'
      ? flat.paddingTop
      : uniformPadding;
  const contentBottom =
    typeof flat.paddingBottom === 'number'
      ? flat.paddingBottom
      : uniformPadding;

  return [
    contentStyle,
    {
      paddingTop: Math.max(
        contentTop,
        safeInsets.paddingTop,
      ),
      paddingBottom: Math.max(
        contentBottom,
        safeInsets.paddingBottom,
      ),
    },
  ];
}

/**
 * Bottom padding for ScrollView / FlatList contentContainerStyle.
 */
export function useBuklodScrollBottomInset(
  options: ScrollInsetOptions = {},
): number {
  const insets = useSafeAreaInsets();
  const navOccupied =
    useBuklodPersistentNavOccupiedHeight();
  const extra = options.extra ?? 16;
  const includeNav =
    options.includePersistentNav ?? false;

  return useMemo(() => {
    if (includeNav && navOccupied > 0) {
      return navOccupied + extra;
    }

    return Math.max(insets.bottom, 0) + extra;
  }, [
    extra,
    includeNav,
    insets.bottom,
    navOccupied,
  ]);
}

/**
 * Portal / door screens (org list, join, create) with global nav still visible.
 */
export function useBuklodPortalContentInsets(
  contentExtra = 16,
) {
  const insets = useSafeAreaInsets();
  const scrollBottomInset =
    useBuklodScrollBottomInset({
      extra: contentExtra,
    });

  return useMemo(
    () => ({
      paddingTop: insets.top,
      paddingBottom: scrollBottomInset,
    }),
    [insets.top, scrollBottomInset],
  );
}

/**
 * Footer AdMob banner padding — avoids double-counting system inset when
 * the global nav already consumes the gesture area.
 */
/**
 * Top/bottom insets for screens inside `/scope/*` (no global nav).
 */
export function useBuklodScopedWorkspaceContentInsets(
  contentExtra = 16,
  options: {
    includeTopInset?: boolean;
  } = {},
) {
  const insets = useSafeAreaInsets();
  const scrollBottomInset =
    useBuklodScrollBottomInset({
      extra: contentExtra,
      includePersistentNav: false,
    });
  const includeTopInset =
    options.includeTopInset ?? true;

  return useMemo(
    () => ({
      paddingTop: includeTopInset
        ? insets.top
        : 0,
      paddingBottom: scrollBottomInset,
    }),
    [
      includeTopInset,
      insets.top,
      scrollBottomInset,
    ],
  );
}

/**
 * Bottom padding so a drawer / bottom sheet sits above the phone nav pane
 * (home indicator or system navigation buttons).
 */
export function useBuklodDrawerBottomInset(
  extra = 12,
): number {
  const insets = useSafeAreaInsets();

  return useMemo(
    () => Math.max(insets.bottom, 8) + extra,
    [extra, insets.bottom],
  );
}

export function useBuklodFooterAdBottomPadding(): number {
  const insets = useSafeAreaInsets();
  const navOccupied =
    useBuklodPersistentNavOccupiedHeight();

  return useMemo(() => {
    if (navOccupied > 0) {
      return 8;
    }

    return Math.max(insets.bottom, 4);
  }, [insets.bottom, navOccupied]);
}
