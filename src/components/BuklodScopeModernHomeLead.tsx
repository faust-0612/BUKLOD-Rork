import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import type { BuklodScope } from '@/lib/buklodScope';
import { scopeRouteParams } from '@/lib/buklodScopeManage';
import {
  fetchScopeHomeSummary,
  type ScopeHomeSummary,
} from '@/lib/buklodScopeMembers';

type Props = {
  scope: BuklodScope;
  onOpenCommunity?: () => void;
  onOpenConnect?: () => void;
};

const BLUE = '#0A63D8';
const BLUE_SOFT = '#EAF2FF';
const TEXT = '#122A43';
const MUTED = '#6A7B90';

export default function BuklodScopeModernHomeLead({
  scope,
  onOpenCommunity,
  onOpenConnect,
}: Props) {
  const [summary, setSummary] = useState<ScopeHomeSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSummary(await fetchScopeHomeSummary(scope.scope_id));
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [scope.scope_id]);

  useEffect(() => {
    void load();
  }, [load]);

  const memberCount =
    summary?.total_members ??
    scope.member_count ??
    0;

  return (
    <View style={styles.wrap}>
      <Text style={styles.tagline}>
        Together in community, connected in purpose.
      </Text>

      <View style={styles.quickRow}>
        <Quick
          icon="account-group-outline"
          label="Community"
          onPress={onOpenCommunity}
        />
        <Quick
          icon="message-text-outline"
          label="Connect"
          onPress={onOpenConnect}
        />
        <Quick
          icon="clipboard-check-outline"
          label="Attendance"
          onPress={() =>
            router.push({
              pathname: '/scope/attendance',
              params: { scopeId: scope.scope_id },
            } as any)
          }
        />
        <Quick
          icon="account-multiple-outline"
          label="Members"
          onPress={() =>
            router.push({
              pathname: '/scope/members',
              params: scopeRouteParams(scope.scope_id, {
                scopeType: scope.scope_type ?? '',
                scopeName: scope.name ?? '',
              }),
            } as any)
          }
        />
      </View>

      <Pressable
        onPress={() =>
          router.push({
            pathname: '/scope/place-manage',
            params: scopeRouteParams(scope.scope_id, {
              scopeType: scope.scope_type ?? '',
              scopeName: scope.name ?? '',
            }),
          } as any)
        }
        style={({ pressed }) => [styles.manage, pressed && { opacity: 0.8 }]}
      >
        <MaterialCommunityIcons name="cog-outline" size={18} color="#FFFFFF" />
        <Text style={styles.manageText}>Manage</Text>
      </Pressable>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>
            {scope.scope_type === 'CLUSTER'
              ? 'Cluster at a Glance'
              : 'Organization at a Glance'}
          </Text>
          {loading ? <ActivityIndicator size="small" color={BLUE} /> : null}
        </View>

        <View style={styles.stats}>
          <Stat
            icon="account-group-outline"
            value={memberCount}
            label="Members"
          />
          <Stat
            icon="account-check-outline"
            value={summary?.active_members ?? '—'}
            label="Active"
          />
          <Stat
            icon="shield-account-outline"
            value={summary?.admin_count ?? '—'}
            label="Leaders"
          />
          <Stat
            icon="briefcase-account-outline"
            value={summary?.functional_role_count ?? '—'}
            label="Roles"
          />
        </View>
      </View>
    </View>
  );
}

function Quick({
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
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.quick,
        pressed && onPress && { opacity: 0.72 },
      ]}
    >
      <View style={styles.quickIcon}>
        <MaterialCommunityIcons
          name={icon}
          size={22}
          color={BLUE}
        />
      </View>
      <Text style={styles.quickText}>{label}</Text>
    </Pressable>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  value: number | string;
  label: string;
}) {
  return (
    <View style={styles.stat}>
      <View style={styles.statIcon}>
        <MaterialCommunityIcons
          name={icon}
          size={20}
          color={BLUE}
        />
      </View>
      <View style={styles.statCopy}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  tagline: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 2,
    textAlign: 'center',
    color: '#315B88',
    fontSize: 11,
    lineHeight: 17,
    fontStyle: 'italic',
    fontWeight: '700',
  },
  quickRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quick: {
    flex: 1,
    minWidth: 0,
    minHeight: 78,
    paddingHorizontal: 5,
    paddingVertical: 9,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2EAF5',
    backgroundColor: '#FFFFFF',
  },
  quickIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BLUE_SOFT,
  },
  manage: {
    marginHorizontal: 14,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: '#17324A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  manageText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  quickText: {
    color: TEXT,
    fontSize: 8.5,
    fontWeight: '900',
    textAlign: 'center',
  },
  sectionCard: {
    padding: 13,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2EAF5',
    backgroundColor: '#FFFFFF',
    shadowColor: '#0B2A4A',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sectionHead: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: TEXT,
    fontSize: 13,
    fontWeight: '900',
  },
  stats: {
    marginTop: 7,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stat: {
    width: '48%',
    minHeight: 64,
    flexGrow: 1,
    padding: 10,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#F7FAFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E7EEF8',
  },
  statIcon: {
    width: 35,
    height: 35,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BLUE_SOFT,
  },
  statCopy: {
    flex: 1,
  },
  statValue: {
    color: TEXT,
    fontSize: 17,
    fontWeight: '900',
  },
  statLabel: {
    marginTop: 1,
    color: MUTED,
    fontSize: 8.5,
    fontWeight: '800',
  },
});
