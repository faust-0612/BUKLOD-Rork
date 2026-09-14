import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  useEffect,
} from 'react';
import {
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

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
  supabase,
} from '@/lib/supabase';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';

/*
 * BUKLOD_WEB_RESPONSIVE_SPLIT_R3
 * BUKLOD_WEB_BOOT_RECOVERY_R1: keep the outer shell passive during auth hydration.
 * BUKLOD_WEB_STALE_SESSION_SELF_HEAL_R1: if Supabase reports an invalid/revoked
 * refresh token on web, clear only local cached auth/scope state and reload to
 * the clean login route. Server account/data are never deleted or modified.
 *
 * BUKLOD_PUBLIC_MINIMAL_NAV_R1: PUBLIC always uses the minimal mobile-style
 * shell at any web width, so the old desktop navigation pane is not rendered.
 * Managed Organization/Cluster workspaces retain the existing responsive
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
  const { activeScope } = useBuklodScope();
  const publicMinimal = activeScope?.scope_type === 'PUBLIC';

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
