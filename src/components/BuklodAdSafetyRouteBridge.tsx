import { usePathname } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import {
  setBuklodAdForeground,
  setBuklodAdRemoteFeatures,
  setBuklodAdRoute,
} from '@/lib/buklodGlobalAdController';
import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';

export default function BuklodAdSafetyRouteBridge() {
  const pathname = usePathname();
  const { config } = useRuntimeConfig();

  useEffect(() => {
    setBuklodAdRoute(pathname);
  }, [pathname]);

  useEffect(() => {
    setBuklodAdRemoteFeatures(config?.features);
  }, [config?.features]);

  useEffect(() => {
    setBuklodAdForeground(AppState.currentState === 'active');
    const sub = AppState.addEventListener('change', state => {
      setBuklodAdForeground(state === 'active');
    });
    return () => sub.remove();
  }, []);

  return null;
}
