import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import BuklodClusterHomeCommandCenterImpl from '@/components/BuklodClusterHomeCommandCenterImpl';
import { clusterScopeManageRoute } from '@/lib/buklodCluster';
import { colors } from '@/lib/theme';
import type { BuklodScope } from '@/lib/buklodScope';

type Props = {
  scope: BuklodScope;
  onOpenCommunity?: () => void;
  onOpenConnect?: () => void;
  manageMode?: boolean;
};

/**
 * Canonical Cluster Home entry point.
 *
 * Cluster admin authority belongs to the scope itself. Older callers passed
 * manageMode={false} for the normal Home route, which accidentally downgraded
 * real Cluster admins to the member-only command center. Keep the legacy prop
 * for dedicated manage previews, but never hide admin tools from a scope admin.
 */
export default function BuklodClusterHomeCommandCenter({
  scope,
  onOpenCommunity,
  onOpenConnect,
  manageMode = false,
}: Props) {
  const canManageCluster = Boolean(
    manageMode || scope.is_admin
  );

  return (
    <View style={styles.screen}>
      {canManageCluster ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Manage ${scope.name} Cluster`}
          onPress={() =>
            router.push(
              clusterScopeManageRoute(
                scope.scope_id,
                scope.name
              ) as any
            )
          }
          style={({ pressed }) => [
            styles.manageButton,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.manageIcon}>
            <MaterialCommunityIcons
              name="shield-crown-outline"
              size={20}
              color={colors.white}
            />
          </View>
          <View style={styles.manageCopy}>
            <Text style={styles.manageTitle}>
              MANAGE CLUSTER
            </Text>
            <Text style={styles.manageSubtitle}>
              Members, requests, admins, settings, features and Cluster controls
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color={colors.white}
          />
        </Pressable>
      ) : null}

      <View style={styles.commandCenter}>
        <BuklodClusterHomeCommandCenterImpl
          scope={scope}
          onOpenCommunity={onOpenCommunity}
          onOpenConnect={onOpenConnect}
          manageMode={canManageCluster}
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
