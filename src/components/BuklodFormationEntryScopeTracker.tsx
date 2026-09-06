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

  useEffect(() => {
    const previousPath = previousPathRef.current;
    const feature = featureForPath(pathname);
    const previousFeature = previousPath ? featureForPath(previousPath) : null;

    previousPathRef.current = pathname;

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
    if (previousPath === null && !directScopedLesson) {
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

    void (supabase as any)
      .rpc('buklod_set_formation_entry_scope_v1', {
        p_feature_key: feature,
        p_scope_id: exactScope,
      })
      .then(({ error }: { error?: { message?: string } | null }) => {
        if (error) {
          console.warn(
            'BUKLOD Formation entry scope:',
            error.message ?? error
          );
        }
      });
  }, [activeScope?.scope_id, activeScope?.scope_type, pathname]);

  return null;
}
