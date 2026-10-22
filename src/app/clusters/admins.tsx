import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import {
  Stack,
  useLocalSearchParams,
} from 'expo-router';
import ClusterManageGate from '@/components/ClusterManageGate';
import {
  getClusterMembers,
  transferClusterAdmin,
  type ClusterMember,
} from '@/lib/buklodClusters';
import { readClusterScopeId } from '@/lib/buklodCluster';

export default function ClusterAdminsScreen() {
  const params = useLocalSearchParams();
  const scopeId = readClusterScopeId(
    params as Record<string, unknown>
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Cluster Admins' }} />
      <ClusterManageGate scopeId={scopeId}>
        {() => <AdminsList scopeId={scopeId} />}
      </ClusterManageGate>
    </>
  );
}

function AdminsList({ scopeId }: { scopeId: string }) {
  const [members, setMembers] = useState<ClusterMember[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await getClusterMembers(scopeId);
      setMembers(rows);
    } catch (error: any) {
      Alert.alert('Cluster Admins', error?.message || 'Could not load admins.');
    }
  }, [scopeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const transfer = (member: ClusterMember) => {
    Alert.alert(
      'Transfer Cluster Admin',
      `Make ${member.full_name} the Cluster Admin? You will remain a normal member. System Admin authority is never granted from Cluster Manage.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          onPress: () =>
            void (async () => {
              setBusy(true);
              try {
                await transferClusterAdmin(scopeId, member.user_id);
                await load();
                Alert.alert(
                  'Cluster Admins',
                  'Cluster admin authority transferred.'
                );
              } catch (error: any) {
                Alert.alert(
                  'Cluster Admins',
                  error?.message || 'Transfer failed.'
                );
              } finally {
                setBusy(false);
              }
            })(),
        },
      ]
    );
  };

  const admins = members.filter((m) => m.is_admin);
  const nonAdmins = members.filter((m) => !m.is_admin);

  return (
    <BuklodPortalScrollView contentContainerStyle={styles.content}>
      <Text style={styles.note}>
        Transfer primary Cluster admin authority below. To grant or revoke scoped
        ADMIN without transfer, open Members & Roles (Unified) from Manage.
      </Text>

      <Text style={styles.section}>CURRENT CLUSTER ADMINS</Text>
      {admins.length === 0 ? (
        <Text style={styles.muted}>No admin assigned.</Text>
      ) : (
        admins.map((admin) => (
          <View key={admin.user_id} style={styles.row}>
            <Text style={styles.name}>{admin.full_name}</Text>
            <Text style={styles.badge}>ADMIN</Text>
          </View>
        ))
      )}

      <Text style={styles.section}>TRANSFER ADMIN TO MEMBER</Text>
      {nonAdmins.length === 0 ? (
        <Text style={styles.muted}>No other members available.</Text>
      ) : (
        nonAdmins.map((member) => (
          <View key={member.user_id} style={styles.row}>
            <Text style={styles.name}>{member.full_name}</Text>
            <Pressable
              disabled={busy}
              onPress={() => transfer(member)}
              style={styles.transfer}
            >
              <Text style={styles.transferText}>MAKE ADMIN</Text>
            </Pressable>
          </View>
        ))
      )}
    </BuklodPortalScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    gap: 10,
    backgroundColor: '#F4F7F5',
  },
  note: {
    color: '#6E7E76',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 4,
  },
  section: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: '#496056',
  },
  row: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E7E3',
    borderRadius: 14,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 1,
    color: '#243C31',
    fontWeight: '900',
  },
  badge: {
    color: '#236043',
    fontSize: 10,
    fontWeight: '900',
    backgroundColor: '#DFF2E7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  muted: {
    color: '#748079',
  },
  transfer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2D6A4F',
    backgroundColor: '#FFFFFF',
  },
  transferText: {
    color: '#2D6A4F',
    fontSize: 10,
    fontWeight: '900',
  },
});
