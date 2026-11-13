import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';
import { findBuklodNavigationHelp } from '@/lib/buklodNavHelp';

/** Searchable offline Help is optional: no mandatory tour, network or AI request. */
export default function BuklodNavigationHelpScreen() {
  const { theme } = useBuklodTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const matches = useMemo(() => findBuklodNavigationHelp(query), [query]);
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.canvas }}
      contentContainerStyle={{
        paddingTop: Math.max(insets.top, 12) + 4,
        paddingHorizontal: 14, paddingBottom: Math.max(insets.bottom, 16) + 24, gap: 10,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable accessibilityRole="button" accessibilityLabel="Back to Settings"
        onPress={() => router.canGoBack() ? router.back() : router.replace('/settings' as any)}
        style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <MaterialCommunityIcons name="arrow-left" size={23} color={theme.textPrimary} />
        <Text allowFontScaling style={{ color: theme.textPrimary, fontSize: 16, fontWeight: '800' }}>Back</Text>
      </Pressable>
      <Text allowFontScaling style={{ fontSize: 23, fontWeight: '900', color: theme.textPrimary }}>
        How to use BUKLOD
      </Text>
      <Text allowFontScaling style={{ color: theme.textSecondary, fontSize: 16, lineHeight: 23 }}>
        Five main destinations, short labels and optional shortcuts. This guide works without internet.
      </Text>
      <View style={{ minHeight: 52, flexDirection: 'row', gap: 8, alignItems: 'center', borderRadius: 12,
        paddingHorizontal: 12, backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }}>
        <MaterialCommunityIcons name="magnify" size={22} color={theme.accent} />
        <TextInput allowFontScaling value={query} onChangeText={setQuery} returnKeyType="search"
          accessibilityLabel="Search offline navigation help"
          placeholder="Search Help: GIF, password, offline..." placeholderTextColor={theme.textMuted}
          style={{ flex: 1, minHeight: 48, fontSize: 16, color: theme.textPrimary }} />
        {query.length > 0 && (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear Help search"
            onPress={() => setQuery('')}
            style={{ minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'center' }}>
            <MaterialCommunityIcons name="close-circle-outline" size={21} color={theme.textMuted} />
          </Pressable>
        )}
      </View>
      {matches.length === 0 && (
        <View accessibilityRole="alert" style={{ padding: 16, backgroundColor: theme.surface, borderRadius: 12 }}>
          <Text allowFontScaling style={{ color: theme.textSecondary, fontSize: 15 }}>
            No matching guide. Try another word or open Live Support.
          </Text>
        </View>
      )}
      <View style={{ borderRadius: 15, borderWidth: 1, borderColor: theme.border,
        overflow: 'hidden', backgroundColor: theme.surface }}>
        {matches.map((guide, index) => (
          <View key={guide.id} style={{
            minHeight: 65, flexDirection: 'row', alignItems: 'flex-start', gap: 12,
            borderTopWidth: index ? 1 : 0, borderTopColor: theme.border, padding: 13,
          }}>
            <MaterialCommunityIcons name={guide.icon} size={24} color={theme.accent} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text allowFontScaling style={{ fontSize: 17, fontWeight: '800', color: theme.textPrimary }}>
                {guide.title}
              </Text>
              <Text allowFontScaling style={{ fontSize: 15, lineHeight: 22, color: theme.textSecondary }}>
                {guide.body}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel={'Open ' + guide.title}
                onPress={() => router.push(guide.route as any)}
                style={{ minHeight: 48, alignSelf: 'flex-start', justifyContent: 'center', paddingRight: 16 }}>
                <Text allowFontScaling style={{ fontSize: 15, color: theme.accent, fontWeight: '700' }}>Open</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Open BUKLOD Live Support"
        onPress={() => router.push('/support/live' as any)}
        style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12 }}>
        <MaterialCommunityIcons name="lifebuoy" size={20} color={theme.accent} />
        <Text allowFontScaling style={{ fontSize: 16, color: theme.accent, fontWeight: '800' }}>
          Need help? Contact Live Support
        </Text>
      </Pressable>
    </ScrollView>
  );
}
