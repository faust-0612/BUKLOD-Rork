import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import { ClusterSummary, getMyClusters, respondClusterInvite } from '@/lib/buklodClusters';
import { enterScopedWorkspace } from '@/lib/buklodScopeRoute';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';

function messageOf(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error
  ) {
    return String(
      (error as { message?: unknown }).message ||
        'Unknown error'
    );
  }

  return String(error || 'Unknown error');
}


export default function ClustersScreen() {
  const { selectScope } = useBuklodScope();
  const [clusters, setClusters] = useState<ClusterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const mine = await getMyClusters();
      setClusters(mine);
      setLoadError(null);
    } catch (error) {
      setLoadError(messageOf(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openHome = useCallback((id: string) => {
    void enterScopedWorkspace(selectScope, id, {
      section: 'home',
      navigation: 'replace',
    }).catch(error => Alert.alert('Cluster Home', messageOf(error)));
  }, [selectScope]);

  const respond = async (id: string, accept: boolean) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await respondClusterInvite(id, accept);
      await load(true);
    } catch (error) {
      Alert.alert('Invitation', messageOf(error));
    } finally {
      setBusyId(null);
    }
  };

  const active = clusters.filter(item => item.membership_status === 'ACTIVE');
  const invitations = clusters.filter(item => item.membership_status === 'INVITED');
  const pending = clusters.filter(item => item.membership_status === 'PENDING');

  return (
    <BuklodPortalScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>BUKLOD</Text>
          <Text style={styles.title}>Clusters</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Create Cluster"
          onPress={() => router.push('/clusters/create' as any)} style={styles.create}>
          <Text style={styles.createText}>+ Create</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>MY CLUSTERS ({active.length})</Text>
      {loading ? (
        <View style={styles.loading}><ActivityIndicator /><Text>Loading your Clusters...</Text></View>
      ) : (
        <>
          {loadError && (
            <Pressable style={styles.notice} onPress={() => void load(true)}>
              <Text style={styles.noticeText}>Unable to refresh Clusters. Tap to retry: {loadError}</Text>
            </Pressable>
          )}
          {active.length === 0 && !loadError && (
            <View style={styles.empty}><Text style={styles.muted}>No active Cluster membership found.</Text></View>
          )}
          {active.map(item => (
            <Pressable key={item.scope_id} accessibilityRole="button"
              accessibilityLabel={`Open Home for ${item.name}`}
              onPress={() => openHome(item.scope_id)} style={styles.row}>
              <View style={styles.rowInfo}>
                <Text style={styles.clusterName} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.meta}>{item.is_admin ? 'Admin' : 'Member'}  ·  {Number(item.member_count || 0)} members</Text>
              </View>
              <View style={styles.openPill}><Text style={styles.openText}>OPEN HOME  ›</Text></View>
            </Pressable>
          ))}
          {invitations.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>INVITATIONS ({invitations.length})</Text>
              {invitations.map(item => (
                <View key={item.scope_id} style={styles.row}>
                  <View style={styles.rowInfo}><Text style={styles.clusterName}>{item.name}</Text><Text style={styles.meta}>Invitation</Text></View>
                  <Pressable accessibilityRole="button" disabled={busyId !== null}
                    onPress={() => void respond(item.scope_id, true)} style={styles.openPill}>
                    <Text style={styles.openText}>ACCEPT</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" disabled={busyId !== null}
                    onPress={() => void respond(item.scope_id, false)} style={styles.decline}>
                    <Text style={styles.meta}>DECLINE</Text>
                  </Pressable>
                </View>
              ))}
            </>
          )}
          {pending.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>PENDING REQUESTS ({pending.length})</Text>
              {pending.map(item => (
                <View key={item.scope_id} style={styles.row}>
                  <View style={styles.rowInfo}><Text style={styles.clusterName}>{item.name}</Text><Text style={styles.meta}>Awaiting approval</Text></View>
                </View>
              ))}
            </>
          )}
        </>
      )}
    </BuklodPortalScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F7F6' },
  content: { padding: 16, gap: 9, paddingBottom: 36 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 3 },
  headerText: { flex: 1 },
  eyebrow: { fontSize: 10, letterSpacing: 2, fontWeight: '900', color: '#2D6A4F' },
  title: { fontSize: 27, fontWeight: '900', color: '#19362A' },
  create: { backgroundColor: '#2D6A4F', borderRadius: 10, minHeight: 36, justifyContent: 'center', paddingHorizontal: 13 },
  createText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  sectionTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 1, color: '#365347', marginTop: 10, marginBottom: 3 },
  row: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E7E3', borderRadius: 13, padding: 13, minHeight: 67, flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowInfo: { flex: 1, gap: 5 },
  clusterName: { fontSize: 15, fontWeight: '800', color: '#19362A' },
  meta: { fontSize: 11, color: '#697A70' },
  openPill: { backgroundColor: '#E6F3EA', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 10 },
  openText: { color: '#206344', fontSize: 11, fontWeight: '900' },
  decline: { paddingHorizontal: 5, paddingVertical: 10 },
  loading: { padding: 24, alignItems: 'center', gap: 9 },
  empty: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 18 },
  muted: { color: '#697A70' },
  notice: { backgroundColor: '#FFF3DC', borderRadius: 10, padding: 12 },
  noticeText: { color: '#79531B', fontSize: 12 },
});
