import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { BsocGate } from '@/components/bsoc/BsocGate';
import BsocShell, {
  BsocMetric,
  BsocPanel,
  BsocStatusBadge,
  type BsocTone,
} from '@/components/bsoc/BsocShell';
import {
  loadBsocIncidents,
  loadBsocSupportInbox,
  loadBsocSupportMetrics,
  updateBsocIncident,
  updateBsocSupportCase,
  type BsocIncident,
  type BsocSupportCase,
  type BsocSupportMetrics,
} from '@/lib/admin/bsocSupport';

const STATUS_FILTERS = [
  ['ALL', null],
  ['OPEN', 'OPEN'],
  ['REVIEW', 'BEING_REVIEWED'],
  ['WAITING', 'WAITING_FOR_USER'],
  ['RESOLVED', 'RESOLVED'],
] as const;

function toneForStatus(status: string): BsocTone {
  if (status === 'RESOLVED') return 'healthy';
  if (status === 'WAITING_FOR_USER') return 'warning';
  if (status === 'BEING_REVIEWED') return 'neutral';
  return 'critical';
}

function statusLabel(status: string) {
  if (status === 'WAITING_FOR_USER') return 'WAITING FOR USER';
  if (status === 'BEING_REVIEWED') return 'BEING REVIEWED';
  return status;
}

export default function BsocSupportScreen() {
  const [cases, setCases] = useState<BsocSupportCase[]>([]);
  const [incidents, setIncidents] = useState<BsocIncident[]>([]);
  const [metrics, setMetrics] = useState<BsocSupportMetrics | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextCases, nextIncidents, nextMetrics] = await Promise.all([
        loadBsocSupportInbox({
          limit: 200,
          status,
          search,
        }),
        loadBsocIncidents(false),
        loadBsocSupportMetrics(),
      ]);
      setCases(nextCases);
      setIncidents(nextIncidents);
      setMetrics(nextMetrics);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Support source unavailable.',
      );
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const sharedIncidents = useMemo(
    () =>
      incidents.filter(
        item =>
          item.status === 'POSSIBLE_SHARED_INCIDENT' ||
          Number(item.affected_users ?? 0) > 1,
      ),
    [incidents],
  );

  const changeIncidentStatus = async (
    item: BsocIncident,
    next: 'INVESTIGATING' | 'MONITORING' | 'RESOLVED',
  ) => {
    if (acting) return;
    setActing(item.incident_code);
    setError('');
    try {
      await updateBsocIncident({
        incidentCode: item.incident_code,
        status: next,
        publicMessage:
          next === 'RESOLVED'
            ? 'This BUKLOD incident has been resolved. Please try again.'
            : next === 'MONITORING'
              ? 'A fix is in place and BUKLOD is monitoring the result.'
              : 'BUKLOD is actively investigating this shared issue.',
      });
      await load();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : 'Incident update failed.',
      );
    } finally {
      setActing(null);
    }
  };

  const changeStatus = async (
    item: BsocSupportCase,
    next:
      | 'OPEN'
      | 'WAITING_FOR_USER'
      | 'BEING_REVIEWED'
      | 'RESOLVED',
  ) => {
    if (acting) return;
    setActing(item.case_code);
    setError('');
    try {
      await updateBsocSupportCase({
        caseCode: item.case_code,
        status: next,
        userMessage:
          next === 'RESOLVED'
            ? 'Your BUKLOD support case has been resolved.'
            : undefined,
      });
      await load();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : 'Support case update failed.',
      );
    } finally {
      setActing(null);
    }
  };

  return (
    <BsocGate>
      <BsocShell
        current="support"
        eyebrow="SUPPORT OPERATIONS"
        title="Support Inbox"
        subtitle="Prevent → Detect → Explain → Self-Heal → Verify → Escalate. Only unresolved user issues arrive here."
        rightPanel={
          <View style={styles.rightStack}>
            <BsocPanel>
              <Text style={styles.panelEyebrow}>ROUTING CONTRACT</Text>
              <Text style={styles.panelTitle}>One inbox, scoped queues</Text>
              <Text style={styles.panelBody}>
                Login and recovery, Quiz, Classroom, Community Operations,
                Moderation and Engineering all use the same canonical case
                store. Queue codes organize work without creating separate
                ticket systems.
              </Text>
            </BsocPanel>

            <BsocPanel>
              <Text style={styles.panelEyebrow}>FINANCE BOUNDARY</Text>
              <Text style={styles.panelTitle}>Amounts stay outside BSOC</Text>
              <Text style={styles.panelBody}>
                Financial inquiries may be routed here as restricted
                escalations, but ordinary BSOC staff receive redacted message
                and diagnostic fields. Revenue, balances and payout amounts are
                never returned by the support inbox RPC.
              </Text>
            </BsocPanel>

            <BsocPanel>
              <Text style={styles.panelEyebrow}>INCIDENT CORRELATION</Text>
              <Text style={styles.panelTitle}>
                {sharedIncidents.length} shared signal
                {sharedIncidents.length === 1 ? '' : 's'}
              </Text>
              <Text style={styles.panelBody}>
                Repeated matching case fingerprints consolidate under one
                incident while preserving each user case.
              </Text>
            </BsocPanel>
          </View>
        }
      >
        <View style={styles.metrics}>
          <BsocMetric label="Open" value={metrics?.open ?? '—'} note="Needs review" />
          <BsocMetric
            label="Being reviewed"
            value={metrics?.being_reviewed ?? '—'}
            note="Active work"
          />
          <BsocMetric
            label="Waiting for user"
            value={metrics?.waiting_for_user ?? '—'}
            note="User action needed"
          />
          <BsocMetric
            label="Active incidents"
            value={metrics?.active_incidents ?? '—'}
            note="Correlated root causes"
          />
        </View>

        <BsocPanel>
          <View style={styles.toolbar}>
            <View style={styles.filters}>
              {STATUS_FILTERS.map(([label, value]) => (
                <Pressable
                  key={label}
                  onPress={() => setStatus(value)}
                  style={[
                    styles.filter,
                    status === value && styles.filterActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      status === value && styles.filterTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.searchWrap}>
              <MaterialCommunityIcons
                name="magnify"
                size={18}
                color="#7A867F"
              />
              <TextInput
                value={search}
                onChangeText={setSearch}
                onSubmitEditing={() => void load()}
                placeholder="Case, category or error code"
                style={styles.search}
              />
            </View>

            <Pressable onPress={() => void load()} style={styles.refresh}>
              <MaterialCommunityIcons name="refresh" size={18} color="#1F5C43" />
              <Text style={styles.refreshText}>REFRESH</Text>
            </Pressable>
          </View>
        </BsocPanel>

        {!!error && (
          <BsocPanel>
            <Text style={styles.error}>{error}</Text>
          </BsocPanel>
        )}

        {loading ? (
          <BsocPanel>
            <View style={styles.loading}>
              <ActivityIndicator size="small" color="#1F5C43" />
              <Text style={styles.muted}>Loading support workload…</Text>
            </View>
          </BsocPanel>
        ) : (
          <BsocPanel>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.panelEyebrow}>USER CASES</Text>
                <Text style={styles.sectionTitle}>
                  {cases.length.toLocaleString('en-PH')} visible case
                  {cases.length === 1 ? '' : 's'}
                </Text>
              </View>
              <Text style={styles.muted}>Bounded to 200 rows</Text>
            </View>

            <ScrollView horizontal>
              <View style={styles.table}>
                <View style={[styles.row, styles.headerRow]}>
                  {['CASE','STATUS','QUEUE','APP / FEATURE','USER REPORT','DIAGNOSTICS','ACTIONS'].map(
                    label => (
                      <Text key={label} style={[styles.cell, styles.headerCell]}>
                        {label}
                      </Text>
                    ),
                  )}
                </View>

                {cases.map(item => (
                  <View key={item.case_code} style={styles.row}>
                    <View style={styles.cell}>
                      <Text style={styles.caseCode}>{item.case_code}</Text>
                      <Text style={styles.small}>{item.category}</Text>
                    </View>

                    <View style={styles.cell}>
                      <BsocStatusBadge
                        label={statusLabel(item.status)}
                        tone={toneForStatus(item.status)}
                      />
                      {!!item.incident_code && (
                        <Text style={styles.incidentLink}>
                          {item.incident_code}
                        </Text>
                      )}
                    </View>

                    <View style={styles.cell}>
                      <Text style={styles.strong}>{item.queue_code}</Text>
                    </View>

                    <View style={styles.cell}>
                      <Text style={styles.strong}>{item.app}</Text>
                      <Text style={styles.small}>
                        {item.feature || 'General'} • {item.platform || '—'} •{' '}
                        {item.app_version || '—'}
                      </Text>
                    </View>

                    <View style={styles.cell}>
                      <Text numberOfLines={3} style={styles.body}>
                        {item.message || 'No user message.'}
                      </Text>
                    </View>

                    <View style={styles.cell}>
                      <Text style={styles.small}>
                        Route: {item.route || '—'}
                      </Text>
                      <Text style={styles.small}>
                        Error: {item.error_code || '—'}
                      </Text>
                      <Text style={styles.small}>
                        Language: {item.language_code || '—'}
                      </Text>
                    </View>

                    <View style={[styles.cell, styles.actions]}>
                      {item.status !== 'BEING_REVIEWED' && item.status !== 'RESOLVED' ? (
                        <Pressable
                          disabled={!!acting}
                          onPress={() => void changeStatus(item, 'BEING_REVIEWED')}
                          style={styles.action}
                        >
                          <Text style={styles.actionText}>REVIEW</Text>
                        </Pressable>
                      ) : null}
                      {item.status !== 'WAITING_FOR_USER' && item.status !== 'RESOLVED' ? (
                        <Pressable
                          disabled={!!acting}
                          onPress={() => void changeStatus(item, 'WAITING_FOR_USER')}
                          style={styles.action}
                        >
                          <Text style={styles.actionText}>WAIT USER</Text>
                        </Pressable>
                      ) : null}
                      {item.status !== 'RESOLVED' ? (
                        <Pressable
                          disabled={!!acting}
                          onPress={() => void changeStatus(item, 'RESOLVED')}
                          style={[styles.action, styles.actionResolve]}
                        >
                          <Text style={styles.actionResolveText}>RESOLVE</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ))}

                {!cases.length ? (
                  <Text style={styles.empty}>
                    No support cases match the current filter.
                  </Text>
                ) : null}
              </View>
            </ScrollView>
          </BsocPanel>
        )}

        <BsocPanel>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.panelEyebrow}>SHARED INCIDENTS</Text>
              <Text style={styles.sectionTitle}>One root cause, many users</Text>
            </View>
          </View>

          <View style={styles.incidentList}>
            {incidents.map(item => (
              <View key={item.incident_code} style={styles.incidentRow}>
                <View style={{ flex: 1 }}>
                  <View style={styles.incidentTitleRow}>
                    <Text style={styles.caseCode}>{item.incident_code}</Text>
                    <BsocStatusBadge
                      label={item.status}
                      tone={
                        item.status === 'RESOLVED'
                          ? 'healthy'
                          : item.severity === 'P0' || item.severity === 'P1'
                            ? 'critical'
                            : 'warning'
                      }
                    />
                  </View>
                  <Text style={styles.incidentTitle}>{item.title}</Text>
                  <Text style={styles.body}>{item.public_message}</Text>
                  <Text style={styles.small}>
                    {item.app} • {item.category} • affected users:{' '}
                    {Number(item.affected_users ?? 0).toLocaleString('en-PH')}
                  </Text>
                  {item.status !== 'RESOLVED' ? (
                    <View style={styles.incidentActions}>
                      {item.status !== 'INVESTIGATING' ? (
                        <Pressable
                          disabled={!!acting}
                          onPress={() =>
                            void changeIncidentStatus(item, 'INVESTIGATING')
                          }
                          style={styles.action}
                        >
                          <Text style={styles.actionText}>INVESTIGATE</Text>
                        </Pressable>
                      ) : null}
                      {item.status !== 'MONITORING' ? (
                        <Pressable
                          disabled={!!acting}
                          onPress={() =>
                            void changeIncidentStatus(item, 'MONITORING')
                          }
                          style={styles.action}
                        >
                          <Text style={styles.actionText}>MONITOR</Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        disabled={!!acting}
                        onPress={() =>
                          void changeIncidentStatus(item, 'RESOLVED')
                        }
                        style={[styles.action, styles.actionResolve]}
                      >
                        <Text style={styles.actionResolveText}>RESOLVE INCIDENT</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
            {!incidents.length ? (
              <Text style={styles.empty}>No active incidents.</Text>
            ) : null}
          </View>
        </BsocPanel>
      </BsocShell>
    </BsocGate>
  );
}

const styles = StyleSheet.create({
  rightStack: { gap: 14 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  panelEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    color: '#738078',
  },
  panelTitle: { marginTop: 4, fontSize: 16, fontWeight: '900', color: '#203D31' },
  panelBody: { marginTop: 6, fontSize: 12.5, lineHeight: 19, color: '#637169' },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filter: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: '#F1F5F2',
  },
  filterActive: { backgroundColor: '#1F5C43' },
  filterText: { fontSize: 9.5, fontWeight: '900', color: '#5C6962' },
  filterTextActive: { color: '#FFFFFF' },
  searchWrap: {
    flex: 1,
    minWidth: 260,
    maxWidth: 420,
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: '#D9E1DC',
    borderRadius: 10,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
  },
  search: { flex: 1, fontSize: 12.5, color: '#263B31' },
  refresh: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 9 },
  refreshText: { fontSize: 10, fontWeight: '900', color: '#1F5C43' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  sectionTitle: { marginTop: 3, fontSize: 18, fontWeight: '900', color: '#203D31' },
  muted: { fontSize: 11, color: '#7B8780' },
  error: { color: '#9E3F37', fontWeight: '800' },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  table: { minWidth: 1320 },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E7ECE9',
    minHeight: 82,
    alignItems: 'flex-start',
  },
  headerRow: { minHeight: 38, backgroundColor: '#F5F8F6' },
  cell: { width: 185, padding: 10 },
  headerCell: { fontSize: 9, fontWeight: '900', color: '#708078' },
  caseCode: { fontSize: 12, fontWeight: '900', color: '#1F5C43' },
  small: { marginTop: 3, fontSize: 10.5, lineHeight: 15, color: '#7B8780' },
  strong: { fontSize: 11.5, fontWeight: '900', color: '#344C40' },
  body: { fontSize: 11.5, lineHeight: 17, color: '#53645B' },
  incidentLink: { marginTop: 5, fontSize: 10, fontWeight: '900', color: '#806E2C' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  action: {
    paddingHorizontal: 7,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: '#EEF4F0',
  },
  actionText: { fontSize: 8.5, fontWeight: '900', color: '#2E654A' },
  actionResolve: { backgroundColor: '#1F5C43' },
  actionResolveText: { fontSize: 8.5, fontWeight: '900', color: '#FFFFFF' },
  empty: { padding: 18, fontSize: 12, color: '#7A867F' },
  incidentList: { gap: 8 },
  incidentRow: {
    padding: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E7E3',
    backgroundColor: '#FBFCFB',
  },
  incidentTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  incidentTitle: { marginTop: 5, fontSize: 13.5, fontWeight: '900', color: '#2A4337' },
  incidentActions: { marginTop: 9, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
