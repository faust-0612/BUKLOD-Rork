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
import { useBuklodScope } from '@/providers/BuklodScopeProvider';

/*
 * BUKLOD_MOBILE_WEB_SHELL_R3
 * BUKLOD_MOBILE_WEB_TOUCH_R5
 * BUKLOD_PUBLIC_MINIMAL_NAV_R1
 * Phone/small-browser web keeps the mobile layout, but PUBLIC no longer
 * renders or reserves the old persistent bottom navigation pane. Managed
 * Organization/Cluster behavior stays unchanged.
 * R5 is the deployment anchor for the dedicated web avatar drag and tolerant
 * web press target implementations.
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
  const rawNavOccupied = useBuklodPersistentNavOccupiedHeight();
  const { activeScope } = useBuklodScope();
  const publicMinimal = activeScope?.scope_type === 'PUBLIC';
  const navOccupied = publicMinimal ? 0 : rawNavOccupied;
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

      {!publicMinimal ? (
        <View pointerEvents="box-none" style={styles.navOverlay}>
          <BuklodPersistentBottomNav />
        </View>
      ) : null}
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
