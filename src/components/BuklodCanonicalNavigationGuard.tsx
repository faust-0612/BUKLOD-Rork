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
  firstRouteParam,
  isBuklodCirclePersonalRoute,
  isBuklodFaithPersonalRoute,
  isFormationLearningRoute,
  isManagedCommunityScope,
  isScopePortalRoute,
  scopedWorkspacePathForGlobalRoute,
} from '@/lib/buklodScopeRoute';

import {
  isBuklodProfileRoute,
  isBuklodScopedWorkspacePath,
  normalizeBuklodPathname,
} from '@/lib/buklodSafeArea';

import {
  useBuklodScope,
} from '@/providers/BuklodScopeProvider';
import { useAuth } from '@/providers/AuthProvider';

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

export default function
BuklodCanonicalNavigationGuard() {
  const pathname =
    usePathname();

  const params =
    useGlobalSearchParams<{
      section?:
        | string
        | string[];
      returnScopeId?:
        | string
        | string[];
      scopeId?:
        | string
        | string[];
    }>();

  const {
    activeScope,
    loading,
  } =
    useBuklodScope();

  const {
    user,
    loading: authLoading,
  } = useAuth();

  const lastRedirectRef =
    useRef('');

  /*
   * BUKLOD_ACCOUNT_ISOLATION_R1
   *
   * Expo Router keeps the currently mounted route while Supabase swaps the
   * authenticated identity. A real account change must never inherit the
   * previous user's classroom/thread/workspace route.
   *
   * Ignore the first hydrated identity. After that, any identity transition
   * resets navigation to a neutral route before normal canonical routing runs.
   */
  const previousAuthUserIdRef =
    useRef<string | null | undefined>(undefined);
  const accountResetInFlightRef =
    useRef(false);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    const nextUserId =
      user?.id ?? null;
    const previousUserId =
      previousAuthUserIdRef.current;

    if (previousUserId === undefined) {
      previousAuthUserIdRef.current =
        nextUserId;
      return;
    }

    if (previousUserId === nextUserId) {
      return;
    }

    previousAuthUserIdRef.current =
      nextUserId;
    lastRedirectRef.current = '';
    accountResetInFlightRef.current = true;

    router.replace(
      nextUserId
        ? ('/' as any)
        : ('/(auth)/login' as any)
    );
  }, [
    authLoading,
    user?.id,
  ]);

  useEffect(() => {
    if (accountResetInFlightRef.current) {
      const normalizedAfterReset =
        normalizeBuklodPathname(pathname);

      if (
        normalizedAfterReset === '/' ||
        normalizedAfterReset === '/login' ||
        normalizedAfterReset === '/(auth)/login'
      ) {
        accountResetInFlightRef.current = false;
      }

      return;
    }

    const normalized =
      normalizeBuklodPathname(pathname);

    /*
     * PATCH_177B_R4_ATTENDANCE_ROUTE_EXEMPT
     * Attendance is an exact-scope utility route.
     *
     * BUKLOD_PROFILE_ROUTE_EXEMPT_R21
     * Profile / My BUKLOD is always personal/global. Never let a stale
     * Organization/Cluster active scope hijack an avatar tap back into a
     * Mission Worker or managed workspace.
     */
    if (
      normalized === '/scope/attendance' ||
      normalized.startsWith('/scope/attendance/') ||
      normalized === '/scope/faith-monitoring/report' ||
      normalized.startsWith('/scope/faith-monitoring/') ||
      normalized === '/scope/manage' ||
      normalized.startsWith('/scope/manage/') ||
      normalized.startsWith('/scope/buklod-lesson') ||
      isFormationLearningRoute(normalized) ||
      isBuklodFaithPersonalRoute(normalized) ||
      isBuklodCirclePersonalRoute(normalized) ||
      isBuklodProfileRoute(normalized)
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
      const openingScopeId =
        firstRouteParam(
          params.scopeId
        );

      if (
        openingScopeId &&
        isBuklodScopedWorkspacePath(
          normalized,
        )
      ) {
        lastRedirectRef.current = '';
        return;
      }

      if (
        isBuklodScopedWorkspacePath(
          normalized,
        )
      ) {
        target =
          publicRouteFor(
            normalizeSection(
              params.section
            )
          );
      }
    } else if (
      isManagedCommunityScope(
        activeScope,
      )
    ) {
      if (
        isScopePortalRoute(
          normalized,
        )
      ) {
        lastRedirectRef.current = '';
        return;
      }

      target =
        scopedWorkspacePathForGlobalRoute(
          normalized,
          activeScope.scope_id,
        );
    }

    if (!target) {
      lastRedirectRef.current =
        '';
      return;
    }

    const key =
      `${activeScope.scope_id}|${normalized}|${target}`;

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
    params.scopeId,
    activeScope?.scope_id,
    activeScope?.scope_type,
    loading,
  ]);

  return null;
}
