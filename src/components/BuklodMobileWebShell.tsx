import React, {
  useEffect,
  useState,
} from 'react';
import {
  Keyboard,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BuklodPersistentBottomNav from '@/components/BuklodPersistentBottomNav';
import { BUKLOD_DESKTOP_DASHBOARD_MIN_WIDTH } from '@/lib/buklodWebResponsivePolicy';
import {
  shouldShowBuklodPublicBottomNav,
  normalizeBuklodPathname,
  useBuklodPersistentNavOccupiedHeight,
} from '@/lib/buklodSafeArea';

/*
 * BUKLOD_MOBILE_WEB_SHELL_R3
 * BUKLOD_MOBILE_WEB_TOUCH_R5
 * BUKLOD_PUBLIC_MINIMAL_NAV_R2
 * Phone/small-browser web keeps the mobile layout, but public/personal routes
 * no longer render or reserve the old persistent bottom navigation pane.
 * `/scope` remains authoritative for Organization/Cluster workspace behavior.
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
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const rawNavOccupied = useBuklodPersistentNavOccupiedHeight();
  // No bottom nav on wide browser detail routes even when this fallback
  // mobile-compatible shell renders a conversation or post detail.
  const eligibleForGlobalNav = shouldShowBuklodPublicBottomNav(pathname);
  const desktopDetail = width >= BUKLOD_DESKTOP_DASHBOARD_MIN_WIDTH && eligibleForGlobalNav;
  const showGlobalNav = eligibleForGlobalNav && !desktopDetail;
  const navOccupied = showGlobalNav ? rawNavOccupied : 0;
  const insets = useSafeAreaInsets();
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
          desktopDetail && styles.desktopDetail,
          {
            paddingTop: contentTopInset,
            paddingBottom: contentBottomInset,
          },
        ]}
      >
        {children}
      </View>

      {showGlobalNav ? (
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
  desktopDetail: {
    width: '100%',
    maxWidth: 1190,
    alignSelf: 'center',
  },
  navOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
