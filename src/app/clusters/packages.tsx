import React from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import BuklodClusterPackagesCard from '@/components/BuklodClusterPackagesCard';
import { readClusterScopeId } from '@/lib/buklodCluster';

export default function ClusterPackagesScreen() {
  const params = useLocalSearchParams();
  const scopeId = readClusterScopeId(params as Record<string, unknown>);
  const name =
    typeof params.clusterName === 'string' ? params.clusterName : 'Cluster';

  return (
    <>
      <Stack.Screen options={{ title: 'Cluster Packages' }} />
      <BuklodPortalScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <BuklodClusterPackagesCard scopeId={scopeId} scopeName={name} />
      </BuklodPortalScrollView>
    </>
  );
}
