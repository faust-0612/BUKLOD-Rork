import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import KlReaderScreen from '@/components/kabihasnang-ligaw/KlReaderScreen';
import KlDynamicLibrary from '@/components/kabihasnang-ligaw/KlDynamicLibrary';
import KlDashboardHome from '@/components/kabihasnang-ligaw/KlDashboardHome';

export default function KabihasnangLigawScreen() {
  const [seasonNumber, setSeasonNumber] = useState<number | null>(null);
  const insets = useSafeAreaInsets();
  if (seasonNumber === null) {
    return <>
      <Stack.Screen options={{ title: 'Kabihasnang Ligaw' }} />
      <KlDashboardHome onOpenSeries={setSeasonNumber} />
    </>;
  }
  if (seasonNumber === 1) {
    return <KlReaderScreen onBackToDashboard={() => setSeasonNumber(null)} />;
  }
  return <>
    <Stack.Screen options={{ title: `KL · Serye ${seasonNumber}` }} />
    <ScrollView style={{ flex: 1, backgroundColor: '#121e26' }}
      contentContainerStyle={{ paddingHorizontal: 16,
        paddingTop: Math.max(12, insets.top + 8), paddingBottom: Math.max(32, insets.bottom + 16) }}>
      <KlDynamicLibrary key={seasonNumber} seasonNumber={seasonNumber}
        onBackToDashboard={() => setSeasonNumber(null)} />
    </ScrollView>
  </>;
}
