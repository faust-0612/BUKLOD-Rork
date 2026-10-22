import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import {
  Stack,
  useLocalSearchParams,
} from 'expo-router';
import ClusterManageGate from '@/components/ClusterManageGate';
import {
  archiveCluster,
  restoreCluster,
} from '@/lib/buklodClusters';
import { readClusterScopeId } from '@/lib/buklodCluster';

export default function ClusterLifecycleScreen() {
  const params = useLocalSearchParams();
  const scopeId = readClusterScopeId(
    params as Record<string, unknown>
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Cluster Lifecycle' }} />
      <ClusterManageGate scopeId={scopeId}>
        {(cluster) => (
          <LifecyclePanel scopeId={scopeId} status={cluster.scope_status} />
        )}
      </ClusterManageGate>
    </>
  );
}

function LifecyclePanel({
  scopeId,
  status,
}: {
  scopeId: string;
  status: string;
}) {
  const [busy, setBusy] = useState(false);
  const archived = status === 'ARCHIVED';

  const archive = () => {
    Alert.alert(
      'Archive Cluster',
      'The Cluster will stop accepting new activity until restored. This action requires confirmation.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: () =>
            void (async () => {
              setBusy(true);
              try {
                await archiveCluster(scopeId);
                Alert.alert('Cluster', 'Cluster archived.');
              } catch (error: any) {
                Alert.alert('Cluster', error?.message || 'Archive failed.');
              } finally {
                setBusy(false);
              }
            })(),
        },
      ]
    );
  };

  const restore = async () => {
    setBusy(true);
    try {
      await restoreCluster(scopeId);
      Alert.alert('Cluster', 'Cluster restored.');
    } catch (error: any) {
      Alert.alert('Cluster', error?.message || 'Restore failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BuklodPortalScrollView contentContainerStyle={styles.content}>
      <Text style={styles.body}>
        {archived
          ? 'This Cluster is archived. Restore it to resume normal activity.'
          : 'Archive the Cluster if it is no longer active. It can be restored later.'}
      </Text>

      {archived ? (
        <Pressable
          disabled={busy}
          onPress={() => void restore()}
          style={[styles.btn, busy && styles.disabled]}
        >
          <Text style={styles.btnText}>RESTORE CLUSTER</Text>
        </Pressable>
      ) : (
        <Pressable
          disabled={busy}
          onPress={archive}
          style={[styles.btnDanger, busy && styles.disabled]}
        >
          <Text style={styles.btnText}>ARCHIVE CLUSTER</Text>
        </Pressable>
      )}
    </BuklodPortalScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    gap: 14,
    backgroundColor: '#F4F7F5',
  },
  body: {
    color: '#526259',
    lineHeight: 20,
  },
  btn: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDanger: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#9E2A2B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.5,
  },
});
