import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StatusBar, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import BuklodFeatureFinder from '@/components/BuklodFeatureFinder';

export default function BuklodFeatureSearchScreen() {
  const { theme } = useBuklodTheme();
  const { session, loading } = useAuth();
  const insets = useSafeAreaInsets();
  if (loading && !session) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.canvas }}>
      <ActivityIndicator color={theme.accent} accessibilityLabel="Opening feature search" />
    </View>;
  }
  if (!session) return <Redirect href="/(auth)/login" />;
  const darkTheme = theme.canvas.toLowerCase() === '#0a0f0d' ||
    theme.canvas.toLowerCase() === '#121212' ||
    theme.canvas.toLowerCase() === '#0d1117';
  return (
    <View style={{ flex: 1, backgroundColor: theme.canvas }}>
      <StatusBar barStyle={darkTheme ? 'light-content' : 'dark-content'} backgroundColor={theme.canvas} />
      <View style={{ paddingTop: Math.max(insets.top, 6), flexDirection: 'row',
        alignItems: 'center', paddingHorizontal: 12, paddingBottom: 7, gap: 9 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back from feature search"
          onPress={() => router.canGoBack() ? router.back() : router.replace('/hub' as any)}
          style={{ minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' }}>
          <MaterialCommunityIcons name="arrow-left" size={25} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text allowFontScaling style={{ color: theme.textPrimary, fontSize: 20, fontWeight: '900' }}>
            Search BUKLOD
          </Text>
          <Text allowFontScaling style={{ color: theme.textMuted, fontSize: 12 }}>
            Find features instantly, even offline
          </Text>
        </View>
      </View>
      <ScrollView keyboardShouldPersistTaps="always" keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingTop: 8, paddingBottom: Math.max(insets.bottom, 16) + 28 }}>
        <BuklodFeatureFinder autoFocus showSuggestions />
      </ScrollView>
    </View>
  );
}
