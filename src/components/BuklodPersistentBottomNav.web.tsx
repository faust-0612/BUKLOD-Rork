import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { buklodInstantReplace } from '@/lib/buklodInstantNavigation';
import { rememberBuklodRoute } from '@/lib/buklodRouteDiagnostics';
import { normalizeBuklodPathname, shouldShowBuklodPublicBottomNav } from '@/lib/buklodSafeArea';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';

/**
 * BUKLOD_MOBILE_WEB_BOTTOM_NAV_FAST_R1
 *
 * Web-only override. The Android/native implementation remains in
 * BuklodPersistentBottomNav.tsx. Bypass the custom touch-movement recheck:
 * mobile browsers can report different page coordinates on touch release,
 * causing genuine taps to be discarded. React Native Web Pressable owns the
 * tap-vs-scroll decision here.
 *
 * Scope selection is synchronous locally and persisted non-blockingly by
 * BuklodScopeProvider. Only scoped exits await that local selection;
 * ordinary public tab changes route immediately without a network request.
 */
type Destination = '/hub' | '/clusters' | '/buklod' | '/messages' | '/me';
type TabKey = 'home' | 'cluster' | 'community' | 'connect' | 'profile';
type Tab = {
  key: TabKey;
  route: Destination;
  icon: 'home-variant-outline' | 'account-group-outline' | 'forum-outline' | 'message-outline' | 'account-outline';
  label: string;
};

const TABS: readonly Tab[] = [
  { key: 'home', route: '/hub', icon: 'home-variant-outline', label: 'Home' },
  { key: 'cluster', route: '/clusters', icon: 'account-group-outline', label: 'Cluster' },
  { key: 'community', route: '/buklod', icon: 'forum-outline', label: 'Wall' },
  { key: 'connect', route: '/messages', icon: 'message-outline', label: 'Connect' },
  { key: 'profile', route: '/me', icon: 'account-outline', label: 'Profile' },
];

function tabForPath(path: string): TabKey | null {
  if (path === '/hub') return 'home';
  if (path === '/clusters' || path.startsWith('/clusters/')) return 'cluster';
  if (path === '/buklod' || path.startsWith('/post/')) return 'community';
  if (path === '/messages' || path.startsWith('/messages/')) return 'connect';
  if (path === '/me') return 'profile';
  return null;
}

export default function BuklodPersistentBottomNavWeb() {
  const pathname = usePathname();
  const normalizedPath = normalizeBuklodPathname(pathname);
  const pathRef = useRef(normalizedPath);
  pathRef.current = normalizedPath;
  const { session, profile } = useAuth();
  const { activeScope, scopes, selectScope } = useBuklodScope();
  const { theme } = useBuklodTheme();
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [pendingRoute, setPendingRoute] = useState<Destination | null>(null);
  const [navError, setNavError] = useState('');
  const inFlightRef = useRef(false);
  const latestRouteRef = useRef<Destination | null>(null);
  const priorPathRef = useRef(normalizedPath);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    // The real route, not an optimistic highlight, is authoritative.
    if (priorPathRef.current !== normalizedPath) {
      priorPathRef.current = normalizedPath;
      setPendingRoute(null);
      setNavError('');
    } else if (pendingRoute === normalizedPath && !inFlightRef.current) {
      setPendingRoute(null);
    }
  }, [normalizedPath, pendingRoute]);

  const requestDestination = (route: Destination) => {
    const needsScopeReset =
      activeScope?.scope_type === 'ORGANIZATION' ||
      activeScope?.scope_type === 'CLUSTER';

    if (!inFlightRef.current && pathRef.current === route && !needsScopeReset) {
      setPendingRoute(null);
      return;
    }

    latestRouteRef.current = route;
    setPendingRoute(route); // immediate selected-tab feedback
    setNavError('');

    // A second tap while leaving an Organization/Cluster supersedes the first.
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    const fail = () => {
      latestRouteRef.current = null;
      inFlightRef.current = false;
      setPendingRoute(null);
      setNavError('Hindi mabuksan ang dashboard. Subukan muli.');
    };

    const complete = () => {
      try {
        const destination = latestRouteRef.current ?? route;
        latestRouteRef.current = null;
        if (pathRef.current !== destination || needsScopeReset) {
          rememberBuklodRoute(destination);
          buklodInstantReplace(destination);
        } else {
          setPendingRoute(null);
        }
        inFlightRef.current = false;
      } catch {
        fail();
      }
    };

    if (!needsScopeReset) {
      complete();
      return;
    }

    const publicScope = scopes.find(scope => scope.scope_type === 'PUBLIC');
    if (!publicScope) {
      fail(); // never leak a managed scope into a personal/global tab
      return;
    }

    // selectScope commits local state before its promise settles; it does not
    // wait for network persistence. The latest user choice wins on resolution.
    try {
      void selectScope(publicScope.scope_id).then(complete, fail);
    } catch {
      fail();
    }
  };

  if (!session || !profile || keyboardVisible || !shouldShowBuklodPublicBottomNav(pathname)) {
    return null;
  }

  const selectedKey = tabForPath(pendingRoute ?? normalizedPath);
  return (
    <View style={styles.wrapper}>
      {navError ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>{navError}</Text>
      ) : null}
      <View
        style={[
          styles.shell,
          {
            paddingBottom: Math.max(insets.bottom, 7),
            backgroundColor: theme.navBackground,
            borderTopColor: theme.navBorder,
            shadowColor: theme.navShadow,
          },
        ]}
      >
        {TABS.map(tab => {
          const selected = tab.key === selectedKey;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              accessibilityHint={'Open ' + tab.label}
              accessibilityState={{ selected }}
              onPress={() => requestDestination(tab.route)}
              style={({ pressed }) => [
                styles.item,
                { touchAction: 'manipulation' } as any,
                pressed && styles.itemPressed,
              ]}
            >
              <View style={[styles.capsule, selected && { backgroundColor: theme.navActive }]}>
                <MaterialCommunityIcons
                  name={tab.icon}
                  size={selected ? 25 : 26}
                  color={selected ? theme.navIconActive : theme.navIconInactive}
                />
              </View>
              <Text style={{ fontSize: 10, color: selected ? theme.navIconActive : theme.navIconInactive }}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%' },
  shell: {
    minHeight: 61,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 6,
    paddingHorizontal: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: -2 },
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
  itemPressed: { opacity: 0.75 },
  capsule: {
    minWidth: 48,
    height: 40,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  error: {
    position: 'absolute',
    bottom: '100%',
    left: 8,
    right: 8,
    padding: 8,
    textAlign: 'center',
    fontSize: 12,
    color: '#FFFFFF',
    backgroundColor: '#8A2424',
    zIndex: 5,
  },
});
