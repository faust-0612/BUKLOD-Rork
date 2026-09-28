import '@/lib/performanceBoot';

import { Stack } from 'expo-router';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { BuklodStandaloneTarget } from '@/lib/buklodStandaloneEntry';
import { AuthProvider } from '@/providers/AuthProvider';
import BuklodStandaloneSessionGate from '@/components/standalone/BuklodStandaloneSessionGate';

export default function BuklodStandaloneRootLayout({
  target,
}: {
  target: BuklodStandaloneTarget;
}) {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <BuklodStandaloneSessionGate target={target}>
            <Stack
              screenOptions={{
                headerShown: false,
                animation: 'none',
                contentStyle: { flex: 1 },
              }}
            />
          </BuklodStandaloneSessionGate>
        </AuthProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
