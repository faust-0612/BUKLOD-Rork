import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Button, shared } from '@/components/UI';
import { supabase } from '@/lib/supabase';

const PESO = '\u20B1';

type Dashboard = {
  total_earned: number;
  total_used: number;
  pending_withdrawals: number;
  available_balance: number;
  spendable_after_pending: number;
  breakdown: {
    lesson_credit: number;
    mentor_credit: number;
    devotional_credit: number;
    bible_reading_credit: number;
    other_credit: number;
  };
};

type LedgerRow = {
  id: string;
  direction: 'credit' | 'debit';
  amount: number;
  source_type: string;
  source_key: string;
  source_id: string | null;
  description: string | null;
  created_at: string;
};

type Withdrawal = {
  id: string;
  requested_amount: number;
  purpose_category:
    | 'insurance'
    | 'medical'
    | 'approved_assistance'
    | 'other';
  purpose_text: string | null;
  status:
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'cancelled';
  reviewer_note: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type HistoryFilter =
  | 'all'
  | 'formation'
  | 'mentor'
  | 'devotional'
  | 'bible'
  | 'other';

type Purpose =
  | 'insurance'
  | 'medical'
  | 'approved_assistance'
  | 'other';

const FILTERS: {
  key: HistoryFilter;
  label: string;
}[] = [
  { key: 'all', label: 'All' },
  { key: 'formation', label: 'Formation' },
  { key: 'mentor', label: 'Mentoring' },
  { key: 'devotional', label: 'Devotional' },
  { key: 'bible', label: 'Bible' },
  { key: 'other', label: 'Other' },
];

const PURPOSES: {
  key: Purpose;
  label: string;
}[] = [
  { key: 'insurance', label: 'Insurance' },
  { key: 'medical', label: 'Medical' },
  {
    key: 'approved_assistance',
    label: 'Approved Assistance',
  },
  { key: 'other', label: 'Other' },
];

function money(value: unknown) {
  const amount = Number(value ?? 0);

  return `${PESO}${amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateLabel(value: string) {
  return new Date(value).toLocaleString();
}

function sourceLabel(source: string) {
  switch (source) {
    case 'member_lesson':
      return 'Formation Lesson';

    case 'mentor_session':
      return 'Mentor Teaching Session';

    case 'devotional':
      return 'Devotional';

    case 'bible_reading':
      return 'Daily Bible Reading';

    case 'mentoring_release':
    case 'mentoring_lesson':
    case 'mentoring_completion':
      return 'Mentoring Lesson';

    case 'withdrawal':
      return 'Withdrawal';

    default:
      return source
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (letter) =>
          letter.toUpperCase()
        );
  }
}

function purposeLabel(purpose: string) {
  switch (purpose) {
    case 'insurance':
      return 'Insurance';

    case 'medical':
      return 'Medical';

    case 'approved_assistance':
      return 'Approved Assistance';

    default:
      return 'Other';
  }
}

function SummaryCard({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <View
      style={[
        styles.summaryCard,
        emphasized && styles.summaryCardPrimary,
      ]}
    >
      <Text
        style={[
          styles.summaryValue,
          emphasized && styles.summaryValuePrimary,
        ]}
      >
        {value}
      </Text>

      <Text
        style={[
          styles.summaryLabel,
          emphasized && styles.summaryLabelPrimary,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export default function BayanihanScreen() {
  const [dashboard, setDashboard] =
    useState<Dashboard | null>(null);

  const [ledger, setLedger] =
    useState<LedgerRow[]>([]);

  const [withdrawals, setWithdrawals] =
    useState<Withdrawal[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [busy, setBusy] = useState(false);

  const [search, setSearch] = useState('');
  const [filter, setFilter] =
    useState<HistoryFilter>('all');

  const [requestOpen, setRequestOpen] =
    useState(false);

  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] =
    useState<Purpose>('medical');
  const [purposeText, setPurposeText] =
    useState('');

  const load = useCallback(async () => {
    const [
      dashboardResult,
      ledgerResult,
      withdrawalResult,
    ] = await Promise.all([
      supabase.rpc('get_my_bayanihan_dashboard'),

      supabase
        .from('bayanihan_ledger')
        .select(
          'id,direction,amount,source_type,source_key,source_id,description,created_at'
        )
        .order('created_at', {
          ascending: false,
        })
        .limit(250),

      supabase
        .from('bayanihan_withdrawals')
        .select(
          'id,requested_amount,purpose_category,purpose_text,status,reviewer_note,reviewed_at,created_at'
        )
        .order('created_at', {
          ascending: false,
        })
        .limit(100),
    ]);

    if (dashboardResult.error) {
      Alert.alert(
        'BUKLOD Bayanihan',
        dashboardResult.error.message
      );
    } else {
      setDashboard(
        dashboardResult.data as Dashboard
      );
    }

    if (ledgerResult.error) {
      Alert.alert(
        'Transaction History',
        ledgerResult.error.message
      );
    } else {
      setLedger(
        (ledgerResult.data ?? []) as LedgerRow[]
      );
    }

    if (withdrawalResult.error) {
      Alert.alert(
        'Bayanihan Requests',
        withdrawalResult.error.message
      );
    } else {
      setWithdrawals(
        (withdrawalResult.data ??
          []) as Withdrawal[]
      );
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filteredLedger = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return ledger.filter((row) => {
      const type = row.source_type;

      let matchesFilter = true;

      if (filter === 'formation') {
        matchesFilter =
          type === 'member_lesson';
      }

      if (filter === 'mentor') {
        matchesFilter =
          type === 'mentor_session' ||
          type === 'mentoring_release' ||
          type === 'mentoring_lesson' ||
          type === 'mentoring_completion';
      }

      if (filter === 'devotional') {
        matchesFilter =
          type === 'devotional';
      }

      if (filter === 'bible') {
        matchesFilter =
          type === 'bible_reading';
      }

      if (filter === 'other') {
        matchesFilter = ![
          'member_lesson',
          'mentor_session',
          'mentoring_release',
          'mentoring_lesson',
          'mentoring_completion',
          'devotional',
          'bible_reading',
        ].includes(type);
      }

      if (!matchesFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchable = [
        sourceLabel(row.source_type),
        row.description ?? '',
        row.direction,
        String(row.amount),
        row.source_key ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [ledger, search, filter]);

  const pendingRequests = useMemo(
    () =>
      withdrawals.filter(
        (item) => item.status === 'pending'
      ),
    [withdrawals]
  );

  const requestWithdrawal = async () => {
    const numericAmount = Number(amount);

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      Alert.alert(
        'Bayanihan Request',
        'Enter a valid amount greater than zero.'
      );
      return;
    }

    const spendable =
      Number(
        dashboard?.spendable_after_pending ??
          0
      );

    if (numericAmount > spendable) {
      Alert.alert(
        'Insufficient Bayanihan',
        `Your spendable Bayanihan after pending requests is ${money(
          spendable
        )}.`
      );
      return;
    }

    setBusy(true);

    const { error } = await supabase.rpc(
      'request_bayanihan_withdrawal',
      {
        p_amount: numericAmount,
        p_purpose_category: purpose,
        p_purpose_text:
          purposeText.trim() || null,
      }
    );

    setBusy(false);

    if (error) {
      Alert.alert(
        'Request Failed',
        error.message
      );
      return;
    }

    setAmount('');
    setPurposeText('');
    setRequestOpen(false);

    await load();

    Alert.alert(
      'Request Submitted',
      'Your Bayanihan request is now pending System Admin review.'
    );
  };

  const cancelWithdrawal = (
    withdrawal: Withdrawal
  ) => {
    Alert.alert(
      'Cancel Request',
      `Cancel your ${money(
        withdrawal.requested_amount
      )} Bayanihan request?`,
      [
        {
          text: 'Keep Request',
          style: 'cancel',
        },
        {
          text: 'Cancel Request',
          style: 'destructive',
          onPress: async () => {
            const { error } =
              await supabase.rpc(
                'cancel_my_bayanihan_withdrawal',
                {
                  p_withdrawal_id:
                    withdrawal.id,
                }
              );

            if (error) {
              Alert.alert(
                'Cancellation Failed',
                error.message
              );
              return;
            }

            await load();
          },
        },
      ]
    );
  };

  const breakdown =
    dashboard?.breakdown;

  return (
    <ScrollView
      style={shared.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
        />
      }
    >
      <View style={styles.hero}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>
            BUKLOD MEMBER BENEFIT
          </Text>

          <Text style={styles.title}>
            BUKLOD Bayanihan
          </Text>

          <Text style={styles.subtitle}>
            Your approved participation rewards,
            assistance requests and Bayanihan
            activity in one place.
          </Text>
        </View>

        <View style={styles.heroIcon}>
          <MaterialCommunityIcons
            name="account-group-outline"
            size={30}
            color="#275D45"
          />
        </View>
      </View>

      {loading || !dashboard ? (
        <View style={styles.loadingCard}>
          <Text style={styles.loadingText}>
            Loading Bayanihan account...
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.primaryBalance}>
            <Text style={styles.balanceEyebrow}>
              AVAILABLE BAYANIHAN
            </Text>

            <Text style={styles.balanceValue}>
              {money(
                dashboard.available_balance
              )}
            </Text>

            <View style={styles.balanceDivider} />

            <Text style={styles.balanceNote}>
              Spendable after pending requests:{' '}
              {money(
                dashboard.spendable_after_pending
              )}
            </Text>
          </View>

          <View style={styles.summaryGrid}>
            <SummaryCard
              label="Total Earned"
              value={money(
                dashboard.total_earned
              )}
              emphasized
            />

            <SummaryCard
              label="Used / Withdrawn"
              value={money(
                dashboard.total_used
              )}
            />

            <SummaryCard
              label="Pending Requests"
              value={money(
                dashboard.pending_withdrawals
              )}
            />
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEyebrow}>
              REWARD SOURCES
            </Text>

            <Text style={styles.sectionTitle}>
              Bayanihan Breakdown
            </Text>
          </View>

          <View style={styles.breakdownCard}>
            <BreakdownRow
              label="Formation Lessons"
              amount={
                breakdown?.lesson_credit ?? 0
              }
            />

            <BreakdownRow
              label="Mentoring"
              amount={
                breakdown?.mentor_credit ?? 0
              }
            />

            <BreakdownRow
              label="Devotionals"
              amount={
                breakdown?.devotional_credit ??
                0
              }
            />

            <BreakdownRow
              label="Daily Bible Reading"
              amount={
                breakdown?.bible_reading_credit ??
                0
              }
            />

            <BreakdownRow
              label="Other Approved Credits"
              amount={
                breakdown?.other_credit ?? 0
              }
              last
            />
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEyebrow}>
              MEMBER REQUEST
            </Text>

            <Text style={styles.sectionTitle}>
              Use Bayanihan
            </Text>
          </View>

          <Pressable
            onPress={() =>
              setRequestOpen((value) => !value)
            }
            style={styles.requestHeader}
          >
            <View style={styles.requestIcon}>
              <MaterialCommunityIcons
                name="heart-outline"
                size={22}
                color="#275D45"
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.requestTitle}>
                Withdrawal / Assistance Request
              </Text>

              <Text style={styles.requestSubtitle}>
                Insurance, medical, approved
                assistance or another approved
                purpose.
              </Text>
            </View>

            <MaterialCommunityIcons
              name={
                requestOpen
                  ? 'chevron-up'
                  : 'chevron-down'
              }
              size={24}
              color="#77837C"
            />
          </Pressable>

          {requestOpen && (
            <View style={styles.requestBody}>
              <Text style={styles.fieldLabel}>
                Amount
              </Text>

              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />

              <Text style={styles.fieldLabel}>
                Purpose
              </Text>

              <View style={styles.chips}>
                {PURPOSES.map((item) => (
                  <Pressable
                    key={item.key}
                    onPress={() =>
                      setPurpose(item.key)
                    }
                    style={[
                      styles.chip,
                      purpose === item.key &&
                        styles.chipOn,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        purpose === item.key &&
                          styles.chipTextOn,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.fieldLabel}>
                Details / Reason
              </Text>

              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                ]}
                value={purposeText}
                onChangeText={setPurposeText}
                multiline
                placeholder="Optional details about your request"
              />

              <Button
                title={
                  busy
                    ? 'SUBMITTING...'
                    : 'SUBMIT BAYANIHAN REQUEST'
                }
                onPress={requestWithdrawal}
              />
            </View>
          )}

          {pendingRequests.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionEyebrow}>
                  PENDING
                </Text>

                <Text style={styles.sectionTitle}>
                  Pending Requests
                </Text>
              </View>

              {pendingRequests.map((item) => (
                <View
                  key={item.id}
                  style={styles.pendingCard}
                >
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={
                          styles.pendingPurpose
                        }
                      >
                        {purposeLabel(
                          item.purpose_category
                        )}
                      </Text>

                      <Text style={styles.meta}>
                        {dateLabel(
                          item.created_at
                        )}
                      </Text>
                    </View>

                    <Text
                      style={
                        styles.pendingAmount
                      }
                    >
                      {money(
                        item.requested_amount
                      )}
                    </Text>
                  </View>

                  {!!item.purpose_text && (
                    <Text style={styles.note}>
                      {item.purpose_text}
                    </Text>
                  )}

                  <Pressable
                    onPress={() =>
                      cancelWithdrawal(item)
                    }
                    style={
                      styles.cancelButton
                    }
                  >
                    <Text
                      style={
                        styles.cancelButtonText
                      }
                    >
                      CANCEL REQUEST
                    </Text>
                  </Pressable>
                </View>
              ))}
            </>
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEyebrow}>
              ACCOUNT ACTIVITY
            </Text>

            <Text style={styles.sectionTitle}>
              Transaction History
            </Text>
          </View>

          <View style={styles.searchBox}>
            <MaterialCommunityIcons
              name="magnify"
              size={21}
              color="#7A867F"
            />

            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search rewards or transactions"
            />

            {!!search && (
              <Pressable
                onPress={() => setSearch('')}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color="#7A867F"
                />
              </Pressable>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={
              styles.filterRow
            }
          >
            {FILTERS.map((item) => (
              <Pressable
                key={item.key}
                onPress={() =>
                  setFilter(item.key)
                }
                style={[
                  styles.filterChip,
                  filter === item.key &&
                    styles.filterChipOn,
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    filter === item.key &&
                      styles.filterTextOn,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {filteredLedger.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>
                No matching transactions
              </Text>

              <Text style={styles.emptyText}>
                Approved Bayanihan credits and
                debits will appear here.
              </Text>
            </View>
          ) : (
            filteredLedger.map((item) => {
              const credit =
                item.direction === 'credit';

              return (
                <View
                  key={item.id}
                  style={styles.transactionCard}
                >
                  <View
                    style={
                      styles.transactionTop
                    }
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={
                          styles.transactionTitle
                        }
                      >
                        {sourceLabel(
                          item.source_type
                        )}
                      </Text>

                      <Text style={styles.meta}>
                        {dateLabel(
                          item.created_at
                        )}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.transactionAmount,
                        credit
                          ? styles.credit
                          : styles.debit,
                      ]}
                    >
                      {credit ? '+' : '-'}
                      {money(item.amount)}
                    </Text>
                  </View>

                  {!!item.description && (
                    <Text
                      style={
                        styles.transactionDescription
                      }
                    >
                      {item.description}
                    </Text>
                  )}
                </View>
              );
            })
          )}

          {withdrawals.some(
            (item) =>
              item.status !== 'pending'
          ) && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionEyebrow}>
                  REQUEST HISTORY
                </Text>

                <Text style={styles.sectionTitle}>
                  Bayanihan Requests
                </Text>
              </View>

              {withdrawals
                .filter(
                  (item) =>
                    item.status !== 'pending'
                )
                .map((item) => (
                  <View
                    key={item.id}
                    style={styles.historyCard}
                  >
                    <View
                      style={styles.rowBetween}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={
                            styles.pendingPurpose
                          }
                        >
                          {purposeLabel(
                            item.purpose_category
                          )}
                        </Text>

                        <Text
                          style={styles.meta}
                        >
                          {dateLabel(
                            item.created_at
                          )}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.statusBadge,
                          item.status ===
                            'approved' &&
                            styles.statusApproved,
                          item.status ===
                            'rejected' &&
                            styles.statusRejected,
                        ]}
                      >
                        <Text
                          style={
                            styles.statusText
                          }
                        >
                          {item.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={
                        styles.historyAmount
                      }
                    >
                      {money(
                        item.requested_amount
                      )}
                    </Text>

                    {!!item.reviewer_note && (
                      <Text style={styles.note}>
                        Admin note:{' '}
                        {item.reviewer_note}
                      </Text>
                    )}
                  </View>
                ))}
            </>
          )}
        </>
      )}

      <View style={styles.footerCard}>
        <MaterialCommunityIcons
          name="shield-check-outline"
          size={22}
          color="#275D45"
        />

        <Text style={styles.footerText}>
          Bayanihan credits are based on approved
          participation records. They are not a
          measure of spirituality or personal worth.
        </Text>
      </View>

      <Text style={styles.footerBrand}>
        SAMAHANG BINU KLOD NG PAG-IBIG
      </Text>
    </ScrollView>
  );
}

function BreakdownRow({
  label,
  amount,
  last = false,
}: {
  label: string;
  amount: number;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.breakdownRow,
        last && {
          borderBottomWidth: 0,
        },
      ]}
    >
      <Text style={styles.breakdownLabel}>
        {label}
      </Text>

      <Text style={styles.breakdownAmount}>
        {money(amount)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 0,
    paddingTop: 18,
    paddingBottom: 160,
    paddingLeft: 0,
    marginLeft: 0,
    paddingStart: 0,
    marginStart: 0,
  },

  hero: {
    flexDirection: 'row',
    gap: 6,
    padding: 19,
    marginBottom: 6,
    borderRadius: 0,
    backgroundColor: 'rgba(39,93,69,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(39,93,69,0.13)',
    paddingLeft: 0,
    marginLeft: 0,
    paddingStart: 0,
    marginStart: 0,
  },

  heroIcon: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    color: '#78847D',
  },

  title: {
    marginTop: 4,
    fontSize: 29,
    fontWeight: '900',
    color: '#1C2822',
  },

  subtitle: {
    display: 'none',
    marginTop: 6,
    fontSize: 12.5,
    lineHeight: 18,
    color: '#69766F',
  },

  loadingCard: {
    padding: 30,
    alignItems: 'center',
    borderRadius: 0,
    backgroundColor: '#FFFFFF',
    paddingLeft: 0,
    marginLeft: 0,
    paddingStart: 0,
    marginStart: 0,
  },

  loadingText: {
    color: '#738078',
  },

  primaryBalance: {
    padding: 21,
    marginBottom: 6,
    borderRadius: 22,
    backgroundColor: '#275D45',
  },

  balanceEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.72)',
  },

  balanceValue: {
    marginTop: 6,
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  balanceDivider: {
    height: 1,
    marginVertical: 13,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },

  balanceNote: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.82)',
  },

  summaryGrid: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
    paddingLeft: 0,
    marginLeft: 0,
    paddingStart: 0,
    marginStart: 0,
  },

  summaryCard: {
    flex: 1,
    minHeight: 88,
    padding: 12,
    justifyContent: 'center',
    borderRadius: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,45,35,0.09)',
    paddingLeft: 0,
    marginLeft: 0,
    paddingStart: 0,
    marginStart: 0,
  },

  summaryCardPrimary: {
    backgroundColor: 'rgba(39,93,69,0.07)',
    borderColor: 'rgba(39,93,69,0.18)',
  },

  summaryValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#344139',
  },

  summaryValuePrimary: {
    color: '#275D45',
  },

  summaryLabel: {
    marginTop: 5,
    fontSize: 9.5,
    lineHeight: 13,
    color: '#7C8881',
  },

  summaryLabelPrimary: {
    color: '#617068',
  },

  sectionHeader: {
    marginTop: 4,
    marginBottom: 6,
  },

  sectionEyebrow: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: '#87918B',
  },

  sectionTitle: {
    marginTop: 2,
    fontSize: 20,
    fontWeight: '900',
    color: '#202C26',
  },

  breakdownCard: {
    paddingHorizontal: 15,
    marginBottom: 6,
    borderRadius: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,45,35,0.09)',
    paddingLeft: 0,
    marginLeft: 0,
    paddingStart: 0,
    marginStart: 0,
  },

  breakdownRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    borderBottomWidth:
      StyleSheet.hairlineWidth,
    borderBottomColor:
      'rgba(25,45,35,0.09)',
  },

  breakdownLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#56635C',
  },

  breakdownAmount: {
    fontSize: 13,
    fontWeight: '900',
    color: '#275D45',
  },

  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 15,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,45,35,0.09)',
  },

  requestIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: 'rgba(39,93,69,0.07)',
  },

  requestTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#25322B',
  },

  requestSubtitle: {
    marginTop: 3,
    fontSize: 10.5,
    lineHeight: 15,
    color: '#7A867F',
  },

  requestBody: {
    marginTop: 6,
    marginBottom: 6,
    padding: 15,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,45,35,0.09)',
  },

  fieldLabel: {
    marginBottom: 6,
    fontSize: 11,
    fontWeight: '900',
    color: '#4E5B54',
  },

  input: {
    minHeight: 47,
    paddingHorizontal: 12,
    marginBottom: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(25,45,35,0.14)',
    backgroundColor: '#FFFFFF',
    color: '#25322B',
  },

  textArea: {
    minHeight: 92,
    paddingTop: 12,
    textAlignVertical: 'top',
  },

  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },

  chip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(25,45,35,0.14)',
    backgroundColor: '#FFFFFF',
  },

  chipOn: {
    borderColor: '#275D45',
    backgroundColor: 'rgba(39,93,69,0.08)',
  },

  chipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#6C7871',
  },

  chipTextOn: {
    fontWeight: '900',
    color: '#275D45',
  },

  pendingCard: {
    padding: 15,
    marginBottom: 6,
    borderRadius: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,45,35,0.09)',
    paddingLeft: 0,
    marginLeft: 0,
    paddingStart: 0,
    marginStart: 0,
  },

  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },

  pendingPurpose: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#26332C',
  },

  pendingAmount: {
    fontSize: 17,
    fontWeight: '900',
    color: '#8A6522',
  },

  meta: {
    marginTop: 3,
    fontSize: 10.5,
    color: '#87918B',
  },

  note: {
    marginTop: 6,
    fontSize: 11.5,
    lineHeight: 17,
    color: '#68756E',
  },

  cancelButton: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(140,55,55,0.06)',
  },

  cancelButtonText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#8A4444',
  },

  searchBox: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,45,35,0.10)',
  },

  searchInput: {
    flex: 1,
    color: '#25322B',
  },

  filterRow: {
    gap: 6,
    paddingVertical: 11,
    paddingRight: 15,
  },

  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,45,35,0.10)',
  },

  filterChipOn: {
    backgroundColor: '#275D45',
    borderColor: '#275D45',
  },

  filterText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#68756E',
  },

  filterTextOn: {
    color: '#FFFFFF',
    fontWeight: '900',
  },

  transactionCard: {
    padding: 14,
    marginBottom: 6,
    borderRadius: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,45,35,0.08)',
    paddingLeft: 0,
    marginLeft: 0,
    paddingStart: 0,
    marginStart: 0,
  },

  transactionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  transactionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#25322B',
  },

  transactionAmount: {
    fontSize: 14,
    fontWeight: '900',
  },

  credit: {
    color: '#275D45',
  },

  debit: {
    color: '#8A4444',
  },

  transactionDescription: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 16,
    color: '#707D75',
  },

  emptyCard: {
    padding: 22,
    alignItems: 'center',
    borderRadius: 0,
    backgroundColor: '#FFFFFF',
    paddingLeft: 0,
    marginLeft: 0,
    paddingStart: 0,
    marginStart: 0,
  },

  emptyTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#3B4841',
  },

  emptyText: {
    marginTop: 4,
    fontSize: 11,
    textAlign: 'center',
    color: '#849089',
  },

  historyCard: {
    padding: 14,
    marginBottom: 6,
    borderRadius: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,45,35,0.08)',
    paddingLeft: 0,
    marginLeft: 0,
    paddingStart: 0,
    marginStart: 0,
  },

  historyAmount: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: '900',
    color: '#344139',
  },

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(100,100,100,0.08)',
  },

  statusApproved: {
    backgroundColor: 'rgba(39,93,69,0.10)',
  },

  statusRejected: {
    backgroundColor: 'rgba(140,55,55,0.09)',
  },

  statusText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#59665F',
  },

  footerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 6,
    padding: 14,
    borderRadius: 0,
    backgroundColor: 'rgba(39,93,69,0.055)',
    paddingLeft: 0,
    marginLeft: 0,
    paddingStart: 0,
    marginStart: 0,
  },

  footerText: {
    flex: 1,
    fontSize: 10.5,
    lineHeight: 15,
    color: '#6D7972',
  },

  footerBrand: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: '#929C96',
  },
});

