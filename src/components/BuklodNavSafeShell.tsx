import React, {
  useEffect,
  useState,
} from 'react';

import {
  Keyboard,
  Platform,
  StyleSheet,
  View,
} from 'react-native';

import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BuklodFocusAppAdStrip from '@/components/BuklodFocusAppAdStrip';
import BuklodPersistentBottomNav from '@/components/BuklodPersistentBottomNav';
import {
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

/**
 * Root shell: shrinks routed content above the global bottom nav so door
 * screens and dashboard pushes never sit underneath the phone nav pane.
 * Focus App routes also receive one normal-flow AdMob banner above that pane.
 */
export default function BuklodNavSafeShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const navOccupied =
    useBuklodPersistentNavOccupiedHeight();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
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
    reserveMyBuklodSystemInsets
      ? Math.max(insets.top, 0)
      : 0;
  const contentBottomInset =
    keyboardVisible
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
        <BuklodFocusAppAdStrip />
      </View>

      <View
        pointerEvents="box-none"
        style={styles.navOverlay}
      >
        <BuklodPersistentBottomNav />
      </View>
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
});
