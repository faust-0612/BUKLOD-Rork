import { LinearGradient } from 'expo-linear-gradient';
import { buklodDashboardRoute, isBuklodDashboardScrollCompact, subscribeBuklodDashboardScroll } from '@/lib/buklodDashboardScroll';
import BuklodDashboardContextBar from '@/components/BuklodDashboardContextBar';
import BuklodHeaderSponsor from '@/components/BuklodHeaderSponsor';
import {
  Redirect,
  Stack,
  router,
  usePathname,
} from 'expo-router';
import React, {
  useEffect,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';

import { useAuth } from '@/providers/AuthProvider';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import { useNotifications } from '@/providers/NotificationProvider';
import { useCompliance } from '@/providers/ComplianceProvider';
import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';
import { isBuklodScopedWorkspacePath, normalizeBuklodPathname } from '@/lib/buklodSafeArea';
import {
  BUKLOD_DESKTOP_PUBLIC_FEED_MAX_WIDTH,
  shouldUseBuklodDesktopPublicFeed,
  shouldUseBuklodPublicDesktopShell,
} from '@/lib/buklodWebResponsivePolicy';
import { buildScopedWorkspacePath, isManagedCommunityScope } from '@/lib/buklodScopeRoute';

/*
 * BUKLOD_PUBLIC_CANONICAL_LANDING_R23
 *
 * When the tab group itself is restored (for example after an OTA reload),
 * Community Wall must be the first route instead of the retired Public Home.
 * Organization/Cluster workspaces remain route-owned by /scope.
 */
export const unstable_settings = {
  initialRouteName: 'buklod',
};

function SwipeDashboardHeader() {
  const pathname =
    usePathname();

  const insets =
    useSafeAreaInsets();

  const { theme } = useBuklodTheme();
  const { unreadCount, refreshUnread } = useNotifications();
  const route = buklodDashboardRoute(pathname);
  const [scrollCompact, setScrollCompact] = useState(() => isBuklodDashboardScrollCompact(route));
  useEffect(() => {
    setScrollCompact(isBuklodDashboardScrollCompact(route));
    return subscribeBuklodDashboardScroll((r, compact) => {
      if (r === route) setScrollCompact(compact);
    });
  }, [route]);
  const publicMinimal =
    !isBuklodScopedWorkspacePath(pathname);
  const badgeText =
    unreadCount > 99
      ? '99+'
      : String(unreadCount);

  useEffect(() => {
    if (publicMinimal) {
      void refreshUnread();
    }
  }, [publicMinimal, refreshUnread]);

  let title = 'Buklod';

  let placement:
    | 'home'
    | 'messages'
    | 'learn'
    | 'community'
    | 'me'
    | null = null;

  if (
    pathname === '/home' ||
    pathname.startsWith('/home/') ||
    pathname === '/hub'
  ) {
    title = 'Buklod';
    placement = 'home';
  } else if (
    pathname === '/messages' ||
    pathname.startsWith('/messages/')
  ) {
    title = 'Buklod';
    placement = null;
  } else if (
    pathname === '/learn' ||
    pathname.startsWith('/learn/')
  ) {
    title = 'Buklod';
    placement = 'learn';
  } else if (
    pathname === '/buklod' ||
    pathname.startsWith('/buklod/')
  ) {
    title = 'Buklod';
    placement = 'community';
  } else if (
    pathname === '/prayer' ||
    pathname.startsWith('/prayer/')
  ) {
    title = 'Buklod';
  } else if (
    pathname === '/me' ||
    pathname.startsWith('/me/')
  ) {
    title = 'Buklod';
  }

  return (
    <View
      style={{
        paddingTop: insets.top,
        minHeight: (scrollCompact ? 42 : 52) + insets.top,
        backgroundColor: theme.headerSurface,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 12,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      }}
    >
      <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9 }}>
        <LinearGradient colors={['#B8F756','#42CC54','#087440']}
          start={{x:0,y:0}} end={{x:1,y:1}}
          style={{width:scrollCompact?31:37,height:scrollCompact?31:37,borderRadius:12,alignItems:'center',justifyContent:'center'}}>
          <Text style={{color:'#FFFFFF',fontSize:scrollCompact?23:28,fontWeight:'900',fontStyle:'italic'}}>B</Text>
        </LinearGradient>
        <View style={{flex:1,minWidth:0}}>
          <Text numberOfLines={1} style={{color:theme.accent,fontSize:scrollCompact?22:25,
            lineHeight:scrollCompact?26:29,fontWeight:'900'}}>{title}</Text>
          {!scrollCompact ? <Text numberOfLines={1} style={{color:theme.textMuted,fontSize:8,
            fontWeight:'800',letterSpacing:0.8}}>KOMUNIDAD · KAIBIGAN · PAGLAGO</Text> : null}
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingRight: 10,
        }}
      >
        {placement ? (
          <BuklodHeaderSponsor
            placement={placement}
          />
        ) : (
          <View style={{ width: 12 }} />
        )}

        {publicMinimal ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                unreadCount > 0
                  ? `Notifications, ${unreadCount} unread`
                  : 'Notifications'
              }
              accessibilityHint="Opens the BUKLOD Notification Center"
              hitSlop={8}
              onPress={() =>
                router.push(
                  '/notifications' as any
                )
              }
              style={({ pressed }) => ({
                position: 'relative',
                width: 38,
                height: 38,
                borderRadius: 19,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.surface,
                opacity: pressed ? 0.72 : 1,
              })}
            >
              <MaterialCommunityIcons
                name="bell-outline"
                size={23}
                color={theme.textPrimary}
              />

              {unreadCount > 0 ? (
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    right: -4,
                    top: -5,
                    minWidth: 18,
                    height: 18,
                    paddingHorizontal: 4,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: theme.danger,
                    borderWidth: 2,
                    borderColor: theme.headerSurface,
                  }}
                >
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 8,
                      lineHeight: 10,
                      fontWeight: '900',
                    }}
                  >
                    {badgeText}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { theme } = useBuklodTheme();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const { activeScope } = useBuklodScope();
  const showPrayer = Boolean(
    activeScope?.show_faith_content
  );

  const {
    session,
    loading,
    profile,
  } = useAuth();
  const {
    requiresAcceptance,
  } = useCompliance();
  const {
    config,
  } = useRuntimeConfig();

  /*
   * BUKLOD_OFFLINE_RUNTIME_R1
   *
   * A full-screen boot indicator is reserved for the one state where BUKLOD
   * has no usable local identity yet. Runtime/compliance refreshes continue
   * behind the cached shell instead of blocking the entire tab workspace.
   */
  if (loading && !session) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.canvas,
        }}
      >
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }
  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }
  if (config?.maintenance_mode) {
    return <Redirect href="/system/maintenance" />;
  }
  if (config?.update_required) {
    return <Redirect href="/system/update-required" />;
  }
  if (
    config?.pilot_access_required &&
    !config?.pilot_access_granted
  ) {
    return <Redirect href="/system/pilot-access" />;
  }
  if (requiresAcceptance) {
    return <Redirect href="/privacy/consent" />;
  }

  /*
   * BUKLOD_LEGACY_VERIFICATION_REMOVAL_R22
   * Keep the authenticated tab shell aligned with src/app/index.tsx:
   * account/admin verification is not a global application gate.
   * Organization/Cluster membership and feature permissions stay local to
   * the features that require them. A missing profile still goes to the
   * actionable onboarding/profile-completion flow below.
   */
  if (!profile) {
    return <Redirect href="/onboarding" />;
  }

  /*
   * The old /home screen must never render again. Keep this alias so legacy
   * buttons, saved navigation state and OTA history reach one canonical Home.
   * Managed workspaces keep their scope-isolated Home destination.
   */
  if (pathname === '/home') {
    const destination = activeScope && isManagedCommunityScope(activeScope)
      ? buildScopedWorkspacePath('home', activeScope.scope_id)
      : '/(tabs)/hub';
    return <Redirect href={destination as any} />;
  }

  /*
   * Retired PUBLIC routes are compatibility aliases only. If an older OTA,
   * saved navigation state, or deep link restores Public Home/Prayer, send
   * the user to the canonical Community Wall. Do not apply this redirect to
   * Organization/Cluster scopes.
   */
  const publicLegacyRoute =
    activeScope?.scope_type === 'PUBLIC' &&
    (
      pathname === '/prayer' ||
      pathname.startsWith('/prayer/')
    );

  if (publicLegacyRoute) {
    return (
      <Redirect
        href="/(tabs)/buklod"
      />
    );
  }

  const tabSceneStyle = {
    backgroundColor: theme.surface,
    marginHorizontal: Platform.OS === 'web' ? 5 : 0,
    marginVertical: 0,
    borderRadius: Platform.OS === 'web' ? 18 : 0,
    overflow: 'hidden' as const,
  };

  // Public Home/Wall use a centered feed, without faux empty desktop rails.
  // Only the browser can enter this mode; APK/native layout is unchanged.
  const desktopWebShell = Platform.OS === 'web' &&
    shouldUseBuklodPublicDesktopShell(normalizeBuklodPathname(pathname), width);
  const desktopHome =
    Platform.OS === 'web' &&
    shouldUseBuklodDesktopPublicFeed(
      normalizeBuklodPathname(pathname),
      width,
    );

  const workspaceStack = (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'none',
        freezeOnBlur: true,
        contentStyle: tabSceneStyle,
      }}
    >
      <Stack.Screen name="buklod" />
      <Stack.Screen name="home" />
      <Stack.Screen name="hub" />
      <Stack.Screen name="messages" />
      {showPrayer ? (
        <Stack.Screen name="prayer" />
      ) : null}
      <Stack.Screen name="me" />
      <Stack.Screen name="learn" />
    </Stack>
  );

  /*
   * BUKLOD_DESKTOP_PUBLIC_FEED_SOURCE_R1
   * The public web shell deliberately owns the minimal global navigation;
   * this route layer owns only the Home/Community feed content width.
   *
   * Legacy 3-column placeholders were empty Views, not functional sidebars,
   * and could squeeze or duplicate desktop chrome. The workspace Stack stays
   * mounted exactly once across routes and screen sizes.
   */
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          flex: 1,
          backgroundColor: theme.canvas,
        }}
      >
        {!desktopWebShell ? <SwipeDashboardHeader /> : null}

        <View
          style={
            desktopHome
              ? {
                  flex: 1,
                  width: '100%',
                  maxWidth: BUKLOD_DESKTOP_PUBLIC_FEED_MAX_WIDTH,
                  alignSelf: 'center',
                  paddingHorizontal: 18,
                }
              : {
                  flex: 1,
                }
          }
        >
          <View
            key="workspace-center"
            style={{
              flex: 1,
              minWidth: 0,
            }}
          >
            <BuklodDashboardContextBar />
            {workspaceStack}
          </View>
        </View>
      </View>
    </View>
  );
}
