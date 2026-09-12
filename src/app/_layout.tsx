import '@/lib/performanceBoot';

import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import BuklodRootKeyboardAvoidingView from '@/components/BuklodRootKeyboardAvoidingView';
import { OfflineBanner } from '@/components/OfflineBanner';
import { colors } from '@/lib/theme';
import { AuthProvider } from '@/providers/AuthProvider';
import { BuklodScopeProvider } from '@/providers/BuklodScopeProvider';
import { BuklodThemeProvider } from '@/providers/BuklodThemeProvider';
import { ComplianceProvider } from '@/providers/ComplianceProvider';
import { NetworkProvider } from '@/providers/NetworkProvider';
import { RuntimeConfigProvider } from '@/providers/RuntimeConfigProvider';
import BuklodReportNotificationProvider from '@/providers/BuklodReportNotificationProvider';
import BuklodReportRouteGuard from '@/providers/BuklodReportRouteGuard';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.error}>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorText}>{error.message}</Text>
      <Pressable onPress={retry} style={styles.retry}>
        <Text style={styles.retryText}>TRY AGAIN</Text>
      </Pressable>
    </View>
  );
}

export function SuspenseFallback() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.green} />
      <Text style={styles.loadingText}>Loading BUKLOD Report…</Text>
    </View>
  );
}

/**
 * Standalone BUKLOD Report application shell.
 *
 * Shared account, compliance and runtime services are retained because Report
 * depends on canonical BUKLOD identity. The BuklodScopeProvider name resolves
 * to the standalone read-only Report scope context on this branch, so Report
 * never writes BUKLOD Main's active workspace. The route guard prevents legacy
 * Main route files or unapproved Report deep links from being opened.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <BuklodThemeProvider>
            <BuklodScopeProvider>
              <NetworkProvider>
                <ComplianceProvider>
                  <RuntimeConfigProvider>
                    <BuklodReportNotificationProvider>
                      <BuklodReportRouteGuard>
                        <BuklodRootKeyboardAvoidingView style={{ flex: 1 }}>
                          <OfflineBanner />
                          <Stack
                            screenOptions={{
                              headerShown: false,
                              animation: 'none',
                              contentStyle: { flex: 1 },
                            }}
                          >
                            <Stack.Screen name="index" />
                            <Stack.Screen name="report-login" />
                            <Stack.Screen name="report-access-pending" />
                            <Stack.Screen name="privacy/consent" />
                            <Stack.Screen name="system/maintenance" />
                            <Stack.Screen name="system/update-required" />
                            <Stack.Screen name="system/pilot-access" />
                            <Stack.Screen name="reports/index" />
                            <Stack.Screen name="reports/library" />
                            <Stack.Screen name="reports/definitions" />
                            <Stack.Screen name="reports/template-builder" />
                            <Stack.Screen name="reports/consolidated" />
                          </Stack>
                        </BuklodRootKeyboardAvoidingView>
                      </BuklodReportRouteGuard>
                    </BuklodReportNotificationProvider>
                  </RuntimeConfigProvider>
                </ComplianceProvider>
              </NetworkProvider>
            </BuklodScopeProvider>
          </BuklodThemeProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  loadingText: { marginTop: 8, color: colors.muted },
  error: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.white },
  errorTitle: { fontSize: 24, fontWeight: '900', color: colors.text },
  errorText: { marginTop: 8, textAlign: 'center', color: colors.muted },
  retry: { marginTop: 18, backgroundColor: colors.green, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12 },
  retryText: { color: colors.white, fontWeight: '900' },
});
