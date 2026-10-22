import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text } from 'react-native';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import BuklodClusterHomeCommandCenter from '@/components/BuklodClusterHomeCommandCenter';
import ClusterManageGate from '@/components/ClusterManageGate';
import { readClusterScopeId } from '@/lib/buklodCluster';
import { getClusterDetails } from '@/lib/buklodClusters';
import type { BuklodScope } from '@/lib/buklodScope';
import { Stack, useLocalSearchParams } from 'expo-router';
import { colors } from '@/lib/theme';

export default function ClusterHomeContentManageScreen() {
  const params = useLocalSearchParams();
  const scopeId = readClusterScopeId(
    params as Record<string, unknown>
  );
  const { scopes } = useBuklodScope();
  const [scope, setScope] = useState<BuklodScope | null>(
    scopes.find((s) => s.scope_id === scopeId) ?? null
  );
  const [loadingScope, setLoadingScope] = useState(!scope);

  useEffect(() => {
    const match = scopes.find((s) => s.scope_id === scopeId);
    if (match) {
      setScope(match);
      setLoadingScope(false);
      return;
    }

    if (!scopeId) {
      setLoadingScope(false);
      return;
    }

    void getClusterDetails(scopeId)
      .then((details) => {
        if (!details) return;

        setScope({
          scope_id: details.scope_id,
          name: details.name,
          scope_type: 'CLUSTER',
          visibility: details.visibility,
          scope_status: details.scope_status,
          member_count: details.member_count,
          is_admin: true,
          role_keys: ['cluster_admin'],
          feature_keys: [],
        });
      })
      .finally(() => setLoadingScope(false));
  }, [scopes, scopeId]);

  return (
    <>
      <Stack.Screen options={{ title: 'Cluster Home Content' }} />
      <ClusterManageGate scopeId={scopeId}>
        {() =>
          loadingScope ? (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <ActivityIndicator color={colors.green} />
              <Text style={{ color: colors.muted }}>Loading...</Text>
            </View>
          ) : scope ? (
            <BuklodClusterHomeCommandCenter scope={scope} manageMode />
          ) : null
        }
      </ClusterManageGate>
    </>
  );
}
