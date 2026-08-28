import React, {
  useMemo,
} from 'react';

import {
  Keyboard,
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
  useNotifications,
} from '@/providers/NotificationProvider';

import {
  useBuklodTheme,
} from '@/providers/BuklodThemeProvider';

import {
  normalizeBuklodPathname,
  shouldShowBuklodPublicBottomNav,
} from '@/lib/buklodSafeArea';

/* PATCH_167I_R2_PROFILE_SLOT_TO_NOTIFICATIONS */

type NavKey =
  | 'home'
  | 'connect'
  | 'community'
  | 'prayer'
  | 'notifications';

type NavItem = {
  key: NavKey;
  route:
    | '/home'
    | '/messages'
    | '/buklod'
    | '/prayer'
    | '/notifications';
  icon:
    | 'home-variant-outline'
    | 'message-processing-outline'
    | 'account-group-outline'
    | 'hands-pray'
    | 'bell-outline';
  label: string;
};

const BASE_ITEMS: NavItem[] = [
  {
    key: 'home',
    route: '/home',
    icon: 'home-variant-outline',
    label: 'Home',
  },
  {
    key: 'connect',
    route: '/messages',
    icon: 'message-processing-outline',
    label: 'Connect',
  },
  {
    key: 'community',
    route: '/buklod',
    icon: 'account-group-outline',
    label: 'Community',
  },
  {
    key: 'prayer',
    route: '/prayer',
    icon: 'hands-pray',
    label: 'Prayer',
  },
  {
    key: 'notifications',
    route: '/notifications',
    icon: 'bell-outline',
    label: 'Notifications',
  },
];

function routeKey(
  pathname: string,
): NavKey | null {
  if (
    pathname === '/home' ||
    pathname.startsWith('/home/')
  ) {
    return 'home';
  }

  if (
    pathname === '/messages' ||
    pathname.startsWith('/messages/') ||
    pathname === '/connect' ||
    pathname.startsWith('/connect/')
  ) {
    return 'connect';
  }

  if (
    pathname === '/buklod' ||
    pathname.startsWith('/buklod/') ||
    pathname.startsWith('/post/') ||
    pathname.startsWith('/reels')
  ) {
    return 'community';
  }

  if (
    pathname === '/prayer' ||
    pathname.startsWith('/prayer/')
  ) {
    return 'prayer';
  }

  if (
    pathname === '/notifications' ||
    pathname.startsWith('/notifications/')
  ) {
    return 'notifications';
  }

  /*
   * /me intentionally has no bottom-nav active item.
   * Profile / My BUKLOD is now opened by the avatar.
   */
  return null;
}

function isOnGlobalNavDestination(
  pathname: string,
  route: NavItem['route']
) {
  if (route === '/home') {
    return pathname === '/home';
  }

  if (route === '/messages') {
    return pathname === '/messages';
  }

  if (route === '/buklod') {
    return pathname === '/buklod';
  }

  if (route === '/prayer') {
    return pathname === '/prayer';
  }

  return pathname === '/notifications';
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

  const {
    unreadCount,
  } =
    useNotifications();

  const { theme } = useBuklodTheme();

  const showPrayer =
    Boolean(
      activeScope
        ?.show_faith_content
    );

  const items =
    useMemo(
      () =>
        BASE_ITEMS.filter(
          item =>
            item.key !==
              'prayer' ||
            showPrayer
        ),
      [showPrayer]
    );

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
  const openGlobalDestination =
    (
      route:
        | '/home'
        | '/messages'
        | '/buklod'
        | '/prayer'
        | '/notifications'
    ) => {
      if (
        isOnGlobalNavDestination(
          normalizedPath,
          route
        )
      ) {
        return;
      }

      setPendingRoute(route);
      buklodInstantReplace(
        route as any
      );

      const needsScopeReset =
        activeScope?.scope_type ===
          'ORGANIZATION' ||
        activeScope?.scope_type ===
          'CLUSTER';

      if (needsScopeReset) {
        const publicScope =
          scopes.find(
            scope =>
              scope.scope_type ===
              'PUBLIC'
          );

        if (publicScope) {
          queueMicrotask(() => {
            void selectScope(
              publicScope.scope_id
            ).catch(
              error => {
                console.warn(
                  'BUKLOD global nav scope reset:',
                  error
                );
              }
            );
          });
        }
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

  const badgeText =
    unreadCount > 99
      ? '99+'
      : String(unreadCount);

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

        const showBadge =
          item.key ===
            'notifications' &&
          unreadCount > 0;
return (
          <BuklodPressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityHint={
              item.key === 'notifications'
                ? unreadCount > 0
                  ? `${badgeText} unread updates`
                  : 'Open Notification Center'
                : undefined
            }
            instant
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


              {showBadge && (
                <View
                  style={[
                    styles.badge,
                    {
                      borderColor: theme.navBackground,
                      backgroundColor: theme.warning,
                    },
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {badgeText}
                  </Text>
                </View>
              )}
            </View>
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
