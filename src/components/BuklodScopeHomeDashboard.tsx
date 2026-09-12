import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import BuklodHomeFaithPanel from '@/components/BuklodHomeFaithPanel';
import BuklodScopeBuklodLessonPanel from '@/components/BuklodScopeBuklodLessonPanel';
import BuklodScopeFaithMonitoringSummary from '@/components/BuklodScopeFaithMonitoringSummary';
import BuklodHomeScopeBulletins from '@/components/BuklodHomeScopeBulletins';
import BuklodScopeActionCenterSlot from '@/components/BuklodScopeActionCenterSlot';
import BuklodScopeAttendanceCard from '@/components/BuklodScopeAttendanceCard';
import BuklodMzbHomeWidgets from '@/components/BuklodMzbHomeWidgets';
import BuklodOrgHomeClusterCard from '@/components/BuklodOrgHomeClusterCard';
import BuklodOrgHomeBayanihanCard from '@/components/BuklodOrgHomeBayanihanCard';
import BuklodReportDoorCard from '@/components/BuklodReportDoorCard';
import BuklodScreenBottomBanner from '@/components/BuklodScreenBottomBanner';
import { useBuklodAccess } from '@/hooks/useBuklodAccess';
import { useScreenFocused } from '@/hooks/useScreenFocused';
import {
  useBuklodScrollBottomInset,
} from '@/lib/buklodSafeArea';
import {
  fetchScopeHomeSummary,
  type ScopeHomeSummary,
} from '@/lib/buklodScopeMembers';
import { scopeHomeCacheKey } from '@/lib/buklodOfflineSync';
import { SCALE_LIMITS } from '@/lib/performanceScale';
import { useBuklodOfflineCache } from '@/hooks/useBuklodOfflineCache';
import {
  formatScopeTypeLabel,
  isSubOrganizationScope,
  type BuklodScope,
} from '@/lib/buklodScope';
import {
  scopeManageRoute,
  scopeRouteParams,
} from '@/lib/buklodScopeManage';
import { isMzbOrganizationScope } from '@/lib/buklodMzbOrganization';
import { colors } from '@/lib/theme';

type Props = {
  scope: BuklodScope;
  onOpenCommunity?: () => void;
  onOpenConnect?: () => void;
};

function homeSubtitle(scope: BuklodScope) {
  if (scope.scope_type === 'CLUSTER') return 'Your Cluster Home';
  if (scope.scope_type === 'CHURCH' || scope.scope_type === 'LOCAL') {
    return 'Your Location Home';
  }

  if (isSubOrganizationScope(scope)) {
    return 'Your Sub-organization Home';
  }

  if (scope.scope_type === 'ORGANIZATION') {
    return 'Your Organization Home';
  }

  return 'Your BUKLOD Home';
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

type ScopeHomeCache = {
  summary: ScopeHomeSummary;
};

export default function BuklodScopeHomeDashboard({
  scope,
  onOpenCommunity,
  onOpenConnect,
}: Props) {
  const { isExactScopeAdmin, isSystemAdmin } = useBuklodAccess();
  const isFocused = useScreenFocused();

  const {
    data: homeCache,
    loading,
    refreshing,
    error: loadError,
    refresh,
  } = useBuklodOfflineCache<ScopeHomeCache>({
    cacheKey: scopeHomeCacheKey(scope.scope_id),
    enabled: isFocused,
    fetcher: async () => {
      const summary = await fetchScopeHomeSummary(scope.scope_id);

      return { summary };
    },
    refreshIntervalMs: isFocused
      ? SCALE_LIMITS.offlineBackgroundRefreshMs
      : undefined,
  });

  const summary = homeCache?.summary ?? null;

  const showAdminSummary =
    scope.is_admin || isExactScopeAdmin || isSystemAdmin;

  const isMzbScope = isMzbOrganizationScope(scope);

  const scopeTypeLabel = formatScopeTypeLabel(
    scope.scope_type,
    scope.geo_level,
    scope.parent_scope_id
  );

  const load = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const actionItems = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      subtitle?: string;
      tone?: 'default' | 'warning' | 'critical';
    }> = [];

    if (showAdminSummary && summary && summary.pending_join_requests > 0) {
      items.push({
        id: 'join-requests',
        title: `${summary.pending_join_requests} pending join request(s)`,
        subtitle: 'Review membership requests in Manage.',
        tone: 'warning',
      });
    }

    return items;
  }, [showAdminSummary, summary]);

  const scrollBottomInset =
    useBuklodScrollBottomInset({
      extra: 12,
    });

  if (loading && !homeCache) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.green} />
        <Text style={styles.loadingText}>Loading scope home...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom: scrollBottomInset,
        },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            void load();
          }}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.heroType}>
          {scopeTypeLabel}
          {scope.geo_level ? ` · ${scope.geo_level}` : ''}
        </Text>
        <Text style={styles.heroTitle}>{scope.name}</Text>
        <Text style={styles.heroText}>{homeSubtitle(scope)}</Text>
      </View>

      {loadError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{loadError}</Text>
          <Pressable onPress={() => void load()} style={styles.retry}>
            <Text style={styles.retryText}>RETRY</Text>
          </Pressable>
        </View>
      ) : null}

      {scope.scope_type === 'ORGANIZATION' ? (
        <>
          <BuklodOrgHomeClusterCard organizationId={scope.scope_id} />
          <BuklodOrgHomeBayanihanCard />
          <BuklodReportDoorCard
            scopeId={scope.scope_id}
            scopeName={scope.name}
            scopeType="ORGANIZATION"
          />
        </>
      ) : null}

      {showAdminSummary && summary ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ADMIN SUMMARY</Text>
          <View style={styles.statRow}>
            <StatCard label="MEMBERS" value={summary.total_members} />
            <StatCard label="ACTIVE" value={summary.active_members} />
            <StatCard label="ADMINS" value={summary.admin_count} />
            <StatCard label="ROLES" value={summary.functional_role_count} />
          </View>
          {summary.pending_join_requests > 0 ? (
            <Text style={styles.pending}>
              Pending join requests: {summary.pending_join_requests}
            </Text>
          ) : null}
        </View>
      ) : null}

      <BuklodScopeActionCenterSlot items={actionItems} />

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>MY ROLE(S)</Text>
        </View>
        {summary?.my_functional_roles.length ? (
          <View style={styles.roleChips}>
            {summary.my_functional_roles.map((role) => (
              <View key={role.id} style={styles.roleChip}>
                <Text style={styles.roleChipText}>{role.name}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.muted}>
            No functional role assigned yet in this scope.
          </Text>
        )}
        <Text style={styles.accessLine}>
          Access:{' '}
          {summary?.my_is_admin || scope.is_admin ? 'ADMIN' : 'MEMBER'}
        </Text>
      </View>

      {isMzbScope ? (
        <BuklodMzbHomeWidgets
          scope={scope}
          onOpenCommunity={onOpenCommunity}
        />
      ) : null}

      {scope.show_faith_content ? (
        <>
          <BuklodScopeFaithMonitoringSummary scope={scope} />
          <BuklodScopeBuklodLessonPanel scope={scope} />
          <BuklodHomeFaithPanel scopeId={scope.scope_id} />
        </>
      ) : null}

      <BuklodHomeScopeBulletins />
      <BuklodScopeAttendanceCard
        scopeId={scope.scope_id}
        scopeType={scope.scope_type}
      />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>QUICK LINKS</Text>
        <View style={styles.quickGrid}>
          <QuickLink
            icon="account-group-outline"
            label="Community"
            onPress={onOpenCommunity}
          />
          <QuickLink
            icon="message-text-outline"
            label="Connect"
            onPress={onOpenConnect}
          />
          <QuickLink
            icon="clipboard-check-outline"
            label="Attendance"
            onPress={() =>
              router.push({
                pathname: '/scope/attendance',
                params: scopeRouteParams(scope.scope_id),
              } as any)
            }
          />
          {showAdminSummary ? (
            <>
              <QuickLink
                icon="shield-crown-outline"
                label="Manage"
                onPress={() =>
                  router.push(scopeManageRoute(scope) as any)
                }
              />
              {scope.scope_type === 'ORGANIZATION' ? (
                <>
                  <QuickLink
                    icon="account-group-outline"
                    label="Clusters"
                    onPress={() =>
                      router.push({
                        pathname: '/organizations/clusters-oversight',
                        params: { organizationId: scope.scope_id },
                      } as any)
                    }
                  />
                  <QuickLink
                    icon="swap-horizontal"
                    label="Org access"
                    onPress={() =>
                      router.push({
                        pathname: '/organizations/cross-access',
                        params: { organizationId: scope.scope_id },
                      } as any)
                    }
                  />
                </>
              ) : null}
            </>
          ) : null}
        </View>
      </View>

      <BuklodScreenBottomBanner placement="home" variant="large" />
    </ScrollView>
  );
}

function QuickLink({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.quick,
        !onPress && styles.quickDisabled,
        pressed && onPress && styles.pressed,
      ]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={20}
        color={colors.greenDark}
      />
      <Text style={styles.quickText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 12,
  },
  loading: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 12,
  },
  hero: {
    gap: 4,
    paddingVertical: 4,
  },
  heroType: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroTitle: {
    color: '#173B2F',
    fontSize: 24,
    fontWeight: '900',
  },
  heroText: {
    color: '#5F6F67',
    fontSize: 12,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 10,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    color: '#173B2F',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCard: {
    minWidth: 72,
    borderRadius: 12,
    backgroundColor: '#F4F7F5',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  statValue: {
    color: '#173B2F',
    fontSize: 18,
    fontWeight: '900',
  },
  statLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  pending: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: '700',
  },
  roleChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  roleChip: {
    borderRadius: 999,
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  roleChipText: {
    color: '#176B4A',
    fontSize: 11,
    fontWeight: '800',
  },
  accessLine: {
    color: '#4B5D54',
    fontSize: 11,
    fontWeight: '700',
  },
  muted: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  link: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  linkText: {
    color: colors.greenDark,
    fontSize: 11,
    fontWeight: '900',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quick: {
    width: '47%',
    minHeight: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#F8FAF9',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 10,
  },
  quickDisabled: {
    opacity: 0.45,
  },
  quickText: {
    color: '#173B2F',
    fontSize: 11,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.72,
  },
  errorCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    padding: 12,
    gap: 8,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 12,
    lineHeight: 18,
  },
  retry: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  retryText: {
    color: '#991B1B',
    fontSize: 10,
    fontWeight: '900',
  },
});