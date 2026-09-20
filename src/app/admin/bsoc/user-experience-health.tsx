import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { AdminGate } from '@/components/AdminGate';
import BsocShell, {
  BsocMetric,
  BsocPanel,
  BsocStatusBadge,
  type BsocTone,
} from '@/components/bsoc/BsocShell';
import { useBuklodOfflineCache } from '@/hooks/useBuklodOfflineCache';
import { adminDashboardStatsCacheKey } from '@/lib/buklodOfflineSync';
import { supabase } from '@/lib/supabase';

type Stats = {
  total_users: number;
  active_today: number;
  completion_rate: number;
  groups: number;
  churches: number;
  pending_requests: number;
  published_devotionals: number;
  series: number;
};

type HealthMetric = {
  key: string;
  label: string;
  value: string;
  note: string;
  tone: BsocTone;
};

type CoverageRow = {
  path: string;
  expected: string;
  current: string;
  tone: BsocTone;
};

const COVERAGE: readonly CoverageRow[] = [
  {
    path: 'LOGIN',
    expected: 'started · completed · failed · recovered · duration',
    current: 'Partial application telemetry; unified BSOC feed not connected',
    tone: 'warning',
  },
  {
    path: 'COMMUNITY WALL',
    expected: 'loading · success · empty · error · recovery',
    current: 'App behavior exists; centralized UX-health aggregation pending',
    tone: 'warning',
  },
  {
    path: 'PROFILE / ORGANIZATION',
    expected: 'navigation · auth · sync · recovery',
    current: 'Unified incident correlation pending',
    tone: 'warning',
  },
  {
    path: 'CLASSROOM',
    expected: 'healthy · connecting · weak network · recovery · needs help',
    current: 'Live health contract required before claiming real-time coverage',
    tone: 'offline',
  },
  {
    path: 'QUIZ / SUBMISSION',
    expected: 'durable save · retry · submit · recover · verify',
    current: 'Recovery work exists; unified BSOC telemetry still pending',
    tone: 'warning',
  },
] as const;

function MetricCard({ item }: { item: HealthMetric }) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricTop}>
        <Text style={styles.metricLabel}>{item.label}</Text>
        <BsocStatusBadge
          label={item.tone === 'healthy' ? 'LIVE' : item.tone === 'warning' ? 'PARTIAL' : 'NOT CONNECTED'}
          tone={item.tone}
        />
      </View>
      <Text style={styles.metricValue}>{item.value}</Text>
      <Text style={styles.metricNote}>{item.note}</Text>
    </View>
  );
}

function FlowStep({ label }: { label: string }) {
  return (
    <View style={styles.flowStep}>
      <Text style={styles.flowText}>{label}</Text>
    </View>
  );
}

export default function BsocUserExperienceHealthScreen() {
  const {
    data: stats,
    loading,
    online,
    fromCache,
    error,
  } = useBuklodOfflineCache<Stats | null>({
    cacheKey: adminDashboardStatsCacheKey(),
    fetcher: async () => {
      const { data, error: rpcError } = await supabase.rpc('admin_dashboard_stats');
      if (rpcError) throw rpcError;
      return data as Stats;
    },
  });

  const metrics = useMemo<HealthMetric[]>(() => [
    {
      key: 'cases_per_1k',
      label: 'Support cases / 1,000 active users',
      value: '—',
      note: stats
        ? `Active-today denominator available: ${stats.active_today.toLocaleString('en-PH')}. Support-case telemetry is not yet connected, so BSOC will not invent a rate.`
        : error
          ? 'Active-user source unavailable and support-case telemetry is not connected.'
          : 'Waiting for active-user source; support-case telemetry is not connected.',
      tone: 'offline',
    },
    {
      key: 'login_failure',
      label: 'Login failure rate',
      value: '—',
      note: 'Requires a centralized login started/completed/failed/recovered event stream.',
      tone: 'offline',
    },
    {
      key: 'self_heal',
      label: 'Self-heal success rate',
      value: '—',
      note: 'Requires recovery-attempt and recovery-success telemetry with bounded retry metadata.',
      tone: 'offline',
    },
    {
      key: 'retry_success',
      label: 'Retry success rate',
      value: '—',
      note: 'Requires request retry telemetry with attempt count, timeout and final fallback.',
      tone: 'offline',
    },
    {
      key: 'stuck_loading',
      label: 'Stuck loading incidents',
      value: '—',
      note: 'Requires route-level timeout and recovery events. Missing telemetry is not treated as zero.',
      tone: 'offline',
    },
    {
      key: 'submission_recovery',
      label: 'Submission recovery',
      value: '—',
      note: 'Requires durable staging + recovered/verified submission events across Quiz/Classroom/forms.',
      tone: 'offline',
    },
    {
      key: 'session_recovery',
      label: 'Session recovery',
      value: '—',
      note: 'Requires expired/stale session detection and successful refresh/recreate telemetry.',
      tone: 'offline',
    },
    {
      key: 'white_screen',
      label: 'Crash / white-screen rate',
      value: '—',
      note: 'Requires centralized crash and route dead-end telemetry before scale.',
      tone: 'offline',
    },
    {
      key: 'deflection',
      label: 'Support deflection rate',
      value: '—',
      note: 'Problems detected → auto-resolved → self-resolved → support case → engineering escalation.',
      tone: 'offline',
    },
  ], [error, stats]);

  const adminFreshness =
    loading && !stats
      ? 'LOADING'
      : stats && !online
        ? 'CACHED / OFFLINE'
        : stats && fromCache
          ? 'CACHED'
          : stats
            ? 'LIVE RPC'
            : 'UNAVAILABLE';

  return (
    <AdminGate>
      <BsocShell
        current="overview"
        eyebrow="USER EXPERIENCE HEALTH"
        title="Prevent concerns before they become tickets"
        subtitle="BUKLOD should handle normal failure automatically. Human attention is reserved for unresolved exceptions, and engineering escalation is reserved for product defects, systemic incidents, data integrity risks, security issues, repeated recovery failures and unknown recurring failures."
        rightPanel={
          <View style={styles.stack}>
            <BsocPanel>
              <Text style={styles.eyebrow}>CANONICAL FLOW</Text>
              <Text style={styles.panelTitle}>App-first recovery</Text>
              <Text style={styles.body}>
                PREVENT → DETECT → EXPLAIN → SELF-RECOVER → VERIFY → ESCALATE ONLY IF UNRESOLVED
              </Text>
            </BsocPanel>

            <BsocPanel>
              <Text style={styles.eyebrow}>CURRENT DATA FRESHNESS</Text>
              <View style={styles.sourceRow}>
                <Text style={styles.sourceLabel}>Admin snapshot</Text>
                <BsocStatusBadge
                  label={adminFreshness}
                  tone={stats && online && !fromCache ? 'healthy' : stats ? 'warning' : 'offline'}
                />
              </View>
              <View style={styles.sourceRow}>
                <Text style={styles.sourceLabel}>UX-health event stream</Text>
                <BsocStatusBadge label="NOT CONNECTED" tone="offline" />
              </View>
              <View style={styles.sourceRow}>
                <Text style={styles.sourceLabel}>Incident correlation</Text>
                <BsocStatusBadge label="NOT CONNECTED" tone="offline" />
              </View>
            </BsocPanel>

            <BsocPanel>
              <Text style={styles.eyebrow}>HARD RULE</Text>
              <Text style={styles.panelTitle}>Never leave “nothing happened”</Text>
              <Text style={styles.body}>
                Every important action must end in success, loading/processing, a clear actionable error, a safe retry, or recovery in progress. Endless spinners, blank screens and dead navigation are release-blocking.
              </Text>
            </BsocPanel>
          </View>
        }
      >
        <BsocPanel style={styles.flowPanel}>
          <Text style={styles.eyebrow}>APP-FIRST RECOVERY PIPELINE</Text>
          <View style={styles.flowRow}>
            {['PREVENT', 'DETECT', 'EXPLAIN', 'SELF-RECOVER', 'VERIFY', 'ESCALATE'].map((step, index, all) => (
              <React.Fragment key={step}>
                <FlowStep label={step} />
                {index < all.length - 1 ? (
                  <MaterialCommunityIcons name="chevron-right" size={17} color="#929C96" />
                ) : null}
              </React.Fragment>
            ))}
          </View>
        </BsocPanel>

        <View style={styles.topMetrics}>
          <BsocMetric
            label="Active today"
            value={stats ? stats.active_today.toLocaleString('en-PH') : '—'}
            note={adminFreshness}
          />
          <BsocMetric
            label="Pending admin requests"
            value={stats ? stats.pending_requests.toLocaleString('en-PH') : '—'}
            note="Not equivalent to support cases"
          />
          <BsocMetric
            label="Unified UX telemetry"
            value="NOT CONNECTED"
            note="No false-zero health claims"
          />
        </View>

        <BsocPanel>
          <Text style={styles.eyebrow}>CONCERN PREVENTION KPI</Text>
          <Text style={styles.sectionTitle}>Operational health metrics</Text>
          <Text style={styles.body}>
            Ticket count alone is not enough. BSOC must distinguish detected problems, automatic recovery, user self-recovery, human support cases and engineering escalations.
          </Text>
          <View style={styles.metricGrid}>
            {metrics.map((item) => (
              <MetricCard key={item.key} item={item} />
            ))}
          </View>
        </BsocPanel>

        <BsocPanel>
          <Text style={styles.eyebrow}>CRITICAL PATH COVERAGE</Text>
          <Text style={styles.sectionTitle}>Observability before scale</Text>
          <View style={styles.coverageList}>
            {COVERAGE.map((row) => (
              <View key={row.path} style={styles.coverageRow}>
                <View style={{ flex: 0.8 }}>
                  <Text style={styles.coveragePath}>{row.path}</Text>
                </View>
                <View style={{ flex: 1.4 }}>
                  <Text style={styles.coverageExpected}>{row.expected}</Text>
                </View>
                <View style={{ flex: 1.5 }}>
                  <Text style={styles.coverageCurrent}>{row.current}</Text>
                </View>
                <BsocStatusBadge
                  label={row.tone === 'offline' ? 'GAP' : 'PARTIAL'}
                  tone={row.tone}
                />
              </View>
            ))}
          </View>
        </BsocPanel>

        <BsocPanel>
          <Text style={styles.eyebrow}>EXCEPTION-BASED OPERATIONS</Text>
          <Text style={styles.sectionTitle}>Human attention only for unresolved exceptions</Text>
          <View style={styles.exceptionGrid}>
            {[
              ['Routine recoverable condition', 'Automatic self-heal with bounded retry, timeout, fallback and telemetry', 'APP'],
              ['Known shared incident', 'Link users/cases to one incident and stop repeated diagnosis', 'BSOC'],
              ['Unresolved user-specific case', 'Create a smart case with context already attached', 'SUPPORT'],
              ['Reproducible/systemic defect', 'Escalate with correlated evidence and recovery history', 'ENGINEERING'],
            ].map(([problem, action, owner]) => (
              <View key={problem} style={styles.exceptionCard}>
                <Text style={styles.exceptionTitle}>{problem}</Text>
                <Text style={styles.exceptionBody}>{action}</Text>
                <Text style={styles.exceptionOwner}>{owner}</Text>
              </View>
            ))}
          </View>
        </BsocPanel>

        <BsocPanel>
          <Text style={styles.eyebrow}>RELEASE QUALITY GATE</Text>
          <Text style={styles.sectionTitle}>Routine failures must not require manual admin intervention</Text>
          <View style={styles.testGrid}>
            {[
              'bad / slow network',
              'token expiry',
              'session conflict',
              'API timeout',
              'database retry',
              'background / foreground',
              'page refresh',
              'double tap',
              'submission interruption',
              'old app version',
              'dependency outage',
              'blank / dead route',
            ].map((test) => (
              <View key={test} style={styles.testChip}>
                <MaterialCommunityIcons name="checkbox-marked-circle-outline" size={15} color="#1F5C43" />
                <Text style={styles.testText}>{test}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.releaseBlock}>
            BLOCK RELEASE if a routine recoverable failure leaves the user stuck without guidance, creates an endless loading state, causes a white screen/dead end, or requires administrator intervention that the app should safely perform itself.
          </Text>
        </BsocPanel>

        <BsocPanel>
          <Text style={styles.eyebrow}>NEXT SAFE IMPLEMENTATION LAYER</Text>
          <Text style={styles.sectionTitle}>Central telemetry and recovery contracts</Text>
          <Text style={styles.body}>
            The dashboard intentionally shows missing UX-health telemetry as unavailable. The next implementation layer is a shared event contract for started/completed/failed/recovered/duration, plus bounded-retry and self-heal outcome events. That must be connected before BSOC reports ecosystem-wide recovery KPIs.
          </Text>
          <Pressable
            onPress={() => router.push('/admin/bsoc' as any)}
            style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.76 }]}
          >
            <MaterialCommunityIcons name="arrow-left" size={17} color="#FFFFFF" />
            <Text style={styles.backText}>BACK TO COMMAND CENTER</Text>
          </Pressable>
        </BsocPanel>
      </BsocShell>
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 10 },
  eyebrow: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 1.1,
    color: '#78837D',
  },
  panelTitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '900',
    color: '#223029',
  },
  sectionTitle: {
    marginTop: 3,
    fontSize: 16,
    fontWeight: '900',
    color: '#223029',
  },
  body: {
    marginTop: 5,
    fontSize: 10,
    lineHeight: 15,
    color: '#6F7A74',
  },
  sourceRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#E7EBE8',
  },
  sourceLabel: {
    flex: 1,
    fontSize: 9.5,
    color: '#6D7872',
  },
  flowPanel: { overflow: 'hidden' },
  flowRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
  },
  flowStep: {
    minHeight: 31,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D4E0D8',
    backgroundColor: '#F2F8F4',
  },
  flowText: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.4,
    color: '#1F5C43',
  },
  topMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  metricGrid: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricCard: {
    minWidth: 210,
    flexGrow: 1,
    flexBasis: '30%',
    padding: 11,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#E1E6E3',
    backgroundColor: '#FAFBFA',
  },
  metricTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 7,
  },
  metricLabel: {
    flex: 1,
    fontSize: 9,
    fontWeight: '900',
    color: '#5E6963',
  },
  metricValue: {
    marginTop: 8,
    fontSize: 20,
    fontWeight: '900',
    color: '#1F5C43',
  },
  metricNote: {
    marginTop: 4,
    fontSize: 8.7,
    lineHeight: 13,
    color: '#7A847E',
  },
  coverageList: { marginTop: 8 },
  coverageRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: '#E7EBE8',
  },
  coveragePath: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#223029',
  },
  coverageExpected: {
    fontSize: 8.8,
    lineHeight: 13,
    color: '#59675F',
  },
  coverageCurrent: {
    fontSize: 8.8,
    lineHeight: 13,
    color: '#7B867F',
  },
  exceptionGrid: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  exceptionCard: {
    minWidth: 210,
    flexGrow: 1,
    flexBasis: '45%',
    padding: 11,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#E1E6E3',
    backgroundColor: '#FAFBFA',
  },
  exceptionTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#233129',
  },
  exceptionBody: {
    marginTop: 4,
    fontSize: 9,
    lineHeight: 13,
    color: '#747F78',
  },
  exceptionOwner: {
    marginTop: 7,
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.55,
    color: '#1F5C43',
  },
  testGrid: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  testChip: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#DDE4E0',
    backgroundColor: '#F8FAF8',
  },
  testText: {
    fontSize: 8.8,
    fontWeight: '800',
    color: '#5C6962',
  },
  releaseBlock: {
    marginTop: 11,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8C5C0',
    backgroundColor: '#FFF3F1',
    fontSize: 9,
    lineHeight: 14,
    fontWeight: '800',
    color: '#8B3C33',
  },
  backButton: {
    alignSelf: 'flex-start',
    marginTop: 11,
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 9,
    backgroundColor: '#1F5C43',
  },
  backText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
  },
});
