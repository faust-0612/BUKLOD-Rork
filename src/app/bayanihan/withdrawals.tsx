import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import { shared } from '@/components/UI';
import { formatPhp } from '@/lib/buklodR38Economy';
import {
  cancelMyBuklodWithdrawalV3,
  loadMyBuklodWithdrawalsV3,
  type BuklodWithdrawalHistoryV3,
} from '@/lib/buklodEconomyV3';

function statusIcon(status: string): React.ComponentProps<typeof MaterialCommunityIcons>['name'] {
  switch (status) {
    case 'PAID': return 'check-circle-outline';
    case 'APPROVED': return 'check-decagram-outline';
    case 'PROCESSING': return 'progress-clock';
    case 'REJECTED': return 'close-circle-outline';
    case 'CANCELLED': return 'cancel';
    case 'FAILED': return 'alert-circle-outline';
    default: return 'clock-outline';
  }
}

export default function BuklodWithdrawalHistoryScreen() {
  const [history, setHistory] = useState<BuklodWithdrawalHistoryV3 | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setHistory(await loadMyBuklodWithdrawalsV3());
    } catch (nextError: unknown) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load withdrawal history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const cancelRequest = (id: string, amount: number) => {
    Alert.alert(
      'Cancel Withdrawal?',
      `${formatPhp(amount)} will be released back to your available finalized BUKLOD Economy cash. Points are not affected.`,
      [
        { text: 'Keep Request', style: 'cancel' },
        {
          text: 'Cancel Withdrawal',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusyId(id);
              try {
                await cancelMyBuklodWithdrawalV3(id);
                await load();
                Alert.alert('Withdrawal Cancelled', 'Reserved finalized cash was released back to available cash.');
              } catch (nextError: unknown) {
                Alert.alert('Withdrawal', nextError instanceof Error ? nextError.message : 'Could not cancel withdrawal.');
              } finally {
                setBusyId(null);
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <BuklodPortalScrollView
      style={shared.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <Pressable onPress={() => router.back()} style={styles.backRow}>
        <MaterialCommunityIcons name="arrow-left" size={19} color="#275D45" />
        <Text style={styles.backText}>BACK</Text>
      </Pressable>

      <View style={styles.hero}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>BUKLOD ECONOMY WITHDRAWALS</Text>
          <Text style={styles.title}>Withdrawal History</Text>
          <Text style={styles.subtitle}>
            Finalized withdrawable BUKLOD Economy cash only. Destinations remain masked and BUKLOD Points are never converted or deducted.
          </Text>
        </View>
        <MaterialCommunityIcons name="history" size={29} color="#275D45" />
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color="#275D45" />
          <Text style={styles.muted}>Loading withdrawal history...</Text>
        </View>
      ) : error ? (
        <View style={styles.loadingCard}>
          <Text style={styles.errorTitle}>History unavailable</Text>
          <Text style={styles.muted}>{error}</Text>
          <Pressable onPress={() => void load()} style={styles.primaryBtn}>
            <Text style={styles.primaryText}>TRY AGAIN</Text>
          </Pressable>
        </View>
      ) : history?.rows.length ? (
        <View style={styles.list}>
          {history.rows.map((row) => {
            const canCancel = ['REQUESTED', 'UNDER_REVIEW'].includes(row.status);
            return (
              <View key={row.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.statusIcon}>
                    <MaterialCommunityIcons name={statusIcon(row.status)} size={19} color="#275D45" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.amount}>{formatPhp(row.requested_amount)}</Text>
                    <Text style={styles.status}>{row.status.replace(/_/g, ' ')}</Text>
                  </View>
                  <Text style={styles.date}>{new Date(row.requested_at).toLocaleDateString('en-PH')}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Payout</Text>
                  <Text style={styles.detailValue}>{row.payout_method || '—'} · {row.payout_destination_masked || '—'}</Text>
                </View>
                {row.payout_transaction_ref ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Transaction</Text>
                    <Text style={styles.detailValue}>{row.payout_transaction_ref}</Text>
                  </View>
                ) : null}
                {row.rejection_reason ? <Text style={styles.reason}>Reason: {row.rejection_reason}</Text> : null}
                {row.failure_reason ? <Text style={styles.reason}>Failure: {row.failure_reason}</Text> : null}

                {canCancel ? (
                  <Pressable
                    disabled={busyId === row.id}
                    onPress={() => cancelRequest(row.id, row.requested_amount)}
                    style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.72 }, busyId === row.id && { opacity: 0.55 }]}
                  >
                    {busyId === row.id ? <ActivityIndicator color="#7C3B35" /> : <MaterialCommunityIcons name="close-circle-outline" size={16} color="#7C3B35" />}
                    <Text style={styles.cancelText}>CANCEL WITHDRAWAL</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <MaterialCommunityIcons name="bank-transfer-out" size={30} color="#87928C" />
          <Text style={styles.emptyTitle}>No withdrawals yet</Text>
          <Text style={styles.muted}>
            A withdrawal can exist only after finalized withdrawable cash is available and the canonical withdrawal gate is enabled.
          </Text>
          <Pressable onPress={() => router.push('/bayanihan/payout-profile' as any)} style={styles.primaryBtn}>
            <Text style={styles.primaryText}>OPEN PAYOUT PROFILE</Text>
          </Pressable>
        </View>
      )}
    </BuklodPortalScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 150, gap: 12 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6 },
  backText: { fontSize: 10.5, fontWeight: '900', color: '#275D45' },
  hero: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 17, backgroundColor: 'rgba(39,93,69,0.06)', borderWidth: 1, borderColor: 'rgba(39,93,69,0.13)' },
  eyebrow: { fontSize: 9.5, fontWeight: '900', letterSpacing: 1.4, color: '#7D8982' },
  title: { marginTop: 4, fontSize: 25, fontWeight: '900', color: '#1C2822' },
  subtitle: { marginTop: 5, fontSize: 12, lineHeight: 17, color: '#69766F' },
  loadingCard: { padding: 28, gap: 10, alignItems: 'center', backgroundColor: '#FFFFFF' },
  errorTitle: { fontSize: 15, fontWeight: '900', color: '#26352D' },
  muted: { fontSize: 11.5, lineHeight: 17, color: '#738078', textAlign: 'center' },
  list: { gap: 9 },
  card: { padding: 13, gap: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(25,45,35,0.09)' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  statusIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#EFF8F2' },
  amount: { fontSize: 16, fontWeight: '900', color: '#275D45' },
  status: { marginTop: 2, fontSize: 9.5, fontWeight: '900', color: '#6F7C75' },
  date: { fontSize: 10, color: '#89938D' },
  detailRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  detailLabel: { width: 70, fontSize: 10.5, color: '#87928C' },
  detailValue: { flex: 1, fontSize: 11, fontWeight: '800', color: '#344139' },
  reason: { fontSize: 10.5, lineHeight: 15, color: '#7C3B35' },
  cancelBtn: { minHeight: 38, marginTop: 2, borderWidth: 1, borderColor: 'rgba(124,59,53,0.25)', backgroundColor: 'rgba(124,59,53,0.05)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  cancelText: { fontSize: 10.5, fontWeight: '900', color: '#7C3B35' },
  emptyCard: { padding: 28, gap: 10, alignItems: 'center', backgroundColor: '#FFFFFF' },
  emptyTitle: { fontSize: 15, fontWeight: '900', color: '#26352D' },
  primaryBtn: { minHeight: 42, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#275D45', alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 10.5, fontWeight: '900', color: '#FFFFFF' },
});
