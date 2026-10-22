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
} from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  useWindowDimensions,
  View,
  StatusBar,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';

import { useAuth } from '@/providers/AuthProvider';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import { useNotifications } from '@/providers/NotificationProvider';
import { useCompliance } from '@/providers/ComplianceProvider';
import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';
import { isBuklodScopedWorkspacePath } from '@/lib/buklodSafeArea';

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

  /* BUKLOD_V25_GREEN_TOP_TITLEBAR_R1: top title bar ONLY, on the two canonical screens. */
  const greenTopTitlebar = pathname === '/buklod' || pathname === '/me';

  const insets =
    useSafeAreaInsets();

  const { theme } = useBuklodTheme();
  const { unreadCount, refreshUnread } = useNotifications();
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
    pathname.startsWith('/home/')
  ) {
    title = 'Buklod';
    placement = null;
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
        minHeight: 54 + insets.top,
        backgroundColor: greenTopTitlebar ? '#087C3B' : theme.headerSurface,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 16,
      }}
    >
      {greenTopTitlebar && Platform.OS === 'android' ? (
        <StatusBar barStyle="light-content" backgroundColor="#087C3B" />
      ) : null}
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          color: greenTopTitlebar ? '#FFFFFF' : theme.accent,
          fontSize: 26,
          fontWeight: '900',
        }}
      >
        {title}
      </Text>

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
                backgroundColor: greenTopTitlebar ? 'rgba(255,255,255,0.18)' : theme.surface,
                opacity: pressed ? 0.72 : 1,
              })}
            >
              <MaterialCommunityIcons
                name="dots-horizontal"
                size={24}
                color={greenTopTitlebar ? '#FFFFFF' : theme.textPrimary}
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
                    borderColor: greenTopTitlebar ? '#087C3B' : theme.headerSurface,
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
    loading: complianceLoading,
    requiresAcceptance,
  } = useCompliance();
  const {
    loading: runtimeLoading,
    config,
  } = useRuntimeConfig();


  /*
   * BUKLOD_GLOBAL_BOOT_R20
   *
   * Keep auth/compliance/runtime gates authoritative.
   * R20 bounds their provider wait time instead of bypassing them.
   */
  if (
    (loading && !session && !profile) ||
    (complianceLoading && !session) ||
    (runtimeLoading && !config)
  ) {
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
   * Retired PUBLIC routes are compatibility aliases only. If an older OTA,
   * saved navigation state, or deep link restores Public Home/Prayer, send
   * the user to the canonical Community Wall. Do not apply this redirect to
   * Organization/Cluster scopes.
   */
  const publicLegacyRoute =
    activeScope?.scope_type === 'PUBLIC' &&
    (
      pathname === '/home' ||
      pathname.startsWith('/home/') ||
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
    marginHorizontal: 5,
    marginVertical: 3,
    borderRadius: 18,
    overflow: 'hidden' as const,
  };

  const desktopHome =
    Platform.OS === 'web' &&
    width >= 1200 &&
    (
      pathname === '/home' ||
      pathname.startsWith('/home/') ||
      pathname === '/buklod' ||
      pathname.startsWith('/buklod/')
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
      <Stack.Screen name="messages" />
      {showPrayer ? (
        <Stack.Screen name="prayer" />
      ) : null}
      <Stack.Screen name="me" />
      <Stack.Screen name="learn" />
    </Stack>
  );

  /*
   * BUKLOD_DESKTOP_HOME_3COL_R2
   * Desktop Community/Home only: reserve narrow left/right rails and keep the
   * existing dashboard intact in a wider center column. The workspace/navigation
   * tree stays mounted while route changes occur, preventing tab-state resets.
   * Mobile/tablet receives no desktop rail styling.
   */
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          flex: 1,
          backgroundColor: theme.canvas,
        }}
      >
        <SwipeDashboardHeader />

        <View
          style={
            desktopHome
              ? {
                  flex: 1,
                  width: '100%',
                  maxWidth: 1680,
                  alignSelf: 'center',
                  flexDirection: 'row',
                  alignItems: 'stretch',
                  paddingHorizontal: 18,
                  gap: 18,
                }
              : {
                  flex: 1,
                }
          }
        >
          {desktopHome ? (
            <View
              key="desktop-left-rail"
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{
                flex: 1,
                minWidth: 0,
              }}
            />
          ) : null}

          <View
            key="workspace-center"
            {...(
              Platform.OS === 'web'
                ? ({ 'google-side-rail-overlap': 'false' } as any)
                : {}
            )}
            style={{
              flex: desktopHome ? 2.8 : 1,
              minWidth: 0,
            }}
          >
            <BuklodDashboardContextBar />
            {workspaceStack}
          </View>

          {desktopHome ? (
            <View
              key="desktop-right-rail"
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{
                flex: 1,
                minWidth: 0,
              }}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}
