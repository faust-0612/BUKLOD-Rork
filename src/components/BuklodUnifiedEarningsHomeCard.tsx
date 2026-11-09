import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import {
  formatMinorPhp,
  formatCommunityPoolPercent,
  formatCommunitySharePercent,
  getCommunityRevenueBreakdown,
  loadMyCommunityContribution,
  type CommunityContributionDashboard,
} from '@/lib/buklodCommunityContributionEconomy';

// No recipient ID is accepted: all personal values come from auth.uid()-scoped RPCs.
// Scope funds have separate server-enforced active-membership authorization.
type CashReport = {
  identity_ready: boolean;
  latest_period_key?: string | null;
  latest_finalized?: { user_pool_php?: number; first_line_php?: number };
  lifetime_earned?: {
    user_pool_php?: number;
    first_line_php?: number;
    referral_reward_php?: number;
    total_php?: number;
  };
  cash_status?: { available_php?: number; reserved_php?: number; paid_php?: number };
  points_used_for_cash?: boolean;
};
type ScopeFund = {
  scope_id: string;
  scope_type: string;
  fund_source: 'CANONICAL_FUNDED_COMMUNITY_LEDGER';
  policy_allocation_bps: number;
  available_fund_minor: number;
  reserved_fund_minor: number;
  spent_fund_minor: number;
  member_withdrawal_allowed: false;
  is_member_personal_wallet: false;
  economics_enabled: boolean;
};
type Props = { scopeId?: string | null; scopeType?: string | null; compact?: boolean };

const php = (value: number | undefined | null) =>
  value == null || !Number.isFinite(value)
    ? 'Unavailable'
    : formatMinorPhp(Math.round(value * 100));

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statTitle}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export default function BuklodUnifiedEarningsHomeCard({ scopeId, scopeType, compact = true }: Props) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const serial = useRef(0);
  const [cash, setCash] = useState<CashReport | null>(null);
  const [contribution, setContribution] = useState<CommunityContributionDashboard | null>(null);
  const [scopeFund, setScopeFund] = useState<ScopeFund | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [retries, setRetries] = useState(0);

  const load = useCallback(async () => {
    const id = ++serial.current;
    if (!userId) {
      setCash(null); setContribution(null); setScopeFund(null);
      setLoading(false); return;
    }
    setLoading(true);
    const [personal, community, group] = await Promise.allSettled([
      (supabase as any).rpc('get_my_buklod_financial_earnings_breakdown_v1'),
      loadMyCommunityContribution(),
      scopeId
        ? (supabase as any).rpc('get_buklod_scope_revenue_fund_summary_v1', { p_scope_id: scopeId })
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (id !== serial.current) return;
    const issues: string[] = [];
    if (personal.status === 'fulfilled' && !personal.value.error && personal.value.data?.identity_ready === true) {
      setCash(personal.value.data as CashReport);
    } else {
      setCash(null);
      issues.push('Finalized cash summary unavailable');
    }
    if (community.status === 'fulfilled') setContribution(community.value);
    else {
      setContribution(null);
      issues.push('Community revenue estimate unavailable');
    }
    if (!scopeId) setScopeFund(null);
    else if (group.status === 'fulfilled' && !group.value.error
      && group.value.data?.scope_id === scopeId
      && group.value.data?.fund_source === 'CANONICAL_FUNDED_COMMUNITY_LEDGER') {
      setScopeFund(group.value.data as ScopeFund);
    } else {
      setScopeFund(null);
      issues.push('Scope fund summary unavailable');
    }
    setErrors(issues);
    setLoading(false);
  }, [userId, scopeId]);

  useEffect(() => {
    ++serial.current;
    setCash(null); setContribution(null); setScopeFund(null); setErrors([]);
    void load();
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') void load();
    });
    return () => {
      ++serial.current;
      listener.remove();
    };
  }, [load, retries]);

  if (!userId) return null;
  const breakdown = contribution ? getCommunityRevenueBreakdown(contribution) : null;
  const estimate = contribution?.estimated_share_minor == null
    ? 'Source not available'
    : contribution.estimate_below_cent ? 'Below ₱0.01' : formatMinorPhp(contribution.estimated_share_minor);
  const activeProvisional = contribution?.estimate_status === 'PROVISIONAL_ADMOB';
  const available = cash?.cash_status?.available_php;
  const scopeIsSupported = !scopeType || ['ORGANIZATION', 'CLUSTER', 'SUB_ORGANIZATION'].includes(scopeType.toUpperCase());

  return (
    <View style={styles.shell} accessibilityLabel="Your private BUKLOD earnings and withdrawal summary">
      <View style={styles.header}>
        <MaterialCommunityIcons name="cash-multiple" size={19} color="#205741" />
        <View style={styles.heading}>
          <Text style={styles.title}>MY EARNINGS & WITHDRAWAL</Text>
          <Text style={styles.sub}>Personal account only · separate from Organization/Cluster funds</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh earnings"
          onPress={() => setRetries(v => v + 1)} style={styles.reload}>
          <MaterialCommunityIcons name="refresh" size={17} color="#205741" />
        </Pressable>
      </View>

      {loading && !cash && !contribution ? <Text style={styles.note}>Loading verified private earnings…</Text> : null}

      {cash ? (
        <View style={styles.cashBox}>
          <Stat label="ACCUMULATED AVAILABLE CASH" value={php(available)} />
          <Text style={styles.note}>Finalized cash carries across months until withdrawn. A withdrawal request moves available cash into reserved; paid withdrawals remain in lifetime earnings.</Text>
          <View style={styles.cashRow}>
            <Stat label="Reserved for payout" value={php(cash.cash_status?.reserved_php)} />
            <Stat label="Already paid" value={php(cash.cash_status?.paid_php)} />
          </View>
          <Stat label="LIFETIME FINALIZED EARNINGS" value={php(cash.lifetime_earned?.total_php)} />
          {!compact ? (
            <View style={styles.cashRow}>
              <Stat label="Lifetime finalized user pool" value={php(cash.lifetime_earned?.user_pool_php)} />
              <Stat label="Lifetime referral / first-line" value={php(
                Number(cash.lifetime_earned?.first_line_php ?? 0) +
                Number(cash.lifetime_earned?.referral_reward_php ?? 0)
              )} />
            </View>
          ) : (
            <Text style={styles.note}>Finalized revenue-share and funded referral rewards use the same canonical cash wallet. Points are excluded.</Text>
          )}
        </View>
      ) : !loading ? <Text style={styles.warning}>Cash report unavailable. No withdrawable amount is assumed.</Text> : null}

      <View style={styles.estimateBox}>
        <Text style={styles.category}>THIS MONTH · PRELIMINARY COMMUNITY REVENUE SHARE</Text>
        <Text style={styles.estimateValue}>{activeProvisional ? estimate : 'No fresh estimate'}</Text>
        {breakdown ? (
          <>
            <Text style={styles.note}>AdMob (100%): {formatMinorPhp(breakdown.grossMinor)} · Community pool ({formatCommunityPoolPercent(breakdown.poolBps)}): {formatMinorPhp(breakdown.poolMinor)}</Text>
            <Text style={styles.note}>Your QMP weight: {formatCommunitySharePercent(breakdown.memberPoolFraction)} of Community pool</Text>
          </>
        ) : null}
        <Text style={styles.warning}>Current-month estimate only. Not finalized, funded, or withdrawable; historical finalized cash carries forward separately.</Text>
      </View>

      {scopeId && scopeIsSupported ? (
        <View style={styles.scopeBox}>
          <Text style={styles.category}>THIS {scopeType?.toUpperCase() ?? 'SCOPE'} FUND · SEPARATE ACCOUNT</Text>
          {scopeFund ? (
            <>
              <View style={styles.cashRow}>
                <Stat label="Fund available" value={formatMinorPhp(scopeFund.available_fund_minor)} />
                <Stat label="Reserved" value={formatMinorPhp(scopeFund.reserved_fund_minor)} />
              </View>
              <Text style={styles.note}>Policy allocation: {formatCommunityPoolPercent(scopeFund.policy_allocation_bps)} · This fund belongs to the scope, not to individual members.</Text>
              <Text style={styles.warning}>Not transferable to a member's personal withdrawal without an authorized, funded transaction.</Text>
            </>
          ) : <Text style={styles.note}>No verified member-accessible fund summary.</Text>}
        </View>
      ) : null}

      {errors.length > 0 ? <Text style={styles.warning}>{errors.join(' · ')} · Refresh to retry.</Text> : null}
      <View style={styles.actions}>
        <Pressable accessibilityRole="button"
          accessibilityLabel="Open unified cash payout and withdrawal"
          onPress={() => router.push('/bayanihan/payout-profile' as any)}
          style={styles.primary}>
          <Text style={styles.primaryText}>PAYOUT / WITHDRAWAL</Text>
        </Pressable>
        <Pressable accessibilityRole="button"
          accessibilityLabel="Open detailed revenue sharing"
          onPress={() => router.push('/community-contribution' as any)}
          style={styles.secondary}>
          <Text style={styles.secondaryText}>SHARING DETAILS</Text>
        </Pressable>
      </View>
      <Text style={styles.disclaimer}>One payout request reserves only available finalized cash. System Admin reward transfers require separate verified funding; no manual claim converts points into cash.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { borderRadius: 14, borderWidth: 1, borderColor: '#CEE3D5', backgroundColor: '#FFFFFF', padding: 12, gap: 9 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  heading: { flex: 1 },
  title: { fontSize: 11, fontWeight: '900', color: '#184C34' },
  sub: { marginTop: 2, fontSize: 8.5, lineHeight: 13, color: '#67766C' },
  reload: { padding: 8, borderRadius: 8, backgroundColor: '#EAF5EE' },
  cashBox: { padding: 10, gap: 6, backgroundColor: '#EAF5EE', borderRadius: 11 },
  cashRow: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, gap: 2 },
  statTitle: { fontSize: 8, fontWeight: '800', color: '#566B5D' },
  statValue: { fontSize: 15, fontWeight: '900', color: '#145037' },
  estimateBox: { borderRadius: 11, padding: 10, gap: 4, backgroundColor: '#F2F6FF' },
  estimateValue: { fontSize: 16, fontWeight: '900', color: '#24466A' },
  scopeBox: { borderWidth: 1, borderColor: '#DCE8E2', borderRadius: 11, padding: 10, gap: 6 },
  category: { fontSize: 8.5, fontWeight: '900', color: '#355B49' },
  note: { fontSize: 9, lineHeight: 14, color: '#5C6D63' },
  warning: { fontSize: 8.5, lineHeight: 13, color: '#895F29' },
  actions: { flexDirection: 'row', gap: 7 },
  primary: { flex: 1, borderRadius: 9, paddingVertical: 11, paddingHorizontal: 5, backgroundColor: '#1E6B45', alignItems: 'center' },
  primaryText: { fontSize: 8, fontWeight: '900', color: '#FFFFFF' },
  secondary: { flex: 1, borderRadius: 9, borderWidth: 1, borderColor: '#91B7A0', paddingVertical: 11, paddingHorizontal: 4, alignItems: 'center' },
  secondaryText: { fontSize: 8, fontWeight: '900', color: '#1E6B45' },
  disclaimer: { fontSize: 8, lineHeight: 12, color: '#72786D' },
});
