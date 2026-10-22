import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { useScopeManageParams } from '@/components/ScopeManageGate';
import { clusterScopeManageRoute } from '@/lib/buklodCluster';
import { organizationScopeManageRoute } from '@/lib/buklodOrganization';
import { buildScopedWorkspacePath } from '@/lib/buklodScopeRoute';
import { colors } from '@/lib/theme';

/**
 * Legacy redirect — canonical Manage hubs are:
 * - Cluster: /clusters/scope-manage
 * - Organization / Sub-org: /organizations/scope-manage
 */
export default function ScopeManageRedirectScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { scopeId, scopeType } = useScopeManageParams(
    params as Record<string, unknown>
  );
  const scopeName = String(params.scopeName ?? '').trim();

  useEffect(() => {
    if (!scopeId) return;

    const type = scopeType.toUpperCase();

    if (type === 'CLUSTER') {
      router.replace(
        clusterScopeManageRoute(scopeId, scopeName) as any
      );
      return;
    }

    if (type === 'ORGANIZATION') {
      router.replace(
        organizationScopeManageRoute(scopeId, scopeName) as any
      );
      return;
    }

    router.replace(
      buildScopedWorkspacePath(
        'home',
        scopeId
      ) as any
    );
  }, [router, scopeId, scopeName, scopeType]);

  return (
    <>
      <Stack.Screen options={{ title: 'Manage' }} />
      <View style={styles.center}>
        <ActivityIndicator color={colors.green} />
        <Text style={styles.muted}>Opening Manage...</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#F4F7F5',
  },
  muted: {
    color: colors.muted,
    fontSize: 12,
  },
});
