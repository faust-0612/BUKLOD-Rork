import React, { useCallback, useState } from 'react';
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
import { Stack, useLocalSearchParams, useFocusEffect } from 'expo-router';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import {
  listOrgAccess,
  requestOrgAccess,
  reviewOrgAccess,
  revokeOrgAccess,
  type OrgAccessGrant,
} from '@/lib/buklodOrgGovernance';
import { readOrganizationScopeId } from '@/lib/buklodOrganization';
import { colors } from '@/lib/theme';

function GrantCard({
  grant,
  incoming,
  onReview,
  onRevoke,
}: {
  grant: OrgAccessGrant;
  incoming: boolean;
  onReview: (approve: boolean) => void;
  onRevoke: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.name}>
        {grant.requesting_org_name ?? 'Organization'} →{' '}
        {grant.target_org_name ?? 'Organization'}
      </Text>
      <Text style={styles.meta}>
        {grant.status} · {grant.permission_scope.join(', ')}
      </Text>
      {incoming && grant.status === 'PENDING' ? (
        <View style={styles.row}>
          <Pressable onPress={() => onReview(true)} style={styles.button}>
            <Text style={styles.buttonText}>APPROVE</Text>
          </Pressable>
          <Pressable onPress={() => onReview(false)} style={styles.secondary}>
            <Text style={styles.secondaryText}>REJECT</Text>
          </Pressable>
        </View>
      ) : null}
      {grant.status === 'APPROVED' ? (
        <Pressable onPress={onRevoke} style={styles.secondary}>
          <Text style={styles.secondaryText}>REVOKE</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function OrganizationCrossAccessScreen() {
  const params = useLocalSearchParams();
  const organizationId = readOrganizationScopeId(params as Record<string, unknown>);
  const [targetId, setTargetId] = useState('');
  const [outgoing, setOutgoing] = useState<OrgAccessGrant[]>([]);
  const [incoming, setIncoming] = useState<OrgAccessGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) {
      setError('Organization is missing.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const next = await listOrgAccess(organizationId);
      setOutgoing(next.outgoing);
      setIncoming(next.incoming);
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

  const submit = async () => {
    if (!organizationId) return;
    try {
      await requestOrgAccess(organizationId, targetId.trim());
      setTargetId('');
      await load();
    } catch (err: any) {
      Alert.alert('Access request', String(err?.message ?? err));
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Organization Access' }} />
      <BuklodPortalScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void load()} />
        }
      >
        <Text style={styles.title}>Cross-Organization access</Text>
        <Text style={styles.meta}>
          Access is never automatic. The target Organization Admin must approve.
          Grants stay scoped to the listed information.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Target Organization ID"
          value={targetId}
          onChangeText={setTargetId}
          autoCapitalize="none"
        />
        <Pressable onPress={() => void submit()} style={styles.button}>
          <Text style={styles.buttonText}>REQUEST ACCESS</Text>
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading && !outgoing.length && !incoming.length ? (
          <ActivityIndicator color={colors.green} />
        ) : null}
        <Text style={styles.section}>INCOMING</Text>
        {incoming.map((grant) => (
          <GrantCard
            key={grant.id}
            grant={grant}
            incoming
            onReview={(approve) =>
              void reviewOrgAccess(grant.id, approve).then(load)
            }
            onRevoke={() => void revokeOrgAccess(grant.id, 'Revoked').then(load)}
          />
        ))}
        <Text style={styles.section}>OUTGOING</Text>
        {outgoing.map((grant) => (
          <GrantCard
            key={grant.id}
            grant={grant}
            incoming={false}
            onReview={() => undefined}
            onRevoke={() => void revokeOrgAccess(grant.id, 'Revoked').then(load)}
          />
        ))}
      </BuklodPortalScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10, paddingBottom: 28 },
  title: { fontSize: 22, fontWeight: '900', color: '#173B2F' },
  meta: { fontSize: 12, lineHeight: 18, color: '#5F6F67' },
  name: { fontSize: 14, fontWeight: '900', color: '#173B2F' },
  section: { marginTop: 8, fontSize: 11, fontWeight: '900', color: '#61766C' },
  error: { color: '#9A4747', fontSize: 13 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    borderRadius: 12,
    paddingHorizontal: 11,
    color: '#173B2F',
  },
  card: {
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  row: { flexDirection: 'row', gap: 8 },
  button: {
    minHeight: 40,
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 11 },
  secondary: {
    minHeight: 40,
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { color: '#2D6A4F', fontWeight: '900', fontSize: 11 },
});
