import React from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';

/** Lightweight, on-demand shortcuts. No feed, map, audio, or SOS modules mount here. */
const shortcuts = [
  { label: 'Drawer', icon: 'view-dashboard-outline', route: '/drawer' },
  { label: 'PTT', icon: 'microphone-outline', route: '/ptt' },
  { label: 'BUKLOD Today', icon: 'calendar-today', route: '/today' },
  { label: 'Map', icon: 'map-outline', route: '/map' },
  { label: 'SOS', icon: 'shield-alert-outline', route: '/sos' },
] as const;

export default function BuklodLightHome() {
  const { theme } = useBuklodTheme();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.surface }} contentContainerStyle={{ padding: 18, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: '800', color: theme.textPrimary }}>BUKLOD Home</Text>
      <Text style={{ color: theme.textPrimary }}>Open tools only when needed. Community Wall remains the default destination.</Text>
      {shortcuts.map(item => (
        <Pressable key={item.label} accessibilityRole="button" onPress={() => router.push(item.route as any)}
          style={{ flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 14, backgroundColor: theme.canvas, gap: 14 }}>
          <MaterialCommunityIcons name={item.icon} size={24} color={theme.accent} />
          <Text style={{ fontSize: 16, color: theme.textPrimary, fontWeight: '600' }}>{item.label}</Text>
        </Pressable>
      ))}
      <Pressable accessibilityRole="button" onPress={() => router.replace('/buklod' as any)}
        style={{ padding: 16, alignItems: 'center', borderRadius: 14, backgroundColor: theme.navActive }}>
        <Text style={{ color: theme.textPrimary, fontWeight: '700' }}>Return to Community Wall</Text>
      </Pressable>
    </ScrollView>
  );
}
