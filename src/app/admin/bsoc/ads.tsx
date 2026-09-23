import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { AdminGate } from '@/components/AdminGate';
import BsocShell, {
  BsocMetric,
  BsocPanel,
  BsocStatusBadge,
  type BsocTone,
} from '@/components/bsoc/BsocShell';
import {
  BSOC_AD_PLACEMENTS,
  bsocActiveProductionPlacements,
  bsocLegacyProductionPlacements,
  type BsocAdPlacementRegistryItem,
} from '@/lib/admin/bsocAdsRegistry';
import {
  getBuklodAdDiagnosticsSummary,
  type BuklodAdDiagnosticsSummary,
} from '@/lib/buklodAdDiagnostics';
import { buklodAdsTestMode } from '@/lib/buklodAdUnits';
import { hasProductionAdUnits } from '@/lib/adUnits';

function pct(a: number, b: number) {
  return b > 0 ? Math.round((a / b) * 100) : null;
}

function metricFor(
  summary: BuklodAdDiagnosticsSummary,
  placement: BsocAdPlacementRegistryItem,
) {
  return placement.diagnosticPlacement
    ? summary.placements.find(
        (row) => row.placement === placement.diagnosticPlacement,
      ) ?? null
    : null;
}

function healthFor(summary: BuklodAdDiagnosticsSummary): {
  label: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'DISABLED';
  tone: BsocTone;
  reason: string;
} {
  if (!hasProductionAdUnits()) {
    return {
      label: 'DISABLED',
      tone: 'offline',
      reason: 'Required production ad-unit configuration is incomplete in this runtime.',
    };
  }

  const { requested, loaded, impression, failures } = summary.totals;
  if (requested === 0) {
    return {
      label: 'DEGRADED',
      tone: 'warning',
      reason: 'No local session telemetry is available. Missing telemetry is not interpreted as zero production activity.',
    };
  }

  const failure = failures / requested;
  const show = loaded > 0 ? impression / loaded : 0;
  if (failure >= 0.2) {
    return {
      label: 'CRITICAL',
      tone: 'critical',
      reason: 'The current runtime has an ad failure rate at or above 20%.',
    };
  }
  if (loaded >= 5 && show < 0.25) {
    return {
      label: 'DEGRADED',
      tone: 'warning',
      reason: 'Loaded ads are producing unusually few impressions in the current runtime.',
    };
  }
  return {
    label: 'HEALTHY',
    tone: 'healthy',
    reason: 'No local runtime threshold currently indicates a placement failure or low show-rate condition.',
  };
}

function Inspector({
  item,
  summary,
}: {
  item: BsocAdPlacementRegistryItem;
  summary: BuklodAdDiagnosticsSummary;
}) {
  const metric = metricFor(summary, item);
  const rows: Array<[string, string | number]> = [
    ['App', item.appId],
    ['Platform', item.platform],
    ['Provider', item.provider],
    ['Format', item.format],
    ['Route', item.route],
    ['Environment', item.environment],
    ['Requests', metric?.requested ?? '—'],
    ['Loaded', metric?.loaded ?? '—'],
    ['Rendered', metric?.rendered ?? '—'],
    ['Impressions', metric?.impression ?? '—'],
    ['Load rate', metric ? `${pct(metric.loaded, metric.requested) ?? '—'}%`.replace('—%', '—') : '—'],
    ['Show rate', metric ? `${pct(metric.impression, metric.loaded) ?? '—'}%`.replace('—%', '—') : '—'],
  ];

  return (
    <View style={styles.stack}>
      <BsocPanel>
        <Text style={styles.eyebrow}>PLACEMENT INSPECTOR</Text>
        <Text style={styles.inspectorTitle}>{item.displayName}</Text>
        <Text style={styles.muted}>{item.placementId}</Text>
        <View style={styles.inspectorRows}>
          <View style={styles.inspectorRow}>
            <Text style={styles.label}>Status</Text>
            <BsocStatusBadge
              label={item.status}
              tone={item.status === 'ACTIVE' ? 'healthy' : item.status === 'TEST' ? 'warning' : 'offline'}
            />
          </View>
          {rows.map(([label, value]) => (
            <View key={label} style={styles.inspectorRow}>
              <Text style={styles.label}>{label}</Text>
              <Text style={styles.value}>{value}</Text>
            </View>
          ))}
        </View>
        {!metric ? (
          <Text style={styles.note}>
            No in-memory diagnostic bucket exists for this registered surface. BSOC does not fabricate counts.
          </Text>
        ) : null}
      </BsocPanel>
      {item.note ? (
        <BsocPanel>
          <Text style={styles.eyebrow}>NOTE</Text>
          <Text style={styles.note}>{item.note}</Text>
        </BsocPanel>
      ) : null}
    </View>
  );
}

export default function BsocAdsHealthScreen() {
  const [refreshToken, setRefreshToken] = useState(0);
  const [selectedId, setSelectedId] = useState(
    BSOC_AD_PLACEMENTS[0]?.placementId ?? '',
  );
  void refreshToken;

  const summary = getBuklodAdDiagnosticsSummary();
  const health = healthFor(summary);
  const selected =
    BSOC_AD_PLACEMENTS.find((item) => item.placementId === selectedId) ??
    BSOC_AD_PLACEMENTS[0];

  const { requested, loaded, impression, failures } = summary.totals;
  const rendered = summary.placements.reduce(
    (sum, row) => sum + row.rendered,
    0,
  );
  const loadRate = pct(loaded, requested);
  const showRate = pct(impression, loaded);
  const failureRate = pct(failures, requested);
  const active = bsocActiveProductionPlacements();
  const legacy = bsocLegacyProductionPlacements();

  const alerts = useMemo(() => {
    const out: Array<{
      title: string;
      detail: string;
      tone: BsocTone;
      icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
    }> = [];

    if (requested === 0) {
      out.push({
        title: 'NO LOCAL SESSION TELEMETRY',
        detail: 'This runtime has not observed ad events. This state is unavailable data, not zero production traffic.',
        tone: 'warning',
        icon: 'database-off-outline',
      });
    }
    if (failureRate != null && failureRate >= 20) {
      out.push({
        title: 'AD_LOAD_FAILURE_SPIKE',
        detail: `Failure rate is ${failureRate}% in this local runtime.`,
        tone: 'critical',
        icon: 'alert-circle-outline',
      });
    }
    if (showRate != null && loaded >= 5 && showRate < 25) {
      out.push({
        title: 'LOW_SHOW_RATE',
        detail: `Loaded ads are producing a ${showRate}% show rate. Investigate viewability, rerendering and placement lifecycle.`,
        tone: 'warning',
        icon: 'eye-off-outline',
      });
    }
    if (legacy.length > 0) {
      out.push({
        title: 'LEGACY_PLACEMENT_TRAFFIC WATCH',
        detail: `${legacy.length} production placement${legacy.length === 1 ? '' : 's'} are registered as legacy. Version-aware telemetry is required before treating traffic as a current regression.`,
        tone: 'warning',
        icon: 'history',
      });
    }
    if (out.length === 0) {
      out.push({
        title: 'NO LOCAL THRESHOLD TRIGGERED',
        detail: 'This is a session-level observation, not a provider-wide production guarantee.',
        tone: 'healthy',
        icon: 'check-circle-outline',
      });
    }
    return out;
  }, [failureRate, legacy.length, loaded, requested, showRate]);

  const adsenseConfigured = /^ca-pub-\d+$/.test(
    String(process.env.EXPO_PUBLIC_ADSENSE_CLIENT_ID ?? '').trim(),
  );

  return (
    <AdminGate>
      <BsocShell
        current="apps"
        eyebrow="APPS & SYSTEM / ADS"
        title="Ads & Monetization Health"
        subtitle="Operational monitoring only. This workspace answers whether ads are working correctly; revenue, payouts, user balances and owner financial data remain outside BSOC."
        rightPanel={selected ? <Inspector item={selected} summary={summary} /> : undefined}
      >
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>ADS SERVICE</Text>
            <View style={styles.titleRow}>
              <Text style={styles.healthTitle}>{health.label}</Text>
              <BsocStatusBadge label={health.label} tone={health.tone} />
            </View>
            <Text style={styles.detail}>{health.reason}</Text>
            <Text style={styles.freshness}>
              DATA FRESHNESS · LOCAL RUNTIME · {summary.environment.toUpperCase()} · APP {summary.appVersion ?? 'UNKNOWN'}
            </Text>
          </View>
          <Pressable
            onPress={() => setRefreshToken((n) => n + 1)}
            style={({ pressed }) => [styles.refresh, pressed && { opacity: 0.76 }]}
          >
            <MaterialCommunityIcons name="refresh" size={17} color="#FFFFFF" />
            <Text style={styles.refreshText}>REFRESH LOCAL</Text>
          </Pressable>
        </View>

        <View style={styles.metrics}>
          <BsocMetric label="Requests" value={requested} />
          <BsocMetric label="Loaded / matched" value={loaded} />
          <BsocMetric label="Rendered" value={rendered} />
          <BsocMetric label="Impressions" value={impression} />
          <BsocMetric label="Match / load rate" value={loadRate == null ? '—' : `${loadRate}%`} />
          <BsocMetric label="Show rate" value={showRate == null ? '—' : `${showRate}%`} />
          <BsocMetric label="Load failure rate" value={failureRate == null ? '—' : `${failureRate}%`} />
          <BsocMetric label="Active placements" value={active.length} />
          <BsocMetric label="Legacy placements" value={legacy.length} />
        </View>

        <BsocPanel>
          <Text style={styles.eyebrow}>REQUEST → IMPRESSION</Text>
          <Text style={styles.sectionTitle}>Operational funnel</Text>
          <View style={styles.funnel}>
            {([
              ['REQUEST', requested],
              ['LOAD / MATCH', loaded],
              ['RENDER', rendered],
              ['IMPRESSION', impression],
            ] as const).map(([label, value], index, all) => (
              <React.Fragment key={label}>
                <View style={styles.funnelStep}>
                  <Text style={styles.label}>{label}</Text>
                  <Text style={styles.funnelValue}>{value}</Text>
                </View>
                {index < all.length - 1 ? (
                  <MaterialCommunityIcons name="arrow-right" size={18} color="#9AA39E" />
                ) : null}
              </React.Fragment>
            ))}
          </View>
          <Text style={styles.note}>
            Show Rate is separate from Match / Load Rate. Healthy loading with low impressions is a possible viewability or wasted-request condition.
          </Text>
        </BsocPanel>

        <BsocPanel>
          <Text style={styles.eyebrow}>OPERATIONAL ALERTS</Text>
          <Text style={styles.sectionTitle}>Actionable conditions</Text>
          <View style={styles.list}>
            {alerts.map((alert) => (
              <View key={alert.title} style={styles.row}>
                <View style={styles.iconBox}>
                  <MaterialCommunityIcons name={alert.icon} size={19} color="#1F5C43" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={styles.rowTitle}>{alert.title}</Text>
                    <BsocStatusBadge
                      label={alert.tone === 'critical' ? 'CRITICAL' : alert.tone === 'warning' ? 'WARNING' : 'INFO'}
                      tone={alert.tone}
                    />
                  </View>
                  <Text style={styles.detail}>{alert.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        </BsocPanel>

        <BsocPanel>
          <Text style={styles.eyebrow}>PROVIDER SEPARATION</Text>
          <Text style={styles.sectionTitle}>Provider operational state</Text>
          <View style={styles.list}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>AdMob Native</Text>
                <Text style={styles.detail}>
                  Android native provider. Current runtime is {buklodAdsTestMode ? 'using test mode' : 'using production identity/configuration'}.
                </Text>
              </View>
              <BsocStatusBadge
                label={buklodAdsTestMode ? 'TEST MODE' : hasProductionAdUnits() ? 'CONFIGURED' : 'ACTION REQUIRED'}
                tone={buklodAdsTestMode ? 'warning' : hasProductionAdUnits() ? 'healthy' : 'critical'}
              />
            </View>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>AdSense Web</Text>
                <Text style={styles.detail}>
                  Web uses AdSense when a valid client/slot is present and the approved BUKLOD sponsor fallback otherwise.
                </Text>
              </View>
              <BsocStatusBadge
                label={adsenseConfigured ? 'CONFIGURED' : 'FALLBACK / ACTION REQUIRED'}
                tone={adsenseConfigured ? 'healthy' : 'warning'}
              />
            </View>
          </View>
        </BsocPanel>

        <BsocPanel>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>PLACEMENT REGISTRY</Text>
              <Text style={styles.sectionTitle}>Registered ad surfaces</Text>
            </View>
            <Text style={styles.muted}>{BSOC_AD_PLACEMENTS.length} entries</Text>
          </View>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHead, { flex: 1.8 }]}>PLACEMENT</Text>
            <Text style={styles.tableHead}>PLATFORM</Text>
            <Text style={styles.tableHead}>REQ</Text>
            <Text style={styles.tableHead}>LOAD</Text>
            <Text style={styles.tableHead}>SHOW</Text>
            <Text style={styles.tableHead}>STATUS</Text>
          </View>
          {BSOC_AD_PLACEMENTS.map((item) => {
            const metric = metricFor(summary, item);
            return (
              <Pressable
                key={item.placementId}
                onPress={() => setSelectedId(item.placementId)}
                style={({ pressed }) => [
                  styles.tableRow,
                  selectedId === item.placementId && styles.selected,
                  pressed && { opacity: 0.76 },
                ]}
              >
                <View style={{ flex: 1.8 }}>
                  <Text style={styles.tableName}>{item.displayName}</Text>
                  <Text style={styles.tableSub}>{item.placementId}</Text>
                </View>
                <Text style={styles.cell}>{item.platform}</Text>
                <Text style={styles.cell}>{metric?.requested ?? '—'}</Text>
                <Text style={styles.cell}>{metric ? `${pct(metric.loaded, metric.requested) ?? '—'}%`.replace('—%', '—') : '—'}</Text>
                <Text style={styles.cell}>{metric ? `${pct(metric.impression, metric.loaded) ?? '—'}%`.replace('—%', '—') : '—'}</Text>
                <View style={styles.statusCell}>
                  <BsocStatusBadge
                    label={item.status}
                    tone={item.status === 'ACTIVE' ? 'healthy' : item.status === 'TEST' ? 'warning' : 'offline'}
                  />
                </View>
              </Pressable>
            );
          })}
        </BsocPanel>

        <BsocPanel style={styles.invariant}>
          <View style={styles.iconBox}>
            <MaterialCommunityIcons name="shield-check-outline" size={22} color="#1F5C43" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>CONTENT-FIRST INVARIANT</Text>
            <Text style={styles.sectionTitle}>Ad failure must not block content.</Text>
            <Text style={styles.detail}>
              Community Wall and other content must remain usable when AdMob/AdSense is unavailable, no-fill occurs, or an ad request times out. A violation is release-blocking.
            </Text>
          </View>
        </BsocPanel>
      </BsocShell>
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 10 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DCE5DF',
    backgroundColor: '#FFFFFF',
  },
  eyebrow: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 1.1,
    color: '#7B867F',
  },
  healthTitle: { fontSize: 22, fontWeight: '900', color: '#213028' },
  sectionTitle: { marginTop: 3, fontSize: 16, fontWeight: '900', color: '#213028' },
  titleRow: {
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  detail: { marginTop: 3, fontSize: 9.5, lineHeight: 14, color: '#747F78' },
  note: { marginTop: 8, fontSize: 9.5, lineHeight: 14, color: '#6F7A74' },
  muted: { marginTop: 2, fontSize: 8, lineHeight: 12, color: '#84908A' },
  freshness: {
    marginTop: 7,
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: '#88918C',
  },
  refresh: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#1F5C43',
  },
  refreshText: { fontSize: 9, fontWeight: '900', color: '#FFFFFF' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  funnel: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 7,
  },
  funnelStep: {
    minWidth: 120,
    flexGrow: 1,
    padding: 11,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#E0E6E2',
    backgroundColor: '#F8FAF8',
  },
  label: { fontSize: 9, color: '#717C76' },
  value: { maxWidth: 150, fontSize: 9, fontWeight: '800', color: '#26332C', textAlign: 'right' },
  funnelValue: { marginTop: 4, fontSize: 19, fontWeight: '900', color: '#1F5C43' },
  list: { marginTop: 8 },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E7EBE8',
  },
  iconBox: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#EFF5F1',
  },
  rowTitle: { flex: 1, fontSize: 11, fontWeight: '900', color: '#25322B' },
  inspectorTitle: { marginTop: 4, fontSize: 14, fontWeight: '900', color: '#223028' },
  inspectorRows: { marginTop: 9 },
  inspectorRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#E8ECE9',
  },
  tableHeader: {
    marginTop: 10,
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 7,
    borderRadius: 8,
    backgroundColor: '#F4F7F5',
  },
  tableHead: {
    flex: 0.75,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.3,
    color: '#7C8680',
  },
  tableRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 7,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECE9',
  },
  selected: { backgroundColor: '#F1F7F3' },
  tableName: { fontSize: 10, fontWeight: '900', color: '#25322B' },
  tableSub: { marginTop: 2, fontSize: 7, color: '#87908B' },
  cell: { flex: 0.75, fontSize: 9, color: '#59665F' },
  statusCell: { flex: 0.75, alignItems: 'flex-start' },
  invariant: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F3F9F5',
    borderColor: '#CFE1D5',
  },
});
