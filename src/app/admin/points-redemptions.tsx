import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AdminGate } from '@/components/AdminGate';
import { shared } from '@/components/UI';
import {
  adminLoadBuklodPointsRedemptionCenter,
  adminMarkBuklodCashRewardPaid,
  adminReviewBuklodCashReward,
  adminSaveBuklodPointsRedemptionConfig,
  type BuklodCashRewardAdminRequest,
  type BuklodPointsRedemptionAdminCenter,
} from '@/lib/buklodPointsRedemption';
import { colors } from '@/lib/theme';

function numberOrNull(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function integerOrNull(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.floor(parsed);
}

function ActionButton({
  title,
  onPress,
  disabled = false,
  outline = false,
  danger = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  outline?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.actionButton,
        outline && styles.actionButtonOutline,
        danger && styles.actionButtonDanger,
        disabled && { opacity: 0.45 },
      ]}
    >
      <Text
        style={[
          styles.actionButtonText,
          outline && styles.actionButtonTextOutline,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export default function AdminPointsRedemptionsScreen() {
  const [data, setData] =
    useState<BuklodPointsRedemptionAdminCenter | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const [bayanihanEnabled, setBayanihanEnabled] = useState(true);
  const [bayanihanRate, setBayanihanRate] = useState('1');
  const [cashEnabled, setCashEnabled] = useState(false);
  const [cashRate, setCashRate] = useState('');
  const [cashMin, setCashMin] = useState('1');
  const [cashMax, setCashMax] = useState('');
  const [references, setReferences] =
    useState<Record<string, string>>({});

  const applyConfigToState = useCallback(
    (next: BuklodPointsRedemptionAdminCenter) => {
      setData(next);
      setBayanihanEnabled(next.config.bayanihan_enabled);
      setBayanihanRate(
        String(next.config.bayanihan_units_per_point),
      );
      setCashEnabled(next.config.cash_reward_enabled);
      setCashRate(
        next.config.cash_php_per_point == null
          ? ''
          : String(next.config.cash_php_per_point),
      );
      setCashMin(String(next.config.cash_min_points));
      setCashMax(
        next.config.cash_max_points == null
          ? ''
          : String(next.config.cash_max_points),
      );
    },
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      applyConfigToState(
        await adminLoadBuklodPointsRedemptionCenter(),
      );
    } catch (error: unknown) {
      Alert.alert(
        'Could not load redemption center',
        error instanceof Error
          ? error.message
          : 'Unknown error',
      );
    } finally {
      setLoading(false);
    }
  }, [applyConfigToState]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveConfig = async () => {
    const bayanihanUnits = numberOrNull(bayanihanRate);
    const phpPerPoint = numberOrNull(cashRate);
    const minPoints = integerOrNull(cashMin);
    const maxPoints = cashMax.trim()
      ? integerOrNull(cashMax)
      : null;

    if (bayanihanUnits == null || bayanihanUnits <= 0) {
      Alert.alert(
        'Invalid Bayanihan rate',
        'Bayanihan units per point must be greater than zero.',
      );
      return;
    }

    if (minPoints == null || minPoints < 1) {
      Alert.alert(
        'Invalid Cash Reward minimum',
        'Minimum points must be at least 1.',
      );
      return;
    }

    if (maxPoints != null && maxPoints < minPoints) {
      Alert.alert(
        'Invalid Cash Reward maximum',
        'Maximum points cannot be below the minimum.',
      );
      return;
    }

    if (cashEnabled && (phpPerPoint == null || phpPerPoint <= 0)) {
      Alert.alert(
        'Cash rate required',
        'Set a positive PHP-per-point rate before enabling Cash Reward.',
      );
      return;
    }

    setBusy('config');
    try {
      const next =
        await adminSaveBuklodPointsRedemptionConfig({
          bayanihan_enabled: bayanihanEnabled,
          bayanihan_units_per_point: bayanihanUnits,
          cash_reward_enabled: cashEnabled,
          cash_php_per_point: phpPerPoint,
          cash_min_points: minPoints,
          cash_max_points: maxPoints,
        });
      applyConfigToState(next);
      Alert.alert('Saved', 'Redemption configuration updated.');
    } catch (error: unknown) {
      Alert.alert(
        'Save failed',
        error instanceof Error
          ? error.message
          : 'Could not save redemption configuration.',
      );
    } finally {
      setBusy(null);
    }
  };

  const review = (
    request: BuklodCashRewardAdminRequest,
    approve: boolean,
  ) => {
    Alert.alert(
      approve ? 'Approve Cash Reward?' : 'Reject Cash Reward?',
      approve
        ? 'Approval keeps the points reserved. Points are NOT deducted until you later mark the payout PAID.'
        : 'Rejection releases the reservation and does not deduct any points.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: approve ? 'APPROVE' : 'REJECT',
          style: approve ? 'default' : 'destructive',
          onPress: async () => {
            setBusy(request.id);
            try {
              await adminReviewBuklodCashReward(
                request.id,
                approve,
              );
              await load();
            } catch (error: unknown) {
              Alert.alert(
                'Review failed',
                error instanceof Error
                  ? error.message
                  : 'Could not review this request.',
              );
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  const markPaid = (request: BuklodCashRewardAdminRequest) => {
    const payoutReference =
      references[request.id]?.trim() ?? '';

    if (!payoutReference) {
      Alert.alert(
        'Payout reference required',
        'Enter the actual GCash/bank/manual payout transaction reference first.',
      );
      return;
    }

    Alert.alert(
      'Mark Cash Reward PAID?',
      `Confirm that ₱${request.destination_amount.toLocaleString(
        'en-PH',
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        },
      )} was actually paid. This will deduct ${request.points_spent.toLocaleString(
        'en-PH',
      )} Available Points. Lifetime Points will remain unchanged.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'MARK PAID',
          onPress: async () => {
            setBusy(request.id);
            try {
              await adminMarkBuklodCashRewardPaid(
                request.id,
                payoutReference,
              );
              setReferences((current) => {
                const next = { ...current };
                delete next[request.id];
                return next;
              });
              await load();
            } catch (error: unknown) {
              Alert.alert(
                'Mark paid failed',
                error instanceof Error
                  ? error.message
                  : 'Could not complete the payout record.',
              );
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  return (
    <AdminGate>
      <ScrollView
        style={shared.screen}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.eyebrow}>SYSTEM ADMIN</Text>
        <Text style={shared.h1}>Points Redemption Center</Text>
        <Text style={shared.muted}>
          Configure the only allowed uses of Available Points:
          BUKLOD Bayanihan and Cash Reward. Lifetime Points and Rank
          are permanent and never decrease.
        </Text>

        {loading && !data ? (
          <ActivityIndicator color={colors.greenDark} />
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                BUKLOD Bayanihan Transfer
              </Text>

              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Enabled</Text>
                  <Text style={styles.help}>
                    Immediate atomic Points → Bayanihan credit transfer.
                  </Text>
                </View>
                <Switch
                  value={bayanihanEnabled}
                  onValueChange={setBayanihanEnabled}
                />
              </View>

              <Text style={styles.label}>
                Bayanihan units per point
              </Text>
              <TextInput
                value={bayanihanRate}
                onChangeText={setBayanihanRate}
                keyboardType="decimal-pad"
                style={styles.input}
                placeholder="1"
              />

              <Text style={styles.help}>
                This is an internal participation-credit conversion,
                not a PHP cash rate.
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Cash Reward</Text>

              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Enabled</Text>
                  <Text style={styles.help}>
                    Manual payout workflow: Request → Approve → PAID.
                  </Text>
                </View>
                <Switch
                  value={cashEnabled}
                  onValueChange={setCashEnabled}
                />
              </View>

              <Text style={styles.label}>PHP per point</Text>
              <TextInput
                value={cashRate}
                onChangeText={setCashRate}
                keyboardType="decimal-pad"
                style={styles.input}
                placeholder="Set rate before enabling"
              />

              <Text style={styles.label}>Minimum points</Text>
              <TextInput
                value={cashMin}
                onChangeText={setCashMin}
                keyboardType="number-pad"
                style={styles.input}
              />

              <Text style={styles.label}>
                Maximum points (optional)
              </Text>
              <TextInput
                value={cashMax}
                onChangeText={setCashMax}
                keyboardType="number-pad"
                style={styles.input}
                placeholder="No maximum"
              />

              <Text style={styles.help}>
                Enabling Cash Reward does not create automatic GCash
                payout. System Admin must actually send the payout,
                enter its transaction/reference, then mark PAID. Only
                PAID deducts Available Points.
              </Text>
            </View>

            <ActionButton
              title={
                busy === 'config'
                  ? 'SAVING...'
                  : 'SAVE REDEMPTION SETTINGS'
              }
              disabled={busy != null}
              onPress={() => {
                void saveConfig();
              }}
            />

            <Text style={styles.sectionTitle}>
              CASH REWARD REQUESTS
            </Text>

            {data?.requests.length ? (
              data.requests.map((request) => (
                <View key={request.id} style={styles.card}>
                  <View style={styles.requestTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>
                        {request.full_name}
                      </Text>
                      <Text style={styles.help}>
                        {new Date(request.created_at).toLocaleString(
                          'en-PH',
                        )}
                      </Text>
                    </View>
                    <Text style={styles.status}>
                      {request.status.toUpperCase()}
                    </Text>
                  </View>

                  <Text style={styles.amount}>
                    {request.points_spent.toLocaleString('en-PH')} pts
                    {' → '}₱
                    {request.destination_amount.toLocaleString(
                      'en-PH',
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      },
                    )}
                  </Text>

                  <Text style={styles.detail}>
                    Payout: {request.payout_method || '—'}
                  </Text>
                  <Text style={styles.detail}>
                    Account: {request.payout_account || '—'}
                  </Text>

                  {request.payout_reference ? (
                    <Text style={styles.detail}>
                      Reference: {request.payout_reference}
                    </Text>
                  ) : null}

                  {request.admin_note ? (
                    <Text style={styles.detail}>
                      Note: {request.admin_note}
                    </Text>
                  ) : null}

                  {request.status === 'pending' ? (
                    <View style={styles.buttonRow}>
                      <ActionButton
                        title={
                          busy === request.id
                            ? '...'
                            : 'APPROVE'
                        }
                        disabled={busy != null}
                        onPress={() => review(request, true)}
                      />
                      <ActionButton
                        title="REJECT"
                        outline
                        danger
                        disabled={busy != null}
                        onPress={() => review(request, false)}
                      />
                    </View>
                  ) : null}

                  {request.status === 'approved' ? (
                    <>
                      <Text style={styles.label}>
                        Actual payout transaction/reference
                      </Text>
                      <TextInput
                        value={references[request.id] ?? ''}
                        onChangeText={(value) =>
                          setReferences((current) => ({
                            ...current,
                            [request.id]: value,
                          }))
                        }
                        style={styles.input}
                        placeholder="GCash / bank / manual payout reference"
                      />

                      <ActionButton
                        title={
                          busy === request.id
                            ? '...'
                            : 'MARK PAID'
                        }
                        disabled={busy != null}
                        onPress={() => markPaid(request)}
                      />
                    </>
                  ) : null}
                </View>
              ))
            ) : (
              <View style={styles.card}>
                <Text style={styles.help}>
                  No Cash Reward requests yet.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    paddingBottom: 60,
    gap: 12,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: colors.greenDark,
  },
  sectionTitle: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: colors.muted,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 13,
    gap: 9,
    backgroundColor: colors.white,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.text,
  },
  help: {
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.muted,
  },
  input: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 11,
    backgroundColor: colors.white,
    color: colors.text,
    fontSize: 13,
  },
  requestTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  status: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.background,
    fontSize: 9.5,
    fontWeight: '900',
    color: colors.greenDark,
  },
  amount: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
  },
  detail: {
    fontSize: 12,
    color: colors.muted,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    minHeight: 42,
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: colors.green,
  },
  actionButtonOutline: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.green,
  },
  actionButtonDanger: {
    borderColor: '#9C2F2F',
  },
  actionButtonText: {
    color: colors.white,
    fontSize: 11.5,
    fontWeight: '900',
  },
  actionButtonTextOutline: {
    color: colors.green,
  },
});
