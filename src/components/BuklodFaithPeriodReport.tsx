import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

import {
  faithPeriodToCsvRows, fetchFaithPeriodReport, percentage, shiftFaithPeriodAnchor, todayInManila,
  type FaithPeriod, type FaithPeriodMember, type FaithPeriodResult,
} from '@/lib/buklodScopeFaithPeriodReport';
import { shareCsv } from '@/lib/reports/export';

const GREEN = '#17653A';
const PAGE_SIZE = 40;
type Props = { scopeId: string; scopeName: string };

function prettyDate(date: string): string {
  const value = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(value.getTime()) ? date : value.toLocaleDateString('en-PH', {
    timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>;
}

function MemberRow({ member, expected }: { member: FaithPeriodMember; expected: number }) {
  const [expanded, setExpanded] = useState(false);
  return <Pressable style={styles.member} accessibilityRole="button"
    accessibilityLabel={`View ${member.member_name} weekly or monthly progress`}
    accessibilityState={{ expanded }} onPress={() => setExpanded((current) => !current)}>
    <View style={styles.memberHead}>
      <View style={styles.avatar}><Text style={styles.initial}>{member.member_name.charAt(0).toUpperCase() || '?'}</Text></View>
      <View style={styles.memberTitle}>
        <Text style={styles.memberName}>{member.member_name}</Text>
        <Text style={styles.memberSubtitle}>Reading {member.reading_approved_days}/{expected} · Devotion {member.devotion_completed_days}/{expected} days</Text>
      </View>
      <MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={GREEN} />
    </View>
    <View style={styles.memberMetrics}>
      <Text style={styles.memberRate}>Reading {percentage(member.reading_approved_days, expected)}%</Text>
      <Text style={styles.memberRate}>Devotion {percentage(member.devotion_completed_days, expected)}%</Text>
      <Text style={styles.memberRate}>Lessons +{member.lesson_approved_count}</Text>
    </View>
    {expanded ? <View style={styles.details}>
      <Text style={styles.detail}>Daily Reading: {member.reading_submitted_days} submitted days, {member.reading_approved_days} approved, {member.reading_revision_days} need revision</Text>
      <Text style={styles.detail}>Devotion: {member.devotion_submitted_days} submitted days, {member.devotion_completed_days} completed, {member.devotion_revision_days} need revision</Text>
      <Text style={styles.detail}>BUKLOD Lessons: {member.lesson_approved_count} approved, {member.lesson_pending_count} pending this period</Text>
      {member.lesson_stages.map((stage) => <Text key={stage.stage_code} style={styles.stage}>
        BUKLOD {stage.stage_code}: {stage.approved_count} approved lesson{stage.approved_count === 1 ? '' : 's'}
      </Text>)}
      <Text style={styles.explain}>Daily progress is counted once per assigned or completed date, not once per repeated submission.</Text>
    </View> : null}
  </Pressable>;
}

export default function BuklodFaithPeriodReport({ scopeId, scopeName }: Props) {
  const [period, setPeriod] = useState<FaithPeriod>('week');
  const [anchor, setAnchor] = useState(todayInManila);
  const [report, setReport] = useState<FaithPeriodResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [exporting, setExporting] = useState(false);
  const [retry, setRetry] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setReport(null); // Never show the prior workspace/period under a new selection.
    setLoading(true);
    setError(null);
    void fetchFaithPeriodReport(scopeId, period, anchor).then((result) => {
      if (active) { setReport(result); setError(null); }
    }).catch((e: unknown) => {
      if (active) setError(String((e as Error)?.message ?? 'Could not load period report.'));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [scopeId, period, anchor, retry]));

  const activeReport = report?.scope_id === scopeId && report.period === period ? report : null;
  const today = todayInManila();
  const earliest = shiftFaithPeriodAnchor(today, 'week', -52);
  const previous = shiftFaithPeriodAnchor(anchor, period, -1);
  const next = shiftFaithPeriodAnchor(anchor, period, 1);
  const canPrevious = previous >= earliest;
  const canNext = next <= today;

  const filtered = useMemo(() => (activeReport?.members ?? []).filter((member) =>
    member.member_name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  ), [activeReport, search]);

  const exportNamed = async () => {
    if (!activeReport || exporting) return;
    setExporting(true);
    try {
      const safeName = scopeName.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'scope';
      await shareCsv(`faith-${period}-named-${safeName}-${activeReport.start_date}.csv`,
        faithPeriodToCsvRows(activeReport));
    } catch (e: unknown) {
      Alert.alert('Export', String((e as Error)?.message ?? 'Could not export member report.'));
    } finally { setExporting(false); }
  };

  const setKind = (value: FaithPeriod) => {
    setPeriod(value);
    setAnchor(todayInManila());
    setVisibleCount(PAGE_SIZE);
  };

  const totals = activeReport?.totals;
  const possibleDays = (totals?.active_members ?? 0) * (activeReport?.expected_days ?? 0);
  const belowTarget = activeReport?.members.filter((m) =>
    m.reading_approved_days < activeReport.expected_days
    || m.devotion_completed_days < activeReport.expected_days).length ?? 0;

  return <View style={styles.card}>
    <View style={styles.head}>
      <View style={styles.headCopy}>
        <Text style={styles.title}>OVERALL FAITH REPORT</Text>
        <Text style={styles.subtitle}>Weekly and monthly · name-specific member progress</Text>
      </View>
      <Pressable style={[styles.export, (!activeReport || exporting) && styles.disabled]}
        disabled={!activeReport || exporting} accessibilityRole="button"
        accessibilityLabel="Export named weekly or monthly report"
        onPress={() => void exportNamed()}>
        <MaterialCommunityIcons name="file-export-outline" size={17} color={GREEN} />
        <Text style={styles.exportText}>{exporting ? 'Exporting' : 'CSV'}</Text>
      </Pressable>
    </View>

    <View style={styles.switch}>
      {(['week', 'month'] as FaithPeriod[]).map((value) => <Pressable key={value}
        accessibilityRole="button" accessibilityState={{ selected: period === value }}
        onPress={() => setKind(value)} style={[styles.switchButton, period === value && styles.selected]}>
        <Text style={[styles.switchLabel, period === value && styles.selectedLabel]}>
          {value === 'week' ? 'Weekly' : 'Monthly'}
        </Text>
      </Pressable>)}
    </View>

    <View style={styles.range}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous report period"
        disabled={!canPrevious} onPress={() => { setAnchor(previous); setVisibleCount(PAGE_SIZE); }}
        style={[styles.arrow, !canPrevious && styles.disabled]}>
        <MaterialCommunityIcons name="chevron-left" size={22} color={GREEN} />
      </Pressable>
      <View style={styles.rangeText}>
        <Text style={styles.rangeTitle}>{activeReport
          ? `${prettyDate(activeReport.start_date)} – ${prettyDate(activeReport.end_date)}`
          : period === 'week' ? 'Weekly monitoring' : 'Monthly monitoring'}</Text>
        <Text style={styles.rangeSub}>{activeReport
          ? `As of ${prettyDate(activeReport.as_of_date)} · ${activeReport.expected_days} elapsed day(s)`
          : 'Philippine time'}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Next report period"
        disabled={!canNext} onPress={() => { setAnchor(next); setVisibleCount(PAGE_SIZE); }}
        style={[styles.arrow, !canNext && styles.disabled]}>
        <MaterialCommunityIcons name="chevron-right" size={22} color={GREEN} />
      </Pressable>
    </View>

    {loading ? <View style={styles.center}><ActivityIndicator color={GREEN} /><Text style={styles.helper}>Loading this period…</Text></View> : null}
    {error ? <View style={styles.errorBox}>
      <Text style={styles.errorText}>{error}</Text>
      <Pressable accessibilityRole="button" onPress={() => setRetry((n) => n + 1)}>
        <Text style={styles.retryText}>Retry report</Text>
      </Pressable>
    </View> : null}

    {activeReport && totals ? <>
      <View style={styles.grid}>
        <Metric label="Active members" value={String(totals.active_members)} />
        <Metric label="Members with activity" value={String(totals.members_with_activity)} />
        <Metric label="Reading approval" value={`${percentage(totals.reading_approved_days, possibleDays)}%`} />
        <Metric label="Devotion completion" value={`${percentage(totals.devotion_completed_days, possibleDays)}%`} />
        <Metric label="Approved lessons" value={String(totals.lesson_approved_count)} />
        <Metric label="Below daily target to date" value={String(belowTarget)} />
      </View>
      <Text style={styles.context}>
        Reading and Devotion rates use {activeReport.expected_days} elapsed days × {totals.active_members} members. Only submissions attributed to this workspace count.
      </Text>
      <Text style={styles.sectionTitle}>INDIVIDUAL MEMBER REPORT</Text>
      <TextInput style={styles.search} placeholder="Search member by name" placeholderTextColor="#738679"
        value={search} onChangeText={(value) => { setSearch(value); setVisibleCount(PAGE_SIZE); }}
        autoCapitalize="none" accessibilityLabel="Search report member by name" />
      <Text style={styles.count}>{filtered.length} of {activeReport.members.length} member(s)</Text>
      {filtered.length === 0 ? <Text style={styles.helper}>No member matches this search.</Text> : null}
      {filtered.slice(0, visibleCount).map((member) =>
        <MemberRow key={member.user_id} member={member} expected={activeReport.expected_days} />)}
      {filtered.length > visibleCount ? <Pressable style={styles.more} accessibilityRole="button"
        onPress={() => setVisibleCount((n) => n + PAGE_SIZE)}>
        <Text style={styles.moreLabel}>Show more ({filtered.length - visibleCount} remaining)</Text>
      </Pressable> : null}
      <Text style={styles.footer}>The report is private to authorized workspace leadership. No devotional answers or personal reflections are included in CSV.</Text>
    </> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#DDE9E2', padding: 14, gap: 12, marginBottom: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headCopy: { flex: 1 },
  title: { color: '#184735', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  subtitle: { color: '#577263', fontSize: 11, marginTop: 3 },
  export: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F3FAF5', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1, borderColor: '#DCE8DF' },
  exportText: { color: GREEN, fontWeight: '800', fontSize: 11 },
  disabled: { opacity: 0.3 },
  switch: { flexDirection: 'row', padding: 3, borderRadius: 12, backgroundColor: '#EFF5F1', gap: 4 },
  switchButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  selected: { backgroundColor: GREEN },
  switchLabel: { fontSize: 13, fontWeight: '800', color: '#486659' },
  selectedLabel: { color: '#FFFFFF' },
  range: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  arrow: { width: 36, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderWidth: 1, borderColor: '#DCE8DF' },
  rangeText: { flex: 1, alignItems: 'center' },
  rangeTitle: { fontSize: 12, fontWeight: '900', color: '#294A3B', textAlign: 'center' },
  rangeSub: { fontSize: 10, color: '#687B70', marginTop: 3, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  metric: { width: '48%', flexGrow: 1, backgroundColor: '#F4F8F5', borderRadius: 12, padding: 11, minHeight: 76 },
  metricValue: { color: GREEN, fontSize: 19, fontWeight: '900' },
  metricLabel: { color: '#556B60', fontSize: 10, marginTop: 4, fontWeight: '700' },
  context: { fontSize: 11, color: '#657A6D', lineHeight: 16 },
  sectionTitle: { fontSize: 12, color: '#174A34', fontWeight: '900', marginTop: 5 },
  search: { backgroundColor: '#FAFCFA', borderColor: '#DDE7E0', borderWidth: 1, minHeight: 44, borderRadius: 11, paddingHorizontal: 12, fontSize: 13 },
  count: { fontSize: 11, color: '#51665B', fontWeight: '700' },
  member: { borderColor: '#E0E9E3', borderWidth: 1, borderRadius: 13, padding: 11, gap: 8 },
  memberHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E5F4EB', justifyContent: 'center', alignItems: 'center' },
  initial: { color: GREEN, fontSize: 14, fontWeight: '900' },
  memberTitle: { flex: 1 },
  memberName: { color: '#1C3D2F', fontSize: 13, fontWeight: '800' },
  memberSubtitle: { color: '#60786B', fontSize: 10, marginTop: 3 },
  memberMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  memberRate: { fontSize: 10, fontWeight: '800', backgroundColor: '#F2F8F4', paddingVertical: 5, paddingHorizontal: 8, borderRadius: 7, color: GREEN },
  details: { borderTopWidth: 1, borderColor: '#E3EBE6', paddingTop: 9, gap: 7 },
  detail: { fontSize: 11, lineHeight: 17, color: '#394F43' },
  stage: { fontSize: 11, color: GREEN, paddingLeft: 10 },
  explain: { fontSize: 10, color: '#697D71', marginTop: 4, fontStyle: 'italic' },
  more: { alignItems: 'center', padding: 12, borderRadius: 10, backgroundColor: '#F3F8F5' },
  moreLabel: { color: GREEN, fontSize: 12, fontWeight: '900' },
  center: { alignItems: 'center', gap: 8, paddingVertical: 22 },
  helper: { textAlign: 'center', color: '#647769', fontSize: 12 },
  errorBox: { borderRadius: 10, backgroundColor: '#FFF6F3', padding: 12, gap: 9 },
  errorText: { color: '#9E3528', fontSize: 11 },
  retryText: { color: GREEN, fontWeight: '900', fontSize: 12 },
  footer: { color: '#6A7E71', fontSize: 10, lineHeight: 16 },
});
