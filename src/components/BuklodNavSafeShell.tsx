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
import BuklodPersistentBottomNav from '@/components/BuklodPersistentBottomNav';
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
  const rawNavOccupied =
    useBuklodPersistentNavOccupiedHeight();
  const publicMinimal =
    !isBuklodScopedWorkspacePath(pathname);
  const navOccupied = publicMinimal
    ? 0
    : rawNavOccupied;
  const insets = useSafeAreaInsets();
  const immersiveIgpat =
    isImmersiveIgpatPath(pathname);
  const reserveMyBuklodSystemInsets =
    isMyBuklodDoorPath(pathname);
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
    immersiveIgpat
      ? 0
      : keyboardVisible
        ? 0
        : navOccupied > 0
          ? navOccupied
          : reserveMyBuklodSystemInsets
            ? Math.max(insets.bottom, 0)
            : 0;

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

      {!immersiveIgpat && !publicMinimal ? (
        <View
          pointerEvents="box-none"
          style={styles.navOverlay}
        >
          <BuklodPersistentBottomNav />
        </View>
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
