import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BUKLOD_DESKTOP_DASHBOARD_MIN_WIDTH } from '@/lib/buklodWebResponsivePolicy';
import { router, useFocusEffect } from 'expo-router';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';
import BuklodFirstViewAd from '@/components/BuklodFirstViewAd';
import BuklodNativeSponsoredCard from '@/components/BuklodNativeSponsoredCard';
import BuklodScreenBottomBanner from '@/components/BuklodScreenBottomBanner';
import BuklodCommunitySponsoredAd from '@/components/BuklodCommunitySponsoredAd';
import BuklodHomeUtilityCards from '@/components/home/BuklodHomeUtilityCards';
import { reportBuklodDashboardScroll } from '@/lib/buklodDashboardScroll';
import BuklodKingdomHubCard from '@/components/home/BuklodKingdomHubCard';

// Factories execute only after the user opens a tool.
const Today = lazy(() => import('@/components/BuklodTodayCard'));
const Contribution = lazy(() => import('@/components/BuklodCommunityContributionCard'));
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

  if (desktopDashboard) {
    const openPost = () => router.push({
      pathname: '/buklod' as any,
      params: { homeTodayIntent: String(Date.now()), homeTodayDraft: '' },
    } as any);
    const openRoute = (path: string) => router.push(path as any);
    const actions = [
      { label: 'Create Post', icon: 'pencil-outline', path: '', action: openPost },
      { label: 'Join Cluster', icon: 'account-group-outline', path: '/clusters', action: () => openRoute('/clusters') },
      { label: 'Connect', icon: 'message-outline', path: '/messages', action: () => openRoute('/messages') },
      { label: 'Contribute', icon: 'heart-outline', path: '/community-contribution', action: () => openRoute('/community-contribution') },
      { label: 'Daily Reading', icon: 'book-open-variant', path: '/bible', action: () => router.push('/bible' as any) },
    ] as const;
    return (
      <ScrollView
        onScroll={event => reportBuklodDashboardScroll('home', event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={64}
        style={{ flex: 1, backgroundColor: theme.surface }}
        contentContainerStyle={{ paddingHorizontal: 0, paddingVertical: 8, paddingBottom: 32, gap: 8 }}>
        <LinearGradient colors={['#0D5873', '#238B9D', '#95CCAD']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ minHeight: 112, borderRadius: 4, padding: 20, justifyContent: 'center' }}>
          <Text style={{ fontSize: 24, fontWeight: '900', color: '#FFFFFF' }}>Welcome to BUKLOD!</Text>
          <Text style={{ fontSize: 12, marginTop: 4, color: '#FFFFFF' }}>
            A community of faith, connection, and shared purpose.
          </Text>
        </LinearGradient>
        {/* Desktop Home: approved paid ads share a persistent placement,
            independent of AdMob/legacy sidebar sponsors. */}
        <BuklodCommunitySponsoredAd audience="public" placement="home" />
        <Text style={{ color: theme.textPrimary, fontWeight: '900', fontSize: 16 }}>Quick Actions</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {actions.map(item => (
            <Pressable key={item.label} accessibilityRole="button"
              accessibilityLabel={item.label} onPress={item.action}
              style={({ pressed }) => ({
                width: 112, minHeight: 72, borderRadius: 4, padding: 9,
                alignItems: 'center', justifyContent: 'center', gap: 7,
                backgroundColor: theme.accentSoft, opacity: pressed ? 0.75 : 1,
              })}>
              <MaterialCommunityIcons name={item.icon} color={theme.accent} size={23} />
              <Text style={{ color: theme.textPrimary, fontWeight: '800', fontSize: 11, textAlign: 'center' }}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={{ gap: 10 }}>
          {foreground ? (
            <ToolBoundary onClose={() => {}}>
              <Suspense fallback={<ActivityIndicator color={theme.accent} accessibilityLabel="Loading Today's message" />}>
                <Today onRespond={draft => {
                  router.push({ pathname: '/buklod', params: { homeTodayDraft: draft ?? '', homeTodayIntent: String(Date.now()) } });
                }} />
              </Suspense>
            </ToolBoundary>
          ) : null}
          <BuklodHomeUtilityCards />
      <BuklodNativeSponsoredCard surface="home" slotId="hub_mid_native" />
          <Pressable accessibilityRole="button" accessibilityLabel="Create a public Wall post"
            onPress={openPost} style={({ pressed }) => ({
              backgroundColor: theme.inputSurface, borderRadius: 4,
              paddingHorizontal: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
              opacity: pressed ? 0.75 : 1,
            })}>
            <MaterialCommunityIcons name="pencil-outline" color={theme.accent} size={24} />
            <Text style={{ color: theme.textMuted, flex: 1 }}>Share something with the BUKLOD community...</Text>
            <MaterialCommunityIcons name="arrow-right-circle-outline" color={theme.accent} size={24} />
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Open announcements, Quiz and Bulletins"
          accessibilityState={{ expanded: updatesOpen }}
          onPress={() => setUpdatesOpen(value => !value)}
          style={{ borderRadius: 4, padding: 14, backgroundColor: theme.accentSoft,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: theme.textPrimary, fontWeight: '900' }}>
            {updatesOpen ? 'Hide Announcements, Quiz & Bulletins' : 'Announcements, Quiz & Bulletins'}
          </Text>
          <MaterialCommunityIcons name={updatesOpen ? 'chevron-up' : 'chevron-down'}
            size={23} color={theme.accent} />
        </Pressable>
        {focused && foreground && updatesOpen ? (
          <ToolBoundary onClose={() => setUpdatesOpen(false)}>
            <Suspense fallback={<ActivityIndicator color={theme.accent} />}>
              <Updates />
            </Suspense>
          </ToolBoundary>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Open the Community Wall"
          onPress={() => router.push('/buklod')}
          style={{ padding: 16, backgroundColor: theme.surface, borderRadius: 4,
            borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <MaterialCommunityIcons name="post-outline" size={26} color={theme.accent} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '900', fontSize: 16, color: theme.textPrimary }}>Community Wall</Text>
            <Text style={{ color: theme.textMuted, fontSize: 12 }}>Open the live feed, photos, videos and conversations.</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={25} color={theme.accent} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Show home tools"
          accessibilityState={{ expanded: desktopToolsOpen }}
          onPress={() => setDesktopToolsOpen(v => !v)}
          style={{ backgroundColor: theme.accentSoft, borderRadius: 4, padding: 14,
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
        <BuklodKingdomHubCard />
      <BuklodScreenBottomBanner placement="home" variant="large" />
      </ScrollView>
    );
  }

  return (
    <ScrollView onScroll={event => reportBuklodDashboardScroll('home', event.nativeEvent.contentOffset.y)} scrollEventThrottle={64} style={{ flex: 1, backgroundColor: theme.surface }} contentContainerStyle={{ paddingHorizontal: 0, paddingVertical: 8, paddingBottom: 28, gap: 8 }}>
      <Text style={{ fontSize: 24, fontWeight: '800', color: theme.textPrimary }}>BUKLOD Home</Text>
      <Text style={{ color: theme.textPrimary }}>Mga kagamitan para sa araw-araw.</Text>
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
            <Today onRespond={draft => {
              router.push({ pathname: '/buklod', params: { homeTodayDraft: draft ?? '', homeTodayIntent: String(Date.now()) } });
            }} />
          </Suspense>
        </ToolBoundary>
      ) : null}
      <BuklodHomeUtilityCards />
      <BuklodNativeSponsoredCard surface="home" slotId="hub_mid_native" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Announcements, BUKLOD Quiz and Bulletins"
        accessibilityState={{ expanded: updatesOpen }}
        onPress={() => setUpdatesOpen(value => !value)}
        style={{
          borderRadius: 4,
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
      {foreground ? (
        <ToolBoundary onClose={() => {}}>
          <Suspense fallback={<ActivityIndicator accessibilityLabel="Loading Home SOS" color={theme.accent} />}>
            <Help />
          </Suspense>
        </ToolBoundary>
      ) : null}
      <Pressable accessibilityRole="button" onPress={() => router.replace('/buklod')}
        style={{ padding: 16, alignItems: 'center', borderRadius: 4, backgroundColor: theme.navActive }}>
        <Text style={{ color: theme.textPrimary, fontWeight: '700' }}>Return to Community Wall</Text>
      </Pressable>
      <BuklodKingdomHubCard />
      <BuklodScreenBottomBanner placement="home" variant="large" />
    </ScrollView>
  );
}
