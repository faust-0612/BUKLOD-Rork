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
  if (section === 'community') {
    return '/buklod';
  }

  if (section === 'connect') {
    return '/connect';
  }

  return '/hub';
}

export default function
BuklodCanonicalNavigationGuard() {
  const pathname =
    usePathname();

  const params =
    useGlobalSearchParams<{
      section?: string | string[];
      returnScopeId?: string | string[];
      scopeId?: string | string[];
      focusPostId?: string | string[];
    }>();

  const {
    activeScope,
    scopes,
    selectScope,
    loading,
  } =
    useBuklodScope();

  const lastRedirectRef =
    useRef('');

  const initialBrowserRouteHandledRef =
    useRef(false);

  useEffect(() => {
    const normalized =
      normalizeBuklodPathname(pathname);

    if (normalized === '/buklod' && firstRouteParam(params.focusPostId)) {
      lastRedirectRef.current = '';
      return;
    }

    const exactScopeUtility =
      normalized === '/scope/attendance' ||
      normalized.startsWith('/scope/attendance/') ||
      normalized === '/scope/faith-monitoring/report' ||
      normalized.startsWith('/scope/faith-monitoring/') ||
      normalized === '/scope/manage' ||
      normalized.startsWith('/scope/manage/') ||
      normalized.startsWith('/scope/buklod-lesson');

    /*
     * BUKLOD_WEB_SCOPE_BOOT_R22
     *
     * A browser refresh/history autocomplete may reopen an old canonical
     * /scope?section=...&scopeId=... URL directly. That bypasses app/index.tsx,
     * so the normal PUBLIC boot reset never gets a chance to run.
     *
     * On the FIRST settled browser route only, a plain scoped workspace is
     * treated as stale navigation state: restore PUBLIC and enter personal
     * Connect. Exact-scope utilities are preserved.
     *
     * Later in-app navigation to /scope is untouched because this guard has
     * already completed its initial-route pass.
     */
    if (
      !initialBrowserRouteHandledRef.current &&
      !loading &&
      activeScope
    ) {
      initialBrowserRouteHandledRef.current = true;

      if (
        isBuklodScopedWorkspacePath(normalized) &&
        !firstRouteParam(params.focusPostId) &&
        !exactScopeUtility
      ) {
        const publicScope =
          scopes.find(
            scope =>
              scope.scope_type === 'PUBLIC'
          );

        if (publicScope) {
          lastRedirectRef.current = 'WEB_BOOT_PUBLIC';

          void (async () => {
            if (
              activeScope.scope_id !==
              publicScope.scope_id
            ) {
              try {
                await selectScope(
                  publicScope.scope_id
                );
              } catch (error) {
                console.warn(
                  'BUKLOD web boot Public reset:',
                  error
                );
              }
            }

            router.replace(
              '/messages' as any
            );
          })();

          return;
        }
      }
    }

    /*
     * Profile / My BUKLOD is always personal/global. Never let a stale
     * Organization/Cluster active scope hijack an avatar tap.
     */
    if (
      exactScopeUtility ||
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
      | null = null;

    if (
      activeScope.scope_type === 'PUBLIC'
    ) {
      const openingScopeId =
        firstRouteParam(
          params.scopeId
        );

      if (
        openingScopeId &&
        isBuklodScopedWorkspacePath(normalized)
      ) {
        lastRedirectRef.current = '';
        return;
      }

      if (
        isBuklodScopedWorkspacePath(normalized)
      ) {
        target =
          publicRouteFor(
            normalizeSection(
              params.section
            )
          );
      }
    } else if (
      isManagedCommunityScope(activeScope)
    ) {
      if (
        isScopePortalRoute(normalized)
      ) {
        lastRedirectRef.current = '';
        return;
      }

      target =
        scopedWorkspacePathForGlobalRoute(
          normalized,
          activeScope.scope_id
        );
    }

    if (!target) {
      lastRedirectRef.current = '';
      return;
    }

    const key =
      `${activeScope.scope_id}|${normalized}|${target}`;

    if (
      lastRedirectRef.current === key
    ) {
      return;
    }

    lastRedirectRef.current = key;

    router.replace(
      target as any
    );
  }, [
    pathname,
    params.section,
    params.scopeId,
    params.focusPostId,
    activeScope?.scope_id,
    activeScope?.scope_type,
    scopes,
    selectScope,
    loading,
  ]);

  return null;
}

