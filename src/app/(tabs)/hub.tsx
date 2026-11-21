import { buklodVisual } from '@/lib/buklodVisual';
import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BUKLOD_DESKTOP_DASHBOARD_MIN_WIDTH } from '@/lib/buklodWebResponsivePolicy';
import { router, useFocusEffect } from 'expo-router';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';
import BuklodFirstViewAd from '@/components/BuklodFirstViewAd';
import {noteBuklodVideoScroll} from '@/lib/buklodVideoScrollSignal';
import BuklodNativeSponsoredCard from '@/components/BuklodNativeSponsoredCard';
import BuklodScreenBottomBanner from '@/components/BuklodScreenBottomBanner';
import { BuklodSystemAnnouncementBoard } from '@/components/BuklodSystemAnnouncementBoard';
import BuklodCommunitySponsoredAd from '@/components/BuklodCommunitySponsoredAd';
import BuklodHomeUtilityCards from '@/components/home/BuklodHomeUtilityCards';
import { reportBuklodDashboardScroll } from '@/lib/buklodDashboardScroll';
import BuklodExecutiveQuickAccess from '@/components/home/BuklodExecutiveQuickAccess';
import { GenesisHomeHero, GenesisCosmosBackground } from '@/features/season2/genesis/GenesisVisuals';
import { isGenesisPreviewBuild } from '@/features/season2/genesis/genesisContract';

// Factories execute only after the user opens a tool.
const Today = lazy(() => import('@/components/BuklodTodayCard'));
const Contribution = lazy(() => import('@/components/BuklodCommunityContributionCard'));
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
  const genesisPreview = isGenesisPreviewBuild();
  const [focused, setFocused] = useState(false);
  const [desktopToolsOpen, setDesktopToolsOpen] = useState(false);
  const { width } = useWindowDimensions();
  const desktopDashboard = Platform.OS === 'web' && width >= BUKLOD_DESKTOP_DASHBOARD_MIN_WIDTH;
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => { setFocused(false); };
  }, []));

  // Boot starts on the World map; its explicit Home door opens this real dashboard.
  // Do not redirect the user's Home tap back into the map.

  if (desktopDashboard) {
    const openPost = () => router.push({
      pathname: '/buklod' as any,
      params: { homeTodayIntent: String(Date.now()), homeTodayDraft: '' },
    } as any);
    return (
      <ScrollView
        onScroll={event => {reportBuklodDashboardScroll('home',event.nativeEvent.contentOffset.y);noteBuklodVideoScroll();}}
        scrollEventThrottle={16}
        style={{ flex: 1, backgroundColor: genesisPreview ? '#050A19' : theme.surface }}
        contentContainerStyle={{ paddingHorizontal: buklodVisual.space.screen, paddingVertical: 8, paddingBottom: 32, gap: 8 }}>
        {genesisPreview ? <GenesisCosmosBackground active={focused && foreground}/> : null}
{genesisPreview ? <GenesisHomeHero active={focused && foreground} onExplore={() => router.push('/games' as any)}/> : (
        <LinearGradient colors={['#0D5873', '#238B9D', '#95CCAD']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ minHeight: 86, borderRadius: buklodVisual.radius.card, padding: 14, justifyContent: 'center' }}>
          <Text style={{ fontSize: 24, fontWeight: '900', color: '#FFFFFF' }}>Welcome to BUKLOD!</Text>
          <Text style={{ fontSize: 12, marginTop: 4, color: '#FFFFFF' }}>
            A community of faith, connection, and shared purpose.
          </Text>
        </LinearGradient>
        )}
        {/* Desktop Home: approved paid ads share a persistent placement,
            independent of AdMob/legacy sidebar sponsors. */}
        <BuklodSystemAnnouncementBoard slot="public_home" />
        <BuklodCommunitySponsoredAd audience="public" placement="home" />
        <View style={{ gap: 10 }}>
          {foreground ? (
            <ToolBoundary onClose={() => {}}>
              <Suspense fallback={<ActivityIndicator color={theme.accent} accessibilityLabel="Loading Today's message" />}>
                <Today />
              </Suspense>
            </ToolBoundary>
          ) : null}
          <BuklodHomeUtilityCards />
      <BuklodNativeSponsoredCard surface="home" slotId="hub_mid_native" />
          <Pressable accessibilityRole="button" accessibilityLabel="Create a public Wall post"
            onPress={openPost} style={({ pressed }) => ({
              backgroundColor: theme.inputSurface, borderRadius: buklodVisual.radius.card,
              paddingHorizontal: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
              opacity: pressed ? 0.75 : 1,
            })}>
            <MaterialCommunityIcons name="pencil-outline" color={theme.accent} size={24} />
            <Text style={{ color: theme.textMuted, flex: 1 }}>Share something with the BUKLOD community...</Text>
            <MaterialCommunityIcons name="arrow-right-circle-outline" color={theme.accent} size={24} />
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Show home tools"
          accessibilityState={{ expanded: desktopToolsOpen }}
          onPress={() => setDesktopToolsOpen(v => !v)}
          style={{ backgroundColor: theme.accentSoft, borderRadius: buklodVisual.radius.card, padding: 14,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: theme.textPrimary, fontWeight: '900' }}>
            {desktopToolsOpen ? 'Hide Home Tools' : 'Open Home Tools: Drawer, PTT, Map & SOS'}
          </Text>
          <MaterialCommunityIcons name={desktopToolsOpen ? 'chevron-up' : 'chevron-down'} size={24} color={theme.accent} />
        </Pressable>
        {desktopToolsOpen && focused ? (
          <ToolBoundary onClose={() => setDesktopToolsOpen(false)}>
            <Suspense fallback={<ActivityIndicator color={theme.accent} />}>
              {foreground ? <><DrawerCard /><PttCard /></> : null}
              <Map />
              {foreground ? <Help /> : null}
            </Suspense>
          </ToolBoundary>
        ) : null}
        <BuklodFirstViewAd placement="home" placementId="new_home_first_view" />
      <BuklodScreenBottomBanner placement="home" variant="large" />
      </ScrollView>
    );
  }

  return (
    <ScrollView onScroll={event => {reportBuklodDashboardScroll('home',event.nativeEvent.contentOffset.y);noteBuklodVideoScroll();}} scrollEventThrottle={16} style={{ flex: 1, backgroundColor: genesisPreview ? '#050A19' : theme.surface }} contentContainerStyle={{ paddingHorizontal: buklodVisual.space.screen, paddingVertical: 9, paddingBottom: 16, gap: 9 }}>
      {genesisPreview ? <GenesisCosmosBackground active={focused && foreground}/> : null}
      <BuklodSystemAnnouncementBoard slot="public_home" />
{genesisPreview ? <GenesisHomeHero active={focused && foreground} onExplore={() => router.push('/games' as any)}/> : (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1 }}><Text allowFontScaling style={{ fontSize: 18, fontWeight: '900', color: theme.textPrimary }}>Your everyday space</Text>
        <Text allowFontScaling style={{ color: theme.textMuted, fontSize: 12, marginTop: 1 }}>Connect, learn and grow with BUKLOD.</Text></View>
        <MaterialCommunityIcons name="sprout-outline" size={22} color={theme.accent} />
      </View>
      )}
      <BuklodExecutiveQuickAccess active={focused && foreground} />
      {/* CANONICAL_HOME_CONTRIBUTION_R3: /hub is the active bottom-nav Home.
          Old /home redirects here; do not bury QMP in the retired screen. */}
      {foreground ? (
        <ToolBoundary onClose={() => {}}>
          <Suspense fallback={
            <View style={{padding:12,borderRadius:14,backgroundColor:theme.surface}}>
              <Text style={{color:theme.textPrimary,fontWeight:'800'}}>Your Community Contribution</Text>
              <Text style={{color:theme.textMuted,fontSize:12}}>Loading contribution…</Text>
            </View>
          }>
            <Contribution />
          </Suspense>
        </ToolBoundary>
      ) : null}
      <BuklodFirstViewAd placement="home" placementId="new_home_first_view" />
      {foreground ? (
        <ToolBoundary onClose={() => {}}>
          <Suspense fallback={<ActivityIndicator accessibilityLabel="Loading Home cards" color={theme.accent} />}>
            <DrawerCard />
            <PttCard />
            <Today />
          </Suspense>
        </ToolBoundary>
      ) : null}
      <BuklodHomeUtilityCards />
      <BuklodNativeSponsoredCard surface="home" slotId="hub_mid_native" />
      {/* Preserve the map while Android permission dialogs or Google Maps
          temporarily put this app in the background. */}
      {focused ? (
        <ToolBoundary onClose={() => {}}>
          <Suspense fallback={<ActivityIndicator accessibilityLabel="Loading Home map" color={theme.accent} />}>
            <Map />
          </Suspense>
        </ToolBoundary>
      ) : null}
      {foreground ? (
        <ToolBoundary onClose={() => {}}>
          <Suspense fallback={<ActivityIndicator accessibilityLabel="Loading Home SOS" color={theme.accent} />}>
            <Help />
          </Suspense>
        </ToolBoundary>
      ) : null}
      <BuklodScreenBottomBanner placement="home" variant="large" />
    </ScrollView>
  );
}
