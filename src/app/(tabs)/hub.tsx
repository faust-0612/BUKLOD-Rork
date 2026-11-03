import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';
import BuklodFirstViewAd from '@/components/BuklodFirstViewAd';

// Factories execute only after the user opens a tool.
const Today = lazy(() => import('@/components/BuklodTodayCard'));
const Updates = lazy(() => import('@/components/home/BuklodHomeMergedUpdates'));
const DrawerCard = lazy(() => import('@/components/SmartDrawerWallCard'));
const PttCard = lazy(() => import('@/components/BuklodPttEntryButton'));
const Help = lazy(() => import('@/components/BuklodCommunityHelp'));
const Map = lazy(() => Platform.OS === 'web'
  ? import('@/components/BuklodWebCommunityMapHeader.web')
  : import('@/components/BuklodNativeCommunityMapHeader'));

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
  const [focused, setFocused] = useState(false);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => { setFocused(false); };
  }, []));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.surface }} contentContainerStyle={{ padding: 18, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: '800', color: theme.textPrimary }}>BUKLOD Home</Text>
      <Text style={{ color: theme.textPrimary }}>Mga kagamitan para sa araw-araw.</Text>
      <BuklodFirstViewAd placement="home" placementId="new_home_first_view" />
      {focused && foreground ? (
        <ToolBoundary onClose={() => {}}>
          <Suspense fallback={<ActivityIndicator accessibilityLabel="Loading Home cards" color={theme.accent} />}>
            <DrawerCard />
            <PttCard />
            <Today onRespond={draft => {
              router.push({ pathname: '/buklod', params: { homeTodayDraft: draft ?? '', homeTodayIntent: String(Date.now()) } });
            }} />
          </Suspense>
        </ToolBoundary>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Announcements, BUKLOD Quiz and Bulletins"
        accessibilityState={{ expanded: updatesOpen }}
        onPress={() => setUpdatesOpen(value => !value)}
        style={{
          borderRadius: 14,
          borderWidth: 1,
          borderColor: theme.navBorder,
          padding: 14,
          backgroundColor: theme.navBackground,
        }}
      >
        <Text style={{ color: theme.textPrimary, fontWeight: '800', fontSize: 16 }}>
          {updatesOpen ? 'Hide Updates, Quiz & Bulletins' : 'Open Updates, Quiz & Bulletins'}
        </Text>
      </Pressable>
      {focused && foreground && updatesOpen ? (
        <ToolBoundary onClose={() => setUpdatesOpen(false)}>
          <Suspense fallback={<ActivityIndicator accessibilityLabel="Loading announcements, Quiz and bulletins" color={theme.accent} />}>
            <Updates />
          </Suspense>
        </ToolBoundary>
      ) : null}
      {/* Preserve the map while Android permission dialogs or Google Maps
          temporarily put this app in the background. */}
      {focused ? (
        <ToolBoundary onClose={() => {}}>
          <Suspense fallback={<ActivityIndicator accessibilityLabel="Loading Home map" color={theme.accent} />}>
            <Map />
          </Suspense>
        </ToolBoundary>
      ) : null}
      {focused && foreground ? (
        <ToolBoundary onClose={() => {}}>
          <Suspense fallback={<ActivityIndicator accessibilityLabel="Loading Home SOS" color={theme.accent} />}>
            <Help />
          </Suspense>
        </ToolBoundary>
      ) : null}
      <Pressable accessibilityRole="button" onPress={() => router.replace('/buklod')}
        style={{ padding: 16, alignItems: 'center', borderRadius: 14, backgroundColor: theme.navActive }}>
        <Text style={{ color: theme.textPrimary, fontWeight: '700' }}>Return to Community Wall</Text>
      </Pressable>

    </ScrollView>
  );
}
