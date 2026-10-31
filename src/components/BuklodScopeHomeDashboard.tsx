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
import BuklodNonFaithEncouragementDoor from '@/components/BuklodNonFaithEncouragementDoor';
import BuklodScopeBuklodLessonPanel from '@/components/BuklodScopeBuklodLessonPanel';
import BuklodScopeFaithMonitoringDoor from '@/components/BuklodScopeFaithMonitoringDoor';
import BuklodHomeScopeBulletins from '@/components/BuklodHomeScopeBulletins';
import BuklodScopeActionCenterSlot from '@/components/BuklodScopeActionCenterSlot';
import BuklodScopeAttendanceCard from '@/components/BuklodScopeAttendanceCard';
import BuklodMzbHomeWidgets from '@/components/BuklodMzbHomeWidgets';
import BuklodOrgHomeClusterCard from '@/components/BuklodOrgHomeClusterCard';
import BuklodOrgHomeBayanihanCard from '@/components/BuklodOrgHomeBayanihanCard';
import BuklodScreenBottomBanner from '@/components/BuklodScreenBottomBanner';
import BuklodFirstViewAd from '@/components/BuklodFirstViewAd';
import BuklodNativeSponsoredCard from '@/components/BuklodNativeSponsoredCard';
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
      {/* BUKLOD_V28_ORG_HOME_BLUE_R1: Quick Links exclude Community/Connect. */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>QUICK LINKS</Text>
        <View style={styles.quickGrid}>
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


      <BuklodFirstViewAd
        placement={scope.scope_type === 'CLUSTER' ? 'cluster' : 'org'}
        placementId={scope.scope_type === 'CLUSTER' ? 'cluster_scope_home_first_view' : 'organization_scope_home_first_view'}
      />

      {loading && !homeCache ? (
        <View style={styles.card}>
          <ActivityIndicator color="#0874DE" />
          <Text style={styles.loadingText}>Loading Organization details; available actions can be opened now.</Text>
        </View>
      ) : null}

      {loadError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{loadError}</Text>
          <Pressable onPress={() => void load()} style={styles.retry}>
            <Text style={styles.retryText}>RETRY</Text>
          </Pressable>
        </View>
      ) : null}

      {scope.scope_type === 'ORGANIZATION' ? (
        <View style={styles.homePair}>
          <View style={styles.homePairItem}><BuklodOrgHomeClusterCard organizationId={scope.scope_id} /></View>
          <View style={styles.homePairItem}><BuklodOrgHomeBayanihanCard /></View>
        </View>
      ) : null}

      {showAdminSummary ? (
      <View style={styles.homePair}>
        <View style={styles.homePairItem}>
      {summary ? (
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

        </View>
        <View style={styles.homePairItem}><BuklodScopeActionCenterSlot items={actionItems} /></View>
      </View>
      ) : null}

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

      {scope.show_faith_content ? (
        <>
          <View style={styles.homePair}>
            <View style={styles.homePairItem}><BuklodScopeFaithMonitoringDoor scope={scope} /></View>
            <View style={styles.homePairItem}><BuklodScopeBuklodLessonPanel scope={scope} /></View>
          </View>
          <BuklodHomeFaithPanel scopeId={scope.scope_id} compact />
        </>
      ) : <BuklodNonFaithEncouragementDoor />}

      <BuklodHomeScopeBulletins />
      <BuklodNativeSponsoredCard
        surface="cluster_dashboard"
        slotId={`scope-home-native-media:${scope.scope_id}`}
      />
      <BuklodScopeAttendanceCard
        scopeId={scope.scope_id}
        scopeType={scope.scope_type}
      />

      {isMzbScope ? (
        <BuklodMzbHomeWidgets scope={scope} onOpenCommunity={onOpenCommunity} />
      ) : null}



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
  const tones: Record<string, {background: string; foreground: string}> = {
    Attendance: {background:'#E6F2FF',foreground:'#0874DE'},
    Manage: {background:'#E6F8EF',foreground:'#15995C'},
    Clusters: {background:'#F0E9FD',foreground:'#8452DC'},
    'Org access': {background:'#FFF2E2',foreground:'#DD8618'},
  };
  const tone = tones[label] ?? tones.Attendance;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.quick,
        { backgroundColor: tone.background },
        !onPress && styles.quickDisabled,
        pressed && onPress && styles.pressed,
      ]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={20}
        color={tone.foreground}
      />
      <Text style={styles.quickText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Paired panels wrap below 350dp; nothing can overflow the phone viewport.
  /* BUKLOD_V28_R3_PHONE_SINGLE_COLUMN: prevents 166px child width from vertically breaking text. */
  homePair: { flexDirection: 'column', alignItems: 'stretch', gap: 9, width: '100%' },
  homePairItem: { width: '100%', minWidth: 0, flexShrink: 0 },
  content: {
    paddingHorizontal: 10,
    paddingTop: 9,
    paddingBottom: 28,
    gap: 9,
    backgroundColor: '#F2F7FD',
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
    borderColor: '#E1EBF7',
    backgroundColor: '#FFFFFF',
    padding: 11,
    gap: 9,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    color: '#113C72',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCard: {
    minWidth: 72,
    borderRadius: 12,
    backgroundColor: '#EAF4FF',
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
    backgroundColor: '#E6F2FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  roleChipText: {
    color: '#1262AC',
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
    width: '22%',
    minWidth: 68,
    flexGrow: 1,
    minHeight: 64,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#DCEAF9',
    backgroundColor: '#EAF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 10,
  },
  quickDisabled: {
    opacity: 0.45,
  },
  quickText: {
    color: '#164675',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
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
