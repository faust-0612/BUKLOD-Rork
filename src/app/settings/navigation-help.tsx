import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';

const GUIDES = [
  { title: 'Home', icon: 'home-outline' as const, body: 'Find your everyday tools and pinned shortcuts. Type a task in Find a Feature to open it directly.' },
  { title: 'Cluster', icon: 'account-group-outline' as const, body: 'Open your Cluster, Organization or Community workspace. Check the workspace name before posting or chatting.' },
  { title: 'Wall', icon: 'view-dashboard-outline' as const, body: 'Read and share community posts. Tap the three-dot menu for less-used actions.' },
  { title: 'Connect', icon: 'message-text-outline' as const, body: 'Open chats, calls and group conversations. Your chat composer stays in its conversation.' },
  { title: 'Profile', icon: 'account-circle-outline' as const, body: 'Your identity, progress, communities and Focus Apps are here. Tap the gear for Settings, even if you hide Profile sections.' },
  { title: 'Shortcuts', icon: 'star-outline' as const, body: 'Find a Feature lets you pin up to four shortcuts. Tap its star icon, or long-press a result. Long-press is always optional.' },
  { title: 'Keyboard & accessibility', icon: 'keyboard-outline' as const, body: 'Use the font-size controls on your phone. BUKLOD inputs follow Android text scaling. Emoji, photos and available GIF options depend on the current composer.' },
];

/** Separated from the main UI: short optional reference, never a mandatory tour. */
export default function BuklodNavigationHelpScreen() {
  const { theme } = useBuklodTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.canvas }}
      contentContainerStyle={{
        paddingTop: Math.max(insets.top, 12) + 4,
        paddingHorizontal: 14, paddingBottom: Math.max(insets.bottom, 16) + 24, gap: 10,
      }}
    >
      <Pressable
        accessibilityRole="button" accessibilityLabel="Back to Settings"
        onPress={() => router.canGoBack() ? router.back() : router.replace('/settings' as any)}
        style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 }}
      >
        <MaterialCommunityIcons name="arrow-left" size={23} color={theme.textPrimary} />
        <Text allowFontScaling style={{ color: theme.textPrimary, fontSize: 16, fontWeight: '800' }}>Back</Text>
      </Pressable>
      <Text allowFontScaling style={{ fontSize: 23, fontWeight: '900', color: theme.textPrimary }}>How to use BUKLOD</Text>
      <Text allowFontScaling style={{ color: theme.textSecondary, fontSize: 16, lineHeight: 23 }}>
        Look for familiar icons and short labels. Everything you need is in five main destinations.
      </Text>
      <View style={{ borderRadius: 15, borderWidth: 1, borderColor: theme.border, overflow: 'hidden', backgroundColor: theme.surface }}>
        {GUIDES.map((guide, index) => (
          <View key={guide.title} style={{
            minHeight: 65, flexDirection: 'row', alignItems: 'flex-start', gap: 12,
            borderTopWidth: index ? 1 : 0, borderTopColor: theme.border, padding: 13,
          }}>
            <MaterialCommunityIcons name={guide.icon} size={24} color={theme.accent} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text allowFontScaling style={{ fontSize: 17, fontWeight: '800', color: theme.textPrimary }}>{guide.title}</Text>
              <Text allowFontScaling style={{ fontSize: 15, lineHeight: 22, color: theme.textSecondary }}>{guide.body}</Text>
            </View>
          </View>
        ))}
      </View>
      <Pressable
        accessibilityRole="button" accessibilityLabel="Open BUKLOD Live Support"
        onPress={() => router.push('/support/live' as any)}
        style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12 }}
      >
        <MaterialCommunityIcons name="lifebuoy" size={20} color={theme.accent} />
        <Text allowFontScaling style={{ fontSize: 16, color: theme.accent, fontWeight: '800' }}>Need help? Contact Live Support</Text>
      </Pressable>
    </ScrollView>
  );
}
