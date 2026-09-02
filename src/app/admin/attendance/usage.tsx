import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { AdminGate } from '@/components/AdminGate';
import { BuklodSyncStatusBadge } from '@/components/BuklodSyncStatusBadge';
import { Card, SectionTitle, shared } from '@/components/UI';
import { useBuklodOfflineCache } from '@/hooks/useBuklodOfflineCache';
import {
  fetchAttendancePlatformStats,
  type AttendancePlatformStats,
} from '@/lib/admin/buklodAttendanceAdmin';
import {
  adminAttendancePlatformStatsCacheKey,
  type BuklodSyncStatus,
} from '@/lib/buklodOfflineSync';
import { colors } from '@/lib/theme';

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {!!hint && <Text style={styles.metricHint}>{hint}</Text>}
    </View>
  );
}

export default function AdminAttendanceUsageScreen() {
  const {
    data: stats,
    loading,
    refreshing,
    syncing,
    fromCache,
    online,
    refresh,
    error,
  } = useBuklodOfflineCache<AttendancePlatformStats | null>({
    cacheKey: adminAttendancePlatformStatsCacheKey(),
    fetcher: fetchAttendancePlatformStats,
  });

  const syncStatus = useMemo((): BuklodSyncStatus | null => {
    if (syncing) return 'syncing';
    if (!online && stats) return 'saved_offline';
    if (fromCache && online) return 'waiting_to_sync';
    if (stats && !fromCache) return 'synced';
    return null;
  }, [syncing, online, stats, fromCache]);

  return (
    <AdminGate>
      <ScrollView
        style={shared.screen}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />
        }
      >
        <Pressable onPress={() => router.back()} style={styles.back}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={22}
            color={colors.greenDark}
          />
        </Pressable>

        <Text style={styles.eyebrow}>SYSTEM ADMIN</Text>
        <Text style={shared.h1}>Attendance Usage</Text>
        <Text style={shared.muted}>
          Platform-wide BUKLOD Attendance events, check-ins, and cluster
          activity.
        </Text>

        {syncStatus ? (
          <View style={styles.syncRow}>
            <BuklodSyncStatusBadge status={syncStatus} compact />
          </View>
        ) : null}

        {loading && !stats ? (
          <ActivityIndicator color={colors.greenDark} />
        ) : error && !stats ? (
          <Card>
            <Text style={shared.h2}>Report unavailable</Text>
            <Text style={shared.muted}>{error}</Text>
          </Card>
        ) : stats ? (
          <>
            <SectionTitle>ALL TIME</SectionTitle>
            <View style={styles.metrics}>
              <Metric label="TOTAL EVENTS" value={stats.total_events} />
              <Metric label="OPEN EVENTS" value={stats.active_events} />
              <Metric label="TOTAL CHECK-INS" value={stats.total_records} />
              <Metric label="ACTIVE SCOPES" value={stats.scopes_with_events} />
              <Metric label="ATTENDANCE OPERATORS" value={stats.scope_operators} />
            </View>

            <SectionTitle>LAST 30 DAYS</SectionTitle>
            <View style={styles.metrics}>
              <Metric label="NEW EVENTS" value={stats.events_30d} />
              <Metric label="CHECK-INS" value={stats.records_30d} />
              <Metric
                label="CLUSTER CHECK-INS"
                value={stats.cluster_checkins_30d}
                hint="Daily cluster self check-in"
              />
            </View>

            <SectionTitle>LAST 7 DAYS</SectionTitle>
            <View style={styles.metrics}>
              <Metric label="NEW EVENTS" value={stats.events_7d} />
              <Metric label="CHECK-INS" value={stats.records_7d} />
            </View>

            <Card>
              <Text style={styles.infoTitle}>Generated</Text>
              <Text style={shared.muted}>
                {new Date(stats.generated_at).toLocaleString()}
              </Text>
            </Card>
          </>
        ) : null}
      </ScrollView>
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    paddingBottom: 50,
  },
  back: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.greenSoft,
    marginBottom: 10,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: colors.greenDark,
    marginBottom: 4,
  },
  syncRow: {
    marginTop: 10,
    marginBottom: 4,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  metric: {
    width: '47%',
    minWidth: 140,
    flexGrow: 1,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.greenDark,
  },
  metricLabel: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '800',
    color: colors.muted,
  },
  metricHint: {
    marginTop: 4,
    fontSize: 10,
    color: colors.muted,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.text,
  },
});
