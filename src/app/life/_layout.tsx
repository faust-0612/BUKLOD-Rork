import React from 'react';
import { Slot } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useBuklodI18n } from '@/providers/BuklodI18nProvider';

/** Wait for a persisted locale before showing any LIFE copy. */
export default function BuklodLifeLayout() {
  const { ready } = useBuklodI18n();
  if (!ready) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAF7' }}>
      <ActivityIndicator color="#2F6946" accessibilityLabel="Loading LIFE language" />
    </View>
  );
  return <Slot />;
}
