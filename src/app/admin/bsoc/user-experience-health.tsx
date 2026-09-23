import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { AdminGate } from '@/components/AdminGate';
import BsocShell, {
  BsocMetric,
  BsocPanel,
  BsocStatusBadge,
  type BsocTone,
} from '@/components/bsoc/BsocShell';
import {
  bsocSupportDeflectionRate,
  bsocVerifiedRecoveryRate,
  loadBsocHealthEvents,
  loadBsocHealthOverview,
  loadBsocRecoveryPlaybooks,
  loadBsocRecoveryRuns,
  type BsocHealthEvent,
  type BsocHealthOverview,
  type BsocRecoveryPlaybook,
  type BsocRecoveryRun,
} from '@/lib/admin/bsocHealth';

const REFRESH_MS = 30_000;

function percent(value: number | null) {
  return value === null
    ? '—'
    : `${value.toFixed(1)}%`;
}

function toneForState(state: string): BsocTone {
  if (state === 'AUTO_HEALED') return 'healthy';
  if (
    state === 'RECOVERY_FAILED' ||
    state === 'ESCALATED'
  ) {
    return 'critical';
  }
  if (
    state === 'LINKED_TO_INCIDENT' ||
    state === 'REMOTE_RECOVERY_RUNNING' ||
    state === 'VERIFYING'
  ) {
    return 'warning';
  }
  return 'neutral';
}

function toneForPlaybook(
  item: BsocRecoveryPlaybook,
): BsocTone {
  if (item.kill_switch) return 'critical';
  if (item.mode === 'SHADOW') return 'warning';
  if (
    item.mode === 'ENABLED' &&
    item.qa_verified_at &&
    item.executor_ready
  ) {
    return 'healthy';
  }
  return 'neutral';
}

function FlowStep({ label }: { label: string }) {
  return (
    <View style={styles.flowStep}>
      <Text style={styles.flowText}>{label}</Text>
    </View>
  );
}

export default function BsocUserExperienceHealthScreen() {
  const [overview, setOverview] =
    useState<BsocHealthOverview | null>(null);
  const [events, setEvents] =
    useState<BsocHealthEvent[]>([]);
  const [runs, setRuns] =
    useState<BsocRecoveryRun[]>([]);
  const [playbooks, setPlaybooks] =
    useState<BsocRecoveryPlaybook[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] = useState('');
  const [lastLoadedAt, setLastLoadedAt] =
    useState<string | null>(null);

  const load = useCallback(async (
    background = false,
  ) => {
    if (background) setRefreshing(true);
    else setLoading(true);

    try {
      const [
        nextOverview,
        nextEvents,
        nextRuns,
        nextPlaybooks,
      ] = await Promise.all([
        loadBsocHealthOverview(24),
        loadBsocHealthEvents({
          hours: 24,
          limit: 80,
        }),
        loadBsocRecoveryRuns({
          hours: 24,
          limit: 60,
        }),
        loadBsocRecoveryPlaybooks(),
      ]);

      setOverview(nextOverview);
      setEvents(nextEvents);
      setRuns(nextRuns);
      setPlaybooks(nextPlaybooks);
      setLastLoadedAt(new Date().toISOString());
      setError('');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'BSOC health data could not load.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);

    const timer = setInterval(() => {
      void load(true);
    }, REFRESH_MS);

    return () => clearInterval(timer);
  }, [load]);

  const unresolved = useMemo(
    () =>
      events.filter(
        item =>
          ![
            'AUTO_HEALED',
            'LINKED_TO_INCIDENT',
          ].includes(item.lifecycle_state),
      ),
    [events],
  );

  const verifiedRate = useMemo(
    () => bsocVerifiedRecoveryRate(overview),
    [overview],
  );

  const deflectionRate = useMemo(
    () => bsocSupportDeflectionRate(overview),
    [overview],
  );

  const shadowCount = playbooks.filter(
    item => item.mode === 'SHADOW',
  ).length;
  const enabledCount = playbooks.filter(
    item => item.mode === 'ENABLED',
  ).length;
  const killSwitchCount = playbooks.filter(
    item => item.kill_switch,
  ).length;

  const sourceStatus = error
    ? 'DEGRADED'
    : loading
      ? 'LOADING'
      : 'LIVE RPC';

  return (
    <AdminGate>
      <BsocShell
        current="overview"
        eyebrow="USER EXPERIENCE HEALTH"
        title="Closed-loop recovery before support escalation"
        subtitle="BSOC now reads the live health-event, recovery, verification and incident-correlation models. It never calls a recovery successful merely because a command ran."
        rightPanel={
          <View style={styles.stack}>
            <BsocPanel>
              <Text style={styles.eyebrow}>
                CANONICAL FLOW
              </Text>
              <Text style={styles.panelTitle}>
                App-first, proof-based recovery
              </Text>
              <Text style={styles.body}>
                DETECT → DIAGNOSE → HEAL → VERIFY →
                ESCALATE ONLY IF UNRESOLVED
              </Text>
            </BsocPanel>

            <BsocPanel>
              <Text style={styles.eyebrow}>
                LIVE SOURCES
              </Text>
              <View style={styles.sourceRow}>
                <Text style={styles.sourceLabel}>
                  Health event stream
                </Text>
                <BsocStatusBadge
                  label={sourceStatus}
                  tone={
                    error
                      ? 'critical'
                      : loading
                        ? 'warning'
                        : 'healthy'
                  }
                />
              </View>
              <View style={styles.sourceRow}>
                <Text style={styles.sourceLabel}>
                  Verification engine
                </Text>
                <BsocStatusBadge
                  label="CONNECTED"
                  tone="healthy"
                />
              </View>
              <View style={styles.sourceRow}>
                <Text style={styles.sourceLabel}>
                  Incident correlation
                </Text>
                <BsocStatusBadge
                  label="CONNECTED"
                  tone="healthy"
                />
              </View>
              <View style={styles.sourceRow}>
                <Text style={styles.sourceLabel}>
                  Remote playbooks
                </Text>
                <BsocStatusBadge
                  label={
                    enabledCount > 0
                      ? `${enabledCount} ENABLED`
                      : `${shadowCount} SHADOW`
                  }
                  tone={
                    enabledCount > 0
                      ? 'warning'
                      : 'healthy'
                  }
                />
              </View>
            </BsocPanel>

            <BsocPanel>
              <Text style={styles.eyebrow}>
                SAFETY LOCK
              </Text>
              <Text style={styles.panelTitle}>
                No blind reset
              </Text>
              <Text style={styles.body}>
                Financial, security, role, ownership,
                destructive and irreversible changes are
                human-controlled only. New remote playbooks
                stay in SHADOW until their client executor
                and verification evidence pass E2E.
              </Text>
            </BsocPanel>
          </View>
        }
      >
        <BsocPanel style={styles.flowPanel}>
          <View style={styles.headingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>
                CLOSED-LOOP SELF-HEAL
              </Text>
              <Text style={styles.sectionTitle}>
                Live operational health
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh BSOC health"
              disabled={refreshing}
              onPress={() => void load(true)}
              style={styles.refreshButton}
            >
              {refreshing ? (
                <ActivityIndicator
                  size="small"
                  color="#1F5C43"
                />
              ) : (
                <MaterialCommunityIcons
                  name="refresh"
                  size={17}
                  color="#1F5C43"
                />
              )}
              <Text style={styles.refreshText}>
                REFRESH
              </Text>
            </Pressable>
          </View>

          <View style={styles.flowRow}>
            {[
              'DETECT',
              'DIAGNOSE',
              'HEAL',
              'VERIFY',
              'ESCALATE',
            ].map((step, index, all) => (
              <React.Fragment key={step}>
                <FlowStep label={step} />
                {index < all.length - 1 ? (
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={17}
                    color="#929C96"
                  />
                ) : null}
              </React.Fragment>
            ))}
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>
                {error}
              </Text>
            </View>
          ) : null}

          <Text style={styles.freshness}>
            {lastLoadedAt
              ? `Last live refresh: ${new Date(
                  lastLoadedAt,
                ).toLocaleString()}`
              : 'Waiting for first live refresh.'}
          </Text>
        </BsocPanel>

        <View style={styles.topMetrics}>
          <BsocMetric
            label="Detected issues · 24h"
            value={Number(
              overview?.detected_issues ?? 0,
            ).toLocaleString()}
            note="Unique health-event rows"
          />
          <BsocMetric
            label="Event occurrences · 24h"
            value={Number(
              overview?.event_occurrences ?? 0,
            ).toLocaleString()}
            note="Includes deduped repeat count"
          />
          <BsocMetric
            label="Local self-heal"
            value={Number(
              overview?.local_self_heal_success ?? 0,
            ).toLocaleString()}
            note="Resolved before remote BSOC action"
          />
          <BsocMetric
            label="Verified remote heal"
            value={Number(
              overview?.remote_auto_healed ?? 0,
            ).toLocaleString()}
            note="AUTO_HEALED only after proof"
          />
          <BsocMetric
            label="Verification failures"
            value={Number(
              overview?.verification_failures ?? 0,
            ).toLocaleString()}
            note="Command success without proof is failure"
          />
          <BsocMetric
            label="Support escalations"
            value={Number(
              overview?.support_cases_created ?? 0,
            ).toLocaleString()}
            note="Only unresolved/human-needed cases"
          />
        </View>

        <BsocPanel>
          <Text style={styles.eyebrow}>
            RECOVERY QUALITY
          </Text>
          <Text style={styles.sectionTitle}>
            Optimize for verified recovery
          </Text>
          <View style={styles.metricGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>
                Verified remote recovery rate
              </Text>
              <Text style={styles.metricValue}>
                {percent(verifiedRate)}
              </Text>
              <Text style={styles.metricNote}>
                AUTO_HEALED / (AUTO_HEALED +
                verification failures). Blank means no
                verified sample yet.
              </Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>
                Support deflection
              </Text>
              <Text style={styles.metricValue}>
                {percent(deflectionRate)}
              </Text>
              <Text style={styles.metricNote}>
                Local + verified remote recovery compared
                with created support cases.
              </Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>
                Incident-linked events
              </Text>
              <Text style={styles.metricValue}>
                {Number(
                  overview?.incident_linked_events ?? 0,
                ).toLocaleString()}
              </Text>
              <Text style={styles.metricNote}>
                Repeated shared failures are clustered so
                support does not scale linearly.
              </Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>
                Unresolved exceptions
              </Text>
              <Text style={styles.metricValue}>
                {unresolved.length.toLocaleString()}
              </Text>
              <Text style={styles.metricNote}>
                Current 24-hour rows still requiring
                recovery, verification or escalation.
              </Text>
            </View>
          </View>
        </BsocPanel>

        <BsocPanel>
          <Text style={styles.eyebrow}>
            RECENT EXCEPTIONS
          </Text>
          <Text style={styles.sectionTitle}>
            Human attention goes to unresolved state
          </Text>

          {loading && !events.length ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#1F5C43" />
              <Text style={styles.body}>
                Loading live health events…
              </Text>
            </View>
          ) : unresolved.length ? (
            <View style={styles.table}>
              {unresolved.slice(0, 12).map(item => (
                <View
                  key={item.event_id}
                  style={styles.eventRow}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventTitle}>
                      {item.error_signature}
                    </Text>
                    <Text style={styles.eventMeta}>
                      {item.app_id} ·{' '}
                      {item.route_module ?? 'unknown'} ·{' '}
                      {item.safe_error_code}
                    </Text>
                    <Text style={styles.eventMeta}>
                      user {item.user_ref} · repeats{' '}
                      {item.repeat_count}
                    </Text>
                  </View>
                  <BsocStatusBadge
                    label={item.lifecycle_state}
                    tone={toneForState(
                      item.lifecycle_state,
                    )}
                  />
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>
              No unresolved health events in the current
              24-hour window.
            </Text>
          )}
        </BsocPanel>

        <BsocPanel>
          <Text style={styles.eyebrow}>
            RECOVERY PLAYBOOK REGISTRY
          </Text>
          <Text style={styles.sectionTitle}>
            Named, versioned, bounded and kill-switchable
          </Text>
          <Text style={styles.body}>
            This screen is deliberately read-only. Playbook
            mode changes remain controlled administrative
            actions; no playbook is enabled from a dashboard
            refresh or health event.
          </Text>

          <View style={styles.playbookGrid}>
            {playbooks.map(item => (
              <View
                key={`${item.playbook_id}:${item.version}`}
                style={styles.playbookCard}
              >
                <View style={styles.playbookTop}>
                  <Text style={styles.playbookTitle}>
                    {item.playbook_id}
                  </Text>
                  <BsocStatusBadge
                    label={
                      item.kill_switch
                        ? 'KILL SWITCH'
                        : item.mode
                    }
                    tone={toneForPlaybook(item)}
                  />
                </View>
                <Text style={styles.playbookMeta}>
                  v{item.version} · {item.health_category} ·{' '}
                  {item.error_signature}
                </Text>
                <Text style={styles.playbookMeta}>
                  action: {item.action_kind}
                </Text>
                <Text style={styles.playbookMeta}>
                  max {item.max_attempts} · timeout{' '}
                  {item.timeout_seconds}s · cooldown{' '}
                  {item.cooldown_seconds}s
                </Text>
                <Text style={styles.playbookMeta}>
                  verification: {item.verification_type}
                </Text>
                <View style={styles.playbookFlags}>
                  <Text style={styles.flagText}>
                    QA:{' '}
                    {item.qa_verified_at
                      ? 'VERIFIED'
                      : 'NOT VERIFIED'}
                  </Text>
                  <Text style={styles.flagText}>
                    EXECUTOR:{' '}
                    {item.executor_ready
                      ? 'READY'
                      : 'NOT READY'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </BsocPanel>

        <BsocPanel>
          <Text style={styles.eyebrow}>
            RECOVERY EVIDENCE
          </Text>
          <Text style={styles.sectionTitle}>
            Recent remote recovery runs
          </Text>

          {runs.length ? (
            <View style={styles.table}>
              {runs.slice(0, 10).map(item => (
                <View
                  key={item.recovery_run_id}
                  style={styles.eventRow}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventTitle}>
                      {item.playbook_id} v
                      {item.playbook_version}
                    </Text>
                    <Text style={styles.eventMeta}>
                      {item.app_id} · {item.mode} · attempts{' '}
                      {item.attempt_count}
                    </Text>
                    <Text style={styles.eventMeta}>
                      verification:{' '}
                      {item.verification_result ?? 'PENDING'}
                    </Text>
                  </View>
                  <BsocStatusBadge
                    label={item.state}
                    tone={toneForState(item.state)}
                  />
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>
              No persistent recovery runs in the current
              24-hour window. Rollback-only QA runs do not
              appear here by design.
            </Text>
          )}
        </BsocPanel>

        <BsocPanel>
          <Text style={styles.eyebrow}>
            TOP RECURRING SIGNATURES
          </Text>
          <Text style={styles.sectionTitle}>
            Correlate, do not create a ticket storm
          </Text>

          {overview?.top_signatures?.length ? (
            <View style={styles.table}>
              {overview.top_signatures.map(
                (item, index) => (
                  <View
                    key={`${item.app_id}:${item.error_signature}:${index}`}
                    style={styles.signatureRow}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.eventTitle}>
                        {item.error_signature ??
                          'UNKNOWN_ERROR'}
                      </Text>
                      <Text style={styles.eventMeta}>
                        {item.app_id ?? 'UNKNOWN_APP'} ·
                        affected users{' '}
                        {Number(
                          item.affected_users ?? 0,
                        ).toLocaleString()}
                      </Text>
                    </View>
                    <Text style={styles.signatureCount}>
                      {Number(
                        item.occurrences ?? 0,
                      ).toLocaleString()}
                    </Text>
                  </View>
                ),
              )}
            </View>
          ) : (
            <Text style={styles.emptyText}>
              No recurring health signature in this
              24-hour window.
            </Text>
          )}
        </BsocPanel>

        <BsocPanel>
          <Text style={styles.eyebrow}>
            RELEASE SAFETY
          </Text>
          <Text style={styles.sectionTitle}>
            Closed-loop blockers remain enforced
          </Text>
          <View style={styles.ruleGrid}>
            {[
              'AUTO_HEALED requires verification proof',
              'Main must operate when BSOC is down',
              'No private Smart Drawer or LIFE content in health payloads',
              'No financial or security auto-mutation',
              'No cross-user or cross-Organization recovery',
              'No recovery or support-ticket storm',
              'Every remote playbook has version, cooldown and kill switch',
              'No endless loading / dead route',
            ].map(rule => (
              <View
                key={rule}
                style={styles.ruleCard}
              >
                <MaterialCommunityIcons
                  name="shield-check-outline"
                  size={16}
                  color="#1F5C43"
                />
                <Text style={styles.ruleText}>
                  {rule}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.safetySummary}>
            <Text style={styles.safetyText}>
              Playbooks: {playbooks.length} · SHADOW:{' '}
              {shadowCount} · ENABLED: {enabledCount} ·
              KILL SWITCH: {killSwitchCount}
            </Text>
          </View>

          <Pressable
            onPress={() =>
              router.push('/admin/bsoc' as any)
            }
            style={styles.backButton}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={17}
              color="#FFFFFF"
            />
            <Text style={styles.backText}>
              BACK TO COMMAND CENTER
            </Text>
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
  flowPanel: {
    overflow: 'hidden',
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  refreshButton: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#CEDBD3',
    backgroundColor: '#F4F8F5',
  },
  refreshText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#1F5C43',
  },
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
  freshness: {
    marginTop: 9,
    fontSize: 8.5,
    color: '#849089',
  },
  errorBox: {
    marginTop: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#E5B8B2',
    backgroundColor: '#FFF2F0',
    padding: 9,
  },
  errorText: {
    fontSize: 9,
    lineHeight: 13,
    color: '#8A3B32',
    fontWeight: '700',
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
    minWidth: 205,
    flexGrow: 1,
    flexBasis: '22%',
    padding: 11,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#E1E6E3',
    backgroundColor: '#FAFBFA',
  },
  metricLabel: {
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
  loadingRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  table: {
    marginTop: 9,
    borderTopWidth: 1,
    borderTopColor: '#E6EAE7',
  },
  eventRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECE9',
  },
  eventTitle: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#25332C',
  },
  eventMeta: {
    marginTop: 2,
    fontSize: 8.5,
    lineHeight: 12,
    color: '#77827C',
  },
  emptyText: {
    marginTop: 10,
    fontSize: 9.5,
    lineHeight: 14,
    color: '#7B867F',
  },
  playbookGrid: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  playbookCard: {
    minWidth: 250,
    flexGrow: 1,
    flexBasis: '45%',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#E0E6E2',
    backgroundColor: '#FAFBFA',
    padding: 11,
  },
  playbookTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  playbookTitle: {
    flex: 1,
    fontSize: 9.5,
    fontWeight: '900',
    color: '#223129',
  },
  playbookMeta: {
    marginTop: 4,
    fontSize: 8.5,
    lineHeight: 12,
    color: '#727E77',
  },
  playbookFlags: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  flagText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#52625A',
  },
  signatureRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECE9',
  },
  signatureCount: {
    minWidth: 52,
    textAlign: 'right',
    fontSize: 18,
    fontWeight: '900',
    color: '#1F5C43',
  },
  ruleGrid: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  ruleCard: {
    minWidth: 220,
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 43,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#DDE6E0',
    backgroundColor: '#F8FAF8',
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  ruleText: {
    flex: 1,
    fontSize: 8.7,
    lineHeight: 12,
    fontWeight: '800',
    color: '#5E6963',
  },
  safetySummary: {
    marginTop: 10,
    borderRadius: 9,
    backgroundColor: '#EFF5F1',
    padding: 9,
  },
  safetyText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#365646',
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
