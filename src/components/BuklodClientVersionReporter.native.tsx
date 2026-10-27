/* BUKLOD_CLIENT_VERSION_TELEMETRY_R1 */
import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/providers/AuthProvider';
import { useNetwork } from '@/providers/NetworkProvider';
import { reportBuklodClientVersion } from '@/lib/buklodClientVersionTelemetry.native';

export default function BuklodClientVersionReporter() {
  const { user } = useAuth();
  const { online } = useNetwork();

  useEffect(() => {
    if (__DEV__ || !user?.id || !online) return;
    let mounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const userId = user.id;

    const schedule = () => {
      if (timer) clearTimeout(timer);
      // Jitter avoids a simultaneous login/foreground telemetry burst.
      timer = setTimeout(() => {
        timer = null;
        if (mounted) void reportBuklodClientVersion(userId);
      }, 8_000 + Math.floor(Math.random() * 12_000));
    };

    schedule();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') schedule();
      else if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    });

    return () => {
      mounted = false;
      subscription.remove();
      if (timer) clearTimeout(timer);
    };
  }, [user?.id, online]);

  return null;
}
