import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  useEffect,
} from 'react';
import {
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { router, usePathname } from 'expo-router';

import BuklodDesktopWebShell from '@/components/BuklodDesktopWebShell';
import BuklodFocusAppAdStrip from '@/components/BuklodFocusAppAdStrip';
import BuklodMobileWebShell from '@/components/BuklodMobileWebShell';
import {
  clearBuklodPersistedAuthStorage,
} from '@/lib/buklodAuthResilience';
import {
  clearAuthSnapshot,
  readPersistedSupabaseSession,
} from '@/lib/buklodAuthSnapshot';
import {
  withBuklodTimeout,
} from '@/lib/buklodAsyncTimeout';
import {
  isBuklodScopedWorkspacePath,
  normalizeBuklodPathname,
} from '@/lib/buklodSafeArea';
import {
  supabase,
} from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

/*
 * BUKLOD_WEB_RESPONSIVE_SPLIT_R3
 * BUKLOD_WEB_BOOT_RECOVERY_R1: keep the outer shell passive during auth hydration.
 * BUKLOD_WEB_STALE_SESSION_SELF_HEAL_R1: if Supabase reports an invalid/revoked
 * refresh token on web, clear only local cached auth/scope state and reload to
 * the clean login route. Server account/data are never deleted or modified.
 *
 * BUKLOD_PUBLIC_MINIMAL_NAV_R2: public/personal routes use the minimal shell at
 * any web width, determined by route rather than transient active-scope state.
 * Managed Organization/Cluster `/scope` routes retain the existing responsive
 * desktop shell behavior and are not changed by this public cleanup.
 *
 * BUKLOD_WEB_FOCUS_ADS_R1 keeps the Focus App ad inside both web layouts,
 * so phone-browser users and desktop-browser users are monetized consistently.
 */

export const BUKLOD_DESKTOP_WEB_MIN_WIDTH = 1100;

function isInvalidRefreshTokenError(error: any): boolean {
  const code = String(
    error?.code ??
      error?.error_code ??
      ''
  ).toLowerCase();

  const text = String(
    error?.message ??
      error?.error_description ??
      error?.error ??
      error ??
      ''
  ).toLowerCase();

  return (
    code.includes('refresh_token_not_found') ||
    code.includes('invalid_refresh_token') ||
    text.includes('refresh token not found') ||
    text.includes('invalid refresh token') ||
    text.includes('refresh_token_not_found') ||
    text.includes('refresh token already used')
  );
}

function useBuklodWebSessionSelfHeal() {
  useEffect(() => {
    let disposed = false;

    void withBuklodTimeout(
      supabase.auth.getSession(),
      5_000,
      'BUKLOD web session health'
    )
      .catch(async (error: any) => {
        if (
          disposed ||
          !isInvalidRefreshTokenError(error)
        ) {
          return;
        }

        const persisted =
          await readPersistedSupabaseSession();
        const userId =
          persisted?.user?.id ?? null;

        await clearBuklodPersistedAuthStorage();

        if (userId) {
          await Promise.allSettled([
            clearAuthSnapshot(userId),
            AsyncStorage.removeItem(
              `buklod:scopes:v1:${userId}`
            ),
          ]);
        }

        await AsyncStorage.removeItem(
          'buklod.auth.fresh_login_public.v1'
        ).catch(() => undefined);

        if (disposed) {
          return;
        }

        const browserLocation =
          (globalThis as any)?.location;

        if (
          browserLocation &&
          typeof browserLocation.replace ===
            'function'
        ) {
          browserLocation.replace(
            '/login?session_recovered=1'
          );
        }
      });

    return () => {
      disposed = true;
    };
  }, []);
}

export default function BuklodNavSafeShell({
  children,
}: {
  children: React.ReactNode;
}) {
  useBuklodWebSessionSelfHeal();

  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const { user } = useAuth();

  /*
   * BUKLOD_WEB_TERMINAL_BACK_GUARD_R4
   *
   * Mobile web / installed PWA resolves this .web.tsx shell, so native
   * BackHandler cannot protect Profile or Community Wall.
   *
   * R2 could leave a stale guard after a round-trip such as:
   * Profile -> Organization -> Back -> Profile -> Back.
   * Re-arm a fresh same-URL history pair every time Profile or Community Wall
   * becomes the active route. popstate resolves the CURRENT browser pathname
   * instead of relying on a route captured when the effect was installed.
   *
   * Canonical behavior:
   * - Profile (/me or /profile) Back -> Community Wall.
   * - Community Wall (/buklod) Back -> stay on/reload Community Wall.
   * - Re-entering either terminal route after another screen always receives a
   *   fresh guard, so browser/PWA history cannot fall through and close.
   */
  useEffect(() => {
    if (!user) {
      return;
    }

    const normalized =
      normalizeBuklodPathname(pathname);

    const isProfileRoot =
      normalized === '/me' ||
      normalized === '/profile';

    const isWall =
      normalized === '/buklod';

    if (!isProfileRoot && !isWall) {
      return;
    }

    const root = globalThis as any;
    const browserWindow = root?.window;

    if (
      !browserWindow?.history?.pushState ||
      !browserWindow?.history?.replaceState ||
      !browserWindow?.addEventListener
    ) {
      return;
    }

    const TERMINAL_BASE =
      '__BUKLOD_WEB_TERMINAL_BASE_R3__';
    const TERMINAL_GUARD =
      '__BUKLOD_WEB_TERMINAL_GUARD_R3__';

    const routeKind =
      isProfileRoot
        ? 'PROFILE'
        : 'WALL';

    /*
     * Phone web / installed PWA gets two same-URL sentinels. This gives the
     * Android system Back button an in-app history entry even when BUKLOD was
     * launched directly from a Home Screen shortcut with no useful prior page.
     */
    const mobileWeb =
      width < BUKLOD_DESKTOP_WEB_MIN_WIDTH;

    const currentState =
      browserWindow.history.state &&
      typeof browserWindow.history.state === 'object'
        ? browserWindow.history.state
        : {};

    /*
     * Always re-arm on route entry/re-entry. Do not trust a historical guard
     * flag: that is exactly what failed after Organization -> Back -> Profile.
     */
    browserWindow.history.replaceState(
      {
        ...currentState,
        [TERMINAL_BASE]: routeKind,
        [TERMINAL_GUARD]: undefined,
      },
      '',
      browserWindow.location.href,
    );

    const armGuard = () => {
      const latestState =
        browserWindow.history.state &&
        typeof browserWindow.history.state === 'object'
          ? browserWindow.history.state
          : currentState;

      browserWindow.history.pushState(
        {
          ...latestState,
          [TERMINAL_BASE]: routeKind,
          [TERMINAL_GUARD]: routeKind,
        },
        '',
        browserWindow.location.href,
      );
    };

    armGuard();

    if (mobileWeb) {
      armGuard();
    }

    const onPopState = (event: any) => {
      /*
       * Run before Expo Router's normal web popstate handling on phone/PWA.
       * Terminal Back is owned by BUKLOD: Profile -> Wall, Wall -> refresh.
       */
      if (
        mobileWeb &&
        typeof event?.stopImmediatePropagation === 'function'
      ) {
        event.stopImmediatePropagation();
      }
      const livePath =
        normalizeBuklodPathname(
          String(
            browserWindow.location?.pathname ?? ''
          )
        );

      const liveIsProfile =
        livePath === '/me' ||
        livePath === '/profile';

      const liveIsWall =
        livePath === '/buklod';

      if (liveIsProfile) {
        /*
         * Restore a guard immediately before changing route so a very fast
         * second hardware-Back cannot fall through while Expo Router updates.
         */
        const latestState =
          browserWindow.history.state &&
          typeof browserWindow.history.state === 'object'
            ? browserWindow.history.state
            : {};

        browserWindow.history.pushState(
          {
            ...latestState,
            [TERMINAL_GUARD]: 'PROFILE',
          },
          '',
          browserWindow.location.href,
        );

        router.replace('/buklod' as any);
        return;
      }

      if (liveIsWall) {
        const latestState =
          browserWindow.history.state &&
          typeof browserWindow.history.state === 'object'
            ? browserWindow.history.state
            : {};

        browserWindow.history.pushState(
          {
            ...latestState,
            [TERMINAL_GUARD]: 'WALL',
          },
          '',
          browserWindow.location.href,
        );

        if (
          typeof browserWindow.location?.reload ===
          'function'
        ) {
          browserWindow.setTimeout(
            () => {
              browserWindow.location.reload();
            },
            0,
          );
        }

        return;
      }

      /*
       * A terminal duplicate entry should normally keep the pathname on the
       * same screen. If the browser already crossed to an older external/app
       * entry, converge back to Community Wall instead of allowing PWA exit.
       */
      router.replace('/buklod' as any);
    };

    browserWindow.addEventListener(
      'popstate',
      onPopState,
      mobileWeb,
    );

    return () => {
      browserWindow.removeEventListener(
        'popstate',
        onPopState,
        mobileWeb,
      );
    };
  }, [
    pathname,
    user?.id,
    width,
  ]);

  const publicMinimal =
    !isBuklodScopedWorkspacePath(pathname);

  const content = (
    <>
      <View style={styles.routedContent}>
        {children}
      </View>
      <BuklodFocusAppAdStrip />
    </>
  );

  if (
    publicMinimal ||
    width < BUKLOD_DESKTOP_WEB_MIN_WIDTH
  ) {
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
