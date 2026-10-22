import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, router, useLocalSearchParams, useFocusEffect } from 'expo-router';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import {
  fetchOrganizationClustersOversight,
  type OrgClusterOversightRow,
} from '@/lib/buklodOrgGovernance';
import { readOrganizationScopeId } from '@/lib/buklodOrganization';
import { colors } from '@/lib/theme';

export default function OrganizationClustersOversightScreen() {
  const params = useLocalSearchParams();
  const organizationId = readOrganizationScopeId(params as Record<string, unknown>);
  const [rows, setRows] = useState<OrgClusterOversightRow[]>([]);
  const [name, setName] = useState('Organization');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!organizationId) {
      setError('Organization is missing.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const next = await fetchOrganizationClustersOversight(organizationId);
      setRows(next.clusters);
      setName(next.organization_name);
      setError(null);
    } catch (err: any) {
      setError(String(err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Organization Clusters' }} />
      <BuklodPortalScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void load()} />
        }
      >
        <Text style={styles.title}>{name}</Text>
        <Text style={styles.meta}>
          Organization Admin oversight. Unrelated Organizations stay hidden.
        </Text>
        {loading && !rows.length ? (
          <ActivityIndicator color={colors.green} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          rows.map((cluster) => (
            <View key={cluster.cluster_id} style={styles.card}>
              <Text style={styles.name}>{cluster.cluster_name}</Text>
              <Text style={styles.meta}>
                {cluster.cluster_status} · {cluster.member_count} members ·
                pending {cluster.pending_approvals}
                {cluster.cluster_premium ? ' · Cluster Premium' : ''}
              </Text>
              {(cluster.leadership ?? []).map((person) => (
                <Text key={`${person.user_id}:${person.role_key}`} style={styles.meta}>
                  {person.full_name} · {person.role_key.replaceAll('_', ' ')}
                </Text>
              ))}
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/clusters/progress' as any,
                    params: { id: cluster.cluster_id },
                  } as any)
                }
                style={styles.button}
              >
                <Text style={styles.buttonText}>OPEN PROGRESS</Text>
              </Pressable>
            </View>
          ))
        )}
      </BuklodPortalScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10, paddingBottom: 28 },
  title: { fontSize: 22, fontWeight: '900', color: '#173B2F' },
  meta: { fontSize: 12, color: '#5F6F67' },
  name: { fontSize: 15, fontWeight: '900', color: '#173B2F' },
  error: { color: '#9A4747', fontSize: 13 },
  card: {
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  button: {
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 11 },
});
