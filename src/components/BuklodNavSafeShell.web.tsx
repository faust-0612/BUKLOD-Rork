import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';

import BuklodDesktopWebShell from '@/components/BuklodDesktopWebShell';
import BuklodFocusAppAdStrip from '@/components/BuklodFocusAppAdStrip';
import BuklodMobileWebShell from '@/components/BuklodMobileWebShell';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';

/*
 * BUKLOD_WEB_RESPONSIVE_SPLIT_R3
 *
 * One Expo web build serves both phone browsers and desktop browsers.
 * Do not infer "web" as "desktop": small viewports keep the original
 * mobile-style BUKLOD layout, while desktop-sized viewports receive the
 * Facebook-style desktop shell. Android/iOS APK still resolve the native
 * BuklodNavSafeShell.tsx and are completely separate from this decision.
 *
 * BUKLOD_WEB_FOCUS_ADS_R1 keeps the Focus App ad inside both web layouts,
 * so phone-browser users and desktop-browser users are monetized consistently.
 *
 * BUKLOD_DESKTOP_OPTIONAL_FOCUS_VIEW_R1
 * Content-heavy desktop routes can opt into an immersive app-level Focus View.
 * This is NEVER automatic: the normal BUKLOD desktop shell stays the default.
 * Mobile web and native APK behavior are unchanged.
 */

export const BUKLOD_DESKTOP_WEB_MIN_WIDTH = 1100;

const DESKTOP_FOCUS_ROUTE_HINTS = [
  'learn',
  'lesson',
  'course',
  'module',
  'hymn',
  'hymnal',
  'bible',
  'reader',
  'document',
  'material',
  'presentation',
  'classroom',
  'faculty',
  'gradebook',
  'attendance',
  'quiz',
  'exam',
  'report',
  'dashboard',
  'analytics',
  'workspace',
  'giving',
  'business',
  'health',
  'market',
  'government',
  'organization',
] as const;

function isDesktopFocusEligible(pathname: string) {
  const segments = String(pathname ?? '')
    .toLowerCase()
    .split(/[/?#]+/)
    .filter(Boolean);

  return segments.some(segment =>
    DESKTOP_FOCUS_ROUTE_HINTS.some(hint => segment.includes(hint))
  );
}

export default function BuklodNavSafeShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const { theme } = useBuklodTheme();
  const [focusMode, setFocusMode] = useState(false);

  const desktopFocusEligible = useMemo(
    () => width >= BUKLOD_DESKTOP_WEB_MIN_WIDTH && isDesktopFocusEligible(pathname),
    [pathname, width]
  );

  // Focus View is an explicit per-page choice. Navigating away always restores
  // the normal BUKLOD shell so users are never trapped in an immersive layout.
  useEffect(() => {
    setFocusMode(false);
  }, [pathname]);

  // ESC is a desktop convenience exit; the visible Exit Focus button remains
  // the primary control.
  useEffect(() => {
    if (!focusMode || typeof window === 'undefined') return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFocusMode(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusMode]);

  if (width < BUKLOD_DESKTOP_WEB_MIN_WIDTH) {
    const mobileContent = (
      <>
        <View style={styles.routedContent}>
          {children}
        </View>
        <BuklodFocusAppAdStrip />
      </>
    );

    return (
      <BuklodMobileWebShell>
        {mobileContent}
      </BuklodMobileWebShell>
    );
  }

  if (focusMode && desktopFocusEligible) {
    return (
      <View style={[styles.focusRoot, { backgroundColor: theme.canvas }]}>
        <View style={styles.focusContent}>
          {children}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Exit Focus View"
          onPress={() => setFocusMode(false)}
          style={({ pressed }) => [
            styles.focusToggle,
            {
              backgroundColor: theme.surfaceElevated,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            },
            pressed && styles.pressed,
          ]}
        >
          <MaterialCommunityIcons
            name="fullscreen-exit"
            size={20}
            color={theme.accent}
          />
          <Text style={[styles.focusToggleText, { color: theme.textPrimary }]}>Exit Focus</Text>
        </Pressable>
      </View>
    );
  }

  const desktopContent = (
    <View style={styles.desktopContentStack}>
      <View style={styles.routedContent}>
        {children}
      </View>

      <BuklodFocusAppAdStrip />

      {desktopFocusEligible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Focus View"
          onPress={() => setFocusMode(true)}
          style={({ pressed }) => [
            styles.focusToggle,
            {
              backgroundColor: theme.surfaceElevated,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            },
            pressed && styles.pressed,
          ]}
        >
          <MaterialCommunityIcons
            name="fullscreen"
            size={20}
            color={theme.accent}
          />
          <Text style={[styles.focusToggleText, { color: theme.textPrimary }]}>Focus View</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <BuklodDesktopWebShell>
      {desktopContent}
    </BuklodDesktopWebShell>
  );
}

const styles = StyleSheet.create({
  routedContent: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  desktopContentStack: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    position: 'relative',
  },
  focusRoot: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    position: 'relative',
  },
  focusContent: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  focusToggle: {
    position: 'absolute',
    top: 14,
    right: 16,
    zIndex: 10000,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 8,
  },
  focusToggleText: {
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.72,
  },
});
