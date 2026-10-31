import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '@/providers/AuthProvider';
import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';
import BuklodUpdateRequiredPanel from '@/components/BuklodUpdateRequiredPanel';

/**
 * Root-only mandatory native version guard.
 * A route redirect inside Tabs misses deep-linked scopes and older restored
 * navigation. The root boundary leaves providers mounted for recovery while
 * denying interaction with every authenticated native destination.
 *
 * The cutoff remains server-controlled; do not enforce a higher floor here
 * before a verified APK/OTA is actually downloadable.
 */
export default function BuklodMandatoryUpdateBoundary({
  children,
}: {
  children: ReactNode;
}) {
  const { session } = useAuth();
  const { config } = useRuntimeConfig();
  if (Platform.OS !== 'web' && session && config?.update_required) {
    return <BuklodUpdateRequiredPanel />;
  }
  return <>{children}</>;
}
