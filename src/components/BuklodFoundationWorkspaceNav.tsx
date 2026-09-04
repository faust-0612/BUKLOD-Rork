import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import {
  BuklodProfileGlassCard,
  BuklodProfileGlassRow,
} from '@/components/BuklodProfileGlassCard';
import { ProfileMotionFadeUp } from '@/components/BuklodProfileMotion';
import {
  BUKLOD_FOCUS_APP_CATALOG,
  BUKLOD_FOCUS_APP_ICONS,
  BUKLOD_FOCUS_APP_LABELS,
  BUKLOD_FOCUS_APP_REGISTRY,
  type BuklodFocusApp,
  type BuklodFocusAppAccess,
} from '@/lib/buklodFoundation';
import { isOrgSubscriptionGatedFocusApp } from '@/lib/buklodCommercialCatalog';
import {
  canUseOrganizationFocusApp,
  resolveOrganizationIdFromScope,
} from '@/lib/buklodOrganizationFocusApps';
import { useBuklodFoundation } from '@/hooks/useBuklodFoundation';
import { openAttendanceWorkspaceForAccount } from '@/lib/buklodScopeManage';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';
import { supabase } from '@/lib/supabase';

export default function BuklodFoundationWorkspaceNav() {
  const { theme } = useBuklodTheme();
  const { focusApps } = useBuklodFoundation();
  const { scopes, activeScope, selectScope } = useBuklodScope();
  const [open, setOpen] = useState(false);
  const [openingKey, setOpeningKey] = useState<string | null>(null);
  const [locked, setLocked] = useState<Record<string, boolean>>({});

  const organizationId =
    resolveOrganizationIdFromScope(activeScope) ??
    scopes.map((scope) => resolveOrganizationIdFromScope(scope)).find(Boolean) ??
    null;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: {
          marginTop: 4,
          paddingHorizontal: 12,
        },
        eyebrow: {
          marginBottom: 8,
          marginLeft: 4,
          color: theme.textMuted,
          fontSize: 12,
          fontWeight: '800',
          letterSpacing: 0.8,
        },
        rowBorder: {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.border,
        },
        lockNote: {
          paddingHorizontal: 14,
          paddingBottom: 12,
          fontSize: 12,
          lineHeight: 17,
          color: theme.textMuted,
        },
      }),
    [theme],
  );

  const catalogApps = useMemo(() => {
    const byApp = new Map<BuklodFocusApp, BuklodFocusAppAccess>();
    for (const item of focusApps) {
      byApp.set(item.app, item);
    }
    return BUKLOD_FOCUS_APP_REGISTRY.map((app) => {
      const existing = byApp.get(app);
      return {
        app,
        access: existing ?? null,
        gated: isOrgSubscriptionGatedFocusApp(app),
      };
    });
  }, [focusApps]);

  const openDrawer = useCallback(async () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (!nextOpen || !organizationId) return;

    const nextLocked: Record<string, boolean> = {};
    await Promise.all(
      catalogApps
        .filter((row) => row.gated)
        .map(async (row) => {
          const allowed = await canUseOrganizationFocusApp(
            organizationId,
            row.app,
          );
          nextLocked[row.app] = !allowed;
        }),
    );
    setLocked(nextLocked);
  }, [catalogApps, open, organizationId]);

  const openApp = useCallback(
    async (app: BuklodFocusApp, item: BuklodFocusAppAccess | null) => {
      if (openingKey) return;

      /* PATCH_ORG_PROFILE_SETUP_HUB_R24
       * Organization in Profile is a setup/management doorway.
       * Never allow an organization-specific workspace route (for example
       * MZB Home) to override this canonical entry point.
       */
      if (app === 'organization') {
        router.push('/organizations' as any);
        return;
      }

      if (locked[app]) {
        router.push('/profile/focus-apps' as any);
        return;
      }

      const route =
        item?.workspace?.route ||
        BUKLOD_FOCUS_APP_CATALOG[app].routes[0];
      if (!route) return;

      setOpeningKey(app);
      try {
        if (app === 'faculty') {
          const { error } = await (supabase as any).rpc(
            'buklod_education_activate_faculty_workspace_v1',
          );
          if (error) throw error;
        }
        if (app === 'attendance') {
          await openAttendanceWorkspaceForAccount(selectScope, scopes, {
            scopeId: item?.scopeId,
            activeScope,
          });
          return;
        }
        router.push(route as any);
      } catch (error: any) {
        Alert.alert(
          BUKLOD_FOCUS_APP_LABELS[app],
          String(error?.message ?? 'Could not open this BUKLOD workspace.'),
        );
      } finally {
        setOpeningKey(null);
      }
    },
    [activeScope, locked, openingKey, scopes, selectScope],
  );

  return (
    <View style={styles.section}>
      <ProfileMotionFadeUp delay={0} duration={240} fromY={10} fromOpacity={0.78}>
        <Text style={styles.eyebrow}>BUKLOD FOCUS APPS</Text>
      </ProfileMotionFadeUp>

      <BuklodProfileGlassCard>
        <BuklodProfileGlassRow
          icon="apps"
          title="BUKLOD Focus Apps"
          subtitle="Premium portals · ₱59/month or ₱499/year"
          onPress={() => void openDrawer()}
          trailing={
            <MaterialCommunityIcons
              name={open ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={theme.textMuted}
            />
          }
        />

        {open
          ? catalogApps.map((row, index) => {
              const opening = openingKey === row.app;
              const isLocked = row.gated && locked[row.app] !== false && locked[row.app] !== undefined
                ? locked[row.app]
                : row.gated && !row.access?.canSee;
              const title = BUKLOD_FOCUS_APP_LABELS[row.app];
              return (
                <View key={row.app} style={index >= 0 ? styles.rowBorder : undefined}>
                  <BuklodProfileGlassRow
                    icon={
                      (BUKLOD_FOCUS_APP_ICONS[row.app] as
                        React.ComponentProps<typeof MaterialCommunityIcons>['name']) ||
                      'apps'
                    }
                    title={title}
                    subtitle={
                      row.app === 'organization'
                        ? 'Setup Organization, Sub-organization, Cluster and structure'
                        : isLocked
                          ? 'Locked · subscription required'
                          : 'Open portal'
                    }
                    disabled={!!openingKey}
                    onPress={() => void openApp(row.app, row.access)}
                    trailing={
                      opening ? (
                        <ActivityIndicator size="small" color={theme.accent} />
                      ) : (
                        <MaterialCommunityIcons
                          name={row.app === 'organization' ? 'chevron-right' : isLocked ? 'lock-outline' : 'chevron-right'}
                          size={20}
                          color={theme.textMuted}
                        />
                      )
                    }
                  />
                </View>
              );
            })
          : null}

        {open ? (
          <Pressable onPress={() => router.push('/profile/focus-apps' as any)}>
            <Text style={styles.lockNote}>
              Show plans, lock state, and Organization subscription options.
            </Text>
          </Pressable>
        ) : null}
      </BuklodProfileGlassCard>
    </View>
  );
}
