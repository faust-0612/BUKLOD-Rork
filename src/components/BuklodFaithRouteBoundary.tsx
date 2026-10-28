import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect, Slot } from 'expo-router';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';

/**
 * Personal Show Faith opt-out applies to EVERY scope, including religious
 * organizations and admin roles. Do not mount faith screens while the
 * account's server-derived preference is OFF or cannot be resolved.
 */
export function BuklodFaithRouteBoundary({ children }: { children: React.ReactNode }) {
  const { activeScope, loading } = useBuklodScope();

  if (loading || !activeScope) {
    return (
      <View style={styles.waiting}>
        <ActivityIndicator color="#2F7A4F" />
        <Text style={styles.message}>Checking content preference…</Text>
      </View>
    );
  }

  if (!activeScope.show_faith_content) {
    return <Redirect href="/hub" />;
  }

  return <>{children}</>;
}

export default function BuklodFaithRouteLayout() {
  return (
    <BuklodFaithRouteBoundary>
      <Slot />
    </BuklodFaithRouteBoundary>
  );
}

const styles = StyleSheet.create({
  waiting: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  message: { color: '#50675A', fontSize: 13 },
});
