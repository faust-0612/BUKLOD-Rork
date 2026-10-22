import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';

import BuklodScopedWorkspaceScrollView from '@/components/BuklodScopedWorkspaceScrollView';
import { clusterScopeManageRoute } from '@/lib/buklodCluster';
import { loadMyBuklodFinancialSummaryV3 } from '@/lib/buklodEconomyV3';
import { organizationScopeManageRoute } from '@/lib/buklodOrganization';
import { fetchScopeHomeSummary } from '@/lib/buklodScopeMembers';
import { firstScopeRouteParam, readScopeIdFromParams } from '@/lib/buklodScopeManage';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type FundRequest = {
  id: string;
  title: string;
  amountPhp: number;
  status: string;
};

type FundView = {
  tier: string;
  activeContributors: number;
  availablePhp: number;
  reservedPhp: number;
  spentPhp: number;
  requests: FundRequest[];
};

function money(value: number) {
  return `₱${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ScopePlaceManageScreen() {
  const params = useLocalSearchParams();
  const scopeId = readScopeIdFromParams(params as Record<string, unknown>);
  const scopeType = firstScopeRouteParam(params.scopeType).toUpperCase();
  const scopeName = firstScopeRouteParam(params.scopeName);
  const isCluster = scopeType === 'CLUSTER';

  const [loading, setLoading] = useState(true);
  const [isLeader, setIsLeader] = useState(false);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [fund, setFund] = useState<FundView | null>(null);
  const [fundHidden, setFundHidden] = useState(false);
  const [threshold, setThreshold] = useState<number | null>(null);
  const [allocationPct, setAllocationPct] = useState<number | null>(null);
  const [myShare, setMyShare] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!scopeId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const summary = await fetchScopeHomeSummary(scopeId);
      setIsLeader(summary.my_is_admin);
      setMemberCount(summary.total_members);
    } catch {
      setMemberCount(null);
    }

    try {
      const economy = await loadMyBuklodFinancialSummaryV3();
      const community = economy.community;
      if (community?.organization_threshold) {
        setThreshold(community.organization_threshold);
      }
      if (community?.selected && community.scope_id === scopeId) {
        const weight = Number(economy.earnings?.estimated_pool_share_pct ?? 0);
        setAllocationPct(Number(community.allocation_pct ?? 0) || null);
        setMyShare(
          `${Number(economy.progress?.qualified_monthly_points ?? 0).toLocaleString()} qualified points this month · your personal pool share ${weight.toLocaleString(undefined, { maximumFractionDigits: 4 })}%`,
        );
      } else {
        setAllocationPct(null);
        setMyShare(null);
      }
    } catch {
      setMyShare(null);
    }

    try {
      const { data, error } = await (supabase as any).rpc('get_my_buklod_community_fund_v3', {
        p_scope_id: scopeId,
      });
      if (error) throw error;
      const row = (data ?? {}) as Record<string, unknown>;
      const requests = Array.isArray(row.requests) ? row.requests : [];
      setFund({
        tier: String(row.tier ?? 'CLUSTER'),
        activeContributors: Number(row.active_contributors ?? 0) || 0,
        availablePhp: Number(row.available_php ?? 0) || 0,
        reservedPhp: Number(row.reserved_php ?? 0) || 0,
        spentPhp: Number(row.spent_php ?? 0) || 0,
        requests: requests.map((item) => {
          const request = item as Record<string, unknown>;
          return {
            id: String(request.id ?? ''),
            title: String(request.title ?? 'Untitled request'),
            amountPhp: Number(request.amount_php ?? 0) || 0,
            status: String(request.status ?? ''),
          };
        }),
      });
      setFundHidden(false);
    } catch {
      setFund(null);
      setFundHidden(true);
    } finally {
      setLoading(false);
    }
  }, [scopeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openTools = () => {
    if (!scopeId) return;
    const route = isCluster
      ? clusterScopeManageRoute(scopeId, scopeName)
      : organizationScopeManageRoute(scopeId, scopeName);
    router.push(route as any);
  };

  const readyToUpgrade =
    isCluster &&
    fund != null &&
    threshold != null &&
    fund.tier !== 'ORGANIZATION' &&
    fund.activeContributors >= threshold;

  const alreadyOrganizationRate = fund?.tier === 'ORGANIZATION';

  return (
    <>
      <Stack.Screen options={{ title: scopeName ? `Manage · ${scopeName}` : 'Manage' }} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.green} />
        </View>
      ) : (
        <BuklodScopedWorkspaceScrollView contentContainerStyle={styles.content}>
          <View style={[styles.banner, isLeader ? styles.bannerLeader : styles.bannerMember]}>
            <Text style={[styles.bannerTitle, isLeader && styles.onDark]}>{isLeader ? 'Leader view' : 'Member view'}</Text>
            <Text style={[styles.bannerBody, isLeader && styles.onDark]}>
              {isLeader
                ? 'You can manage this place and see the community fund. Members do not see the leader tools or other people\'s personal shares.'
                : 'You can see the member count, the sharing rules, and your own share. Leader tools stay hidden. The community fund opens here only if you chose this place as your community destination.'}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Members</Text>
            <Text style={styles.value}>{memberCount == null ? '—' : memberCount.toLocaleString()}</Text>
            <Text style={styles.note}>This is everyone with a membership here, not only the people who are sharing.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Sharing</Text>
            {fund ? (
              <>
                <Text style={styles.line}>People sharing under the rules: {fund.activeContributors.toLocaleString()}</Text>
                {allocationPct != null ? (
                  <Text style={styles.line}>Community fund rate for this place: {allocationPct.toLocaleString()}%</Text>
                ) : null}
                <Text style={styles.line}>
                  {isCluster
                    ? alreadyOrganizationRate
                      ? 'This cluster is already on the organization sharing rate.'
                      : readyToUpgrade
                        ? `Ready to use the organization sharing rate. ${fund.activeContributors.toLocaleString()} active contributors reached the mark${threshold != null ? ` of ${threshold.toLocaleString()}` : ''}.`
                        : `Not yet on the organization rate. Active contributors are ${fund.activeContributors.toLocaleString()}${threshold != null ? ` of ${threshold.toLocaleString()}` : ''}.`
                    : alreadyOrganizationRate
                      ? 'This organization is on the organization sharing rate.'
                      : 'This organization is still on the cluster sharing rate until enough people are actively contributing.'}
                </Text>
                <Text style={styles.line}>Ready to use: {money(fund.availablePhp)}</Text>
                <Text style={styles.line}>Set aside for a request: {money(fund.reservedPhp)}</Text>
                <Text style={styles.line}>Already used: {money(fund.spentPhp)}</Text>
                {fund.requests.length ? (
                  <View style={styles.requests}>
                    <Text style={styles.line}>Requests to use the fund</Text>
                    {fund.requests.slice(0, 6).map((request) => (
                      <Text key={request.id || request.title} style={styles.note}>
                        {request.title} · {money(request.amountPhp)} · {request.status}
                      </Text>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.note}>No fund request is open for this place yet.</Text>
                )}
              </>
            ) : (
              <Text style={styles.note}>
                {fundHidden
                  ? 'The community fund numbers are hidden here. They open for a leader, or after you choose this place as your community destination.'
                  : 'Sharing numbers are not available yet.'}
              </Text>
            )}
            {myShare ? <Text style={styles.line}>Your own share: {myShare}</Text> : (
              <Text style={styles.note}>Your personal share is not tied to this place yet. Choosing it as your community destination is what connects your sharing here.</Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>How the share is used</Text>
            <Text style={styles.note}>
              A person counts as contributing only after they qualify, turn on sharing, stay active, and choose this place as their community destination. Membership alone does not count.
            </Text>
            <Text style={styles.note}>
              The community fund is not personal money. A member or a leader cannot withdraw it just because they belong here. A leader requests a project with a name, a purpose, an amount, and a date. The people allowed to vote then vote. The money can be used only when enough of them take part and enough of them agree.
            </Text>
            <Text style={styles.note}>
              A cluster uses the lower community rate. It moves to the higher organization rate when the active contributors reach the mark in the sharing rules. If that number later falls and stays down through the waiting period, it can return to the cluster rate.
            </Text>
          </View>

          {isLeader ? (
            <Pressable onPress={openTools} style={styles.tools}>
              <Text style={styles.toolsTitle}>Open leader tools</Text>
              <Text style={styles.toolsBody}>
                Members, roles, invitations, attendance, home content, and the other controls for this {isCluster ? 'cluster' : 'organization'}.
              </Text>
            </Pressable>
          ) : (
            <View style={styles.card}>
              <Text style={styles.label}>Leader tools</Text>
              <Text style={styles.note}>Hidden on the member view. Only a leader of this exact place can open them.</Text>
            </View>
          )}
        </BuklodScopedWorkspaceScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, backgroundColor: '#F4F7F5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F7F5' },
  banner: { borderRadius: 16, padding: 14, gap: 6 },
  bannerLeader: { backgroundColor: '#17324A' },
  bannerMember: { backgroundColor: '#E7F2FC' },
  bannerTitle: { fontSize: 16, fontWeight: '900', color: '#17324A' },
  bannerBody: { fontSize: 13, lineHeight: 19, color: '#17324A' },
  onDark: { color: '#FFFFFF' },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D5E0EA',
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 6,
  },
  label: { color: '#5C6B7A', fontSize: 11, fontWeight: '900', letterSpacing: 0.4 },
  value: { color: '#17324A', fontSize: 28, fontWeight: '900' },
  line: { color: '#17324A', fontSize: 14, lineHeight: 20, fontWeight: '700' },
  note: { color: '#4E6070', fontSize: 13, lineHeight: 19 },
  requests: { gap: 4, marginTop: 4 },
  tools: { borderRadius: 16, backgroundColor: '#146C43', padding: 14, gap: 4 },
  toolsTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  toolsBody: { color: '#E7F8EE', fontSize: 13, lineHeight: 19 },
});
