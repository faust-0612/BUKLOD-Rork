import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { isBuklodConnectStandalone, shouldRequireBuklodNativeUpdate } from '@/lib/buklodConnectStandalone';
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
  const { config, refresh } = useRuntimeConfig();
  const blocked = Platform.OS !== 'web' && Boolean(session) && shouldRequireBuklodNativeUpdate(config);
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
          {isBuklodConnectStandalone ? (
          <View style={styles.connectUpdate}>
            <Text style={styles.connectTitle}>BUKLOD Connect update required</Text>
            <Text style={styles.connectCopy}>
              This Connect installation needs its own updated APK. Do not install the Main BUKLOD APK as a replacement.
            </Text>
            <Pressable accessibilityRole="button" style={styles.connectButton} onPress={() => void refresh()}>
              <Text style={styles.connectButtonText}>Check again</Text>
            </Pressable>
          </View>
        ) : (
          <BuklodUpdateRequiredPanel />
        )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  connectUpdate: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, backgroundColor: '#F3F9E9' },
  connectTitle: { fontSize: 23, color: '#1E3814', fontWeight: '900', textAlign: 'center' },
  connectCopy: { marginTop: 14, fontSize: 14, lineHeight: 21, color: '#4E6C3B', textAlign: 'center' },
  connectButton: { marginTop: 25, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 18, backgroundColor: '#68B516' },
  connectButtonText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
});
