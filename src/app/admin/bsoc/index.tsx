import React, { useMemo } from 'react';
import {
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
import { useBuklodOfflineCache } from '@/hooks/useBuklodOfflineCache';
import { adminDashboardStatsCacheKey } from '@/lib/buklodOfflineSync';
import { getBuklodAdDiagnosticsSummary } from '@/lib/buklodAdDiagnostics';
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

type AttentionItem = {
  key: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  detail: string;
  status: string;
  tone: BsocTone;
  path?: string;
};

function AttentionRow({ item }: { item: AttentionItem }) {
  const content = (
    <View style={styles.attentionRow}>
      <View style={styles.attentionIcon}>
        <MaterialCommunityIcons
          name={item.icon}
          size={20}
          color="#1F5C43"
        />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.attentionTitleRow}>
          <Text style={styles.attentionTitle}>{item.title}</Text>
          <BsocStatusBadge label={item.status} tone={item.tone} />
        </View>
        <Text style={styles.attentionDetail}>{item.detail}</Text>
      </View>
      {item.path ? (
        <MaterialCommunityIcons
          name="chevron-right"
          size={20}
          color="#89928D"
        />
      ) : null}
    </View>
  );

  if (!item.path) return content;

  return (
    <Pressable
      onPress={() => router.push(item.path as any)}
      style={({ pressed }) => pressed && { opacity: 0.76 }}
    >
      {content}
    </Pressable>
  );
}

function SourceRow({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: BsocTone;
}) {
  return (
    <View style={styles.sourceRow}>
      <Text style={styles.sourceLabel}>{label}</Text>
      <BsocStatusBadge label={value} tone={tone} />
    </View>
  );
}

export default function BsocOverviewScreen() {
  const {
    data: stats,
    loading,
    syncing,
    fromCache,
    online,
    error,
  } = useBuklodOfflineCache<Stats | null>({
    cacheKey: adminDashboardStatsCacheKey(),
    fetcher: async () => {
      const { data, error: rpcError } = await supabase.rpc('admin_dashboard_stats');
      if (rpcError) throw rpcError;
      return data as Stats;
    },
  });

  const ads = getBuklodAdDiagnosticsSummary();

  const adsHealth = useMemo(() => {
    const requests = ads.totals.requested;
    const failures = ads.totals.failures;
    const loaded = ads.totals.loaded;
    const impressions = ads.totals.impression;
    const failureRate = requests > 0 ? failures / requests : 0;
    const showRate = loaded > 0 ? impressions / loaded : 0;

    if (requests === 0) {
      return {
        label: 'NO SESSION DATA',
        tone: 'neutral' as BsocTone,
        detail: 'No local ad events have been captured in this BSOC runtime. This is not treated as zero production traffic.',
      };
    }
    if (failureRate >= 0.2) {
      return {
        label: 'CRITICAL',
        tone: 'critical' as BsocTone,
        detail: 'The current runtime has a high ad failure rate. Open Ads & Monetization Health for the request-to-impression funnel.',
      };
    }
    if (loaded >= 5 && showRate < 0.25) {
      return {
        label: 'DEGRADED',
        tone: 'warning' as BsocTone,
        detail: 'Loaded ads are producing unusually few impressions in the current runtime.',
      };
    }
    return {
      label: 'HEALTHY',
      tone: 'healthy' as BsocTone,
      detail: 'No local runtime ad-health threshold is currently violated.',
    };
  }, [ads]);

  const attention = useMemo<AttentionItem[]>(() => {
    const pending = Number(stats?.pending_requests ?? 0);
    return [
      {
        key: 'pending',
        icon: 'account-clock-outline',
        title: 'Pending administrative requests',
        detail: stats
          ? `${pending.toLocaleString('en-PH')} current request${pending === 1 ? '' : 's'} reported by the existing admin source.`
          : error
            ? 'Administrative request data is unavailable. The console will not display a false zero.'
            : 'Loading current administrative request data.',
        status: stats ? (pending > 0 ? 'NEEDS REVIEW' : 'CLEAR') : 'UNAVAILABLE',
        tone: stats ? (pending > 0 ? 'warning' : 'healthy') : 'offline',
        path: '/admin/account-recovery',
      },
      {
        key: 'ads',
        icon: 'advertisements',
        title: 'Ads & monetization health',
        detail: adsHealth.detail,
        status: adsHealth.label,
        tone: adsHealth.tone,
        path: '/admin/bsoc/ads',
      },
      {
        key: 'incidents',
        icon: 'alert-decagram-outline',
        title: 'Central incident correlation',
        detail: 'A shared incident store is not yet wired to this R1 source surface. Missing incident telemetry is shown as unavailable, never as zero incidents.',
        status: 'NOT CONNECTED',
        tone: 'offline',
      },
    ];
  }, [adsHealth, error, stats]);

  const freshnessLabel = syncing
    ? 'SYNCING'
    : !online && stats
      ? 'CACHED / OFFLINE'
      : fromCache
        ? 'CACHED'
        : stats
          ? 'LIVE RPC'
          : 'UNAVAILABLE';

  return (
    <AdminGate>
      <BsocShell
        current="overview"
        eyebrow="COMMAND CENTER"
        title="What needs attention?"
        subtitle="Observe first. Understand the current condition, investigate in context, take only authorized actions, then verify and audit the result."
        rightPanel={
          <View style={styles.rightStack}>
            <BsocPanel>
              <Text style={styles.panelEyebrow}>OPERATOR PRINCIPLE</Text>
              <Text style={styles.panelTitle}>Context before action</Text>
              <Text style={styles.panelBody}>
                BSOC does not lead with reset, ban, delete or configuration buttons. Open the affected user, app, case or incident first, then expose only the actions that are relevant and authorized.
              </Text>
            </BsocPanel>

            <BsocPanel>
              <Text style={styles.panelEyebrow}>SOURCE OF TRUTH</Text>
              <SourceRow
                label="Admin snapshot"
                value={freshnessLabel}
                tone={stats && !fromCache ? 'healthy' : stats ? 'warning' : 'offline'}
              />
              <SourceRow
                label="Ad diagnostics"
                value="LOCAL RUNTIME"
                tone="neutral"
              />
              <SourceRow
                label="Incident store"
                value="NOT CONNECTED"
                tone="offline"
              />
            </BsocPanel>

            <BsocPanel>
              <Text style={styles.panelEyebrow}>FINANCE BOUNDARY</Text>
              <Text style={styles.panelTitle}>Operational status only</Text>
              <Text style={styles.panelBody}>
                BSOC may show whether economy, settlement or ad infrastructure is operational. Revenue, user cash balances, payout totals, owner profit and other financial values belong outside this operations workspace.
              </Text>
            </BsocPanel>
          </View>
        }
      >
        <View style={styles.metrics}>
          <BsocMetric
            label="Total users"
            value={stats ? stats.total_users.toLocaleString('en-PH') : '—'}
            note={loading && !stats ? 'Loading' : freshnessLabel}
          />
          <BsocMetric
            label="Active today"
            value={stats ? stats.active_today.toLocaleString('en-PH') : '—'}
            note="Existing admin source"
          />
          <BsocMetric
            label="Pending requests"
            value={stats ? stats.pending_requests.toLocaleString('en-PH') : '—'}
            note={error && !stats ? 'Source unavailable' : 'Review workload'}
          />
          <BsocMetric
            label="Registered scopes"
            value={stats ? (stats.groups + stats.churches).toLocaleString('en-PH') : '—'}
            note="Groups + churches"
          />
        </View>

        <BsocPanel>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.panelEyebrow}>MY WORK / ATTENTION</Text>
              <Text style={styles.sectionTitle}>Operational attention queue</Text>
            </View>
            <Text style={styles.smallMuted}>No false zero states</Text>
          </View>

          <View style={styles.attentionList}>
            {attention.map((item) => (
              <AttentionRow key={item.key} item={item} />
            ))}
          </View>
        </BsocPanel>

        <BsocPanel>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.panelEyebrow}>APPS & SYSTEM</Text>
              <Text style={styles.sectionTitle}>Registered operational surfaces</Text>
            </View>
          </View>

          <View style={styles.appRows}>
            {[
              ['BUKLOD Main', 'Primary application and Community Wall', 'SOURCE REGISTERED'],
              ['BUKLOD Quiz', 'Exam and submission operations', 'HEALTH FEED PENDING'],
              ['BUKLOD Classroom', 'Class sessions, attendance and video', 'HEALTH FEED PENDING'],
              ['BUKLOD QuickCheck', 'Standalone rapid assessment', 'HEALTH FEED PENDING'],
              ['Focus Apps', 'Registered personal and organization applications', 'HEALTH FEED PENDING'],
            ].map(([name, description, state]) => (
              <View key={name} style={styles.appRow}>
                <View style={styles.appIcon}>
                  <MaterialCommunityIcons
                    name="application-outline"
                    size={19}
                    color="#1F5C43"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.appName}>{name}</Text>
                  <Text style={styles.appDescription}>{description}</Text>
                </View>
                <BsocStatusBadge
                  label={state}
                  tone={state === 'SOURCE REGISTERED' ? 'healthy' : 'offline'}
                />
              </View>
            ))}
          </View>
        </BsocPanel>

        <BsocPanel style={styles.flowPanel}>
          <Text style={styles.panelEyebrow}>CANONICAL OPERATING FLOW</Text>
          <View style={styles.flowRow}>
            {['OBSERVE', 'UNDERSTAND', 'INVESTIGATE', 'ACT', 'VERIFY', 'AUDIT'].map((step, index, all) => (
              <React.Fragment key={step}>
                <View style={styles.flowStep}>
                  <Text style={styles.flowStepText}>{step}</Text>
                </View>
                {index < all.length - 1 ? (
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={17}
                    color="#99A29D"
                  />
                ) : null}
              </React.Fragment>
            ))}
          </View>
        </BsocPanel>
      </BsocShell>
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  rightStack: {
    gap: 10,
  },
  panelEyebrow: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 1.15,
    color: '#7B867F',
  },
  panelTitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '900',
    color: '#213028',
  },
  panelBody: {
    marginTop: 5,
    fontSize: 10.5,
    lineHeight: 16,
    color: '#6E7973',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitle: {
    marginTop: 3,
    fontSize: 17,
    fontWeight: '900',
    color: '#213028',
  },
  smallMuted: {
    fontSize: 9,
    color: '#818B85',
  },
  attentionList: {
    marginTop: 8,
  },
  attentionRow: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E7EBE8',
  },
  attentionIcon: {
    width: 39,
    height: 39,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: '#EEF6F1',
  },
  attentionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  attentionTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '900',
    color: '#243129',
  },
  attentionDetail: {
    marginTop: 4,
    fontSize: 10,
    lineHeight: 15,
    color: '#727D77',
  },
  appRows: {
    marginTop: 8,
  },
  appRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E7EBE8',
  },
  appIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#F0F5F2',
  },
  appName: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#243129',
  },
  appDescription: {
    marginTop: 2,
    fontSize: 9.5,
    color: '#77817B',
  },
  sourceRow: {
    minHeight: 37,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#E8ECE9',
  },
  sourceLabel: {
    flex: 1,
    fontSize: 10,
    color: '#69756E',
  },
  flowPanel: {
    overflow: 'hidden',
  },
  flowRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
  },
  flowStep: {
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D6E2DA',
    backgroundColor: '#F3F8F5',
  },
  flowStepText: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.45,
    color: '#1F5C43',
  },
});
