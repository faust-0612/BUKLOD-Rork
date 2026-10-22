import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack } from 'expo-router';

import { AdminGate } from '@/components/AdminGate';
import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import {
  fetchSystemAdminOrgClusterCenter,
  runAdminLifecycleAction,
} from '@/lib/buklodOrgGovernance';
import { colors } from '@/lib/theme';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export default function SystemAdminOrgClusterControlScreen() {
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');
  const [targetId, setTargetId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchSystemAdminOrgClusterCenter();
      setPayload(asRecord(next));
    } catch (err: any) {
      Alert.alert('Control Center', String(err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const orgs = useMemo(
    () => (Array.isArray(payload?.organizations) ? payload.organizations : []),
    [payload],
  );
  const clusters = useMemo(
    () => (Array.isArray(payload?.clusters) ? payload.clusters : []),
    [payload],
  );
  const leadership = useMemo(
    () => (Array.isArray(payload?.leadership) ? payload.leadership : []),
    [payload],
  );
  const grants = useMemo(
    () => (Array.isArray(payload?.access_grants) ? payload.access_grants : []),
    [payload],
  );
  const audit = useMemo(
    () => (Array.isArray(payload?.recent_audit) ? payload.recent_audit : []),
    [payload],
  );

  const run = async (action: string, kind: 'ORGANIZATION' | 'CLUSTER' | 'USER') => {
    try {
      await runAdminLifecycleAction({
        action,
        targetKind: kind,
        targetId: targetId.trim(),
        reason,
      });
      setReason('');
      await load();
      Alert.alert('Saved', 'The administrative action was audited.');
    } catch (err: any) {
      Alert.alert('Action', String(err?.message ?? err));
    }
  };

  return (
    <AdminGate>
      <Stack.Screen options={{ title: 'Org / Cluster Control' }} />
      <BuklodPortalScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void load()} />
        }
      >
        <Text style={styles.title}>Global System Admin Control Center</Text>
        <Text style={styles.meta}>
          Connects existing Organizations, Clusters, leadership, grants, and
          audited lifecycle actions. Soft-delete / suspend only. Payments and
          history are preserved.
        </Text>
        {loading && !payload ? <ActivityIndicator color={colors.green} /> : null}

        <Text style={styles.section}>ORGANIZATIONS ({orgs.length})</Text>
        {orgs.slice(0, 40).map((item) => {
          const row = asRecord(item);
          if (!row) return null;
          return (
            <View key={String(row.id)} style={styles.card}>
              <Text style={styles.name}>{String(row.name)}</Text>
              <Text style={styles.meta}>
                {String(row.organization_type ?? 'ORGANIZATION')} ·{' '}
                {String(row.lifecycle_status)} · clusters {String(row.cluster_count)} ·
                members {String(row.member_count)}
                {row.focus_apps_active ? ' · Focus Apps' : ''}
              </Text>
            </View>
          );
        })}

        <Text style={styles.section}>CLUSTERS ({clusters.length})</Text>
        {clusters.slice(0, 40).map((item) => {
          const row = asRecord(item);
          if (!row) return null;
          return (
            <View key={String(row.id)} style={styles.card}>
              <Text style={styles.name}>{String(row.name)}</Text>
              <Text style={styles.meta}>
                {String(row.organization_name ?? 'No parent')} ·{' '}
                {String(row.lifecycle_status)} · members {String(row.member_count)}
                {row.cluster_premium ? ' · Cluster Premium' : ''}
              </Text>
            </View>
          );
        })}

        <Text style={styles.section}>LEADERSHIP</Text>
        {leadership.slice(0, 50).map((item, index) => {
          const row = asRecord(item);
          if (!row) return null;
          return (
            <Text key={`${row.user_id}:${row.scope_id}:${index}`} style={styles.meta}>
              {String(row.full_name)} · {String(row.role_key)} · {String(row.scope_name)}
            </Text>
          );
        })}

        <Text style={styles.section}>CROSS-ORG GRANTS</Text>
        {grants.slice(0, 30).map((item) => {
          const row = asRecord(item);
          if (!row) return null;
          return (
            <Text key={String(row.id)} style={styles.meta}>
              {String(row.requesting_org_name)} → {String(row.target_org_name)} ·{' '}
              {String(row.status)}
            </Text>
          );
        })}

        <Text style={styles.section}>AUDIT</Text>
        {audit.map((item) => {
          const row = asRecord(item);
          if (!row) return null;
          return (
            <Text key={String(row.id)} style={styles.meta}>
              {String(row.created_at)} · {String(row.actor_name)} · {String(row.action)}
            </Text>
          );
        })}

        <Text style={styles.section}>SUSPEND / REACTIVATE / DELETE</Text>
        <TextInput
          style={styles.input}
          placeholder="Target Organization, Cluster, or user ID"
          value={targetId}
          onChangeText={setTargetId}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Reason (required for suspend/delete)"
          value={reason}
          onChangeText={setReason}
        />
        <Pressable onPress={() => void run('SUSPEND_ORG', 'ORGANIZATION')} style={styles.button}>
          <Text style={styles.buttonText}>SUSPEND ORGANIZATION</Text>
        </Pressable>
        <Pressable onPress={() => void run('REACTIVATE_ORG', 'ORGANIZATION')} style={styles.secondary}>
          <Text style={styles.secondaryText}>REACTIVATE ORGANIZATION</Text>
        </Pressable>
        <Pressable onPress={() => void run('SUSPEND_CLUSTER', 'CLUSTER')} style={styles.button}>
          <Text style={styles.buttonText}>SUSPEND CLUSTER</Text>
        </Pressable>
        <Pressable onPress={() => void run('REACTIVATE_CLUSTER', 'CLUSTER')} style={styles.secondary}>
          <Text style={styles.secondaryText}>REACTIVATE CLUSTER</Text>
        </Pressable>
        <Pressable onPress={() => void run('SUSPEND_USER', 'USER')} style={styles.button}>
          <Text style={styles.buttonText}>SUSPEND USER ACCESS</Text>
        </Pressable>
        <Pressable onPress={() => void run('REACTIVATE_USER', 'USER')} style={styles.secondary}>
          <Text style={styles.secondaryText}>REACTIVATE USER ACCESS</Text>
        </Pressable>
        <Pressable onPress={() => void run('DELETE_ORG', 'ORGANIZATION')} style={styles.danger}>
          <Text style={styles.buttonText}>SOFT-DELETE ORGANIZATION</Text>
        </Pressable>
        <Pressable onPress={() => void run('DELETE_CLUSTER', 'CLUSTER')} style={styles.danger}>
          <Text style={styles.buttonText}>SOFT-DELETE CLUSTER</Text>
        </Pressable>
      </BuklodPortalScrollView>
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8, paddingBottom: 36 },
  title: { fontSize: 22, fontWeight: '900', color: '#173B2F' },
  meta: { fontSize: 12, lineHeight: 18, color: '#5F6F67' },
  name: { fontSize: 14, fontWeight: '900', color: '#173B2F' },
  section: { marginTop: 10, fontSize: 11, fontWeight: '900', color: '#61766C' },
  card: {
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    borderRadius: 12,
    paddingHorizontal: 11,
    color: '#173B2F',
  },
  button: {
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  danger: {
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: '#8A3A3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 11 },
  secondaryText: { color: '#2D6A4F', fontWeight: '900', fontSize: 11 },
});
