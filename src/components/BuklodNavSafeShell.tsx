import React, {
  useEffect,
  useState,
} from 'react';

import {
  BackHandler,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/AuthProvider';

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
  const { user } = useAuth();
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

  /*
   * BUKLOD_ROOT_BACK_TO_WALL_R2
   *
   * Community Wall is the canonical signed-in root.
   *
   * Android:
   * - preserve meaningful navigation history;
   * - when history is exhausted, return to Community Wall;
   * - once on Community Wall, consume hardware Back so BUKLOD does not
   *   unexpectedly close.
   *
   * Scoped workspaces keep their dedicated section-aware BackHandler.
   */
  useEffect(() => {
    if (
      Platform.OS !== 'android' ||
      !user
    ) {
      return;
    }

    if (
      isBuklodScopedWorkspacePath(
        pathname
      )
    ) {
      return;
    }

    const normalized =
      normalizeBuklodPathname(
        pathname
      );

    const subscription =
      BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          if (
            normalized === '/buklod'
          ) {
            return true;
          }

          if (router.canGoBack()) {
            return false;
          }

          router.replace(
            '/buklod' as any
          );

          return true;
        }
      );

    return () => {
      subscription.remove();
    };
  }, [
    pathname,
    user?.id,
  ]);


  /*
   * BUKLOD_WEB_WALL_ROOT_HISTORY_GUARD_R1
   *
   * Mobile Web / installed PWA has no React Native BackHandler.
   * Keep one same-URL history barrier behind Community Wall so Android's
   * system Back does not immediately leave/close BUKLOD at its canonical root.
   */
  useEffect(() => {
    if (
      Platform.OS !== 'web' ||
      !user
    ) {
      return;
    }

    const normalized =
      normalizeBuklodPathname(
        pathname
      );

    if (
      normalized !== '/buklod'
    ) {
      return;
    }

    const root =
      globalThis as any;

    const browserWindow =
      root?.window;

    if (
      !browserWindow?.history
        ?.pushState
    ) {
      return;
    }

    const GUARD_KEY =
      '__BUKLOD_WALL_ROOT_GUARD_R1__';

    const BASE_KEY =
      '__BUKLOD_WALL_ROOT_BASE_R1__';

    const currentState =
      browserWindow.history
        .state ?? {};

    if (
      !currentState?.[GUARD_KEY] &&
      !currentState?.[BASE_KEY]
    ) {
      browserWindow.history
        .replaceState(
          {
            ...currentState,
            [BASE_KEY]: true,
          },
          '',
          browserWindow.location.href,
        );

      browserWindow.history
        .pushState(
          {
            ...currentState,
            [GUARD_KEY]: true,
          },
          '',
          browserWindow.location.href,
        );
    }

    const onPopState =
      (event: any) => {
        const currentPath =
          normalizeBuklodPathname(
            String(
              browserWindow.location
                ?.pathname ?? ''
            )
          );

        if (
          currentPath !== '/buklod'
        ) {
          return;
        }

        const poppedState =
          event?.state &&
          typeof event.state ===
            'object'
            ? event.state
            : {};

        browserWindow.history
          .pushState(
            {
              ...poppedState,
              [GUARD_KEY]: true,
            },
            '',
            browserWindow.location.href,
          );
      };

    browserWindow.addEventListener(
      'popstate',
      onPopState,
    );

    return () => {
      browserWindow
        .removeEventListener(
          'popstate',
          onPopState,
        );
    };
  }, [
    pathname,
    user?.id,
  ]);

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
