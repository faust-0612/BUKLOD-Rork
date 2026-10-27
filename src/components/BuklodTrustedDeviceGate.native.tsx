import React, { type ReactNode, useEffect } from 'react';
import { markBuklodStartupChromeReady } from '@/lib/buklodStartupChrome';

/**
 * Resume persisted Supabase sessions without automatically requiring device
 * biometrics. Sensitive-feature verification remains independent.
 */
export default function BuklodTrustedDeviceGate({ children }: { children: ReactNode }) {
  useEffect(() => {
    markBuklodStartupChromeReady();
  }, []);

  return <>{children}</>;
}
