import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import { Stack, useRouter } from 'expo-router';
import {
  clusterScopeManageRoute,
  getMyManageableClusters,
} from '@/lib/buklodCluster';
import type { ClusterSummary } from '@/lib/buklodClusters';

export default function ClustersManageListScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clusters, setClusters] = useState<ClusterSummary[]>([]);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const rows = await getMyManageableClusters();
      setClusters(rows);
    } catch {
      setClusters([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openManage = (cluster: ClusterSummary) => {
    router.push(
      clusterScopeManageRoute(cluster.scope_id, cluster.name) as any
    );
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Manage Clusters' }} />
        <View style={styles.center}>
          <ActivityIndicator color="#2D6A4F" />
          <Text style={styles.muted}>Loading manageable Clusters...</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Manage Clusters' }} />
      <BuklodPortalScrollView
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
          />
        }
        contentContainerStyle={styles.content}
      >
        <Text style={styles.eyebrow}>EXACT-SCOPE ADMIN</Text>
        <Text style={styles.title}>Manage Clusters</Text>
        <Text style={styles.subtitle}>
          Clusters where you have scoped admin authority only.
        </Text>

        {clusters.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No manageable Clusters</Text>
            <Text style={styles.muted}>
              Admin access applies only to the exact Cluster where you hold
              the admin role.
            </Text>
          </View>
        ) : (
          clusters.map((cluster) => (
            <Pressable
              key={cluster.scope_id}
              onPress={() => openManage(cluster)}
              style={({ pressed }) => [
                styles.card,
                pressed && styles.pressed,
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{cluster.name}</Text>
                <Text style={styles.cardMeta}>
                  {cluster.member_count} members · {cluster.visibility}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))
        )}
      </BuklodPortalScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 16,
    gap: 11,
    backgroundColor: '#F4F7F5',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#F4F7F5',
  },
  eyebrow: {
    color: '#61766C',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  title: {
    color: '#173B2F',
    fontSize: 24,
    fontWeight: '900',
  },
  subtitle: {
    color: '#697A71',
    fontSize: 11,
    marginBottom: 6,
  },
  empty: {
    padding: 18,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    gap: 6,
  },
  emptyTitle: {
    color: '#173B2F',
    fontWeight: '900',
  },
  muted: {
    color: '#6E7E76',
    lineHeight: 18,
  },
  card: {
    minHeight: 72,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardTitle: {
    color: '#173B2F',
    fontSize: 13,
    fontWeight: '900',
  },
  cardMeta: {
    color: '#6E7E76',
    fontSize: 10,
    marginTop: 3,
  },
  chevron: {
    color: '#176B4A',
    fontSize: 26,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
});
