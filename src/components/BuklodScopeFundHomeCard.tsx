import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { formatMinorPhp } from '@/lib/buklodCommunityContributionEconomy';

type ScopeFund = {
  scope_id: string;
  scope_type: string;
  fund_source: 'CANONICAL_FUNDED_COMMUNITY_LEDGER';
  available_fund_minor: number;
  reserved_fund_minor: number;
  spent_fund_minor: number;
  member_withdrawal_allowed: false;
  is_member_personal_wallet: false;
};

type Props = { scopeId: string; scopeType: string };
const money = (minor: number | null | undefined) =>
  minor != null && Number.isFinite(minor) ? formatMinorPhp(minor) : 'Unavailable';

/**
 * Membership-scoped fund only. Intentionally never loads personal cash,
 * personal QMP or the gross AdMob revenue report.
 */
export default function BuklodScopeFundHomeCard({ scopeId, scopeType }: Props) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const requestRef = useRef(0);
  const [report, setReport] = useState<{ owner: string; scope: string; value: ScopeFund } | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [retryEpoch, setRetryEpoch] = useState(0);
  const refresh = useCallback(async () => {
    if (!userId) return;
    const req = ++requestRef.current;
    try {
      const { data, error } = await (supabase as any).rpc('get_buklod_scope_revenue_fund_summary_v1', { p_scope_id: scopeId });
      if (req !== requestRef.current) return;
      if (error || !data || data.scope_id !== scopeId || data.fund_source !== 'CANONICAL_FUNDED_COMMUNITY_LEDGER'
        || data.is_member_personal_wallet !== false || data.member_withdrawal_allowed !== false) {
        setReport(null);
        setStatus('failed');
        return;
      }
      setReport({ owner: userId, scope: scopeId, value: data as ScopeFund });
      setStatus('ready');
    } catch {
      if (req === requestRef.current) {
        setReport(null);
        setStatus('failed');
      }
    }
  }, [scopeId, userId]);
  useEffect(() => {
    ++requestRef.current;
    setReport(null);
    setStatus('loading');
    void refresh();
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh();
    });
    return () => { ++requestRef.current; listener.remove(); };
  }, [refresh, retryEpoch]);

  if (!userId) return null;
  const fund = report?.owner === userId && report.scope === scopeId ? report.value : null;
  const label = scopeType === 'CLUSTER' ? 'CLUSTER FUND' : 'ORGANIZATION FUND';
  return (
    <View style={s.card} accessibilityLabel={label + ' · separate community account'}>
      <View style={s.heading}>
        <MaterialCommunityIcons name="account-group-outline" size={21} color="#235C43" />
        <Text style={s.title}>{label}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh this community fund"
          onPress={() => setRetryEpoch(i => i + 1)} style={s.retry}>
          <MaterialCommunityIcons name="refresh" color="#235C43" size={19} />
        </Pressable>
      </View>
      {fund ? (
        <View style={s.values}>
          <View style={s.column}><Text style={s.label}>Available</Text><Text style={s.amount}>{money(fund.available_fund_minor)}</Text></View>
          <View style={s.column}><Text style={s.label}>Reserved</Text><Text style={s.amount}>{money(fund.reserved_fund_minor)}</Text></View>
        </View>
      ) : <Text style={s.hint}>{status === 'loading' ? 'Loading this community fund…' : 'Verified community fund unavailable. Tap refresh to retry.'}</Text>}
      <Text style={s.hint}>This is the community's fund, not a member's personal earnings or withdrawable cash. Payout and personal QMP belong in My Earnings.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 14, borderColor: '#CADFD4', borderWidth: 1, backgroundColor: '#F6FBF7', padding: 13, gap: 10 },
  heading: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  title: { flex: 1, fontSize: 13, color: '#184C34', fontWeight: '900' },
  retry: { padding: 7 },
  values: { flexDirection: 'row', gap: 16 },
  column: { flex: 1, gap: 3 },
  label: { fontSize: 11, fontWeight: '700', color: '#5D7466' },
  amount: { fontSize: 21, fontWeight: '900', color: '#235C43' },
  hint: { fontSize: 11, lineHeight: 16, color: '#5D7466' },
});
