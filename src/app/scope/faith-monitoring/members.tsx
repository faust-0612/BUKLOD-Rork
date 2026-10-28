import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { readScopeIdFromParams } from '@/lib/buklodScopeManage';
import {
  fetchFaithMonitoringMembers, matchesFaithMonitoringMember, memberMonitoringStatus,
  type FaithMonitoringArea, type FaithMonitoringMember,
  type FaithMonitoringMemberFilter, type FaithMonitoringMembersResult,
} from '@/lib/buklodScopeFaithMonitoringMembers';

const GREEN = '#17653A';

function first(value: unknown): string {
  return typeof value === 'string' ? value : Array.isArray(value) && typeof value[0] === 'string' ? value[0] : '';
}

function areaFromRoute(value: unknown): FaithMonitoringArea {
  return value === 'daily' || value === 'devotion' || value === 'lesson' ? value : 'daily';
}

function filterFromRoute(value: unknown): FaithMonitoringMemberFilter {
  const allowed: FaithMonitoringMemberFilter[] = [
    'all', 'approved', 'submitted', 'checking', 'revision', 'missing',
    'weekly', 'active', 'completed', 'in_progress',
  ];
  return allowed.includes(value as FaithMonitoringMemberFilter)
    ? value as FaithMonitoringMemberFilter : 'all';
}

function timeLabel(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function statusColor(status: string) {
  if (status === 'Approved' || status === 'Completed' || status === 'Has lesson activity') return GREEN;
  if (status === 'Needs revision') return '#B45309';
  if (status === 'Automatic checking' || status === 'In progress' || status === 'Submitted') return '#1D4ED8';
  return '#64748B';
}

const LABELS: Record<FaithMonitoringArea, string> = {
  daily: 'Daily Reading', devotion: 'Devotion', lesson: 'BUKLOD Lesson',
};

const COMMON_FILTERS: Record<FaithMonitoringArea, Array<[FaithMonitoringMemberFilter, string]>> = {
  daily: [
    ['all', 'All'], ['approved', 'Approved'], ['submitted', 'Submitted'],
    ['checking', 'Checking'], ['revision', 'Needs revision'],
    ['missing', 'Not submitted'], ['weekly', 'Approved this week'],
  ],
  devotion: [
    ['all', 'All'], ['completed', 'Completed'], ['submitted', 'Submitted'],
    ['checking', 'Checking'], ['revision', 'Needs revision'],
    ['missing', 'Not completed'], ['weekly', 'Completed this week'],
  ],
  lesson: [
    ['all', 'All'], ['active', 'With activity'], ['missing', 'Not started'],
  ],
};

function MemberDetails({ member }: { member: FaithMonitoringMember }) {
  return (
    <View style={styles.details}>
      <Text style={styles.detailLine}>Reading: {memberMonitoringStatus(member, 'daily')}</Text>
      {member.reading.latest_reference ? (
        <Text style={styles.detailSub}>{member.reading.latest_reference} · {timeLabel(member.reading.latest_at)}</Text>
      ) : null}
      <Text style={styles.detailLine}>Devotion: {memberMonitoringStatus(member, 'devotion')}</Text>
      {member.devotion.latest_at ? <Text style={styles.detailSub}>{timeLabel(member.devotion.latest_at)}</Text> : null}
      <Text style={styles.detailLine}>BUKLOD Lesson Stages</Text>
      {member.lesson.stages.map((stage) => (
        <View key={stage.stage_code} style={styles.stageDetail}>
          <Text style={styles.stageName}>BUKLOD {stage.stage_code} · {stage.stage_title}</Text>
          <Text style={{ color: statusColor(stage.status === 'COMPLETED' ? 'Completed' : stage.status === 'IN_PROGRESS' ? 'In progress' : 'Not started') }}>
            {stage.status === 'COMPLETED' ? 'Done' : stage.status === 'IN_PROGRESS' ? 'In progress' : 'Not started'}
            {' · '}{stage.approved_lessons}/{stage.expected_lessons} lessons
            {stage.required_requirements ? ` · ${stage.verified_requirements}/${stage.required_requirements} requirements` : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function ScopeFaithMonitoringMembersScreen() {
  const params = useLocalSearchParams();
  const scopeId = readScopeIdFromParams(params as Record<string, unknown>);
  const area = areaFromRoute(first(params.area));
  const stageCode = area === 'lesson' ? Number(first(params.stage)) || undefined : undefined;
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<FaithMonitoringMemberFilter>(filterFromRoute(first(params.filter)));
  const [search, setSearch] = useState('');
  const [result, setResult] = useState<FaithMonitoringMembersResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const requestId = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; requestId.current += 1; };
  }, []);
  useEffect(() => {
    setFilter(filterFromRoute(first(params.filter)));
    setExpanded(null);
  }, [params.area, params.filter, params.stage]);

  const load = useCallback(async (isActive: () => boolean) => {
    const currentRequest = ++requestId.current;
    const isCurrent = () => mounted.current && isActive() && requestId.current === currentRequest;
    if (!scopeId) {
      if (isCurrent()) {
        setError('The workspace is missing. Open Faith Monitoring again.');
        setLoading(false);
        setRefreshing(false);
      }
      return;
    }
    try {
      const next = await fetchFaithMonitoringMembers(scopeId);
      if (isCurrent()) { setResult(next); setError(null); }
    } catch (err: unknown) {
      if (isCurrent()) {
        setError(String((err as Error)?.message ?? 'Could not load member activity.'));
        setResult(null);
      }
    } finally {
      if (isCurrent()) { setLoading(false); setRefreshing(false); }
    }
  }, [scopeId]);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    void load(() => active);
    return () => { active = false; };
  }, [load]));

  const filters = area === 'lesson' && stageCode
    ? ([['all', 'All'], ['completed', 'Done'], ['in_progress', 'In progress'], ['missing', 'Not started']] as Array<[FaithMonitoringMemberFilter, string]>)
    : COMMON_FILTERS[area];

  const members = useMemo(() => (result?.members ?? []).filter((member) =>
    member.member_name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
    && matchesFaithMonitoringMember(member, area, filter, stageCode),
  ), [result, search, area, filter, stageCode]);

  return (
    <View style={[styles.shell, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to Faith Monitoring"
          style={styles.back} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>{stageCode ? `BUKLOD ${stageCode}` : LABELS[area]}</Text>
          <Text numberOfLines={1} style={styles.subtitle}>{result?.scope_name ?? 'Member Activity'}</Text>
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
          setRefreshing(true);
          void load(() => true);
        }} />}>
        <Text style={styles.intro}>Individual member progress · {result?.report_date || 'Today'} (Philippine time)</Text>
        <TextInput style={styles.search} placeholder="Search member name" value={search}
          onChangeText={setSearch} autoCapitalize="none" accessibilityLabel="Search member" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {filters.map(([key, title]) => (
            <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: filter === key }}
              onPress={() => setFilter(key)} style={[styles.filter, filter === key && styles.filterSelected]}>
              <Text style={[styles.filterText, filter === key && styles.filterTextSelected]}>{title}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading && !result ? <ActivityIndicator color={GREEN} style={styles.loader} /> : null}
        {error ? (
          <View style={styles.notice}>
            <Text style={styles.error}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => {
              setLoading(true);
              void load(() => true);
            }}><Text style={styles.retry}>Try again</Text></Pressable>
          </View>
        ) : result ? (
          <>
            <Text style={styles.count}>{members.length} of {result.members.length} active members</Text>
            {area === 'daily' ? <Text style={styles.hint}>Daily Reading submissions include catch-up readings submitted today.</Text> : null}
            {members.length === 0 ? <Text style={styles.empty}>No members match this filter.</Text> : null}
            {members.map((member) => {
              const status = memberMonitoringStatus(member, area, stageCode);
              const open = expanded === member.user_id;
              return (
                <Pressable key={member.user_id} accessibilityRole="button"
                  accessibilityLabel={`View ${member.member_name} formation progress`}
                  accessibilityState={{ expanded: open }}
                  onPress={() => setExpanded(open ? null : member.user_id)} style={styles.member}>
                  <View style={styles.memberHead}>
                    <View style={styles.avatar}><Text style={styles.initial}>{member.member_name.trim().charAt(0).toUpperCase() || '?'}</Text></View>
                    <View style={styles.memberCopy}>
                      <Text style={styles.memberName}>{member.member_name}</Text>
                      <Text style={[styles.status, { color: statusColor(status) }]}>{status}</Text>
                    </View>
                    <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={23} color="#5F6F67" />
                  </View>
                  {open ? <MemberDetails member={member} /> : null}
                </Pressable>
              );
            })}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: '#F2F7FD' },
  header: { minHeight: 65, backgroundColor: '#07539B', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, gap: 12 },
  back: { width: 40, height: 44, justifyContent: 'center' },
  headerText: { flex: 1 },
  title: { color: '#FFFFFF', fontWeight: '900', fontSize: 18 },
  subtitle: { color: '#D6E9FF', marginTop: 3, fontSize: 11 },
  content: { padding: 14, gap: 11 },
  intro: { fontSize: 12, color: '#526B5C' },
  search: { borderWidth: 1, borderColor: '#DCE5E0', borderRadius: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 14, minHeight: 46, fontSize: 14 },
  filters: { gap: 7, paddingVertical: 2 },
  filter: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE5E0' },
  filterSelected: { backgroundColor: GREEN, borderColor: GREEN },
  filterText: { fontWeight: '700', color: '#496356', fontSize: 12 },
  filterTextSelected: { color: '#FFFFFF' },
  loader: { marginTop: 28 },
  notice: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 15, gap: 12 },
  error: { color: '#9A3131', fontSize: 13 },
  retry: { color: GREEN, fontWeight: '800' },
  count: { fontSize: 12, color: '#456052', fontWeight: '700' },
  hint: { fontSize: 11, color: '#60746A', lineHeight: 16 },
  empty: { textAlign: 'center', color: '#60746A', padding: 20 },
  member: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE5E0', borderRadius: 14, padding: 12, gap: 10 },
  memberHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#E7F4EB', justifyContent: 'center', alignItems: 'center' },
  initial: { fontSize: 17, color: GREEN, fontWeight: '900' },
  memberCopy: { flex: 1 },
  memberName: { fontSize: 14, color: '#173B2F', fontWeight: '800' },
  status: { fontSize: 11, fontWeight: '700', marginTop: 3 },
  details: { borderTopWidth: 1, borderTopColor: '#E8EFEA', paddingTop: 10, gap: 6 },
  detailLine: { fontSize: 12, fontWeight: '700', color: '#294B3D' },
  detailSub: { fontSize: 11, color: '#60746A' },
  stageDetail: { paddingVertical: 5, gap: 2 },
  stageName: { fontSize: 11, color: '#294B3D', fontWeight: '700' },
});
