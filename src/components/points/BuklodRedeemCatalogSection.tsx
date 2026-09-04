import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { withAlpha } from '@/lib/buklodContrast';
import {
  cancelBuklodCashReward,
  convertBuklodPointsToBayanihan,
  createBuklodPointsRedemptionRequestKey,
  loadBuklodPointsRedemptionCenter,
  requestBuklodCashReward,
  type BuklodPointsRedemptionCenter,
  type BuklodPointsRedemptionRecord,
} from '@/lib/buklodPointsRedemption';

type Props = {
  availablePoints: number;
  onRedeemed?: (availablePoints: number) => void;
};

function integerPoints(value: string) {
  const parsed = Math.floor(Number(value.replace(/,/g, '').trim()));
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('en-PH');
}

function statusLabel(status: BuklodPointsRedemptionRecord['status']) {
  switch (status) {
    case 'pending':
      return 'PENDING REVIEW';
    case 'approved':
      return 'APPROVED / RESERVED';
    case 'paid':
      return 'PAID';
    case 'completed':
      return 'COMPLETED';
    case 'rejected':
      return 'REJECTED';
    case 'cancelled':
      return 'CANCELLED';
    default:
      return status.toUpperCase();
  }
}

export default function BuklodRedeemCatalogSection({
  availablePoints,
  onRedeemed,
}: Props) {
  const { theme } = useBuklodPresentation();
  const [center, setCenter] =
    useState<BuklodPointsRedemptionCenter | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [bayanihanPoints, setBayanihanPoints] = useState('');
  const [cashPoints, setCashPoints] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('GCash');
  const [payoutAccount, setPayoutAccount] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCenter(await loadBuklodPointsRedemptionCenter());
    } catch {
      setCenter(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 18,
          backgroundColor: theme.surface,
          padding: 14,
          gap: 12,
        },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        },
        title: {
          flex: 1,
          fontSize: 15,
          fontWeight: '900',
          color: theme.textPrimary,
        },
        sub: {
          fontSize: 12,
          lineHeight: 17,
          color: theme.textMuted,
        },
        balanceRow: {
          flexDirection: 'row',
          gap: 8,
        },
        balanceBox: {
          flex: 1,
          borderRadius: 13,
          padding: 10,
          backgroundColor: withAlpha(theme.accent, 0.07),
        },
        balanceLabel: {
          fontSize: 10,
          fontWeight: '900',
          letterSpacing: 0.6,
          color: theme.textMuted,
        },
        balanceValue: {
          marginTop: 4,
          fontSize: 18,
          fontWeight: '900',
          color: theme.textPrimary,
        },
        divider: {
          height: 1,
          backgroundColor: withAlpha(theme.border, 0.7),
        },
        sectionTitle: {
          fontSize: 13,
          fontWeight: '900',
          color: theme.textPrimary,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        input: {
          minHeight: 42,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 11,
          paddingHorizontal: 11,
          color: theme.textPrimary,
          backgroundColor: theme.surface,
          fontSize: 13,
        },
        button: {
          minHeight: 42,
          borderRadius: 11,
          paddingHorizontal: 13,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.accent,
        },
        buttonOutline: {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: theme.accent,
        },
        buttonText: {
          color: '#fff',
          fontSize: 11,
          fontWeight: '900',
        },
        buttonTextOutline: {
          color: theme.accent,
        },
        info: {
          borderRadius: 12,
          padding: 10,
          backgroundColor: withAlpha(theme.accent, 0.06),
        },
        historyRow: {
          borderTopWidth: 1,
          borderTopColor: withAlpha(theme.border, 0.65),
          paddingTop: 10,
          gap: 4,
        },
        historyTitle: {
          fontSize: 12,
          fontWeight: '900',
          color: theme.textPrimary,
        },
        historyMeta: {
          fontSize: 11,
          lineHeight: 16,
          color: theme.textMuted,
        },
        status: {
          alignSelf: 'flex-start',
          marginTop: 2,
          borderRadius: 999,
          paddingHorizontal: 8,
          paddingVertical: 4,
          backgroundColor: withAlpha(theme.accent, 0.1),
          color: theme.accent,
          fontSize: 9.5,
          fontWeight: '900',
        },
      }),
    [theme],
  );

  const effectiveAvailable =
    center?.available_points ?? availablePoints;
  const spendable =
    center?.spendable_points ?? effectiveAvailable;

  const refreshAfterAction = useCallback(
    async (nextAvailable?: number) => {
      if (typeof nextAvailable === 'number') {
        onRedeemed?.(nextAvailable);
      }
      await load();
    },
    [load, onRedeemed],
  );

  const handleBayanihan = () => {
    if (!center?.bayanihan.enabled) {
      return;
    }

    const points = integerPoints(bayanihanPoints);
    if (points <= 0) {
      Alert.alert('Enter points', 'Enter a positive whole-number point amount.');
      return;
    }

    if (points > spendable) {
      Alert.alert(
        'Not enough spendable points',
        `You can currently use up to ${spendable.toLocaleString('en-PH')} points.`,
      );
      return;
    }

    const credits = points * center.bayanihan.units_per_point;

    Alert.alert(
      'Transfer to BUKLOD Bayanihan',
      `${points.toLocaleString('en-PH')} BUKLOD Points will become ${credits.toLocaleString('en-PH')} Bayanihan credit. Lifetime Points will NOT decrease. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'TRANSFER',
          onPress: async () => {
            const requestKey =
              createBuklodPointsRedemptionRequestKey('bayanihan');
            setBusy('bayanihan');
            try {
              const result =
                await convertBuklodPointsToBayanihan(
                  points,
                  requestKey,
                );
              setBayanihanPoints('');
              await refreshAfterAction(result.available_points);
              Alert.alert(
                'Transfer complete',
                `${result.points_spent ?? points} points were transferred to BUKLOD Bayanihan. The transaction is permanently recorded.`,
              );
            } catch (error: unknown) {
              Alert.alert(
                'Transfer failed',
                error instanceof Error
                  ? error.message
                  : 'Could not complete the Bayanihan transfer.',
              );
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  const handleCashRequest = () => {
    if (!center?.cash_reward.enabled) {
      return;
    }

    const points = integerPoints(cashPoints);
    const minPoints = center.cash_reward.min_points;
    const maxPoints = center.cash_reward.max_points;

    if (points < minPoints) {
      Alert.alert(
        'Invalid amount',
        `Minimum Cash Reward request is ${minPoints.toLocaleString('en-PH')} points.`,
      );
      return;
    }

    if (maxPoints != null && points > maxPoints) {
      Alert.alert(
        'Invalid amount',
        `Maximum Cash Reward request is ${maxPoints.toLocaleString('en-PH')} points.`,
      );
      return;
    }

    if (points > spendable) {
      Alert.alert(
        'Not enough spendable points',
        `You can currently reserve up to ${spendable.toLocaleString('en-PH')} points.`,
      );
      return;
    }

    if (!payoutMethod.trim() || !payoutAccount.trim()) {
      Alert.alert(
        'Payout details required',
        'Enter the payout method and account/number.',
      );
      return;
    }

    const phpRate = center.cash_reward.php_per_point ?? 0;
    const phpAmount = points * phpRate;

    Alert.alert(
      'Request Cash Reward',
      `${points.toLocaleString('en-PH')} points will be reserved for a ₱${phpAmount.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} Cash Reward request. Available Points and Lifetime Points will not decrease until System Admin confirms the payout as PAID.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'SUBMIT',
          onPress: async () => {
            const requestKey =
              createBuklodPointsRedemptionRequestKey('cash_reward');
            setBusy('cash');
            try {
              await requestBuklodCashReward({
                points,
                payoutMethod: payoutMethod.trim(),
                payoutAccount: payoutAccount.trim(),
                requestKey,
              });
              setCashPoints('');
              await refreshAfterAction();
              Alert.alert(
                'Cash Reward requested',
                'Your points are reserved. They will be deducted only after the payout is actually marked PAID by System Admin.',
              );
            } catch (error: unknown) {
              Alert.alert(
                'Request failed',
                error instanceof Error
                  ? error.message
                  : 'Could not submit the Cash Reward request.',
              );
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  const handleCancel = (item: BuklodPointsRedemptionRecord) => {
    Alert.alert(
      'Cancel Cash Reward request?',
      'No points will be deducted. Any reservation will be released.',
      [
        { text: 'Keep request', style: 'cancel' },
        {
          text: 'CANCEL REQUEST',
          style: 'destructive',
          onPress: async () => {
            setBusy(item.id);
            try {
              await cancelBuklodCashReward(item.id);
              await refreshAfterAction();
            } catch (error: unknown) {
              Alert.alert(
                'Cancel failed',
                error instanceof Error
                  ? error.message
                  : 'Could not cancel this request.',
              );
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (!center) {
    return null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <MaterialCommunityIcons
          name="wallet-outline"
          size={22}
          color={theme.accent}
        />
        <Text style={styles.title}>Use Available Points</Text>
      </View>

      <Text style={styles.sub}>
        Lifetime Points are permanent achievement history. Only Available
        Points can be used. Pending Cash Reward requests are shown separately
        as reserved points.
      </Text>

      <View style={styles.balanceRow}>
        <View style={styles.balanceBox}>
          <Text style={styles.balanceLabel}>AVAILABLE</Text>
          <Text style={styles.balanceValue}>
            {effectiveAvailable.toLocaleString('en-PH')}
          </Text>
        </View>

        <View style={styles.balanceBox}>
          <Text style={styles.balanceLabel}>RESERVED</Text>
          <Text style={styles.balanceValue}>
            {center.reserved_points.toLocaleString('en-PH')}
          </Text>
        </View>

        <View style={styles.balanceBox}>
          <Text style={styles.balanceLabel}>SPENDABLE NOW</Text>
          <Text style={styles.balanceValue}>
            {spendable.toLocaleString('en-PH')}
          </Text>
        </View>
      </View>

      {center.bayanihan.enabled ? (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>BUKLOD Bayanihan</Text>
          <Text style={styles.sub}>
            {`1 point = ${center.bayanihan.units_per_point.toLocaleString(
              'en-PH',
            )} Bayanihan credit. This is an internal participation credit, not cash.`}
          </Text>

          <View style={styles.row}>
            <TextInput
              value={bayanihanPoints}
              onChangeText={setBayanihanPoints}
              keyboardType="number-pad"
              placeholder="Points"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, { flex: 1 }]}
            />
            <Pressable
              disabled={busy != null}
              onPress={handleBayanihan}
              style={[
                styles.button,
                busy != null && { opacity: 0.5 },
              ]}
            >
              <Text style={styles.buttonText}>
                {busy === 'bayanihan' ? '...' : 'TRANSFER'}
              </Text>
            </Pressable>
          </View>
        </>
      ) : null}

      <View style={styles.divider} />
      <Text style={styles.sectionTitle}>Cash Reward</Text>

      {center.cash_reward.enabled ? (
        <>
          <Text style={styles.sub}>
            {`Current rate: ₱${(
              center.cash_reward.php_per_point ?? 0
            ).toLocaleString('en-PH', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 4,
            })} per point. Request → Admin Review → PAID. Points are deducted only at PAID.`}
          </Text>

          <TextInput
            value={cashPoints}
            onChangeText={setCashPoints}
            keyboardType="number-pad"
            placeholder={`Points (min ${center.cash_reward.min_points})`}
            placeholderTextColor={theme.textMuted}
            style={styles.input}
          />
          <TextInput
            value={payoutMethod}
            onChangeText={setPayoutMethod}
            placeholder="Payout method (e.g. GCash)"
            placeholderTextColor={theme.textMuted}
            style={styles.input}
          />
          <TextInput
            value={payoutAccount}
            onChangeText={setPayoutAccount}
            placeholder="Payout account / mobile number"
            placeholderTextColor={theme.textMuted}
            style={styles.input}
          />
          <Pressable
            disabled={busy != null}
            onPress={handleCashRequest}
            style={[
              styles.button,
              busy != null && { opacity: 0.5 },
            ]}
          >
            <Text style={styles.buttonText}>
              {busy === 'cash' ? '...' : 'REQUEST CASH REWARD'}
            </Text>
          </Pressable>
        </>
      ) : (
        <View style={styles.info}>
          <Text style={styles.sub}>
            Cash Reward is currently disabled until System Admin sets a
            PHP-per-point rate and enables manual payout processing. No points
            can be deducted for cash while this is disabled.
          </Text>
        </View>
      )}

      {center.history.length > 0 ? (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>Redemption History</Text>

          {center.history.slice(0, 10).map((item) => (
            <View key={item.id} style={styles.historyRow}>
              <Text style={styles.historyTitle}>
                {item.redemption_type === 'bayanihan'
                  ? 'BUKLOD Bayanihan Transfer'
                  : 'Cash Reward'}
              </Text>

              <Text style={styles.historyMeta}>
                {`${item.points_spent.toLocaleString('en-PH')} pts → ${
                  item.destination_unit === 'PHP'
                    ? `₱${item.destination_amount.toLocaleString('en-PH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    : `${item.destination_amount.toLocaleString(
                        'en-PH',
                      )} Bayanihan credit`
                }`}
              </Text>

              {item.payout_method || item.payout_account ? (
                <Text style={styles.historyMeta}>
                  {[item.payout_method, item.payout_account]
                    .filter(Boolean)
                    .join(' • ')}
                </Text>
              ) : null}

              {item.payout_reference ? (
                <Text style={styles.historyMeta}>
                  Reference: {item.payout_reference}
                </Text>
              ) : null}

              {item.admin_note ? (
                <Text style={styles.historyMeta}>
                  Admin: {item.admin_note}
                </Text>
              ) : null}

              <Text style={styles.historyMeta}>
                {dateLabel(item.created_at)}
              </Text>

              <Text style={styles.status}>
                {statusLabel(item.status)}
              </Text>

              {item.redemption_type === 'cash_reward' &&
              (item.status === 'pending' ||
                item.status === 'approved') ? (
                <Pressable
                  disabled={busy != null}
                  onPress={() => handleCancel(item)}
                  style={[
                    styles.button,
                    styles.buttonOutline,
                    busy != null && { opacity: 0.5 },
                  ]}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      styles.buttonTextOutline,
                    ]}
                  >
                    {busy === item.id ? '...' : 'CANCEL REQUEST'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}
