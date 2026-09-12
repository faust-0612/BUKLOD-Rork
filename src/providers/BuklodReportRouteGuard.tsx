import React, { type ReactNode, useEffect } from 'react';
import { router, useSegments } from 'expo-router';

import { useAuth } from '@/providers/AuthProvider';

const ALLOWED_ROOTS = new Set([
  '',
  'index',
  'report-login',
  'report-access-pending',
  'reports',
  'privacy',
  'system',
]);

const SAFETY_ROOTS = new Set([
  '',
  'index',
  'report-login',
  'report-access-pending',
  'privacy',
  'system',
]);

/**
 * Runtime containment for the standalone Report package.
 *
 * The repository still contains legacy BUKLOD Main route source, but this
 * package must never expose those screens. The guard also prevents a direct
 * /reports deep link from bypassing the canonical BUKLOD account gate.
 */
export default function BuklodReportRouteGuard({ children }: { children: ReactNode }) {
  const segments = useSegments();
  const { session, loading, profile, membershipState } = useAuth();
  const root = String(segments?.[0] ?? '');

  const hasCommunityAccess = profile?.is_active === true && Boolean(profile?.connection_type);
  const hasCanonicalAccess =
    profile?.is_active === true &&
    (membershipState === 'ready' || hasCommunityAccess);
  const accountLoading = loading || (Boolean(session) && membershipState === 'loading' && !profile);

  useEffect(() => {
    if (accountLoading) return;

    if (!ALLOWED_ROOTS.has(root)) {
      router.replace((!session ? '/report-login' : hasCanonicalAccess ? '/reports' : '/report-access-pending') as any);
      return;
    }

    if (root === 'report-login') {
      if (session && hasCanonicalAccess) router.replace('/reports' as any);
      else if (session) router.replace('/report-access-pending' as any);
      return;
    }

    if (root === 'report-access-pending') {
      if (!session) router.replace('/report-login' as any);
      else if (hasCanonicalAccess) router.replace('/reports' as any);
      return;
    }

    if (SAFETY_ROOTS.has(root)) return;

    if (!session) {
      router.replace('/report-login' as any);
      return;
    }

    if (!hasCanonicalAccess) {
      router.replace('/report-access-pending' as any);
    }
  }, [accountLoading, hasCanonicalAccess, root, session]);

  if (accountLoading) return null;
  if (!ALLOWED_ROOTS.has(root)) return null;
  if (root === 'report-login' && session) return null;
  if (root === 'report-access-pending' && (!session || hasCanonicalAccess)) return null;
  if (!SAFETY_ROOTS.has(root) && (!session || !hasCanonicalAccess)) return null;

  return <>{children}</>;
}
