import React, { lazy, Suspense, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';

// Factories execute only after the user opens a tool.
const Today = lazy(() => import('@/components/BuklodTodayCard'));
const Help = lazy(() => import('@/components/BuklodCommunityHelp'));
const Map = lazy(() => Platform.OS === 'web'
  ? import('@/components/BuklodWebCommunityMapHeader.web')
  : import('@/components/BuklodNativeCommunityMapHeader'));
type Tool = 'today' | 'map' | 'sos';
const shortcuts = [
  { label: 'Drawer', icon: 'view-dashboard-outline', route: '/drawer', tool: null },
  { label: 'PTT', icon: 'microphone-outline', route: '/personal-home/ptt', tool: null },
  { label: 'BUKLOD Today', icon: 'calendar-today', route: null, tool: 'today' },
  { label: 'Map', icon: 'map-outline', route: null, tool: 'map' },
  { label: 'SOS', icon: 'shield-alert-outline', route: null, tool: 'sos' },
] as const;

class ToolBoundary extends React.Component<{ children: React.ReactNode; onClose: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return (
      <Pressable accessibilityRole="button" onPress={this.props.onClose}>
        <Text>Hindi mabuksan ang tool. Isara at subukang muli.</Text>
      </Pressable>
    );
    return this.props.children;
  }
}

export default function BuklodLightHome() {
  const { theme } = useBuklodTheme();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [tool, setTool] = useState<Tool | null>(null);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);
  useEffect(() => { if (!focused) setTool(null); }, [focused]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.surface }} contentContainerStyle={{ padding: 18, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: '800', color: theme.textPrimary }}>BUKLOD Home</Text>
      <Text style={{ color: theme.textPrimary }}>Mga kagamitan para sa araw-araw.</Text>
      {shortcuts.map(item => (
        <Pressable key={item.label} accessibilityRole="button"
          onPress={() => { if (item.route) router.push(item.route); else setTool(item.tool); }}
          style={{ flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 14, backgroundColor: theme.canvas, gap: 14 }}>
          <MaterialCommunityIcons name={item.icon} size={24} color={theme.accent} />
          <Text style={{ fontSize: 16, color: theme.textPrimary, fontWeight: '600' }}>{item.label}</Text>
        </Pressable>
      ))}
      <Pressable accessibilityRole="button" onPress={() => router.replace('/buklod')}
        style={{ padding: 16, alignItems: 'center', borderRadius: 14, backgroundColor: theme.navActive }}>
        <Text style={{ color: theme.textPrimary, fontWeight: '700' }}>Return to Community Wall</Text>
      </Pressable>
      {focused && foreground && tool ? (
        <Modal visible animationType="slide" onRequestClose={() => setTool(null)}>
          <ScrollView style={{ flex: 1, backgroundColor: theme.surface }}
            contentContainerStyle={{ padding: 18, paddingTop: insets.top + 18, paddingBottom: insets.bottom + 18, gap: 18 }}>
            <Pressable accessibilityRole="button" onPress={() => setTool(null)}>
              <Text style={{ color: theme.textPrimary, fontWeight: '700' }}>Close</Text>
            </Pressable>
            <ToolBoundary key={tool} onClose={() => setTool(null)}>
              <Suspense fallback={<ActivityIndicator accessibilityLabel="Opening tool" color={theme.accent} />}>
                {tool === 'today' ? <Today onRespond={draft => {
                  setTool(null);
                  router.push({ pathname: '/buklod', params: { homeTodayDraft: draft ?? '', homeTodayIntent: String(Date.now()) } });
                }} /> : tool === 'map' ? <Map /> : <Help />}
              </Suspense>
            </ToolBoundary>
          </ScrollView>
        </Modal>
      ) : null}
    </ScrollView>
  );
}
