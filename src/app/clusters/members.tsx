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
  removeClusterMember,
  type ClusterMember,
} from '@/lib/buklodClusters';
import { readClusterScopeId } from '@/lib/buklodCluster';

export default function ClusterMembersScreen() {
  const params = useLocalSearchParams();
  const scopeId = readClusterScopeId(
    params as Record<string, unknown>
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Cluster Members' }} />
      <ClusterManageGate scopeId={scopeId}>
        {() => <MembersList scopeId={scopeId} />}
      </ClusterManageGate>
    </>
  );
}

function MembersList({ scopeId }: { scopeId: string }) {
  const [members, setMembers] = useState<ClusterMember[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await getClusterMembers(scopeId);
      setMembers(rows);
    } catch (error: any) {
      Alert.alert('Members', error?.message || 'Could not load members.');
    }
  }, [scopeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = (member: ClusterMember) => {
    Alert.alert(
      'Remove member',
      `Remove ${member.full_name} from this Cluster?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () =>
            void (async () => {
              setBusy(true);
              try {
                await removeClusterMember(scopeId, member.user_id);
                await load();
              } catch (error: any) {
                Alert.alert('Members', error?.message || 'Remove failed.');
              } finally {
                setBusy(false);
              }
            })(),
        },
      ]
    );
  };

  return (
    <BuklodPortalScrollView contentContainerStyle={styles.content}>
      {members.length === 0 ? (
        <Text style={styles.muted}>No members found.</Text>
      ) : (
        members.map((member) => (
          <View key={member.user_id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{member.full_name}</Text>
              <Text style={styles.meta}>
                {member.is_admin ? 'Cluster Admin' : 'Member'}
              </Text>
            </View>
            {!member.is_admin && (
              <Pressable
                disabled={busy}
                onPress={() => remove(member)}
                style={styles.remove}
              >
                <Text style={styles.removeText}>REMOVE</Text>
              </Pressable>
            )}
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
    color: '#243C31',
    fontWeight: '900',
  },
  meta: {
    color: '#748079',
    fontSize: 12,
  },
  muted: {
    color: '#748079',
  },
  remove: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#9E2A2B',
  },
  removeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
});
