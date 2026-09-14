import BuklodDashboardContextBar from '@/components/BuklodDashboardContextBar';
import BuklodHeaderSponsor from '@/components/BuklodHeaderSponsor';
import {
  warmBuklodInterstitial,
} from '@/lib/buklodAds';
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
  Pressable,
  Text,
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

function SwipeDashboardHeader() {
  const pathname =
    usePathname();

  const insets =
    useSafeAreaInsets();

  const { theme } = useBuklodTheme();
  const { activeScope } = useBuklodScope();
  const { unreadCount } = useNotifications();
  const publicMinimal =
    activeScope?.scope_type === 'PUBLIC';
  const badgeText =
    unreadCount > 99
      ? '99+'
      : String(unreadCount);

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
        minHeight: 54 + insets.top,
        backgroundColor: theme.headerSurface,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 16,
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          color: theme.accent,
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
              name="dots-horizontal"
              size={24}
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
        ) : null}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { theme } = useBuklodTheme();
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

  useEffect(() => {
    warmBuklodInterstitial();
  }, []);

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

  const tabSceneStyle = {
    backgroundColor: theme.surface,
    marginHorizontal: 5,
    marginVertical: 3,
    borderRadius: 18,
    overflow: 'hidden' as const,
  };

  /*
   * Instant route switches with no swipe-between-tabs ViewPager.
   * PUBLIC uses Community as its canonical surface, with lightweight header
   * utilities such as the three-dot Notification Center shortcut. Managed
   * Organization/Cluster navigation remains owned by its scoped workspace.
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
        <BuklodDashboardContextBar />

        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'none',
            freezeOnBlur: true,
            contentStyle: tabSceneStyle,
          }}
        >
          <Stack.Screen name="home" />
          <Stack.Screen name="messages" />
          <Stack.Screen name="buklod" />
          {showPrayer ? (
            <Stack.Screen name="prayer" />
          ) : null}
          <Stack.Screen name="me" />
          <Stack.Screen name="learn" />
        </Stack>
      </View>
    </View>
  );
}
