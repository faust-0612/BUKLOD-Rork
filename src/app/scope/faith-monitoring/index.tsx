/* BUKLOD_V28_R3_FAITH_MONITORING_PAGE. Preserve original full-featured scoped panel. */
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { readScopeIdFromParams } from '@/lib/buklodScopeManage';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import BuklodScopeFaithMonitoringSummary from '@/components/BuklodScopeFaithMonitoringSummary';

export default function ScopeFaithMonitoringPage() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { scopes, activeScope, loading, refresh } = useBuklodScope();
  const scopeId = readScopeIdFromParams(params as Record<string, unknown>);
  const scope = scopes.find(item => item.scope_id === scopeId)
    ?? (activeScope?.scope_id === scopeId ? activeScope : null);
  const authorized = scope?.scope_type === 'ORGANIZATION' || scope?.scope_type === 'CLUSTER';
  return (
    <View style={[styles.shell, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to scope Home"
          onPress={() => router.back()} style={styles.back}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
        </Pressable>
        <View style={styles.titleWrap}><Text style={styles.title}>Faith Monitoring</Text>
          <Text numberOfLines={1} style={styles.sub}>{scope?.name ?? 'Organization / Cluster'}</Text></View>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom,12) + 24 }]}>
        {loading && !scope ? <ActivityIndicator color="#0874DE" /> :
        !authorized || !scope?.show_faith_content ? (
          <View style={styles.fallback}><Text style={styles.warning}>This Faith Monitoring workspace is not available to this account.</Text>
            <Pressable accessibilityRole="button" onPress={() => void refresh()}>
              <Text style={styles.retry}>Refresh access</Text>
            </Pressable></View>
        ) : <BuklodScopeFaithMonitoringSummary scope={scope} />}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: '#F2F7FD' },
  header: { minHeight: 65, backgroundColor: '#07539B', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 13, gap: 12 },
  back: { width: 40, height: 44, justifyContent: 'center', alignItems: 'center' },
  titleWrap: { flex: 1 }, title: { color: '#FFFFFF', fontWeight: '900', fontSize: 18 },
  sub: { color: '#D6E9FF', marginTop: 3, fontSize: 11 },
  scroll: { flex: 1 }, content: { paddingHorizontal: 12, paddingTop: 13 },
  fallback: { borderRadius: 14, backgroundColor: '#FFFFFF', padding: 15, gap: 11 },
  warning: { color: '#375273', fontSize: 13 }, retry: { color: '#0874DE', fontWeight: '800' },
});
