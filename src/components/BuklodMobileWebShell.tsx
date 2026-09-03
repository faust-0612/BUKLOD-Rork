import React, {
  useEffect,
  useState,
} from 'react';
import {
  Keyboard,
  StyleSheet,
  View,
} from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BuklodPersistentBottomNav from '@/components/BuklodPersistentBottomNav';
import {
  normalizeBuklodPathname,
  useBuklodPersistentNavOccupiedHeight,
} from '@/lib/buklodSafeArea';

/*
 * BUKLOD_MOBILE_WEB_SHELL_R3
 * Phone/small-browser web intentionally keeps the original BUKLOD mobile-web
 * layout: routed content plus the persistent bottom navigation. This is a web
 * component only and does not change the Android/iOS APK implementation.
 */

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

export default function BuklodMobileWebShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const navOccupied = useBuklodPersistentNavOccupiedHeight();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const reserveMyBuklodSystemInsets = isMyBuklodDoorPath(pathname);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const contentTopInset = reserveMyBuklodSystemInsets
    ? Math.max(insets.top, 0)
    : 0;

  const contentBottomInset = keyboardVisible
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
        {children}
      </View>

      <View pointerEvents="box-none" style={styles.navOverlay}>
        <BuklodPersistentBottomNav />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  content: {
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
