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
   * One authenticated popstate listener stays mounted across ALL public and
   * scoped routes. R3 mounted the listener only while Profile/Wall was active,
   * which left a gap during Organization -> Back -> Profile transitions.
   *
   * Canonical behavior:
   * - Profile (/me or /profile) Back -> Community Wall.
   * - Community Wall (/buklod) Back is always consumed and re-armed.
   * - Community Wall never reloads or exits on Back.
   * - Organization/other routes keep their normal browser/router history.
   */
  useEffect(() => {
    if (!user) {
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
      '__BUKLOD_WEB_TERMINAL_BASE_R4__';
    const TERMINAL_GUARD =
      '__BUKLOD_WEB_TERMINAL_GUARD_R4__';

    const normalizeLivePath = () =>
      normalizeBuklodPathname(
        String(
          browserWindow.location?.pathname ?? ''
        )
      );

    const routeKindFor = (path: string) => {
      if (
        path === '/me' ||
        path === '/profile'
      ) {
        return 'PROFILE';
      }

      if (path === '/buklod') {
        return 'WALL';
      }

      return null;
    };

    const armTerminalGuard = (
      routeKind: 'PROFILE' | 'WALL',
    ) => {
      const currentState =
        browserWindow.history.state &&
        typeof browserWindow.history.state === 'object'
          ? browserWindow.history.state
          : {};

      browserWindow.history.replaceState(
        {
          ...currentState,
          [TERMINAL_BASE]: routeKind,
          [TERMINAL_GUARD]: undefined,
        },
        '',
        browserWindow.location.href,
      );

      browserWindow.history.pushState(
        {
          ...currentState,
          [TERMINAL_BASE]: routeKind,
          [TERMINAL_GUARD]: routeKind,
        },
        '',
        browserWindow.location.href,
      );
    };

    const currentKind =
      routeKindFor(
        normalizeLivePath()
      );

    if (currentKind) {
      armTerminalGuard(
        currentKind
      );
    }

    const onPopState = () => {
      const livePath =
        normalizeLivePath();

      const liveKind =
        routeKindFor(
          livePath
        );

      if (liveKind === 'PROFILE') {
        /*
         * Re-arm the current Profile entry immediately so a second rapid
         * hardware Back cannot leave the installed PWA while Expo Router is
         * converging to the canonical root.
         */
        const latestState =
          browserWindow.history.state &&
          typeof browserWindow.history.state === 'object'
            ? browserWindow.history.state
            : {};

        browserWindow.history.pushState(
          {
            ...latestState,
            [TERMINAL_BASE]: 'PROFILE',
            [TERMINAL_GUARD]: 'PROFILE',
          },
          '',
          browserWindow.location.href,
        );

        router.replace(
          '/buklod' as any
        );

        return;
      }

      if (liveKind === 'WALL') {
        /*
         * Consume Back at the canonical root. Do NOT reload: reload can reset
         * the SPA history relationship and was the remaining R3 close path.
         */
        const latestState =
          browserWindow.history.state &&
          typeof browserWindow.history.state === 'object'
            ? browserWindow.history.state
            : {};

        browserWindow.history.pushState(
          {
            ...latestState,
            [TERMINAL_BASE]: 'WALL',
            [TERMINAL_GUARD]: 'WALL',
          },
          '',
          browserWindow.location.href,
        );

        return;
      }

      /*
       * Non-terminal routes keep normal browser/router Back semantics.
       * Because this listener remains mounted globally, when that Back lands
       * on Profile or Wall the next pathname render re-arms its sentinel.
       */
    };

    browserWindow.addEventListener(
      'popstate',
      onPopState,
    );

    return () => {
      browserWindow.removeEventListener(
        'popstate',
        onPopState,
      );
    };
  }, [
    pathname,
    user?.id,
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
