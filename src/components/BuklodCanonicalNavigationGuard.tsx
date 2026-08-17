import {
  useEffect,
  useRef,
} from 'react';

import {
  router,
  useGlobalSearchParams,
  usePathname,
} from 'expo-router';

import {
  useBuklodScope,
} from '@/providers/BuklodScopeProvider';

type CanonicalSection =
  | 'home'
  | 'community'
  | 'connect';

function normalizeSection(
  value:
    | string
    | string[]
    | undefined
): CanonicalSection {
  const first =
    Array.isArray(value)
      ? value[0]
      : value;

  if (
    first === 'community' ||
    first === 'connect'
  ) {
    return first;
  }

  return 'home';
}

function publicRouteFor(
  section: CanonicalSection
) {
  if (
    section === 'community'
  ) {
    return '/buklod';
  }

  if (
    section === 'connect'
  ) {
    return '/connect';
  }

  return '/home';
}

function scopedRouteFor(
  pathname: string
) {
  if (pathname === '/home') {
    return '/scope?section=home';
  }

  if (pathname === '/buklod') {
    return '/scope?section=community';
  }

  /*
   * Only the Connect directory route is canonicalized.
   * /connect/[id] remains private one-to-one messaging.
   */
  if (pathname === '/connect') {
    return '/scope?section=connect';
  }

  return null;
}

export default function
BuklodCanonicalNavigationGuard() {
  const pathname =
    usePathname();

  const params =
    useGlobalSearchParams<{
      section?:
        | string
        | string[];
    }>();

  const {
    activeScope,
    loading,
  } =
    useBuklodScope();

  const lastRedirectRef =
    useRef('');

  useEffect(() => {
        /*
     * PATCH_177B_R4_ATTENDANCE_ROUTE_EXEMPT
     * Attendance is an exact-scope utility route.
     */
    if (
      pathname === '/scope/attendance' ||
      pathname.startsWith('/scope/attendance/')
    ) {
      lastRedirectRef.current = '';
      return;
    }

if (
      loading ||
      !activeScope
    ) {
      return;
    }

    let target:
      | string
      | null =
      null;

    if (
      activeScope.scope_type ===
      'PUBLIC'
    ) {
      if (
        pathname === '/scope' ||
        pathname.startsWith(
          '/scope/'
        )
      ) {
        target =
          publicRouteFor(
            normalizeSection(
              params.section
            )
          );
      }
    } else {
      target =
        scopedRouteFor(
          pathname
        );
    }

    if (!target) {
      lastRedirectRef.current =
        '';
      return;
    }

    const key =
      `${activeScope.scope_id}|${pathname}|${target}`;

    if (
      lastRedirectRef.current ===
      key
    ) {
      return;
    }

    lastRedirectRef.current =
      key;

    router.replace(
      target as any
    );
  }, [
    pathname,
    params.section,
    activeScope?.scope_id,
    activeScope?.scope_type,
    loading,
  ]);

  return null;
}
