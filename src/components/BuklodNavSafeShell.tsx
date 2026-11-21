import React, {
  useEffect,
  useState,
} from 'react';

import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BuklodFocusAppAdStrip from '@/components/BuklodFocusAppAdStrip';
import { rememberBuklodRoute } from '@/lib/buklodRouteDiagnostics';
import BuklodPersistentBottomNav from '@/components/BuklodPersistentBottomNav';
import { isGenesisPreviewBuild } from '@/features/season2/genesis/genesisContract';
import {
  isBuklodScopedWorkspacePath,
  normalizeBuklodPathname,
  useBuklodPersistentNavOccupiedHeight,
} from '@/lib/buklodSafeArea';

function isMyBuklodDoorPath(pathname: string): boolean {
  const normalized = normalizeBuklodPathname(pathname);

  return (
    normalized.startsWith('/account/') ||
    normalized === '/about-buklod' ||
    normalized.startsWith('/premium') ||
    normalized === '/delete-account' ||
    normalized.startsWith('/delete-account/') ||
    normalized === '/privacy' ||
    normalized.startsWith('/privacy/') ||
    normalized.startsWith('/policy') ||
    normalized.startsWith('/contact-us') ||
    normalized.startsWith('/feedback') ||
    normalized.startsWith('/admin/account-recovery') ||
    normalized.startsWith('/system/paid-features') ||
    normalized.startsWith('/pilot/checklist')
  );
}

function isImmersiveIgpatPath(pathname: string): boolean {
  const normalized = normalizeBuklodPathname(pathname);

  return (
    normalized === '/igpat' ||
    normalized.startsWith('/igpat/') ||
    normalized === '/reels' ||
    normalized.startsWith('/reels/')
  );
}

function isHiblaConversationPath(pathname: string): boolean {
  const normalized = normalizeBuklodPathname(pathname);
  return normalized.startsWith('/connect/personal/') ||
    normalized.startsWith('/connect/community/') ||
    normalized.startsWith('/mzb/connect/');
}

/**
 * Root shell: shrinks routed content above the global bottom nav so door
 * screens and dashboard pushes never sit underneath the phone nav pane.
 * Public/personal routes are route-authoritative and no longer render/reserve
 * the old persistent nav pane. Organization/Cluster `/scope` behavior stays
 * unchanged and does not depend on transient active-scope hydration.
 * IGPAT is an immersive video surface: no normal-flow ad strip or persistent
 * bottom navigation is reserved there. A small floating Community return
 * remains available so the user never gets trapped inside IGPAT.
 */
export default function BuklodNavSafeShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  useEffect(() => {
    rememberBuklodRoute(pathname);
  }, [pathname]);
  const rawNavOccupied =
    useBuklodPersistentNavOccupiedHeight();
  const publicMinimal =
    !isBuklodScopedWorkspacePath(pathname);
  const immersiveConversation = isHiblaConversationPath(pathname);
  const genesisWorld = isGenesisPreviewBuild();
  // Preview keeps the SAME existing bottom nav; never duplicate it in World or Guide.
  const navOccupied = immersiveConversation ? 0 : rawNavOccupied;
  const insets = useSafeAreaInsets();
  const immersiveIgpat =
    isImmersiveIgpatPath(pathname);
  const normalizedPath = normalizeBuklodPathname(pathname);
  const reserveMyBuklodSystemInsets =
    isMyBuklodDoorPath(pathname) ||
    // Daily Reading and Children's Stories have headerless routes. Keep their
    // headings and scrollable content below the Android status bar at rest.
    normalizedPath === '/bible' ||
    normalizedPath === '/bible/index' ||
    normalizedPath === '/bible/read' ||
    normalizedPath === '/children-stories' ||
    normalizedPath.startsWith('/children-stories/') ||
    // Radio header must start below Android's translucent status bar.
    normalizedPath === '/personal-home/radio';
  const [keyboardVisible, setKeyboardVisible] =
    useState(false);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios'
        ? 'keyboardWillShow'
        : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios'
        ? 'keyboardWillHide'
        : 'keyboardDidHide';

    const showSub = Keyboard.addListener(
      showEvent,
      () => {
        setKeyboardVisible(true);
      }
    );
    const hideSub = Keyboard.addListener(
      hideEvent,
      () => {
        setKeyboardVisible(false);
      }
    );
    const didShowSub = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
      }
    );
    const didHideSub = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      showSub.remove();
      hideSub.remove();
      didShowSub.remove();
      didHideSub.remove();
    };
  }, []);

  const contentTopInset =
    immersiveIgpat
      ? 0
      : reserveMyBuklodSystemInsets
        ? Math.max(insets.top, 0)
        : 0;
  const contentBottomInset =
    immersiveIgpat || immersiveConversation
      ? 0
      : keyboardVisible
        ? 0
        : navOccupied > 0
          ? navOccupied
          : reserveMyBuklodSystemInsets
            ? Math.max(insets.bottom, 0)
            : 0;

  // A single compact World portal replaces legacy persistent nav in staging.
  // Never overlap an active conversation, immersive reel, keyboard or auth gate.
  const mapReturnRoots = ['/buklod','/messages','/hub','/me','/learn','/clusters','/organizations',
    '/games','/points','/bayanihan','/bible','/life','/notifications','/profile',
    '/personal-home','/settings','/support','/community-contribution','/children-stories'];
  const worldReturnEligible = genesisWorld && !immersiveConversation && !immersiveIgpat && !keyboardVisible &&
    !normalizedPath.startsWith('/games') &&
    normalizedPath !== '/buklod-map' && mapReturnRoots.some(route => normalizedPath === route || normalizedPath.startsWith(route + '/'));

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.content,
          {
            paddingTop: contentTopInset,
            paddingBottom: contentBottomInset,
          },
        ]}
      >
        <View style={styles.routedContent}>
          {children}
        </View>
        {!immersiveIgpat ? <BuklodFocusAppAdStrip /> : null}
      </View>

      {!immersiveIgpat && !immersiveConversation && rawNavOccupied > 0 ? (
        <View
          pointerEvents="box-none"
          style={styles.navOverlay}
        >
          <BuklodPersistentBottomNav />
        </View>
      ) : null}

      {worldReturnEligible ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Return to BUKLOD Map"
          onPress={() => router.replace('/buklod-map' as any)}
          hitSlop={8} style={[styles.worldReturn,{bottom:Math.max(navOccupied,0)+11}]}>
          <MaterialCommunityIcons name="earth" size={20} color="#F7D8A2"/>
          <MaterialCommunityIcons name="arrow-left" size={15} color="#F7D8A2"/>
        </Pressable>
      ) : null}
      {immersiveIgpat ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Community Wall"
          accessibilityHint="Returns to the BUKLOD Community Wall"
          hitSlop={10}
          onPress={() => router.replace('/buklod' as any)}
          style={[
            styles.igpatCommunityReturn,
            { top: Math.max(insets.top, 8) + 6 },
          ]}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={23}
            color="#FFFFFF"
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  worldReturn: {
    position: 'absolute', right: 10, zIndex: 1000, minWidth: 44, minHeight: 44,
    borderRadius: 22, backgroundColor: 'rgba(7,20,42,0.88)',
    borderColor: 'rgba(239,211,158,0.6)', borderWidth: 1,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, elevation: 5,
  },
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  routedContent: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  navOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  igpatCommunityReturn: {
    position: 'absolute',
    left: 12,
    zIndex: 1000,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.56)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
  },
});

