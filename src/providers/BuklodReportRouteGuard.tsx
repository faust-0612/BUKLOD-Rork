import React, { type ReactNode, useEffect } from 'react';
import { router, useSegments } from 'expo-router';

import { useAuth } from '@/providers/AuthProvider';

const ALLOWED_ROOTS = new Set([
  '',
  'index',
  'report-login',
  'reports',
  'privacy',
  'system',
]);

/**
 * Runtime containment for the standalone Report package.
 *
 * The repository still contains legacy BUKLOD Main route source, but this
 * package must never expose those screens. Any direct/deep-linked Main route
 * is redirected into the standalone Report surface.
 */
export default function BuklodReportRouteGuard({ children }: { children: ReactNode }) {
  const segments = useSegments();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    const root = String(segments?.[0] ?? '');
    if (ALLOWED_ROOTS.has(root)) return;
    router.replace((session ? '/reports' : '/report-login') as any);
  }, [loading, segments, session]);

  return <>{children}</>;
}
