import React, { type ReactNode } from 'react';

/*
 * TypeScript/platform resolver fallback.
 * Metro selects .native.tsx on Android/iOS and .web.tsx on web.
 */
export default function BuklodTrustedDeviceGate({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
