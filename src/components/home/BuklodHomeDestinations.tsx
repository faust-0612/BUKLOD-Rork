import React from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';
import { buklodVisual, buklodVisualColumns } from '@/lib/buklodVisual';
const destinations = [
  { title: 'Community', detail: 'Posts & stories', icon: 'account-group-outline', route: '/buklod' },
  { title: 'Connect', detail: 'Chats & calls', icon: 'message-outline', route: '/messages' },
  { title: 'Bible', detail: 'Read & reflect', icon: 'book-open-page-variant-outline', route: '/bible' },
  { title: 'My Cluster', detail: 'Your community', icon: 'account-multiple-outline', route: '/clusters' },
  { title: 'My Drawer', detail: 'Notes & files', icon: 'folder-outline', route: '/drawer' },
  { title: 'My Profile', detail: 'Account & tools', icon: 'account-circle-outline', route: '/me' },
] as const;
/** Two-column touch-safe quick launchers on phones; grow to one column
 * for very narrow layouts or extremely large accessibility fonts. */
export default function BuklodHomeDestinations() {
  const { theme } = useBuklodTheme();
  const { width, fontScale } = useWindowDimensions();
  const suggestedColumns = buklodVisualColumns(width, fontScale);
  const columns = width >= 360 && fontScale < 1.8
    ? Math.max(2, suggestedColumns) : suggestedColumns;
  const columnWidth = columns === 1 ? '100%' : columns === 2 ? '48%' : '31%';
  return (
    <View accessibilityLabel="Everyday essentials" style={{ gap: 7 }}>
      <Text allowFontScaling style={{ color: theme.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 0.7 }}>QUICK ACCESS</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {destinations.map(item => (
          <Pressable key={item.route} accessibilityRole="button"
            accessibilityLabel={item.title} accessibilityHint={item.detail}
            onPress={() => router.navigate(item.route as any)}
            style={({ pressed }) => ({
              width: columnWidth, flexGrow: 1, minWidth: 0,
              minHeight: buklodVisual.size.touch + 6, paddingVertical: 9,
              paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 9,
              borderRadius: buklodVisual.radius.control, borderWidth: 1, borderColor: theme.border,
              backgroundColor: pressed ? theme.accentSoft : theme.surface,
            })}>
            <MaterialCommunityIcons name={item.icon} size={21} color={theme.accent} />
            <Text allowFontScaling numberOfLines={2}
              style={{ color: theme.textPrimary, fontSize: 14, fontWeight: '800', flexShrink: 1 }}>{item.title}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
