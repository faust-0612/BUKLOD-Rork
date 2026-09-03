import React, {
  useMemo,
} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';
import {
  usePathname,
} from 'expo-router';

import {
  buklodInstantReplace,
} from '@/lib/buklodInstantNavigation';
import {
  normalizeBuklodPathname,
  shouldShowBuklodPublicBottomNav,
} from '@/lib/buklodSafeArea';
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

/*
 * BUKLOD_WEB_DESKTOP_SHELL_R1
 *
 * Web gets a desktop left navigation rail similar to modern Google web apps.
 * Native Android/iOS continue resolving BuklodNavSafeShell.tsx, so the APK
 * keeps the existing bottom navigation unchanged.
 */

type Route =
  | '/home'
  | '/messages'
  | '/buklod'
  | '/prayer'
  | '/notifications'
  | '/me';

type NavItem = {
  key:
    | 'home'
    | 'connect'
    | 'community'
    | 'prayer'
    | 'notifications'
    | 'me';
  route: Route;
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
};

const BASE_ITEMS: NavItem[] = [
  {
    key: 'home',
    route: '/home',
    label: 'Home',
    icon: 'home-variant-outline',
  },
  {
    key: 'connect',
    route: '/messages',
    label: 'Connect',
    icon: 'message-processing-outline',
  },
  {
    key: 'community',
    route: '/buklod',
    label: 'Community',
    icon: 'account-group-outline',
  },
  {
    key: 'prayer',
    route: '/prayer',
    label: 'Prayer',
    icon: 'hands-pray',
  },
  {
    key: 'notifications',
    route: '/notifications',
    label: 'Notifications',
    icon: 'bell-outline',
  },
];

function isActiveRoute(
  pathname: string,
  route: Route,
) {
  if (route === '/home') {
    return pathname === '/home' || pathname.startsWith('/home/');
  }
  if (route === '/messages') {
    return (
      pathname === '/messages' ||
      pathname.startsWith('/messages/') ||
      pathname === '/connect' ||
      pathname.startsWith('/connect/')
    );
  }
  if (route === '/buklod') {
    return (
      pathname === '/buklod' ||
      pathname.startsWith('/buklod/') ||
      pathname.startsWith('/post/') ||
      pathname.startsWith('/reels')
    );
  }
  if (route === '/prayer') {
    return pathname === '/prayer' || pathname.startsWith('/prayer/');
  }
  if (route === '/notifications') {
    return pathname === '/notifications' || pathname.startsWith('/notifications/');
  }
  return pathname === '/me' || pathname.startsWith('/me/');
}

export default function BuklodNavSafeShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const normalizedPath = normalizeBuklodPathname(pathname);
  const { width } = useWindowDimensions();
  const compact = width < 900;

  const {
    session,
    profile,
  } = useAuth();

  const {
    activeScope,
    scopes,
    selectScope,
  } = useBuklodScope();

  const {
    unreadCount,
  } = useNotifications();

  const {
    theme,
  } = useBuklodTheme();

  const showPrayer = Boolean(
    activeScope?.show_faith_content
  );

  const showNavigation = Boolean(
    session &&
    profile &&
    shouldShowBuklodPublicBottomNav(pathname) &&
    normalizedPath !== '/privacy' &&
    !normalizedPath.startsWith('/privacy/') &&
    normalizedPath !== '/delete-account' &&
    !normalizedPath.startsWith('/delete-account/')
  );

  const items = useMemo(
    () => BASE_ITEMS.filter(
      item => item.key !== 'prayer' || showPrayer
    ),
    [showPrayer]
  );

  const openGlobalDestination = (
    route: Route,
  ) => {
    if (isActiveRoute(normalizedPath, route)) {
      return;
    }

    buklodInstantReplace(route as any);

    if (route === '/me') {
      return;
    }

    const needsScopeReset =
      activeScope?.scope_type === 'ORGANIZATION' ||
      activeScope?.scope_type === 'CLUSTER';

    if (!needsScopeReset) {
      return;
    }

    const publicScope = scopes.find(
      scope => scope.scope_type === 'PUBLIC'
    );

    if (!publicScope) {
      return;
    }

    queueMicrotask(() => {
      void selectScope(publicScope.scope_id).catch(error => {
        console.warn('BUKLOD web global nav scope reset:', error);
      });
    });
  };

  if (!showNavigation) {
    return (
      <View style={styles.fullScreen}>
        {children}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: theme.canvas,
        },
      ]}
    >
      <View
        style={[
          styles.sidebar,
          compact
            ? styles.sidebarCompact
            : styles.sidebarWide,
          {
            backgroundColor: theme.headerSurface,
            borderRightColor: theme.navBorder,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="BUKLOD Home"
          onPress={() => openGlobalDestination('/home')}
          style={styles.brand}
        >
          <View
            style={[
              styles.brandMark,
              {
                backgroundColor: theme.accent,
              },
            ]}
          >
            <Text style={styles.brandLetter}>B</Text>
          </View>
          {!compact && (
            <Text
              numberOfLines={1}
              style={[
                styles.brandText,
                { color: theme.accent },
              ]}
            >
              BUKLOD
            </Text>
          )}
        </Pressable>

        <View style={styles.navList}>
          {items.map(item => {
            const active = isActiveRoute(
              normalizedPath,
              item.route
            );

            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={() => openGlobalDestination(item.route)}
                style={({ pressed }) => [
                  styles.navButton,
                  compact && styles.navButtonCompact,
                  active && {
                    backgroundColor: theme.accentSoft,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.iconWrap}>
                  <MaterialCommunityIcons
                    name={item.icon}
                    size={25}
                    color={active ? theme.accent : theme.textMuted}
                  />
                  {item.key === 'notifications' && unreadCount > 0 ? (
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: theme.accent },
                      ]}
                    >
                      <Text style={styles.badgeText}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {!compact && (
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.navLabel,
                      {
                        color: active
                          ? theme.accent
                          : theme.textMuted,
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sidebarBottom}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="My BUKLOD"
            onPress={() => openGlobalDestination('/me')}
            style={({ pressed }) => [
              styles.navButton,
              compact && styles.navButtonCompact,
              isActiveRoute(normalizedPath, '/me') && {
                backgroundColor: theme.accentSoft,
              },
              pressed && styles.pressed,
            ]}
          >
            <MaterialCommunityIcons
              name="account-circle-outline"
              size={28}
              color={
                isActiveRoute(normalizedPath, '/me')
                  ? theme.accent
                  : theme.textMuted
              }
            />
            {!compact && (
              <Text
                numberOfLines={1}
                style={[
                  styles.navLabel,
                  {
                    color: isActiveRoute(normalizedPath, '/me')
                      ? theme.accent
                      : theme.textMuted,
                  },
                ]}
              >
                My BUKLOD
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    minWidth: 0,
    minHeight: 0,
  },
  fullScreen: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  sidebar: {
    flexShrink: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 8,
    minHeight: '100%',
    zIndex: 100,
  },
  sidebarWide: {
    width: 150,
  },
  sidebarCompact: {
    width: 76,
  },
  brand: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  brandMark: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLetter: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 21,
  },
  brandText: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  navList: {
    gap: 6,
  },
  navButton: {
    minHeight: 58,
    borderRadius: 16,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  navButtonCompact: {
    minHeight: 58,
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  iconWrap: {
    position: 'relative',
  },
  navLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
  },
  badge: {
    position: 'absolute',
    right: -12,
    top: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  sidebarBottom: {
    marginTop: 'auto',
  },
  content: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  pressed: {
    opacity: 0.72,
  },
});
