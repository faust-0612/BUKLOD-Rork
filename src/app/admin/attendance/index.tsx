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
  fetchFocusAppPlatformStats,
  type FocusAppPlatformStats,
} from '@/lib/admin/buklodFocusAppAdmin';
import {
  adminAttendancePlatformStatsCacheKey,
  adminFocusAppPlatformStatsCacheKey,
  type BuklodSyncStatus,
} from '@/lib/buklodOfflineSync';
import { colors } from '@/lib/theme';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function AdminLinkCard({
  icon,
  title,
  subtitle,
  path,
  badge,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  path: string;
  badge?: number;
}) {
  return (
    <Pressable
      onPress={() => router.push(path as any)}
      style={({ pressed }) => [styles.linkCard, pressed && { opacity: 0.8 }]}
    >
      <View style={styles.linkHeader}>
        <View style={styles.linkIcon}>
          <MaterialCommunityIcons
            name={icon}
            size={22}
            color={colors.greenDark}
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.linkTitleRow}>
            <Text style={styles.linkTitle}>{title}</Text>
            {!!badge && badge > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badge}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.linkSubtitle}>{subtitle}</Text>
        </View>
        <MaterialCommunityIcons
          name="chevron-right"
          size={22}
          color={colors.muted}
        />
      </View>
    </Pressable>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export default function AdminAttendanceHubScreen() {
  const {
    data: attendanceStats,
    loading: attendanceLoading,
    refreshing,
    syncing: attendanceSyncing,
    fromCache: attendanceFromCache,
    online,
    refresh: refreshAttendance,
    error: attendanceError,
  } = useBuklodOfflineCache<AttendancePlatformStats | null>({
    cacheKey: adminAttendancePlatformStatsCacheKey(),
    fetcher: fetchAttendancePlatformStats,
  });

  const {
    data: focusStats,
    loading: focusLoading,
    syncing: focusSyncing,
    fromCache: focusFromCache,
    refresh: refreshFocus,
    error: focusError,
  } = useBuklodOfflineCache<FocusAppPlatformStats | null>({
    cacheKey: adminFocusAppPlatformStatsCacheKey(),
    fetcher: fetchFocusAppPlatformStats,
  });

  const showBlockingLoader =
    (attendanceLoading && !attendanceStats) &&
    (focusLoading && !focusStats);

  const error =
    !attendanceStats && !focusStats
      ? attendanceError || focusError
      : null;

  const syncStatus = useMemo((): BuklodSyncStatus | null => {
    if (attendanceSyncing || focusSyncing) {
      return 'syncing';
    }

    if (!online && (attendanceStats || focusStats)) {
      return 'saved_offline';
    }

    if ((attendanceFromCache || focusFromCache) && online) {
      return 'waiting_to_sync';
    }

    if ((attendanceStats || focusStats) && !attendanceFromCache && !focusFromCache) {
      return 'synced';
    }

    return null;
  }, [
    attendanceFromCache,
    attendanceStats,
    attendanceSyncing,
    focusFromCache,
    focusStats,
    focusSyncing,
    online,
  ]);

  const refresh = () => {
    void Promise.all([refreshAttendance(), refreshFocus()]);
  };

  return (
    <AdminGate>
      <ScrollView
        style={shared.screen}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
      >
        <Text style={styles.eyebrow}>SYSTEM ADMIN</Text>
        <Text style={shared.h1}>BUKLOD Attendance</Text>
        <Text style={shared.muted}>
          Platform-wide attendance usage, scope adoption, and every BUKLOD
          Focus App subscription and analytics.
        </Text>

        {syncStatus ? (
          <View style={styles.syncRow}>
            <BuklodSyncStatusBadge status={syncStatus} compact />
          </View>
        ) : null}

        {showBlockingLoader ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.greenDark} />
            <Text style={shared.muted}>Loading platform overview...</Text>
          </View>
        ) : error ? (
          <Card>
            <Text style={styles.errorTitle}>Overview unavailable</Text>
            <Text style={shared.muted}>{error}</Text>
            <Pressable onPress={refresh} style={styles.retry}>
              <Text style={styles.retryText}>TRY AGAIN</Text>
            </Pressable>
          </Card>
        ) : (
          <>
            <SectionTitle>PLATFORM SNAPSHOT</SectionTitle>
            <View style={styles.metrics}>
              <Metric
                label="ATTENDANCE EVENTS"
                value={attendanceStats?.total_events ?? 0}
              />
              <Metric
                label="OPEN EVENTS"
                value={attendanceStats?.active_events ?? 0}
              />
              <Metric
                label="CHECK-INS (30D)"
                value={attendanceStats?.records_30d ?? 0}
              />
              <Metric
                label="SCOPES USING"
                value={attendanceStats?.scopes_with_events ?? 0}
              />
              <Metric
                label="ACTIVE SUBSCRIPTIONS"
                value={focusStats?.total_active_subscriptions ?? 0}
              />
              <Metric
                label="PENDING PAYMENTS"
                value={focusStats?.total_pending_payments ?? 0}
              />
            </View>

            <SectionTitle>ATTENDANCE REPORTS</SectionTitle>

            <AdminLinkCard
              icon="chart-timeline-variant"
              title="Usage & Analytics"
              subtitle="Events, check-ins, cluster activity and 7/30-day trends"
              path="/admin/attendance/usage"
            />

            <AdminLinkCard
              icon="office-building-marker-outline"
              title="Scope Adoption"
              subtitle="Organizations and clusters actively using BUKLOD Attendance"
              path="/admin/attendance/scopes"
            />

            <AdminLinkCard
              icon="account-cog-outline"
              title="Attendance Operators"
              subtitle="Assign ATTENDANCE_ADMIN roles through Access & Roles"
              path="/admin/foundation-access"
            />

            <SectionTitle>FOCUS APPS</SectionTitle>

            <AdminLinkCard
              icon="apps"
              title="All Focus Apps"
              subtitle="Subscriptions, admins, and per-app usage across the platform"
              path="/admin/attendance/focus-apps"
              badge={focusStats?.total_pending_payments}
            />

            <AdminLinkCard
              icon="cash-check"
              title="Focus App Payments"
              subtitle="Review annual GCash subscription requests for every focus app"
              path="/admin/attendance/focus-apps/payments"
              badge={focusStats?.total_pending_payments}
            />

            <AdminLinkCard
              icon="tune-variant"
              title="Configuration Center"
              subtitle="Workspace buttons, feature flags, and focus app entry points"
              path="/admin/configuration-center"
            />

            <Card>
              <Text style={styles.infoTitle}>About this console</Text>
              <Text style={styles.infoText}>
                Saved data opens instantly offline. Pull down to refresh when
                you are back online. Scope-level attendance reports remain in
                each Organization or Cluster workspace.
              </Text>
            </Card>
          </>
        )}
      </ScrollView>
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    paddingBottom: 50,
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
  loading: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
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
  linkCard: {
    marginBottom: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  linkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.greenSoft,
  },
  linkTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  linkTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
  },
  linkSubtitle: {
    marginTop: 4,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.muted,
  },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.greenDark,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
  },
  infoText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 6,
  },
  retry: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.greenDark,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
});
