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
  FOCUS_APP_ADMIN_ICONS,
  fetchFocusAppPlatformStats,
  type FocusAppPlatformAppStats,
  type FocusAppPlatformStats,
} from '@/lib/admin/buklodFocusAppAdmin';
import {
  adminFocusAppPlatformStatsCacheKey,
  type BuklodSyncStatus,
} from '@/lib/buklodOfflineSync';
import { colors } from '@/lib/theme';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function FocusAppCard({ app }: { app: FocusAppPlatformAppStats }) {
  const icon =
    (FOCUS_APP_ADMIN_ICONS[app.focus_app_code] as IconName | undefined) ??
    'puzzle-outline';

  return (
    <Card>
      <View style={styles.appHeader}>
        <View style={styles.appIcon}>
          <MaterialCommunityIcons
            name={icon}
            size={22}
            color={colors.greenDark}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.appTitle}>{app.display_name}</Text>
          <Text style={styles.appMeta}>
            ₱{app.annual_amount_php.toFixed(0)} / year
            {!app.is_active ? ' · Inactive catalog' : ''}
          </Text>
        </View>
        {app.pending_payments > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{app.pending_payments}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.statsRow}>
        <Text style={styles.stat}>{app.active_subscriptions} active</Text>
        <Text style={styles.stat}>{app.total_admins} admins</Text>
        <Text style={styles.stat}>
          {app.approved_payments_30d} approved (30d)
        </Text>
      </View>
    </Card>
  );
}

export default function AdminFocusAppsScreen() {
  const {
    data: stats,
    loading,
    refreshing,
    syncing,
    fromCache,
    online,
    refresh,
    error,
  } = useBuklodOfflineCache<FocusAppPlatformStats | null>({
    cacheKey: adminFocusAppPlatformStatsCacheKey(),
    fetcher: fetchFocusAppPlatformStats,
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
        <Text style={shared.h1}>All Focus Apps</Text>
        <Text style={shared.muted}>
          Annual subscriptions, admins, and usage for every BUKLOD Focus App.
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
            <Text style={shared.h2}>Analytics unavailable</Text>
            <Text style={shared.muted}>{error}</Text>
          </Card>
        ) : stats ? (
          <>
            <SectionTitle>PLATFORM TOTALS</SectionTitle>
            <View style={styles.totals}>
              <View style={styles.totalCard}>
                <Text style={styles.totalValue}>
                  {stats.total_active_subscriptions}
                </Text>
                <Text style={styles.totalLabel}>ACTIVE SUBSCRIPTIONS</Text>
              </View>
              <View style={styles.totalCard}>
                <Text style={styles.totalValue}>
                  {stats.total_pending_payments}
                </Text>
                <Text style={styles.totalLabel}>PENDING PAYMENTS</Text>
              </View>
              <View style={styles.totalCard}>
                <Text style={styles.totalValue}>
                  {stats.total_focus_app_admins}
                </Text>
                <Text style={styles.totalLabel}>FOCUS APP ADMINS</Text>
              </View>
            </View>

            <Pressable
              onPress={() =>
                router.push('/admin/attendance/focus-apps/payments' as any)
              }
              style={styles.paymentsLink}
            >
              <MaterialCommunityIcons
                name="cash-check"
                size={20}
                color={colors.greenDark}
              />
              <Text style={styles.paymentsLinkText}>
                REVIEW PENDING PAYMENTS
              </Text>
            </Pressable>

            <SectionTitle>PER APP ANALYTICS</SectionTitle>
            {stats.apps.map((app) => (
              <FocusAppCard key={app.focus_app_code} app={app} />
            ))}
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
  totals: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  totalCard: {
    width: '30%',
    minWidth: 100,
    flexGrow: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.greenDark,
  },
  totalLabel: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: '800',
    color: colors.muted,
  },
  paymentsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.greenSoft,
  },
  paymentsLinkText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.greenDark,
  },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  appIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.greenSoft,
  },
  appTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
  },
  appMeta: {
    marginTop: 3,
    fontSize: 11,
    color: colors.muted,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  stat: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.greenDark,
  },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.greenDark,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
  },
});
