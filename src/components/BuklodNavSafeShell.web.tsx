import React from 'react';
import { useWindowDimensions } from 'react-native';

import BuklodDesktopWebShell from '@/components/BuklodDesktopWebShell';
import BuklodMobileWebShell from '@/components/BuklodMobileWebShell';

/*
 * BUKLOD_WEB_RESPONSIVE_SPLIT_R3
 *
 * One Expo web build serves both phone browsers and desktop browsers.
 * Do not infer "web" as "desktop": small viewports keep the original
 * mobile-style BUKLOD layout, while desktop-sized viewports receive the
 * Facebook-style desktop shell. Android/iOS APK still resolve the native
 * BuklodNavSafeShell.tsx and are completely separate from this decision.
 */

export const BUKLOD_DESKTOP_WEB_MIN_WIDTH = 1100;

export default function BuklodNavSafeShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { width } = useWindowDimensions();

  if (width < BUKLOD_DESKTOP_WEB_MIN_WIDTH) {
    return (
      <BuklodMobileWebShell>
        {children}
      </BuklodMobileWebShell>
    );
  }

  return (
    <BuklodDesktopWebShell>
      {children}
    </BuklodDesktopWebShell>
  );
}
