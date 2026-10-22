import React, { type ReactNode } from 'react';

/*
 * BUKLOD_AUTH_EMAIL_LOCAL_DEVICE_R1
 * Web keeps the existing persisted Supabase session behavior.
 * Native-only local authentication must not block or alter mobile/desktop web.
 */
export default function BuklodTrustedDeviceGate({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
