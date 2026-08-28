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

      {placement ? (
        <BuklodHeaderSponsor
          placement={placement}
        />
      ) : (
        <View style={{ width: 12 }} />
      )}
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
    membershipState,
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
    (runtimeLoading && !config) ||
    (membershipState === 'loading' && !profile)
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

  const hasCommunityAccess =
    profile?.is_active === true &&
    !!profile?.connection_type;

  if (
    membershipState !== 'ready' &&
    !hasCommunityAccess
  ) {
    return <Redirect href="/onboarding" />;
  }

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
   * Instant tab switches (same path as Notifications → Community):
   * Stack + animation:none instead of Material Top Tab ViewPager.
   * Bottom nav is the primary tab control; swipe-between-tabs removed.
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
