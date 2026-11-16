import { useEffect, useRef } from 'react';
import { usePathname } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';

type FeatureKey = 'DAILY_READING' | 'DAILY_DEVOTION' | 'LESSON';

function featureForPath(pathname: string): FeatureKey | null {
  if (pathname === '/bible' || pathname.startsWith('/bible/')) {
    return 'DAILY_READING';
  }

  if (
    pathname === '/word' ||
    pathname.startsWith('/word/') ||
    pathname.startsWith('/devotional/') ||
    pathname.startsWith('/reflection/')
  ) {
    return 'DAILY_DEVOTION';
  }

  if (
    pathname === '/scope/buklod-lesson' ||
    pathname.startsWith('/scope/buklod-lesson/') ||
    pathname === '/learn' ||
    pathname.startsWith('/learn/')
  ) {
    return 'LESSON';
  }

  return null;
}

function isScopedWorkspacePath(pathname: string) {
  return (
    pathname === '/scope' ||
    pathname.startsWith('/scope/') ||
    pathname.startsWith('/clusters/') ||
    pathname.startsWith('/organizations/') ||
    pathname.startsWith('/mzb/')
  );
}

export default function BuklodFormationEntryScopeTracker() {
  const pathname = usePathname();
  const { activeScope } = useBuklodScope();
  const previousPathRef = useRef<string | null>(null);
  const entrySequenceRef = useRef(0);

  useEffect(() => {
    const previousPath = previousPathRef.current;
    const feature = featureForPath(pathname);
    const previousFeature = previousPath ? featureForPath(previousPath) : null;

    previousPathRef.current = pathname;

    // Cancel not-yet-issued context writes when leaving this feature. Moving
    // between /learn screens preserves the original entry request.
    if (feature !== previousFeature) entrySequenceRef.current += 1;
    const entrySequence = entrySequenceRef.current;

    if (!feature) {
      return;
    }

    // Never change the captured scope while navigating inside the same feature.
    if (previousFeature === feature) {
      return;
    }

    const directScopedLesson = pathname.startsWith('/scope/buklod-lesson');

    // A direct reload inside mature generic feature screens keeps the existing
    // short-lived server context instead of guessing a scope from stale UI state.
    if (previousPath === null && !directScopedLesson && feature !== 'LESSON') {
      return;
    }

    const cameFromScopedWorkspace =
      directScopedLesson ||
      (previousPath !== null && isScopedWorkspacePath(previousPath));

    const exactScope =
      cameFromScopedWorkspace &&
      activeScope &&
      (activeScope.scope_type === 'ORGANIZATION' ||
        activeScope.scope_type === 'CLUSTER')
        ? activeScope.scope_id
        : null;

    const setEntryScope = async (scopeId: string | null) => {
      if (entrySequenceRef.current !== entrySequence) return;
      const { error } = await (supabase as any).rpc('buklod_set_formation_entry_scope_v1', {
        p_feature_key: feature,
        p_scope_id: scopeId,
      });
      if (error) console.warn('BUKLOD Formation entry scope:', error.message ?? error);
    };

    if (feature === 'LESSON' && !exactScope) {
      // Generic Learn entry has no scoped workspace. When the authenticated
      // member has exactly ONE active Cluster, its verified membership gives
      // an unambiguous scope; never guess when there are multiple clusters.
      // The setter rechecks membership and scope status on the server.
      void (async () => {
        const { data, error } = await (supabase as any).rpc('buklod_my_clusters');
        if (error) {
          console.warn('BUKLOD Lesson cluster lookup:', error.message ?? error);
          await setEntryScope(null);
          return;
        }
        const active = Array.isArray(data)
          ? data.filter((row: any) => row?.membership_status === 'ACTIVE' && row?.scope_status === 'ACTIVE' && typeof row?.scope_id === 'string')
          : [];
        await setEntryScope(active.length === 1 ? active[0].scope_id : null);
      })();
    } else {
      void setEntryScope(exactScope);
    }
  }, [activeScope?.scope_id, activeScope?.scope_type, pathname]);

  return null;
}
