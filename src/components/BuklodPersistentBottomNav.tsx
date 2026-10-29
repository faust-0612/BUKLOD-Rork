import React from 'react';

import {
  Alert,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  usePathname,
} from 'expo-router';

import BuklodPressable from '@/components/BuklodPressable';
import {
  buklodInstantReplace,
} from '@/lib/buklodInstantNavigation';
import { rememberBuklodRoute } from '@/lib/buklodRouteDiagnostics';

import {
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  useAuth,
} from '@/providers/AuthProvider';

import {
  useBuklodScope,
} from '@/providers/BuklodScopeProvider';

import {
  useBuklodTheme,
} from '@/providers/BuklodThemeProvider';

import {
  normalizeBuklodPathname,
  shouldShowBuklodPublicBottomNav,
} from '@/lib/buklodSafeArea';

/* PATCH_167I_R2_PROFILE_SLOT_TO_NOTIFICATIONS */

type NavKey = 'home' | 'cluster' | 'community' | 'connect' | 'profile';
type NavItem = {
  key: NavKey;
  route: '/hub' | '/clusters' | '/buklod' | '/messages' | '/me';
  icon: 'home-variant-outline' | 'account-group-outline' | 'forum-outline' | 'message-processing-outline' | 'account-outline';
  label: string;
};
const BASE_ITEMS: NavItem[] = [
  { key: 'home', route: '/hub', icon: 'home-variant-outline', label: 'Home' },
  { key: 'cluster', route: '/clusters', icon: 'account-group-outline', label: 'Cluster' },
  { key: 'community', route: '/buklod', icon: 'forum-outline', label: 'Wall' },
  { key: 'connect', route: '/messages', icon: 'message-processing-outline', label: 'Connect' },
  { key: 'profile', route: '/me', icon: 'account-outline', label: 'Profile' },
];

function routeKey(pathname: string): NavKey | null {
  if (pathname === '/hub') return 'home';
  if (pathname === '/clusters') return 'cluster';
  if (pathname === '/buklod' || pathname.startsWith('/post/')) return 'community';
  if (pathname === '/messages' || pathname.startsWith('/messages/') || pathname === '/connect' || pathname.startsWith('/connect/')) return 'connect';
  if (pathname === '/me') return 'profile';
  return null;
}
function isOnGlobalNavDestination(pathname: string, route: NavItem['route']) {
  return pathname === route;
}

export default function
BuklodPersistentBottomNav() {
  /* PATCH_167K_HIDE_NAV_ON_KEYBOARD */
  const [keyboardVisible, setKeyboardVisible] =
    React.useState(false);
  const [pendingRoute, setPendingRoute] =
    React.useState<
      NavItem['route'] | null
    >(null);

  React.useEffect(() => {
    const showSubscription =
      Keyboard.addListener(
        'keyboardDidShow',
        () => {
          setKeyboardVisible(true);
        }
      );

    const hideSubscription =
      Keyboard.addListener(
        'keyboardDidHide',
        () => {
          setKeyboardVisible(false);
        }
      );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);
  const pathname =
    usePathname();

  const normalizedPath =
    normalizeBuklodPathname(pathname);

  React.useEffect(() => {
    if (
      pendingRoute &&
      isOnGlobalNavDestination(
        normalizedPath,
        pendingRoute
      )
    ) {
      setPendingRoute(null);
    }
  }, [
    normalizedPath,
    pendingRoute,
  ]);

  const insets =
    useSafeAreaInsets();

  const {
    session,
    profile,
  } =
    useAuth();

  const {
    activeScope,
    scopes,
    selectScope,
  } =
    useBuklodScope();

  const { theme } = useBuklodTheme();

  const items = BASE_ITEMS;

  /*
   * PATCH_172E_GLOBAL_BOTTOM_NAV
   *
   * Bottom navigation always means the user's global/personal
   * BUKLOD environment. If the active scope is a parent Organization
   * or child Organization/Sub-organization, leave it first by
   * restoring Public, then open the normal destination.
   *
   * Scoped Organization navigation stays in the TOP bar.
   */
  const navigationInFlight = React.useRef(false);
  const lastRequestedRoute = React.useRef<NavItem['route'] | null>(null);
  const openGlobalDestination = async (route: NavItem['route']) => {
    if (Platform.OS !== 'web' && navigationInFlight.current) return;
    if (Platform.OS === 'web' && navigationInFlight.current) {
      // Do not discard a user's second tab choice while a scope switch is pending.
      lastRequestedRoute.current = route;
      setPendingRoute(route);
      return;
    }
    if (Platform.OS === 'web') lastRequestedRoute.current = route;
    const needsScopeReset = activeScope?.scope_type === 'ORGANIZATION' || activeScope?.scope_type === 'CLUSTER';
    if (isOnGlobalNavDestination(normalizedPath, route) && !needsScopeReset) return;
    navigationInFlight.current = true;
    setPendingRoute(route);
    try {
      if (needsScopeReset) {
        const publicScope = scopes.find(scope => scope.scope_type === 'PUBLIC');
        if (!publicScope) throw new Error('Hindi pa ma-load ang Public community. Subukang muli.');
        // selectScope applies the local scope immediately; server persistence is non-blocking.
        await selectScope(publicScope.scope_id);
      }
      const target = Platform.OS === 'web' ? (lastRequestedRoute.current ?? route) : route;
      rememberBuklodRoute(target);
      buklodInstantReplace(target);
    } catch (error) {
      setPendingRoute(null);
      Alert.alert('Hindi mabuksan', error instanceof Error ? error.message : 'Subukang muli.');
    } finally {
      navigationInFlight.current = false;
      lastRequestedRoute.current = null;
    }
  };

  if (
    keyboardVisible ||
    !session ||
    !profile ||
    !shouldShowBuklodPublicBottomNav(pathname)
  ) {
    return null;
  }
  /*
   * Global bottom nav stays visible in Cluster. Tapping it restores
   * Public and opens the personal BUKLOD destination.
   */
  /* PATCH_173A_R4_GATE_NAV_HIDE */
  if (
    normalizedPath === '/privacy' ||
    normalizedPath.startsWith('/privacy/') ||
    normalizedPath === '/delete-account' ||
    normalizedPath.startsWith('/delete-account/')
  ) {
    return null;
  }

  const active =
    pendingRoute
      ? routeKey(pendingRoute)
      : routeKey(normalizedPath);

  /* PATCH_177A_R5_VERIFIED_MODERN_NAV */
  return (
    <View
      style={[
        styles.shell,
        {
          paddingBottom:
            Math.max(
              insets.bottom,
              7
            ),
          backgroundColor: theme.navBackground,
          borderTopColor: theme.navBorder,
          shadowColor: theme.navShadow,
        },
      ]}
    >
      {items.map(item => {
        const selected =
          active === item.key;

        return (
          <BuklodPressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityHint={`Open ${item.label}`}
            instant
            onPressIn={() => {
              // Visual response begins on touch-down; navigation remains release-only.
              if (Platform.OS === 'web') setPendingRoute(item.route);
            }}
            onPressOut={() => {
              if (!navigationInFlight.current && normalizedPath === item.route) {
                setPendingRoute(null);
              }
            }}
            onPress={() =>
              openGlobalDestination(
                item.route
              )
            }
            style={({ pressed }) => [
              styles.item,
              pressed &&
                styles.itemPressed,
            ]}
            android_ripple={{
              color: 'transparent',
            }}
          >
            <View
              style={[
                styles.capsule,
                selected && {
                  backgroundColor: theme.navActive,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={item.icon}
                size={
                  selected
                    ? 25
                    : 26
                }
                color={
                  selected
                    ? theme.navIconActive
                    : theme.navIconInactive
                }
              />


            </View>
            <Text style={{ fontSize: 10, color: selected ? theme.navIconActive : theme.navIconInactive }}>{item.label}</Text>
          </BuklodPressable>
        );
      })}
    </View>
  );
}

const styles =
  StyleSheet.create({
    shell: {
      minHeight: 61,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingTop: 6,
      paddingHorizontal: 7,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      shadowOffset: {
        width: 0,
        height: -2,
      },
      shadowOpacity: 0.045,
      shadowRadius: 7,
      elevation: 7,
    },

    item: {
      flex: 1,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 2,
    },

    itemPressed: {
      opacity: 0.82,
    },

    capsule: {
      position: 'relative',
      minWidth: 48,
      height: 40,
      borderRadius: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
    },

    badge: {
      position: 'absolute',
      right: -4,
      top: -5,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
    },

    badgeText: {
      color: '#FFFFFF',
      fontSize: 8,
      lineHeight: 10,
      fontWeight: '900',
    },
  });
