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

  const lastRedirectRef =
    useRef('');

  useEffect(() => {
    const normalized =
      normalizeBuklodPathname(pathname);

    /*
     * PATCH_177B_R4_ATTENDANCE_ROUTE_EXEMPT
     * Attendance is an exact-scope utility route.
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
      (
        isBuklodProfileRoute(normalized) &&
        Boolean(
          firstRouteParam(
            params.returnScopeId
          )
        )
      )
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
    params.returnScopeId,
    activeScope?.scope_id,
    activeScope?.scope_type,
    loading,
  ]);

  return null;
}
