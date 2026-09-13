import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import { shared } from '@/components/UI';
import {
  asMoney,
  cancelMyBuklodR38ReferralWithdrawal,
  formatPhp,
  loadBuklodR38EconomyPolicy,
  loadMyBuklodR38EconomyReport,
  loadMyBuklodR38PayoutProfile,
  loadMyBuklodR38WithdrawalHistory,
  requestMyBuklodR38ReferralWithdrawal,
  saveMyBuklodR38PayoutProfile,
  type BuklodR38EconomyPolicy,
  type BuklodR38PayoutProfile,
  type BuklodR38UserEconomyReport,
  type BuklodR38WithdrawalHistory,
} from '@/lib/buklodR38Economy';

function formatWhen(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function BuklodR38PayoutProfileScreen() {
  const [profile, setProfile] = useState<BuklodR38PayoutProfile | null>(null);
  const [policy, setPolicy] = useState<BuklodR38EconomyPolicy | null>(null);
  const [report, setReport] = useState<BuklodR38UserEconomyReport | null>(null);
  const [history, setHistory] = useState<BuklodR38WithdrawalHistory | null>(null);
  const [accountName, setAccountName] = useState('');
  const [gcashMobile, setGcashMobile] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [nextProfile, nextPolicy, nextReport, nextHistory] = await Promise.all([
        loadMyBuklodR38PayoutProfile(),
        loadBuklodR38EconomyPolicy(),
        loadMyBuklodR38EconomyReport(),
        loadMyBuklodR38WithdrawalHistory(),
      ]);
      setProfile(nextProfile);
      setPolicy(nextPolicy);
      setReport(nextReport);
      setHistory(nextHistory);
      if (nextProfile) {
        setAccountName(nextProfile.account_name || '');
      }
    } catch (nextError: unknown) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load payout settings.');
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

  const availableReferralCash = asMoney(report?.actual_earnings.available_cash.direct_referral);
  const minimum = asMoney(policy?.withdrawal.minimum_amount ?? 200);
  const withdrawalEnabled = report?.actual_earnings.referral_withdrawal_enabled === true;
  const meetsMinimum = availableReferralCash >= minimum && availableReferralCash > 0;
  const canRequest = withdrawalEnabled && !!profile && meetsMinimum && !requesting;

  const gateText = useMemo(() => {
    if (!withdrawalEnabled) return 'Withdrawal activation is currently OFF.';
    if (!profile) return 'Save an active payout profile first.';
    if (!meetsMinimum) return `Available Direct Referral cash must reach ${formatPhp(minimum)}.`;
    return `Eligible full-balance request: ${formatPhp(availableReferralCash)}.`;
  }, [withdrawalEnabled, profile, meetsMinimum, minimum, availableReferralCash]);

  const saveProfile = async () => {
    if (!accountName.trim() || !gcashMobile.trim()) {
      Alert.alert('Payout Profile', 'Enter the GCash account name and mobile number.');
      return;
    }

    setSaving(true);
    try {
      const saved = await saveMyBuklodR38PayoutProfile({
        accountName,
        gcashMobile,
      });
      setProfile(saved);
      setGcashMobile('');
      Alert.alert(
        'Payout Profile Saved',
        `GCash ${saved.destination_masked} is now your active R38 payout destination. The full number is not shown again on this screen.`,
      );
    } catch (nextError: unknown) {
      Alert.alert(
        'Payout Profile',
        nextError instanceof Error ? nextError.message : 'Could not save payout profile.',
      );
    } finally {
      setSaving(false);
    }
  };

  const requestWithdrawal = () => {
    if (!canRequest || !profile) return;

    Alert.alert(
      'Request Full Referral Balance?',
      `${formatPhp(availableReferralCash)} of finalized Direct Referral cash will be reserved for manual payout to ${profile.payout_method} ${profile.destination_masked}. BUKLOD Points are not used or deducted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Withdrawal',
          onPress: () => {
            void (async () => {
              setRequesting(true);
              try {
                const result = await requestMyBuklodR38ReferralWithdrawal(profile);
                await load();
                Alert.alert(
                  'Withdrawal Requested',
                  `${formatPhp(result.withdrawal.requested_amount)} is reserved for payout review.`,
                );
              } catch (nextError: unknown) {
                Alert.alert(
                  'Withdrawal',
                  nextError instanceof Error ? nextError.message : 'Could not request withdrawal.',
                );
              } finally {
                setRequesting(false);
              }
            })();
          },
        },
      ],
    );
  };

  const cancelWithdrawal = (withdrawalId: string, amount: number) => {
    Alert.alert(
      'Cancel Withdrawal?',
      `${formatPhp(amount)} will be released from Reserved back to Available Direct Referral cash.`,
      [
        { text: 'Keep Request', style: 'cancel' },
        {
          text: 'Cancel Withdrawal',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setCancellingId(withdrawalId);
              try {
                await cancelMyBuklodR38ReferralWithdrawal(withdrawalId);
                await load();
                Alert.alert('Withdrawal Cancelled', 'The reserved referral cash is available again.');
              } catch (nextError: unknown) {
                Alert.alert(
                  'Withdrawal',
                  nextError instanceof Error ? nextError.message : 'Could not cancel the withdrawal.',
                );
              } finally {
                setCancellingId(null);
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
          <Text style={styles.eyebrow}>R38 PAYOUT PROFILE</Text>
          <Text style={styles.title}>Referral Payout</Text>
          <Text style={styles.subtitle}>
            Set the destination used only for finalized Direct Referral cash withdrawals.
          </Text>
        </View>
        <MaterialCommunityIcons name="cash-check" size={29} color="#275D45" />
      </View>

      <View style={styles.guardCard}>
        <MaterialCommunityIcons name="shield-lock-outline" size={22} color="#275D45" />
        <View style={{ flex: 1 }}>
          <Text style={styles.guardTitle}>Separate from Points</Text>
          <Text style={styles.guardText}>
            This payout profile cannot convert Points, Rank, Character, Collectibles, BCU or RCU into pesos. It is used only after funded platform revenue has produced finalized Direct Referral cash.
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color="#275D45" />
          <Text style={styles.muted}>Loading payout settings...</Text>
        </View>
      ) : error ? (
        <View style={styles.loadingCard}>
          <Text style={styles.errorTitle}>Payout settings unavailable</Text>
          <Text style={styles.muted}>{error}</Text>
          <Pressable onPress={() => void load()} style={styles.primaryBtn}>
            <Text style={styles.primaryText}>TRY AGAIN</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active destination</Text>
            {profile ? (
              <View style={styles.profileCard}>
                <View style={styles.profileIcon}>
                  <MaterialCommunityIcons name="cellphone" size={20} color="#275D45" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.profileName}>{profile.account_name}</Text>
                  <Text style={styles.profileMeta}>{profile.payout_method} · {profile.destination_masked}</Text>
                </View>
                <Text style={styles.activePill}>ACTIVE</Text>
              </View>
            ) : (
              <Text style={styles.muted}>No payout destination saved yet.</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{profile ? 'Update GCash profile' : 'Set GCash profile'}</Text>
            <Text style={styles.muted}>
              Saving a new number replaces the active payout destination for future requests only. Existing withdrawal requests keep their original frozen payout destination.
            </Text>
            <TextInput
              value={accountName}
              onChangeText={setAccountName}
              placeholder="GCash account name"
              autoCapitalize="words"
              style={styles.input}
            />
            <TextInput
              value={gcashMobile}
              onChangeText={setGcashMobile}
              placeholder={profile ? 'Enter new GCash mobile to replace current' : '09XXXXXXXXX'}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              style={styles.input}
            />
            <Pressable
              disabled={saving}
              onPress={() => void saveProfile()}
              style={({ pressed }) => [styles.primaryBtn, (pressed || saving) && { opacity: 0.7 }]}
            >
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <MaterialCommunityIcons name="content-save-outline" size={17} color="#FFFFFF" />}
              <Text style={styles.primaryText}>{profile ? 'UPDATE PAYOUT PROFILE' : 'SAVE PAYOUT PROFILE'}</Text>
            </Pressable>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Withdrawal eligibility</Text>
            <View style={styles.metricRow}>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{formatPhp(availableReferralCash)}</Text>
                <Text style={styles.metricLabel}>Available Direct Referral Cash</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{formatPhp(minimum)}</Text>
                <Text style={styles.metricLabel}>Minimum Withdrawal</Text>
              </View>
            </View>
            <View style={styles.statusCard}>
              <MaterialCommunityIcons
                name={canRequest ? 'check-circle-outline' : 'lock-outline'}
                size={19}
                color={canRequest ? '#275D45' : '#7E8983'}
              />
              <Text style={styles.statusText}>{gateText}</Text>
            </View>
            <Text style={styles.muted}>
              Phase 1 uses full-balance withdrawal only. Partial withdrawal is not allowed. The request reserves finalized Direct Referral cash for manual review and payout.
            </Text>
            <Pressable
              disabled={!canRequest}
              onPress={requestWithdrawal}
              style={({ pressed }) => [styles.withdrawBtn, !canRequest && styles.disabledBtn, pressed && canRequest && { opacity: 0.75 }]}
            >
              {requesting ? <ActivityIndicator color="#FFFFFF" /> : <MaterialCommunityIcons name="bank-transfer-out" size={18} color="#FFFFFF" />}
              <Text style={styles.primaryText}>REQUEST FULL REFERRAL BALANCE</Text>
            </Pressable>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Withdrawal history</Text>
            <Text style={styles.muted}>
              Your own payout records only. Full payout numbers are never returned here; each record shows the frozen masked destination used when the request was created.
            </Text>
            {history?.rows.length ? history.rows.map((item) => {
              const cancellable = ['REQUESTED', 'UNDER_REVIEW'].includes(item.status);
              const isCancelling = cancellingId === item.id;
              return (
                <View key={item.id} style={styles.historyCard}>
                  <View style={styles.historyHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyAmount}>{formatPhp(item.requested_amount)}</Text>
                      <Text style={styles.historyMeta}>
                        {item.payout_method || '—'} · {item.payout_destination_masked || '—'}
                      </Text>
                    </View>
                    <Text style={styles.historyStatus}>{item.status.replace(/_/g, ' ')}</Text>
                  </View>
                  <Text style={styles.historyLine}>Requested: {formatWhen(item.requested_at)}</Text>
                  {!!item.paid_at && <Text style={styles.historyLine}>Paid: {formatWhen(item.paid_at)}</Text>}
                  {!!item.payout_transaction_ref && (
                    <Text style={styles.historyLine}>Transaction ref: {item.payout_transaction_ref}</Text>
                  )}
                  {!!item.rejection_reason && (
                    <Text style={styles.historyLine}>Reason: {item.rejection_reason}</Text>
                  )}
                  {!!item.failure_reason && (
                    <Text style={styles.historyLine}>Failure: {item.failure_reason}</Text>
                  )}
                  {cancellable ? (
                    <Pressable
                      disabled={isCancelling}
                      onPress={() => cancelWithdrawal(item.id, item.requested_amount)}
                      style={({ pressed }) => [styles.cancelBtn, (pressed || isCancelling) && { opacity: 0.7 }]}
                    >
                      {isCancelling ? (
                        <ActivityIndicator color="#7C3B35" />
                      ) : (
                        <MaterialCommunityIcons name="close-circle-outline" size={16} color="#7C3B35" />
                      )}
                      <Text style={styles.cancelText}>CANCEL REQUEST</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            }) : (
              <View style={styles.emptyHistory}>
                <MaterialCommunityIcons name="history" size={21} color="#7E8983" />
                <Text style={styles.muted}>No withdrawal requests yet.</Text>
              </View>
            )}
          </View>
        </>
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
  guardCard: { flexDirection: 'row', gap: 10, padding: 14, backgroundColor: '#EFF8F2', borderWidth: 1, borderColor: '#D7EADF' },
  guardTitle: { fontSize: 14, fontWeight: '900', color: '#203229' },
  guardText: { marginTop: 4, fontSize: 11.5, lineHeight: 17, color: '#637169' },
  loadingCard: { padding: 28, gap: 10, alignItems: 'center', backgroundColor: '#FFFFFF' },
  errorTitle: { fontSize: 15, fontWeight: '900', color: '#26352D' },
  muted: { fontSize: 11.5, lineHeight: 17, color: '#738078' },
  section: { gap: 9, paddingTop: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '900', color: '#202C26' },
  profileCard: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 13, borderWidth: 1, borderColor: 'rgba(25,45,35,0.09)', backgroundColor: '#FFFFFF' },
  profileIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#EFF8F2' },
  profileName: { fontSize: 13, fontWeight: '900', color: '#24322B' },
  profileMeta: { marginTop: 2, fontSize: 11, color: '#738078' },
  activePill: { fontSize: 9, fontWeight: '900', color: '#275D45', backgroundColor: '#E8F4EC', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 },
  input: { minHeight: 46, borderWidth: 1, borderColor: 'rgba(25,45,35,0.14)', backgroundColor: '#FFFFFF', paddingHorizontal: 13, fontSize: 13, color: '#202C26' },
  primaryBtn: { minHeight: 44, paddingHorizontal: 14, borderRadius: 11, backgroundColor: '#275D45', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  primaryText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '900' },
  metricRow: { flexDirection: 'row', gap: 7 },
  metric: { flex: 1, minHeight: 82, justifyContent: 'center', padding: 12, borderWidth: 1, borderColor: 'rgba(25,45,35,0.09)', backgroundColor: '#FFFFFF' },
  metricValue: { fontSize: 17, fontWeight: '900', color: '#275D45' },
  metricLabel: { marginTop: 4, fontSize: 10, lineHeight: 13, color: '#738078', fontWeight: '800' },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: '#F4F7F5', borderWidth: 1, borderColor: 'rgba(25,45,35,0.08)' },
  statusText: { flex: 1, fontSize: 11.5, lineHeight: 16, fontWeight: '800', color: '#47564E' },
  withdrawBtn: { minHeight: 46, borderRadius: 11, backgroundColor: '#275D45', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  disabledBtn: { backgroundColor: '#9DA7A2', opacity: 0.72 },
  historyCard: { gap: 6, padding: 13, borderWidth: 1, borderColor: 'rgba(25,45,35,0.09)', backgroundColor: '#FFFFFF' },
  historyHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  historyAmount: { fontSize: 14, fontWeight: '900', color: '#275D45' },
  historyMeta: { marginTop: 2, fontSize: 10.5, color: '#738078' },
  historyStatus: { fontSize: 9, fontWeight: '900', color: '#47564E', backgroundColor: '#F0F4F2', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, textTransform: 'uppercase' },
  historyLine: { fontSize: 10.5, lineHeight: 15, color: '#69766F' },
  cancelBtn: { marginTop: 3, minHeight: 38, borderWidth: 1, borderColor: 'rgba(124,59,53,0.25)', borderRadius: 10, backgroundColor: '#FFF8F7', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  cancelText: { color: '#7C3B35', fontSize: 10, fontWeight: '900' },
  emptyHistory: { minHeight: 72, borderWidth: 1, borderColor: 'rgba(25,45,35,0.08)', backgroundColor: '#F7F9F8', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
