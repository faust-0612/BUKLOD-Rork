import BuklodDashboardContextBar from '@/components/BuklodDashboardContextBar';
import BuklodHeaderSponsor from '@/components/BuklodHeaderSponsor';
import {
  warmBuklodInterstitial,
} from '@/lib/buklodAds';
import {
  Redirect,
  Stack,
  usePathname,
} from 'expo-router';
import React, {
  useEffect,
} from 'react';
import {
  ActivityIndicator,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';

import { useAuth } from '@/providers/AuthProvider';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import { useCompliance } from '@/providers/ComplianceProvider';
import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';

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
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { theme } = useBuklodTheme();
  const pathname = usePathname();
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

  /*
   * Instant route switches with no swipe-between-tabs ViewPager.
   * Public/personal navigation is route-authoritative, with Community as the
   * canonical surface. BUKLOD Connect is entered from Community Wall and
   * Notification Center remains deep-linkable without a public nav shortcut.
   * Managed Organization/Cluster navigation remains owned by /scope.
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
          <Stack.Screen name="buklod" />
          <Stack.Screen name="home" />
          <Stack.Screen name="messages" />
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
