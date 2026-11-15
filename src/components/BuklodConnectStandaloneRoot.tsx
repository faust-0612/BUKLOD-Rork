import React, { useEffect } from 'react';
import { Stack, router, usePathname } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { BuklodI18nProvider } from '@/providers/BuklodI18nProvider';
import { BuklodThemeProvider } from '@/providers/BuklodThemeProvider';
import { BuklodScopeProvider } from '@/providers/BuklodScopeProvider';
import { BuklodFeedbackProvider } from '@/providers/BuklodFeedbackProvider';
import { NetworkProvider } from '@/providers/NetworkProvider';
import { ComplianceProvider } from '@/providers/ComplianceProvider';
import { RuntimeConfigProvider } from '@/providers/RuntimeConfigProvider';
import { AdsProvider } from '@/providers/AdsProvider';
import { NotificationProvider } from '@/providers/NotificationProvider';
import { StreamVideoProvider } from '@/providers/StreamVideoProvider';
import BuklodRootKeyboardAvoidingView from '@/components/BuklodRootKeyboardAvoidingView';
import BuklodMandatoryUpdateBoundary from '@/components/BuklodMandatoryUpdateBoundary';
import { OfflineBanner } from '@/components/OfflineBanner';
import {
  isBuklodConnectAllowedPath,
  isBuklodConnectPublicPath,
} from '@/lib/buklodConnectStandalone';

/**
 * Independent navigation and startup, shared trusted backends. A URL guard is
 * presentation isolation only; authorization still comes from backend RLS.
 */
function ConnectStandaloneNavigator() {
  const pathname = usePathname();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!session && pathname !== '/' && !isBuklodConnectPublicPath(pathname)) {
      router.replace('/(auth)/login');
      return;
    }
    if (session && !isBuklodConnectAllowedPath(pathname)) {
      router.replace('/connect');
    }
  }, [pathname, session, loading]);

  return (
    <BuklodMandatoryUpdateBoundary>
      <View style={{ flex: 1, backgroundColor: '#F3F9E9' }}>
        <OfflineBanner />
        <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="connect/index" />
          <Stack.Screen name="connect/[id]" />
          <Stack.Screen name="connect/personal/[threadId]" />
          <Stack.Screen name="connect/community/[scopeId]" />
          <Stack.Screen name="personal-home/ptt" />
          <Stack.Screen name="account/security" />
          <Stack.Screen name="account/delete" />
          <Stack.Screen name="privacy/consent" />
          <Stack.Screen name="notifications/index" />
        </Stack>
      </View>
    </BuklodMandatoryUpdateBoundary>
  );
}

export default function BuklodConnectStandaloneRoot() {
  return (
    <SafeAreaProvider>
      <BuklodI18nProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <NetworkProvider>
            <AuthProvider>
              <BuklodThemeProvider>
                <BuklodScopeProvider>
                  <BuklodFeedbackProvider>
                    <ComplianceProvider>
                      <RuntimeConfigProvider>
                        <AdsProvider>
                          <NotificationProvider>
                            <StreamVideoProvider>
                              <BuklodRootKeyboardAvoidingView style={{ flex: 1 }}>
                                <ConnectStandaloneNavigator />
                              </BuklodRootKeyboardAvoidingView>
                            </StreamVideoProvider>
                          </NotificationProvider>
                        </AdsProvider>
                      </RuntimeConfigProvider>
                    </ComplianceProvider>
                  </BuklodFeedbackProvider>
                </BuklodScopeProvider>
              </BuklodThemeProvider>
            </AuthProvider>
          </NetworkProvider>
        </GestureHandlerRootView>
      </BuklodI18nProvider>
    </SafeAreaProvider>
  );
}
