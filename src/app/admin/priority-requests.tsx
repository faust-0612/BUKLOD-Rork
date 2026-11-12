import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, AppState, FlatList, Pressable, RefreshControl,
  StyleSheet, Text, View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AdminGate } from '@/components/AdminGate';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import {
  fetchAdminPriorityRequests, rankAdminPriority,
  type AdminPriorityItem, type AdminPrioritySnapshot, type PriorityGroup,
} from '@/lib/buklodAdminPriority';

type Filter = 'all' | 'urgent' | PriorityGroup;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All requests' },
  { key: 'urgent', label: 'Urgent' },
  { key: 'support', label: 'Help' },
  { key: 'advertising', label: 'Ads' },
  { key: 'approvals', label: 'Approvals' },
  { key: 'safety', label: 'Safety' },
  { key: 'privacy', label: 'Privacy' },
];
const ageLabel = (timestamp: string) => {
  const age = Date.now() - new Date(timestamp).getTime();
  if (!Number.isFinite(age) || age < 0) return 'Recently submitted';
  if (age < 3600000) return Math.max(1, Math.floor(age / 60000)) + 'm ago';
  if (age < 86400000) return Math.floor(age / 3600000) + 'h ago';
  return Math.floor(age / 86400000) + 'd ago';
};

export default function AdminPriorityRequestsScreen() {
  const { hasRole } = useAuth();
  const allowed = hasRole('system_admin');
  const [snapshot, setSnapshot] = useState<AdminPrioritySnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const version = useRef(0);
  const lastRequest = useRef(0);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (!allowed || inFlight.current) return;
    inFlight.current = true;
    lastRequest.current = Date.now();
    const seq = ++version.current;
    setLoading(true);
    try {
      const next = await fetchAdminPriorityRequests(true);
      if (version.current === seq) setSnapshot(next);
    } catch {
      if (version.current === seq) setSnapshot(current => current
        ? { ...current, failedSources: [...current.failedSources, 'Priority request service'] }
        : { items: [], pendingTotal: 0, unreadSupportAlerts: null, failedSources: ['Priority request service'], cappedSources: [], refreshedAt: Date.now() }
      );
    } finally {
      if (version.current === seq) setLoading(false);
      inFlight.current = false;
    }
  }, [allowed]);

  useFocusEffect(useCallback(() => {
    if (allowed) void load();
    return () => { version.current += 1; };
  }, [allowed, load]));

  useEffect(() => {
    if (!allowed) return;
    const refreshFromEvent = () => {
      if (Date.now() - lastRequest.current >= 15000) void load();
    };
    const state = AppState.addEventListener('change', next => {
      if (next === 'active') refreshFromEvent();
    });
    const channel = supabase.channel('system-admin-priority-inbox')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, refreshFromEvent)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buklod_paid_ad_campaigns' }, refreshFromEvent)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_feedback' }, refreshFromEvent)
      .subscribe();
    return () => {
      state.remove();
      void supabase.removeChannel(channel);
    };
  }, [allowed, load]);

  const visible = useMemo(() => (snapshot?.items || []).filter(item => {
    if (filter === 'all') return true;
    if (filter === 'urgent') return rankAdminPriority(item) >= 3;
    return item.group === filter;
  }), [snapshot, filter]);
  const urgentCount = snapshot?.items.filter(item => rankAdminPriority(item) >= 3).length || 0;
  const countText = String(snapshot?.pendingTotal || 0) + (snapshot?.cappedSources.some(source => source !== 'BSOC support') ? '+' : '');

  const header = <View style={styles.header}>
    <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.back}>
      <MaterialCommunityIcons name="arrow-left" size={20} color="#21553B" />
      <Text style={styles.link}>Admin Dashboard</Text>
    </Pressable>
    <Text style={styles.eyebrow}>SYSTEM ADMIN · ACTION CENTER</Text>
    <Text style={styles.title}>Priority Requests</Text>
    <Text style={styles.subtitle}>
      Live requests needing action, sorted by urgency. Reading an alert never completes
      or approves a request. Open the original workflow to review it securely.
    </Text>
    <View style={styles.metrics}>
      <View style={styles.metric}><Text style={styles.metricNumber}>{countText}</Text><Text style={styles.metricLabel}>Pending detected</Text></View>
      <View style={styles.metric}><Text style={styles.metricNumber}>{urgentCount}</Text><Text style={styles.metricLabel}>Urgent shown</Text></View>
      <Pressable accessibilityRole="button" onPress={() => router.push('/admin/bsoc-notifications' as any)} style={styles.metric}>
        <Text style={styles.metricNumber}>{snapshot?.unreadSupportAlerts ?? '—'}</Text>
        <Text style={styles.metricLabel}>Unread support alerts ›</Text>
      </Pressable>
    </View>
    {snapshot?.failedSources.length ? <Text accessibilityRole="alert" style={styles.warning}>
      Partial results: could not verify {snapshot.failedSources.join(', ')}. Do not treat this queue as fully clear.
    </Text> : null}
    {snapshot?.cappedSources.length ? <Text style={styles.hint}>
      Some sources show only their latest requests: {snapshot.cappedSources.join(', ')}. The BSOC total is exact; other capped counts are minimums.
    </Text> : null}
    <View style={styles.filterRow}>
      {FILTERS.map(option => <Pressable key={option.key} onPress={() => setFilter(option.key)}
        accessibilityRole="button" accessibilityState={{ selected: option.key === filter }}
        style={[styles.chip, option.key === filter && styles.chipActive]}>
        <Text style={[styles.chipText, option.key === filter && styles.chipTextActive]}>{option.label}</Text>
      </Pressable>)}
    </View>
    <Text style={styles.hint}>Pull down to refresh · {snapshot ? 'Last checked ' + new Date(snapshot.refreshedAt).toLocaleTimeString() : 'Checking request sources'}</Text>
  </View>;

  return <AdminGate>
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={visible}
      keyExtractor={item => item.key}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      ListHeaderComponent={header}
      ListEmptyComponent={loading
        ? <ActivityIndicator style={styles.state} color="#216847" />
        : <Text style={styles.state}>{snapshot?.failedSources.length
          ? 'No verified matching items. Review the source errors above.'
          : 'No pending requests in this filter.'}</Text>}
      renderItem={({ item }: { item: AdminPriorityItem }) => {
        const rank = rankAdminPriority(item);
        return <Pressable accessibilityRole="button" onPress={() => router.push(item.route as any)} style={styles.item}>
          <View style={styles.itemTop}>
            <Text style={[styles.level, rank === 3 ? styles.urgent : rank === 2 ? styles.high : styles.normal]}>
              {rank === 3 ? 'URGENT' : rank === 2 ? 'HIGH' : 'STANDARD'}
            </Text>
            <Text style={styles.time}>{ageLabel(item.createdAt)}</Text>
          </View>
          <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.itemMeta} numberOfLines={2}>{item.summary}</Text>
          <View style={styles.itemBottom}>
            <Text style={styles.source}>{item.source} · {item.status}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#276346" />
          </View>
        </Pressable>;
      }}
    />
  </AdminGate>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F9F7' },
  content: { padding: 14, paddingBottom: 110, gap: 10 },
  header: { gap: 12, paddingBottom: 8 },
  back: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingVertical: 4 },
  link: { color: '#21553B', fontSize: 13, fontWeight: '800' },
  eyebrow: { color: '#477259', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#183C2A', fontSize: 27, fontWeight: '900' },
  subtitle: { color: '#536F5E', lineHeight: 19, fontSize: 13 },
  metrics: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, borderRadius: 12, backgroundColor: '#E7F2EB', padding: 11, minHeight: 79 },
  metricNumber: { color: '#1A5034', fontSize: 22, fontWeight: '900' },
  metricLabel: { color: '#496957', fontSize: 10, fontWeight: '700', marginTop: 3 },
  warning: { color: '#873C22', backgroundColor: '#FFF1E8', padding: 12, borderRadius: 10, fontSize: 12, lineHeight: 17 },
  hint: { color: '#6A7F71', fontSize: 11, lineHeight: 16 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: '#CBDDD1', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 20 },
  chipActive: { backgroundColor: '#225B3C', borderColor: '#225B3C' },
  chipText: { color: '#42664E', fontSize: 11, fontWeight: '800' },
  chipTextActive: { color: '#FFFFFF' },
  item: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D7E7DC', borderRadius: 13, padding: 14, gap: 6 },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  level: { overflow: 'hidden', fontSize: 10, fontWeight: '900', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3 },
  urgent: { color: '#922D2D', backgroundColor: '#FDE7E7' },
  high: { color: '#88531A', backgroundColor: '#FFF2DB' },
  normal: { color: '#326047', backgroundColor: '#E8F4EC' },
  time: { color: '#68776F', fontSize: 11 },
  itemTitle: { color: '#19392B', fontSize: 15, fontWeight: '900' },
  itemMeta: { color: '#506D5B', fontSize: 12, lineHeight: 17 },
  itemBottom: { borderTopWidth: 1, borderColor: '#EFF4F0', paddingTop: 9, marginTop: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  source: { fontSize: 11, color: '#6B7D71', flex: 1 },
  state: { textAlign: 'center', color: '#6A7F71', paddingVertical: 30, fontSize: 13 },
});
