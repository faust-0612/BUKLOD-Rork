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
export default function BuklodHomeDestinations() {
  const { theme } = useBuklodTheme();
  const { width, fontScale } = useWindowDimensions();
  const columns = buklodVisualColumns(width, fontScale);
  return <View accessibilityLabel="Everyday essentials" style={{ gap: 8 }}>
    <Text allowFontScaling style={{ color: theme.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>EVERYDAY ESSENTIALS</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {destinations.map(item => <Pressable key={item.route} accessibilityRole="button" accessibilityLabel={item.title}
        onPress={() => router.navigate(item.route as any)}
        style={({ pressed }) => ({ width: columns === 1 ? '100%' : columns === 2 ? '48%' : '31%', flexGrow: 1,
          minHeight: 80, borderRadius: buklodVisual.radius.card, padding: 12, gap: 6,
          borderWidth: 1, borderColor: theme.border, backgroundColor: pressed ? theme.accentSoft : theme.surface })}>
        <MaterialCommunityIcons name={item.icon} size={22} color={theme.accent} />
        <Text allowFontScaling style={{ color: theme.textPrimary, fontSize: 15, fontWeight: '700' }}>{item.title}</Text>
        <Text allowFontScaling style={{ color: theme.textMuted, fontSize: 12 }}>{item.detail}</Text>
      </Pressable>)}
    </View>
  </View>;
}
