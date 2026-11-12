import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { AdminGate } from '@/components/AdminGate';
import { supabase } from '@/lib/supabase';

type CapacityStatus = 'collecting' | 'normal' | 'watch' | 'review';
type AlertReport = { level: 'normal' | 'watch' | 'review'; changed_at: string | null; last_notified_at: string | null };
type ProviderReport = {
  memory_percent: number | null; filesystem_used_percent: number | null;
  swap_used_percent: number | null; cpu_load1: number | null;
  cpu_cores: number | null; cpu_load_per_core_percent: number | null;
  cpu_utilization_percent: null; source: string; sampled_at: string;
};
type DailySample = {
  day: string;
  peak_connection_pct: number | null;
  database_bytes: number | null;
};
type CapacityReport = {
  sampled_at: string;
  status: CapacityStatus;
  status_reason: string;
  connections: {
    used: number;
    active: number;
    idle_in_transaction: number;
    waiting_locks: number;
    max_configured: number;
  };
  database: {
    bytes: number;
    cache_hit_percent: number | null;
    growth_7d_bytes: number | null;
  };
  trend: {
    samples_7d: number;
    peak_connection_pct_7d: number | null;
    daily: DailySample[];
  };
  cpu_percent: null;
  memory_percent: null;
  disk_capacity_percent: null;
  upgrade_recommended: false;
};

const providerReports =
  'https://supabase.com/dashboard/project/yhanxndaqbmuzbdqlblu/reports/database';
const mainNotebook =
  'https://supabase.com/dashboard/project/yhanxndaqbmuzbdqlblu/explorer/notebook/7cbd4683-0696-4cdf-807e-20f3089a2e6c';
const quizNotebook =
  'https://supabase.com/dashboard/project/cjtehbfspgimyhifnjon/explorer/notebook/7c86b2d7-2d8b-4644-af74-ba832c84e784';

const formatCount = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value).toLocaleString('en-PH') : '—';

function formatBytes(value: number | null) {
  if (value === null || !Number.isFinite(value)) return 'Not available';
  if (Math.abs(value) < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (Math.abs(value) < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function percentage(numerator: number, denominator: number) {
  return denominator > 0 && Number.isFinite(numerator) && Number.isFinite(denominator)
    ? Math.round((1000 * numerator) / denominator) / 10
    : null;
}

function openProvider(url: string) {
  void Linking.openURL(url);
}

function UsageBar({
  name, value, detail, attention,
}: {
  name: string;
  value: number | null;
  detail: string;
  attention?: boolean;
}) {
  const pct = value === null || !Number.isFinite(value) ? null : Math.max(0, value);
  const color = attention ? '#BA6B20' : '#287C5A';
  return (
    <View style={styles.meter}>
      <View style={styles.between}>
        <Text style={styles.meterTitle}>{name}</Text>
        <Text style={[styles.meterValue, attention && styles.warnText]}>
          {pct === null ? 'Not connected' : `${pct.toFixed(1)}%`}
        </Text>
      </View>
      <View style={styles.track}>
        {pct !== null ? (
          <View
            testID="capacity-meter-fill"
            style={[styles.fill, { width: `${Math.min(100, pct)}%` as any, backgroundColor: color }]}
          />
        ) : null}
      </View>
      <Text style={styles.detail}>{detail}</Text>
    </View>
  );
}

function Metric({ title, value, note }: {
  title: string;
  value: string;
  note?: string;
}) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{title}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {note ? <Text style={styles.detail}>{note}</Text> : null}
    </View>
  );
}

function LinkRow({ title, detail, url }: {
  title: string;
  detail: string;
  url: string;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => openProvider(url)}
      style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
    >
      <MaterialCommunityIcons name="open-in-new" size={21} color="#257452" />
      <View style={styles.flex}>
        <Text style={styles.linkTitle}>{title}</Text>
        <Text style={styles.detail}>{detail}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color="#779083" />
    </Pressable>
  );
}

export default function AdminBackendCapacityScreen() {
  const [report, setReport] = useState<CapacityReport | null>(null);
  const [alert, setAlert] = useState<AlertReport | null>(null);
  const [provider, setProvider] = useState<ProviderReport | null>(null);
  const [providerUnavailable, setProviderUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const serial = useRef(0);

  const load = useCallback(async (isRefresh: boolean) => {
    const generation = ++serial.current;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      // Read independent sources once per refresh. Partial provider failure must not
      // suppress the core capacity dashboard.
      const [dbResult, alertResult, providerResult] = await Promise.allSettled([
        (supabase as any).rpc('buklod_admin_backend_capacity_v1'),
        (supabase as any).rpc('buklod_admin_backend_capacity_alert_v2'),
        supabase.functions.invoke('buklod-admin-backend-metrics', { method: 'POST', body: {} }),
      ]);
      if (generation !== serial.current) return;
      if (alertResult.status === 'fulfilled' && !alertResult.value.error)
        setAlert(alertResult.value.data as AlertReport);
      if (providerResult.status === 'fulfilled' && !providerResult.value.error &&
          providerResult.value.data?.source === 'Supabase Metrics API (database host)') {
        setProvider(providerResult.value.data as ProviderReport);
        setProviderUnavailable(false);
      } else {
        setProvider(null);
        setProviderUnavailable(true);
      }
      if (dbResult.status !== 'fulfilled' || dbResult.value.error)
        throw new Error('Database capacity report unavailable.');
      const data = dbResult.value.data;
      if (!data || typeof data !== 'object' || !data.connections || !data.trend)
        throw new Error('Invalid backend capacity response.');
      setReport(data as CapacityReport);
    } catch {
      if (generation === serial.current) {
        setError('Live monitoring is unavailable. Check backend migration and your System Admin access.');
      }
    } finally {
      if (generation === serial.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void load(false);
    return () => { serial.current++; };
  }, [load]);

  const connectionPct = report
    ? percentage(report.connections.used, report.connections.max_configured)
    : null;
  const statusLabel = report?.status === 'review' ? 'REVIEW CAPACITY'
    : report?.status === 'watch' ? 'WATCH'
    : report?.status === 'normal' ? 'NO SLOT ALERT' : 'COLLECTING DATA';

  const peak = report?.trend.peak_connection_pct_7d ?? null;
  const daily = (report?.trend.daily ?? []).slice(-7);
  const growth = report?.database.growth_7d_bytes ?? null;

  return (
    <AdminGate>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />
        }
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.back}
        >
          <MaterialCommunityIcons name="arrow-left" size={20} color="#276F50" />
          <Text style={styles.backText}>System Admin</Text>
        </Pressable>

        <View style={styles.hero}>
          <MaterialCommunityIcons name="server-network" size={28} color="#276F50" />
          <Text style={styles.eyebrow}>SYSTEM ADMIN · INFRASTRUCTURE</Text>
          <Text style={styles.title}>Backend Health & Capacity</Text>
          <Text style={styles.description}>
            Real database measurements, hourly history and early-warning review.
            This screen never purchases an upgrade or changes production settings.
          </Text>
        </View>

        {loading && !report ? <ActivityIndicator color="#276F50" style={styles.loader} /> : null}
        {error ? (
          <View style={styles.notice} accessibilityRole="alert">
            <Text style={styles.noticeText}>{error}</Text>
            <Pressable onPress={() => void load(false)} style={styles.retry}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {report ? (
          <>
            <View style={styles.card}>
              <View style={styles.between}>
                <Text style={styles.sectionTitle}>Primary backend</Text>
                <View style={[styles.pill, (report.status === 'review' || report.status === 'watch') && styles.pillWarn]}>
                  <Text style={styles.pillText}>{statusLabel}</Text>
                </View>
              </View>
              <Text style={styles.detail}>
                Sampled {new Date(report.sampled_at).toLocaleString('en-PH')}
              </Text>
              <Text style={styles.note}>{report.status_reason}</Text>
              <View style={[styles.notice,
                (alert?.level === 'watch' || alert?.level === 'review') && styles.noticeWarning]}>
                <Text style={styles.alertLabel}>
                  Automatic warning: {alert?.level === 'review' ? 'REVIEW CAPACITY' :
                    alert?.level === 'watch' ? 'WATCH' :
                    alert?.level === 'normal' ? 'NO ACTIVE WARNING' : 'COLLECTING BASELINE'}
                </Text>
                <Text style={styles.detail}>
                  Warnings require six consecutive hourly readings. Existing BUKLOD
                  notifications go only to the protected System Admin account.
                </Text>
                {alert?.last_notified_at ?
                  <Text style={styles.detail}>
                    Last warning: {new Date(alert.last_notified_at).toLocaleString('en-PH')}
                  </Text> : null}
              </View>
              <UsageBar
                name="Postgres connection slots"
                value={connectionPct}
                attention={connectionPct !== null && connectionPct >= 65}
                detail={`${formatCount(report.connections.used)} of ${formatCount(report.connections.max_configured)} configured slots used. These are server connections, not active app users.`}
              />
              <View style={styles.metricGrid}>
                <Metric title="Active SQL connections" value={formatCount(report.connections.active)} />
                <Metric title="Waiting locks" value={formatCount(report.connections.waiting_locks)} />
                <Metric title="Idle in transaction" value={formatCount(report.connections.idle_in_transaction)} />
                <Metric title="Database size" value={formatBytes(report.database.bytes)} />
              </View>
              <Text style={styles.detail}>
                Cumulative database cache hit: {report.database.cache_hit_percent === null ? 'Unavailable' : `${report.database.cache_hit_percent}%`}.
                A single cache hit or connection snapshot does not prove capacity headroom.
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Seven-day trend</Text>
              <Text style={styles.detail}>
                {formatCount(report.trend.samples_7d)} hourly samples available ·
                Peak recorded connection use: {peak === null ? 'Not available' : `${peak.toFixed(1)}%`}
              </Text>
              {daily.length === 0 ? (
                <Text style={styles.note}>History is being collected. The first scheduled sample runs hourly.</Text>
              ) : daily.map(item => (
                <View key={item.day} style={styles.dayRow}>
                  <Text style={styles.dayLabel}>{item.day}</Text>
                  <View style={styles.smallTrack}>
                    <View style={[styles.smallFill, {
                      width: `${Math.min(100, Math.max(0, item.peak_connection_pct ?? 0))}%` as any,
                    }]} />
                  </View>
                  <Text style={styles.dayValue}>
                    {item.peak_connection_pct === null ? '—' : `${item.peak_connection_pct.toFixed(1)}%`}
                  </Text>
                </View>
              ))}
              <Text style={styles.note}>
                Database size movement over available seven-day history: {
                  growth === null ? 'Insufficient history'
                    : `${growth >= 0 ? '+' : '-'}${formatBytes(Math.abs(growth))}`
                }. Actual disk quota and IOPS are separate provider metrics.
              </Text>
            </View>
          </>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Compute and infrastructure</Text>
          <Text style={styles.note}>
            {provider
              ? `Provider sample: ${new Date(provider.sampled_at).toLocaleString('en-PH')}`
              : 'Provider telemetry unavailable. No guessed percentages.'}
            {providerUnavailable ? ' Check Supabase provider access and refresh.' : ''}
          </Text>
          <UsageBar
            name="CPU load / logical vCPU (1m, not utilization)"
            value={provider?.cpu_load_per_core_percent ?? null}
            attention={(provider?.cpu_load_per_core_percent ?? 0) >= 75}
            detail={provider?.cpu_load1 != null && provider?.cpu_cores != null
              ? `1-minute load average ${provider.cpu_load1.toFixed(2)} across ${provider.cpu_cores} logical CPUs. This is not CPU utilization.`
              : 'CPU load metric not available.'}
          />
          <UsageBar
            name="Database host RAM usage"
            value={provider?.memory_percent ?? null}
            attention={(provider?.memory_percent ?? 0) >= 75}
            detail={provider?.swap_used_percent != null
              ? `Swap usage ${provider.swap_used_percent.toFixed(1)}%. Sustained swapping requires investigation.`
              : 'Memory metric not available.'}
          />
          <UsageBar
            name="Database host filesystem usage"
            value={provider?.filesystem_used_percent ?? null}
            attention={(provider?.filesystem_used_percent ?? 0) >= 75}
            detail="Filesystem usage is not your Supabase plan quota."
          />
          <LinkRow
            title="Open CPU / RAM / Disk reports"
            detail="Supabase provider graphs and current utilization"
            url={providerReports}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Upgrade decision policy</Text>
          <Text style={styles.note}>
            Watch: six consecutive hourly samples at 65% or higher.
            Review: six consecutive samples at 80% or higher.
            Recovery clears the alert after three consecutive samples below 55%.
            These thresholds request investigation only.
          </Text>
          <Text style={styles.note}>
            Upgrade only after confirming sustained CPU/RAM, IOPS or connection pressure,
            investigating slow queries and pooling, and comparing projected demand against cost.
            An Android video crash by itself is not a backend-upgrade trigger.
          </Text>
          <LinkRow
            title="Main backend diagnostic notebook"
            detail="Read-only database queries and last-24-hour API errors"
            url={mainNotebook}
          />
          <LinkRow
            title="Dedicated Quiz backend notebook"
            detail="Separate Quiz capacity · not combined with main database"
            url={quizNotebook}
          />
          <Text style={styles.footerNote}>
            Hourly sampling is server-side; refreshing this page does not create extra
            stored samples. In-app push alerts and provider CPU/RAM ingestion are not yet configured.
          </Text>
        </View>
      </ScrollView>
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F7F3' },
  content: { padding: 16, paddingBottom: 160, gap: 12, maxWidth: 900, width: '100%', alignSelf: 'center' },
  flex: { flex: 1 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 10 },
  backText: { color: '#276F50', fontWeight: '700' },
  hero: { borderRadius: 18, padding: 20, backgroundColor: '#E8F2EA', gap: 6 },
  eyebrow: { fontSize: 10, letterSpacing: 1.2, fontWeight: '800', color: '#447357' },
  title: { fontSize: 24, fontWeight: '900', color: '#20352A' },
  description: { fontSize: 13, lineHeight: 19, color: '#567266' },
  loader: { marginVertical: 26 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 17, padding: 16, gap: 13, borderWidth: 1, borderColor: '#E3E9E1' },
  sectionTitle: { color: '#20352A', fontSize: 17, fontWeight: '800' },
  detail: { color: '#697D70', fontSize: 12, lineHeight: 17 },
  note: { color: '#425E4D', fontSize: 13, lineHeight: 20 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  pill: { borderRadius: 20, backgroundColor: '#E3F3E9', paddingHorizontal: 10, paddingVertical: 5 },
  pillWarn: { backgroundColor: '#FFF0D5' },
  pillText: { color: '#326C4B', fontSize: 10, fontWeight: '900' },
  meter: { gap: 5 },
  meterTitle: { fontSize: 13, color: '#324A3A', fontWeight: '700' },
  meterValue: { color: '#287C5A', fontWeight: '900', fontSize: 14 },
  warnText: { color: '#BA6B20' },
  track: { height: 11, backgroundColor: '#E4EAE5', borderRadius: 8, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 8 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { backgroundColor: '#F5F8F5', borderRadius: 10, padding: 11, width: '48%', flexGrow: 1, gap: 4 },
  metricLabel: { fontSize: 11, color: '#647669' },
  metricValue: { color: '#20352A', fontWeight: '800', fontSize: 19 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  dayLabel: { width: 78, fontSize: 11, color: '#617768' },
  dayValue: { width: 43, textAlign: 'right', fontSize: 11, fontWeight: '700', color: '#246A49' },
  smallTrack: { flex: 1, backgroundColor: '#ECF0EC', borderRadius: 5, height: 9, overflow: 'hidden' },
  smallFill: { height: '100%', backgroundColor: '#39865A', borderRadius: 5 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#EEF1EC', paddingTop: 12 },
  linkTitle: { color: '#245E45', fontWeight: '800', fontSize: 13 },
  footerNote: { color: '#7B857D', fontSize: 11, lineHeight: 17 },
  notice: { backgroundColor: '#EEF5F0', padding: 14, borderRadius: 12, gap: 8 },
  noticeWarning: { backgroundColor: '#FFF3E6' },
  alertLabel: { fontSize: 13, fontWeight: '900', color: '#286248' },
  noticeText: { color: '#9B492E', fontSize: 13, lineHeight: 18 },
  retry: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#FFFFFF', borderRadius: 8 },
  retryText: { color: '#276F50', fontWeight: '800' },
  pressed: { opacity: 0.7 },
});
