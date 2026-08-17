import React from 'react';

import type {
  BuklodEntitlement,
} from '@/lib/buklodAccess';

import {
  useBuklodAccess,
} from '@/hooks/useBuklodAccess';

export default function BuklodEntitlementGate({
  entitlement,
  children,
  fallback = null,
}: {
  entitlement: BuklodEntitlement;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const {
    loading,
    hasEntitlement,
  } = useBuklodAccess();

  if (
    loading ||
    !hasEntitlement(entitlement)
  ) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
