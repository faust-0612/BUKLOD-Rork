import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import {
  getCachedMzbCanonicalScopeId,
  resolveScopeContextSync,
  syncScopeSelection,
  type ScopeResolution,
} from '@/lib/buklodScopeRoute';
import {
  resolveMzbOrganizationScopeId,
} from '@/lib/buklodMzbOrganization';

type UseResolvedScopeOptions = {
  routeScopeId?: string | null;
  mzbOnly?: boolean;
  requireMembership?: boolean;
  syncActiveScope?: boolean;
};

export function useResolvedScope(
  options: UseResolvedScopeOptions = {}
): ScopeResolution & {
  refresh: () => Promise<void>;
} {
  const {
    routeScopeId = null,
    mzbOnly = false,
    requireMembership = true,
    syncActiveScope = true,
  } = options;

  const {
    scopes,
    activeScope,
    loading,
    error,
    selectScope,
    refresh,
  } = useBuklodScope();

  const [
    mzbCanonicalScopeId,
    setMzbCanonicalScopeId,
  ] = useState<string | null>(
    getCachedMzbCanonicalScopeId()
  );

  useEffect(() => {
    if (!mzbOnly) {
      return;
    }

    let active = true;

    void resolveMzbOrganizationScopeId()
      .then((scopeId) => {
        if (active) {
          setMzbCanonicalScopeId(scopeId);
        }
      })
      .catch(() => {
        if (active) {
          setMzbCanonicalScopeId(null);
        }
      });

    return () => {
      active = false;
    };
  }, [mzbOnly, scopes.length]);

  const resolution = useMemo(
    () =>
      resolveScopeContextSync({
        routeScopeId,
        activeScope,
        scopes,
        scopesLoading: loading,
        scopesError: error,
        mzbOnly,
        requireMembership,
        mzbCanonicalScopeId,
      }),
    [
      routeScopeId,
      activeScope,
      scopes,
      loading,
      error,
      mzbOnly,
      requireMembership,
      mzbCanonicalScopeId,
    ]
  );

  useLayoutEffect(() => {
    if (
      !syncActiveScope ||
      resolution.access !== 'authorized' ||
      !resolution.scope
    ) {
      return;
    }

    void syncScopeSelection(
      selectScope,
      resolution.scope.scope_id,
      activeScope?.scope_id
    );
  }, [
    syncActiveScope,
    resolution.access,
    resolution.scope?.scope_id,
    activeScope?.scope_id,
    selectScope,
  ]);

  return {
    ...resolution,
    refresh,
  };
}
