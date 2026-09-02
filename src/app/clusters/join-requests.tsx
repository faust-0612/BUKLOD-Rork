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
  getClusterRequests,
  reviewClusterRequest,
  type ClusterRequest,
} from '@/lib/buklodClusters';
import { readClusterScopeId } from '@/lib/buklodCluster';

export default function ClusterJoinRequestsScreen() {
  const params = useLocalSearchParams();
  const scopeId = readClusterScopeId(
    params as Record<string, unknown>
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Join Requests' }} />
      <ClusterManageGate scopeId={scopeId}>
        {() => <RequestsList scopeId={scopeId} />}
      </ClusterManageGate>
    </>
  );
}

function RequestsList({ scopeId }: { scopeId: string }) {
  const [requests, setRequests] = useState<ClusterRequest[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await getClusterRequests(scopeId);
      setRequests(rows);
    } catch (error: any) {
      Alert.alert(
        'Join Requests',
        error?.message || 'Could not load requests.'
      );
    }
  }, [scopeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (userId: string, approve: boolean) => {
    setBusy(true);
    try {
      await reviewClusterRequest(scopeId, userId, approve);
      await load();
    } catch (error: any) {
      Alert.alert('Join Requests', error?.message || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BuklodPortalScrollView contentContainerStyle={styles.content}>
      {requests.length === 0 ? (
        <Text style={styles.muted}>No pending requests.</Text>
      ) : (
        requests.map((request) => (
          <View key={request.user_id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{request.full_name}</Text>
              <Text style={styles.meta}>
                Requested{' '}
                {request.requested_at
                  ? new Date(request.requested_at).toLocaleString()
                  : 'recently'}
              </Text>
            </View>
            <View style={styles.actions}>
              <Pressable
                disabled={busy}
                onPress={() => void review(request.user_id, true)}
                style={styles.approve}
              >
                <Text style={styles.btnText}>APPROVE</Text>
              </Pressable>
              <Pressable
                disabled={busy}
                onPress={() => void review(request.user_id, false)}
                style={styles.reject}
              >
                <Text style={styles.rejectText}>REJECT</Text>
              </Pressable>
            </View>
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
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  approve: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#2D6A4F',
  },
  reject: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2D6A4F',
    backgroundColor: '#FFFFFF',
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  rejectText: {
    color: '#2D6A4F',
    fontSize: 10,
    fontWeight: '900',
  },
});
