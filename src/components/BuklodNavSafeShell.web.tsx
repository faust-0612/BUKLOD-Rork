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
   * BUKLOD_WEB_PROFILE_BACK_TO_WALL_R2
   *
   * Mobile web / installed PWA does not execute the native BackHandler in
   * BuklodNavSafeShell.tsx because Expo resolves this .web.tsx file instead.
   *
   * Canonical behavior:
   * - Profile root (/me or /profile) -> browser/system Back goes to Community Wall.
   * - Community Wall (/buklod) is the signed-in terminal root.
   * - Back from Community Wall is consumed by a same-URL history barrier and
   *   refreshes the Wall instead of leaving/closing the installed PWA.
   */
  useEffect(() => {
    if (!user) {
      return;
    }

    const normalized =
      normalizeBuklodPathname(pathname);

    const root = globalThis as any;
    const browserWindow = root?.window;

    if (
      !browserWindow?.history?.pushState ||
      !browserWindow?.addEventListener
    ) {
      return;
    }

    const isProfileRoot =
      normalized === '/me' ||
      normalized === '/profile';

    const isWall =
      normalized === '/buklod';

    if (!isProfileRoot && !isWall) {
      return;
    }

    const PROFILE_BASE =
      '__BUKLOD_WEB_PROFILE_BASE_R2__';
    const PROFILE_GUARD =
      '__BUKLOD_WEB_PROFILE_GUARD_R2__';
    const WALL_BASE =
      '__BUKLOD_WEB_WALL_BASE_R2__';
    const WALL_GUARD =
      '__BUKLOD_WEB_WALL_GUARD_R2__';

    const state =
      browserWindow.history.state &&
      typeof browserWindow.history.state === 'object'
        ? browserWindow.history.state
        : {};

    if (isProfileRoot) {
      if (
        !state?.[PROFILE_BASE] &&
        !state?.[PROFILE_GUARD]
      ) {
        browserWindow.history.replaceState(
          {
            ...state,
            [PROFILE_BASE]: true,
          },
          '',
          browserWindow.location.href,
        );

        browserWindow.history.pushState(
          {
            ...state,
            [PROFILE_GUARD]: true,
          },
          '',
          browserWindow.location.href,
        );
      }
    }

    if (isWall) {
      if (
        !state?.[WALL_BASE] &&
        !state?.[WALL_GUARD]
      ) {
        browserWindow.history.replaceState(
          {
            ...state,
            [WALL_BASE]: true,
          },
          '',
          browserWindow.location.href,
        );

        browserWindow.history.pushState(
          {
            ...state,
            [WALL_GUARD]: true,
          },
          '',
          browserWindow.location.href,
        );
      }
    }

    const onPopState = () => {
      if (isProfileRoot) {
        router.replace('/buklod' as any);
        return;
      }

      if (isWall) {
        const latestState =
          browserWindow.history.state &&
          typeof browserWindow.history.state === 'object'
            ? browserWindow.history.state
            : {};

        browserWindow.history.pushState(
          {
            ...latestState,
            [WALL_GUARD]: true,
          },
          '',
          browserWindow.location.href,
        );

        if (
          typeof browserWindow.location?.reload ===
          'function'
        ) {
          browserWindow.setTimeout(
            () => browserWindow.location.reload(),
            0,
          );
        }
      }
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
