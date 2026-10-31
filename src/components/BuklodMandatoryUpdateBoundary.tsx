import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
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
  const blocked = Platform.OS !== 'web' && Boolean(session) && Boolean(config?.update_required);
  // Expo Router must keep the root navigator mounted even when an update
  // is mandatory. An overlay blocks all touches/deep-linked screens while
  // preserving the navigation context for the Check Again action.
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{ flex: 1 }}
        pointerEvents={blocked ? 'none' : 'auto'}
        accessibilityElementsHidden={blocked}
        importantForAccessibility={blocked ? 'no-hide-descendants' : 'auto'}
      >
        {children}
      </View>
      {blocked ? (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="auto">
          <BuklodUpdateRequiredPanel />
        </View>
      ) : null}
    </View>
  );
}
