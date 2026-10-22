import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useFocusEffect } from 'expo-router';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import {
  fetchClusterGeneralProgress,
  fetchClusterMemberProgress,
  type ClusterProgressMember,
  type ClusterProgressReport,
} from '@/lib/buklodOrgGovernance';
import { clusterRoleLabel } from '@/lib/buklodClusterFormationGate';
import { colors } from '@/lib/theme';

function firstString(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0].trim();
  }
  return '';
}

export default function ClusterProgressScreen() {
  const params = useLocalSearchParams();
  const clusterId = firstString(params.id) || firstString(params.clusterId);
  const [report, setReport] = useState<ClusterProgressReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<string | null>(null);
  const [history, setHistory] = useState<unknown>(null);

  const load = useCallback(async () => {
    if (!clusterId) {
      setError('Cluster is missing.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await fetchClusterGeneralProgress(clusterId);
      setReport(next);
    } catch (err: any) {
      setError(String(err?.message ?? err));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [clusterId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openMember = async (member: ClusterProgressMember) => {
    try {
      const next = await fetchClusterMemberProgress(clusterId, member.user_id);
      setDetail(member.member_name);
      setHistory(next);
    } catch (err: any) {
      setError(String(err?.message ?? err));
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Cluster Progress' }} />
      <BuklodPortalScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void load()} />
        }
      >
        {loading && !report ? (
          <ActivityIndicator color={colors.green} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <>
            <Text style={styles.title}>{report?.cluster_name}</Text>
            <Text style={styles.meta}>
              {report?.member_count ?? 0} members · Cluster leadership only
            </Text>
            {(report?.members ?? []).map((member) => (
              <Pressable
                key={member.user_id}
                onPress={() => void openMember(member)}
                style={styles.card}
              >
                <Text style={styles.name}>{member.member_name}</Text>
                <Text style={styles.meta}>
                  {clusterRoleLabel(member.role_keys)}
                </Text>
                <Text style={styles.meta}>
                  Reading {member.reading_approved} · Devotion{' '}
                  {member.devotion_approved} · Approved {member.approved_items} ·
                  Pending {member.pending_approvals}
                </Text>
              </Pressable>
            ))}
            {detail ? (
              <View style={styles.card}>
                <Text style={styles.name}>{detail}</Text>
                <Text style={styles.body}>
                  {JSON.stringify(history, null, 2).slice(0, 1200)}
                </Text>
              </View>
            ) : null}
          </>
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
  body: { fontSize: 11, color: '#5F6F67' },
  error: { color: '#9A4747', fontSize: 13 },
  card: {
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
});
