import React from 'react';

import {
  useBuklodScope,
} from '@/providers/BuklodScopeProvider';

export default function ScopeFeatureGate({
  feature,
  children,
  fallback = null,
}: {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const {
    featureEnabled,
  } =
    useBuklodScope();

  if (
    !featureEnabled(feature)
  ) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
