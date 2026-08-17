import React, {
  useMemo,
} from 'react';

import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Keyboard } from 'react-native';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  router,
  usePathname,
} from 'expo-router';

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
  colors,
} from '@/lib/theme';

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

function shouldHide(
  pathname: string,
) {
  /* PATCH_177A_R6_ICON_ONLY_ACTIVE_NAV */
  return (
    /* PATCH_169B_HIDE_PUBLIC_NAV_IN_ORG */
    pathname === '/mzb' ||
    pathname.startsWith('/mzb/') ||
    pathname === '/' ||
    pathname.startsWith('/(auth)') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/privacy/consent') ||
    pathname.startsWith('/system/') ||
    pathname.startsWith('/admin/') ||
    pathname.startsWith('/pilot/') ||
    pathname.startsWith('/dev/')
  );
}

export default function
BuklodPersistentBottomNav() {
  /* PATCH_167K_HIDE_NAV_ON_KEYBOARD */
  const [keyboardVisible, setKeyboardVisible] =
    React.useState(false);

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
    async (
      route:
        | '/home'
        | '/messages'
        | '/buklod'
        | '/prayer'
        | '/notifications'
    ) => {
      if (
        activeScope?.scope_type ===
        'ORGANIZATION'
      ) {
        const publicScope =
          scopes.find(
            scope =>
              scope.scope_type ===
              'PUBLIC'
          );

        if (publicScope) {
          try {
            await selectScope(
              publicScope.scope_id
            );
          }
          catch (error) {
            console.warn(
              'BUKLOD global nav scope reset:',
              error
            );

            return;
          }
        }
      }

      router.replace(
        route as any
      );
    };


  if (
    keyboardVisible ||
    !session ||
    !profile ||
    shouldHide(pathname)
  ) {
    return null;
  }
  /* PATCH_170B_HIDE_BOTTOM_NAV_IN_CLUSTER
   * SMOOTH_NAV_R2:
   * Hide only when the Cluster workspace route is actually visible.
   */
  if (
    activeScope?.scope_type ===
      'CLUSTER' &&
    (
      pathname === '/scope' ||
      pathname.startsWith('/scope/')
    )
  ) {
    return null;
  }
  /* PATCH_173A_R4_GATE_NAV_HIDE */
  if (
    pathname === '/privacy/consent' ||
    pathname.startsWith('/privacy/consent/')
  ) {
    return null;
  }

  const active =
    routeKey(pathname);

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
          <Pressable
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
            onPress={() =>
              void openGlobalDestination(
                item.route
              )
            }
            style={({ pressed }) => [
              styles.item,
              pressed &&
                styles.itemPressed,
            ]}
          >
            <View
              style={[
                styles.capsule,
                selected &&
                  styles.capsuleActive,
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
                    ? colors.greenDark
                    : colors.muted
                }
              />


              {showBadge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {badgeText}
                  </Text>
                </View>
              )}
            </View>
          </Pressable>
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
      borderTopColor: colors.line,
      backgroundColor: colors.white,
      shadowColor: '#000000',
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
      opacity: 0.68,
      transform: [
        {
          scale: 0.96,
        },
      ],
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

    capsuleActive: {
      minWidth: 48,
      backgroundColor:
        colors.greenSoft,
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
      backgroundColor: '#B98219',
      borderWidth: 2,
      borderColor: colors.white,
    },

    badgeText: {
      color: '#FFFFFF',
      fontSize: 8,
      lineHeight: 10,
      fontWeight: '900',
    },
  });
