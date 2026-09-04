import React from 'react';
import {
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import BuklodDesktopWebShell from '@/components/BuklodDesktopWebShell';
import BuklodFocusAppAdStrip from '@/components/BuklodFocusAppAdStrip';
import BuklodMobileWebShell from '@/components/BuklodMobileWebShell';

/*
 * BUKLOD_WEB_RESPONSIVE_SPLIT_R3
 * BUKLOD_WEB_BOOT_RECOVERY_R1: keep the outer shell passive during auth hydration.
 *
 * One Expo web build serves both phone browsers and desktop browsers.
 * Do not infer "web" as "desktop": small viewports keep the original
 * mobile-style BUKLOD layout, while desktop-sized viewports receive the
 * Facebook-style desktop shell. Android/iOS APK still resolve the native
 * BuklodNavSafeShell.tsx and are completely separate from this decision.
 *
 * BUKLOD_WEB_FOCUS_ADS_R1 keeps the Focus App ad inside both web layouts,
 * so phone-browser users and desktop-browser users are monetized consistently.
 */

export const BUKLOD_DESKTOP_WEB_MIN_WIDTH = 1100;

export default function BuklodNavSafeShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { width } = useWindowDimensions();

  const content = (
    <>
      <View style={styles.routedContent}>
        {children}
      </View>
      <BuklodFocusAppAdStrip />
    </>
  );

  if (width < BUKLOD_DESKTOP_WEB_MIN_WIDTH) {
    return (
      <BuklodMobileWebShell>
        {content}
      </BuklodMobileWebShell>
    );
  }

  return (
    <BuklodDesktopWebShell>
      {content}
    </BuklodDesktopWebShell>
  );
}

const styles = StyleSheet.create({
  routedContent: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
});
