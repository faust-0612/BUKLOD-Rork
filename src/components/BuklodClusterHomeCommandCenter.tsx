// RELEASE_TRIGGER_WEB_OTA_20260909_REPORT_GATE_R1
import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  router,
  useFocusEffect,
} from 'expo-router';

import BuklodClusterHomeCommandCenterImpl from '@/components/BuklodClusterHomeCommandCenterImpl';
import type { DashboardTheme } from '@/components/BuklodDashboardCustomizer';
import { clusterScopeManageRoute } from '@/lib/buklodCluster';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import type { BuklodScope } from '@/lib/buklodScope';

type Props = {
  scope: BuklodScope;
  onOpenCommunity?: () => void;
  onOpenConnect?: () => void;
  manageMode?: boolean;
  theme?: DashboardTheme;
};

/**
 * Canonical Cluster Home entry point.
 *
 * Never rely only on cached scope.is_admin for Cluster management. Older
 * cached/supplemental scope rows can temporarily carry is_admin=false even
 * while the signed-in user is an ACTIVE admin in the exact Cluster. The
 * backend remains authoritative, so re-check scoped admin authority whenever
 * this Home is focused and promote the command center to admin mode when the
 * server confirms it.
 */
export default function BuklodClusterHomeCommandCenter({
  scope,
  onOpenCommunity,
  onOpenConnect,
  manageMode = false,
  theme,
}: Props) {
  const localCanManage = Boolean(
    manageMode || scope.is_admin
  );
  const [serverCanManage, setServerCanManage] =
    useState(false);

  useEffect(() => {
    setServerCanManage(false);
  }, [scope.scope_id]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (
        scope.scope_type !== 'CLUSTER' ||
        !scope.scope_id
      ) {
        return () => {
          active = false;
        };
      }

      void (async () => {
        try {
          const { data, error } = await (supabase as any).rpc(
            'buklod_is_scope_admin',
            {
              _scope_id: scope.scope_id,
            }
          );

          if (!active) {
            return;
          }

          if (error) {
            console.warn(
              'Cluster Home admin verification:',
              error
            );
            return;
          }

          setServerCanManage(data === true);
        } catch (error) {
          if (active) {
            console.warn(
              'Cluster Home admin verification:',
              error
            );
          }
        }
      })();

      return () => {
        active = false;
      };
    }, [scope.scope_id, scope.scope_type])
  );

  /*
   * A locally-known admin remains an admin immediately; a stale member-only
   * cache can be upgraded by the backend check above. Canonical Manage routes
   * still perform their own server-side exact-Cluster authorization check.
   */
  const canManageCluster = Boolean(
    localCanManage || serverCanManage
  );

  return (
    <View style={styles.screen}>
      {/* BUKLOD_V28_CLUSTER_MANAGE_INLINE_R1: compact Manage button now lives beside Search in the command center. */}

      <View style={styles.commandCenter}>
        <BuklodClusterHomeCommandCenterImpl
          scope={scope}
          onOpenCommunity={onOpenCommunity}
          onOpenConnect={onOpenConnect}
          manageMode={canManageCluster}
          theme={theme}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    minHeight: 0,
  },
  commandCenter: {
    flex: 1,
    minHeight: 0,
  },
  manageButton: {
    minHeight: 64,
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.greenDark,
  },
  manageIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  manageCopy: {
    flex: 1,
  },
  manageTitle: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  manageSubtitle: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 9,
    lineHeight: 13,
  },
  pressed: {
    opacity: 0.76,
  },
});
