import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';

import BuklodSponsorSlot from '@/components/BuklodSponsorSlot';
import { buklodInstantReplace } from '@/lib/buklodInstantNavigation';
import {
  normalizeBuklodPathname,
  shouldShowBuklodPublicBottomNav,
} from '@/lib/buklodSafeArea';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import { useNotifications } from '@/providers/NotificationProvider';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';

/*
 * BUKLOD_DESKTOP_WEB_SHELL_R4
 * Desktop-only social layout. It is mounted only by BuklodNavSafeShell.web
 * when the browser viewport is desktop-sized. Phone web and APK never mount it.
 *
 * R4 adds an OPTIONAL user-triggered Full Screen / Focus View. It never turns
 * on automatically. When active, BUKLOD desktop rails/header are hidden and
 * the current screen gets the full usable canvas. Route changes reset it.
 */

type Route =
  | '/home'
  | '/messages'
  | '/buklod'
  | '/prayer'
  | '/notifications'
  | '/me';

type NavItem = {
  key: 'home' | 'connect' | 'community' | 'prayer' | 'notifications';
  route: Route;
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
};

type SponsorPlacement = 'home' | 'messages' | 'community' | 'prayer';

const NAV_ITEMS: NavItem[] = [
  { key: 'home', route: '/home', label: 'Home', icon: 'home-variant-outline' },
  { key: 'connect', route: '/messages', label: 'Connect', icon: 'message-processing-outline' },
  { key: 'community', route: '/buklod', label: 'Community', icon: 'account-group-outline' },
  { key: 'prayer', route: '/prayer', label: 'Prayer', icon: 'hands-pray' },
  { key: 'notifications', route: '/notifications', label: 'Notifications', icon: 'bell-outline' },
];

function isActiveRoute(pathname: string, route: Route) {
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

function sponsorPlacement(pathname: string): SponsorPlacement {
  if (
    pathname === '/messages' ||
    pathname.startsWith('/messages/') ||
    pathname === '/connect' ||
    pathname.startsWith('/connect/')
  ) {
    return 'messages';
  }
  if (
    pathname === '/buklod' ||
    pathname.startsWith('/buklod/') ||
    pathname.startsWith('/post/') ||
    pathname.startsWith('/reels')
  ) {
    return 'community';
  }
  if (pathname === '/prayer' || pathname.startsWith('/prayer/')) {
    return 'prayer';
  }
  return 'home';
}

function isFeedRoute(pathname: string) {
  return (
    pathname === '/home' ||
    pathname.startsWith('/home/') ||
    pathname === '/buklod' ||
    pathname.startsWith('/buklod/') ||
    pathname.startsWith('/post/') ||
    pathname.startsWith('/reels') ||
    pathname === '/prayer' ||
    pathname.startsWith('/prayer/')
  );
}

export default function BuklodDesktopWebShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const normalizedPath = normalizeBuklodPathname(pathname);
  const { width } = useWindowDimensions();
  const { session, profile } = useAuth();
  const { activeScope, scopes, selectScope } = useBuklodScope();
  const { unreadCount } = useNotifications();
  const { theme } = useBuklodTheme();
  const [focusMode, setFocusMode] = useState(false);
  const browserFullscreenOwned = useRef(false);

  const compactLeft = width < 1240;
  const showRightRail = width >= 1320;
  const feedRoute = isFeedRoute(normalizedPath);
  const showPrayer = Boolean(activeScope?.show_faith_content);

  const items = useMemo(
    () => NAV_ITEMS.filter(item => item.key !== 'prayer' || showPrayer),
    [showPrayer]
  );

  const topItems = useMemo(
    () => items.filter(item => item.key === 'home' || item.key === 'connect' || item.key === 'community'),
    [items]
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

  const leaveBrowserFullscreenIfOwned = async () => {
    const doc = (globalThis as any)?.document;

    if (
      browserFullscreenOwned.current &&
      doc?.fullscreenElement &&
      typeof doc?.exitFullscreen === 'function'
    ) {
      try {
        await doc.exitFullscreen();
      } catch {
        // App-level focus mode still exits even if browser fullscreen rejects.
      }
    }

    browserFullscreenOwned.current = false;
  };

  const enterFocusMode = async () => {
    setFocusMode(true);

    const doc = (globalThis as any)?.document;
    const root = doc?.documentElement;

    if (!root || typeof root.requestFullscreen !== 'function') {
      return;
    }

    try {
      await root.requestFullscreen();
      browserFullscreenOwned.current = true;
    } catch {
      // Browser fullscreen is an enhancement; app-level focus view still works.
      browserFullscreenOwned.current = false;
    }
  };

  const exitFocusMode = async () => {
    setFocusMode(false);
    await leaveBrowserFullscreenIfOwned();
  };

  useEffect(() => {
    setFocusMode(false);
    void leaveBrowserFullscreenIfOwned();
    // Route changes must always restore the normal BUKLOD desktop shell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedPath]);

  useEffect(() => {
    const doc = (globalThis as any)?.document;

    if (!doc || typeof doc.addEventListener !== 'function') {
      return;
    }

    const handleFullscreenChange = () => {
      if (browserFullscreenOwned.current && !doc.fullscreenElement) {
        browserFullscreenOwned.current = false;
        setFocusMode(false);
      }
    };

    doc.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      doc.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  /*
   * PATCH_20260904_DESKTOP_PROFILE_SCOPE_EXIT
   * Every desktop-global destination, including My BUKLOD/avatar, exits an
   * Organization/Cluster scope. Scope reset must also run when the pathname is
   * already the destination (for example /me while a stale Cluster is active).
   */
  const openGlobalDestination = (route: Route) => {
    const scoped =
      activeScope?.scope_type === 'ORGANIZATION' ||
      activeScope?.scope_type === 'CLUSTER';

    if (scoped) {
      const publicScope = scopes.find(scope => scope.scope_type === 'PUBLIC');

      if (publicScope && publicScope.scope_id !== activeScope?.scope_id) {
        void selectScope(publicScope.scope_id).catch(error => {
          console.warn('BUKLOD desktop web scope reset:', error);
        });
      }
    }

    if (isActiveRoute(normalizedPath, route)) return;

    buklodInstantReplace(route as any);
  };

  if (!showNavigation) {
    return <View style={styles.fullScreen}>{children}</View>;
  }

  if (focusMode) {
    return (
      <View style={[styles.focusRoot, { backgroundColor: theme.canvas }]}>
        <View style={styles.focusContent}>{children}</View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Exit Full Screen"
          onPress={() => void exitFocusMode()}
          style={({ pressed }) => [
            styles.exitFocusButton,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
            pressed && styles.pressed,
          ]}
        >
          <MaterialCommunityIcons
            name="fullscreen-exit"
            size={20}
            color={theme.accent}
          />
          <Text style={[styles.exitFocusText, { color: theme.textPrimary }]}>Exit Full Screen</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: theme.headerSurface,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <View style={styles.topLeft}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="BUKLOD Home"
            onPress={() => openGlobalDestination('/home')}
            style={({ pressed }) => [styles.brand, pressed && styles.pressed]}
          >
            <View style={[styles.brandMark, { backgroundColor: theme.accent }]}>
              <Text style={styles.brandLetter}>B</Text>
            </View>
            <Text style={[styles.brandText, { color: theme.accent }]}>BUKLOD</Text>
          </Pressable>

          {!compactLeft ? (
            <View style={[styles.searchPill, { backgroundColor: theme.inputSurface }]}>
              <MaterialCommunityIcons name="magnify" size={20} color={theme.textMuted} />
              <Text style={[styles.searchText, { color: theme.textMuted }]}>Search BUKLOD</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.topCenter}>
          {topItems.map(item => {
            const active = isActiveRoute(normalizedPath, item.route);
            return (
              <Pressable
                key={`top-${item.key}`}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={() => openGlobalDestination(item.route)}
                style={({ pressed }) => [
                  styles.topNav,
                  active ? { borderBottomColor: theme.accent } : null,
                  pressed && styles.pressed,
                ]}
              >
                <MaterialCommunityIcons
                  name={item.icon}
                  size={27}
                  color={active ? theme.accent : theme.textMuted}
                />
              </Pressable>
            );
          })}
        </View>

        <View style={styles.topRight}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Full Screen"
            onPress={() => void enterFocusMode()}
            style={({ pressed }) => [
              styles.roundAction,
              { backgroundColor: theme.surfaceMuted },
              pressed && styles.pressed,
            ]}
          >
            <MaterialCommunityIcons name="fullscreen" size={24} color={theme.textPrimary} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            onPress={() => openGlobalDestination('/notifications')}
            style={({ pressed }) => [
              styles.roundAction,
              { backgroundColor: theme.surfaceMuted },
              pressed && styles.pressed,
            ]}
          >
            <MaterialCommunityIcons name="bell-outline" size={23} color={theme.textPrimary} />
            {unreadCount > 0 ? (
              <View style={[styles.topBadge, { backgroundColor: theme.danger }]}>
                <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="My BUKLOD"
            onPress={() => openGlobalDestination('/me')}
            style={({ pressed }) => [
              styles.roundAction,
              { backgroundColor: theme.surfaceMuted },
              pressed && styles.pressed,
            ]}
          >
            <MaterialCommunityIcons name="account-circle" size={28} color={theme.accent} />
          </Pressable>
        </View>
      </View>

      <View style={styles.body}>
        <View
          style={[
            styles.leftRail,
            compactLeft ? styles.leftCompact : styles.leftWide,
            { borderRightColor: theme.border, backgroundColor: theme.canvas },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="My BUKLOD"
            onPress={() => openGlobalDestination('/me')}
            style={({ pressed }) => [
              styles.profileRow,
              compactLeft && styles.compactButton,
              isActiveRoute(normalizedPath, '/me') ? { backgroundColor: theme.accentSoft } : null,
              pressed && styles.pressed,
            ]}
          >
            <MaterialCommunityIcons name="account-circle" size={34} color={theme.accent} />
            {!compactLeft ? (
              <View style={styles.profileCopy}>
                <Text style={[styles.profileName, { color: theme.textPrimary }]}>My BUKLOD</Text>
                <Text style={[styles.profileSub, { color: theme.textMuted }]}>Profile & settings</Text>
              </View>
            ) : null}
          </Pressable>

          <View style={styles.navList}>
            {items.map(item => {
              const active = isActiveRoute(normalizedPath, item.route);
              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  onPress={() => openGlobalDestination(item.route)}
                  style={({ pressed }) => [
                    styles.navButton,
                    compactLeft && styles.compactButton,
                    active ? { backgroundColor: theme.accentSoft } : null,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.iconWrap}>
                    <MaterialCommunityIcons
                      name={item.icon}
                      size={25}
                      color={active ? theme.accent : theme.textSecondary}
                    />
                    {item.key === 'notifications' && unreadCount > 0 ? (
                      <View style={[styles.badge, { backgroundColor: theme.danger }]}>
                        <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                      </View>
                    ) : null}
                  </View>
                  {!compactLeft ? (
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.navLabel,
                        { color: active ? theme.accent : theme.textPrimary },
                      ]}
                    >
                      {item.label}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          {!compactLeft && activeScope?.name ? (
            <View style={[styles.scopeCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.scopeEyebrow, { color: theme.textMuted }]}>CURRENT SPACE</Text>
              <Text numberOfLines={2} style={[styles.scopeName, { color: theme.textPrimary }]}>
                {activeScope.name}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.mainLane}>
          <View style={[styles.content, feedRoute && styles.feedContent]}>{children}</View>
        </View>

        {showRightRail ? (
          <View
            style={[
              styles.rightRail,
              { backgroundColor: theme.canvas, borderLeftColor: theme.border },
            ]}
          >
            <Text style={[styles.rightHeading, { color: theme.textSecondary }]}>Sponsored</Text>
            <BuklodSponsorSlot placement={sponsorPlacement(normalizedPath)} />

            <View style={[styles.rightCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <MaterialCommunityIcons name="account-group-outline" size={23} color={theme.accent} />
              <View style={styles.rightCardCopy}>
                <Text style={[styles.rightCardTitle, { color: theme.textPrimary }]}>BUKLOD Community</Text>
                <Text style={[styles.rightCardText, { color: theme.textMuted }]}>Connect, serve, learn, and grow together.</Text>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minWidth: 0, minHeight: 0 },
  fullScreen: { flex: 1, minWidth: 0, minHeight: 0 },
  focusRoot: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    position: 'relative',
  },
  focusContent: {
    flex: 1,
    width: '100%',
    minWidth: 0,
    minHeight: 0,
  },
  exitFocusButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    minHeight: 42,
    paddingHorizontal: 13,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    zIndex: 1000,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 7,
  },
  exitFocusText: { fontSize: 12, fontWeight: '900' },
  topBar: {
    height: 64,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    zIndex: 300,
  },
  topLeft: { minWidth: 220, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandMark: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  brandLetter: { color: '#FFFFFF', fontWeight: '900', fontSize: 23 },
  brandText: { fontSize: 20, fontWeight: '900', letterSpacing: 0.2 },
  searchPill: {
    height: 42,
    minWidth: 170,
    maxWidth: 270,
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchText: { fontSize: 14, fontWeight: '600' },
  topCenter: { flex: 1.1, maxWidth: 520, height: '100%', flexDirection: 'row', justifyContent: 'center' },
  topNav: {
    width: 104,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  topRight: { minWidth: 220, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  roundAction: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  topBadge: { position: 'absolute', right: -2, top: -3, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0, minHeight: 0, flexDirection: 'row' },
  leftRail: { flexShrink: 0, borderRightWidth: StyleSheet.hairlineWidth, paddingVertical: 14, paddingHorizontal: 10, minHeight: '100%', zIndex: 90 },
  leftWide: { width: 280 },
  leftCompact: { width: 78 },
  profileRow: { minHeight: 58, borderRadius: 14, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  profileCopy: { flex: 1, minWidth: 0 },
  profileName: { fontSize: 14, fontWeight: '900' },
  profileSub: { marginTop: 2, fontSize: 10, fontWeight: '600' },
  navList: { gap: 4 },
  navButton: { minHeight: 54, borderRadius: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  compactButton: { justifyContent: 'center', paddingHorizontal: 0 },
  iconWrap: { position: 'relative' },
  navLabel: { flex: 1, fontSize: 14, fontWeight: '800' },
  badge: { position: 'absolute', right: -12, top: -10, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  scopeCard: { marginTop: 18, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12 },
  scopeEyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  scopeName: { marginTop: 5, fontSize: 13, fontWeight: '900', lineHeight: 18 },
  mainLane: { flex: 1, minWidth: 0, minHeight: 0, alignItems: 'center' },
  content: { flex: 1, width: '100%', minWidth: 0, minHeight: 0 },
  feedContent: { width: '100%', maxWidth: 940, alignSelf: 'center' },
  rightRail: { width: 330, flexShrink: 0, borderLeftWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 20, minHeight: '100%' },
  rightHeading: { fontSize: 16, fontWeight: '900', marginBottom: 7 },
  rightCard: { marginTop: 20, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  rightCardCopy: { flex: 1, minWidth: 0 },
  rightCardTitle: { fontSize: 13, fontWeight: '900' },
  rightCardText: { marginTop: 4, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  pressed: { opacity: 0.68 },
});