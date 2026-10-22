import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import {
  Button,
  Card,
  SectionTitle,
  shared,
} from '@/components/UI';
import { AdminGate } from '@/components/AdminGate';
import { colors } from '@/lib/theme';

type Church = {
  id: string;
  name: string;
};

type GivingAccount = {
  id: string;
  church_id: string;
  payment_method: 'gcash' | 'bank' | 'cash' | 'other';
  account_name: string;
  account_number: string | null;
  instructions: string | null;
  is_active: boolean;
  is_primary: boolean;

  // PATCH_153F_3_TYPE_FIX3
  provider_code: string | null;
  provider_display_name: string | null;
  app_deep_link: string | null;
  web_checkout_url: string | null;
  verification_mode:
    | 'manual'
    | 'provider_callback'
    | 'provider_api';
};

const methods = [
  { value: 'gcash', label: 'GCash' },
  { value: 'bank', label: 'Bank' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
] as const;

export default function AdminGivingScreen() {
  const [churches, setChurches] = useState<Church[]>([]);
  const [churchId, setChurchId] = useState('');

  const [accounts, setAccounts] =
    useState<GivingAccount[]>([]);

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] =
    useState<GivingAccount['payment_method']>('gcash');

  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [instructions, setInstructions] = useState('');

  const [isPrimary, setIsPrimary] = useState(true);
  const [isActive, setIsActive] = useState(true);

  const [saving, setSaving] = useState(false);

  const selectedChurch =
    churches.find((item) => item.id === churchId) ?? null;

  const resetForm = () => {
    setEditingId(null);
    setPaymentMethod('gcash');
    setAccountName('');
    setAccountNumber('');
    setInstructions('');
    setIsPrimary(true);
    setIsActive(true);
  };

  const loadChurches = useCallback(async () => {
    const { data, error } = await supabase
      .from('churches')
      .select('id,name')
      .order('name');

    if (error) {
      Alert.alert('Churches', error.message);
      return;
    }

    const rows = (data ?? []) as Church[];

    setChurches(rows);

    setChurchId((current) =>
      current || rows[0]?.id || ''
    );
  }, []);

  const loadAccounts = useCallback(async () => {
    if (!churchId) {
      setAccounts([]);
      return;
    }

    const { data, error } = await supabase
      .from('church_giving_accounts')
      .select(`
        id,
        church_id,
        payment_method,
        account_name,
        account_number,
        instructions,
        is_active,
        is_primary
      `)
      .eq('church_id', churchId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      Alert.alert('Giving Accounts', error.message);
      return;
    }

    setAccounts((data ?? []) as GivingAccount[]);
  }, [churchId]);

  useEffect(() => {
    loadChurches();
  }, [loadChurches]);

  useEffect(() => {
    resetForm();
    loadAccounts();
  }, [churchId, loadAccounts]);

  const editAccount = (account: GivingAccount) => {
    setEditingId(account.id);
    setPaymentMethod(account.payment_method);
    setAccountName(account.account_name);
    setAccountNumber(account.account_number ?? '');
    setInstructions(account.instructions ?? '');
    setIsPrimary(account.is_primary);
    setIsActive(account.is_active);
  };

  const saveAccount = async () => {
    if (!churchId) {
      Alert.alert(
        'Local Church',
        'Please select a Local Church.'
      );
      return;
    }

    if (!accountName.trim()) {
      Alert.alert(
        'Account Name',
        'Please enter the account name.'
      );
      return;
    }

    if (
      ['gcash', 'bank'].includes(paymentMethod) &&
      !accountNumber.trim()
    ) {
      Alert.alert(
        'Account Number',
        'Please enter the account or mobile number.'
      );
      return;
    }

    try {
      setSaving(true);

      /*
       * If this account becomes PRIMARY,
       * remove primary status from the other accounts first.
       */
      if (isPrimary && isActive) {
        let unprimaryQuery = supabase
          .from('church_giving_accounts')
          .update({ is_primary: false })
          .eq('church_id', churchId)
          .neq('is_primary', false);

        if (editingId) {
          unprimaryQuery =
            unprimaryQuery.neq('id', editingId);
        }

        const { error: primaryError } =
          await unprimaryQuery;

        if (primaryError) throw primaryError;
      }

      const payload = {
        church_id: churchId,
        payment_method: paymentMethod,
        account_name: accountName.trim(),
        account_number:
          accountNumber.trim() || null,
        instructions:
          instructions.trim() || null,
        is_primary: isPrimary,
        is_active: isActive,
      };

      if (editingId) {
        const { error } = await supabase
          .from('church_giving_accounts')
          .update(payload)
          .eq('id', editingId);

        if (error) throw error;

        Alert.alert(
          'Giving Account',
          'Payment account updated successfully.'
        );
      } else {
        const { error } = await supabase
          .from('church_giving_accounts')
          .insert(payload);

        if (error) throw error;

        Alert.alert(
          'Giving Account',
          'Payment account added successfully.'
        );
      }

      resetForm();
      await loadAccounts();
    } catch (error: any) {
      Alert.alert(
        'Could Not Save',
        error?.message ||
          'Could not save the giving account.'
      );
    } finally {
      setSaving(false);
    }
  };

  const deactivateAccount = async (
    account: GivingAccount
  ) => {
    Alert.alert(
      'Deactivate Account',
      `Deactivate ${account.account_name}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('church_giving_accounts')
              .update({
                is_active: false,
                is_primary: false,
              })
              .eq('id', account.id);

            if (error) {
              Alert.alert(
                'Giving Account',
                error.message
              );
              return;
            }

            resetForm();
            await loadAccounts();
          },
        },
      ]
    );
  };

  return (
    <AdminGate>
      <ScrollView
        style={shared.screen}
        contentContainerStyle={shared.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => router.back()}
          style={{ marginBottom: 12 }}
        >
          <Text style={styles.back}>
            ‹ BACK TO ADMIN
          </Text>
        </Pressable>

        <Text style={shared.h1}>
          Tithes & Giving
        </Text>

        <Text style={shared.muted}>
          Manage official Local Church payment
          accounts used by the Pay My Tithes
          feature.
        </Text>

                <Button
          title="MANAGE TREASURERS"
          outline
          onPress={() => router.push('/admin/giving/treasurers')}
        />

        <Button
          title="REVIEW GIVING SUBMISSIONS"
          onPress={() => router.push('/giving/review')}
        />

<SectionTitle>
          LOCAL CHURCH
        </SectionTitle>

        <View style={styles.churchWrap}>
          {churches.map((church) => {
            const selected =
              church.id === churchId;

            return (
              <Pressable
                key={church.id}
                onPress={() =>
                  setChurchId(church.id)
                }
                style={[
                  styles.churchChip,
                  selected &&
                    styles.churchChipOn,
                ]}
              >
                <Text
                  style={[
                    styles.churchText,
                    selected &&
                      styles.churchTextOn,
                  ]}
                >
                  {church.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <SectionTitle>
          CURRENT PAYMENT ACCOUNTS
        </SectionTitle>

        {accounts.length === 0 ? (
          <Card>
            <Text style={shared.muted}>
              No payment account configured for{' '}
              {selectedChurch?.name ||
                'this Local Church'}.
            </Text>
          </Card>
        ) : (
          accounts.map((account) => (
            <Card key={account.id}>
              <View style={styles.accountHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.method}>
                    {account.payment_method.toUpperCase()}
                  </Text>

                  <Text style={styles.accountName}>
                    {account.account_name}
                  </Text>

                  {!!account.account_number && (
                    <Text
                      style={styles.accountNumber}
                    >
                      {account.account_number}
                    </Text>
                  )}
                </View>

                <View
                  style={{
                    alignItems: 'flex-end',
                    gap: 5,
                  }}
                >
                  {account.is_primary && (
                    <Text style={styles.primaryBadge}>
                      PRIMARY
                    </Text>
                  )}

                  <Text
                    style={[
                      styles.activeBadge,
                      !account.is_active &&
                        styles.inactiveBadge,
                    ]}
                  >
                    {account.is_active
                      ? 'ACTIVE'
                      : 'INACTIVE'}
                  </Text>
                </View>
              </View>

              {!!account.instructions && (
                <Text style={styles.instructions}>
                  {account.instructions}
                </Text>
              )}

              {(account.payment_method === 'gcash' ||
                account.payment_method === 'bank') && (
                <View
                  style={{
                    marginTop: 10,
                    padding: 10,
                    borderRadius: 10,
                    backgroundColor: '#F4F7F5',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '900',
                      color: '#42564A',
                    }}
                  >
                    PROVIDER:{' '}
                    {account.provider_display_name ||
                      account.provider_code ||
                      'Not configured'}
                  </Text>

                  <Text
                    style={{
                      marginTop: 4,
                      fontSize: 10,
                      color: '#68756D',
                    }}
                  >
                    Verification:{' '}
                    {(
                      account.verification_mode ||
                      'manual'
                    )
                      .replace(/_/g, ' ')
                      .toUpperCase()}
                  </Text>

                  {!!(
                    account.app_deep_link ||
                    account.web_checkout_url
                  ) && (
                    <Text
                      style={{
                        marginTop: 4,
                        fontSize: 10,
                        color: '#176B3A',
                        fontWeight: '800',
                      }}
                    >
                      PAYMENT LAUNCH CONFIGURED
                    </Text>
                  )}
                </View>
              )}

              <View style={styles.actions}>
                <Pressable
                  onPress={() =>
                    editAccount(account)
                  }
                  style={styles.editButton}
                >
                  <Text style={styles.editText}>
                    EDIT
                  </Text>
                </Pressable>

                {account.is_active && (
                  <Pressable
                    onPress={() =>
                      deactivateAccount(account)
                    }
                    style={styles.deactivateButton}
                  >
                    <Text
                      style={
                        styles.deactivateText
                      }
                    >
                      DEACTIVATE
                    </Text>
                  </Pressable>
                )}
              </View>
            </Card>
          ))
        )}

        <SectionTitle>
          {editingId
            ? 'EDIT PAYMENT ACCOUNT'
            : 'ADD PAYMENT ACCOUNT'}
        </SectionTitle>

        <Card>
          <Text style={styles.label}>
            PAYMENT METHOD
          </Text>

          <View style={styles.methodWrap}>
            {methods.map((method) => {
              const selected =
                paymentMethod === method.value;

              return (
                <Pressable
                  key={method.value}
                  onPress={() =>
                    setPaymentMethod(
                      method.value
                    )
                  }
                  style={[
                    styles.methodChip,
                    selected &&
                      styles.methodChipOn,
                  ]}
                >
                  <Text
                    style={[
                      styles.methodChipText,
                      selected &&
                        styles.methodChipTextOn,
                    ]}
                  >
                    {method.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>
            ACCOUNT NAME
          </Text>

          <TextInput
            value={accountName}
            onChangeText={setAccountName}
            placeholder="Example: MZB STA. INES"
            style={styles.input}
          />

          <Text style={styles.label}>
            ACCOUNT / MOBILE NUMBER
          </Text>

          <TextInput
            value={accountNumber}
            onChangeText={setAccountNumber}
            placeholder="09XXXXXXXXX"
            keyboardType={
              paymentMethod === 'gcash'
                ? 'phone-pad'
                : 'default'
            }
            style={styles.input}
          />

          <Text style={styles.label}>
            PAYMENT INSTRUCTIONS
          </Text>

          <TextInput
            value={instructions}
            onChangeText={setInstructions}
            multiline
            placeholder="Optional instructions for members..."
            style={[
              styles.input,
              {
                minHeight: 100,
                paddingTop: 12,
                textAlignVertical: 'top',
              },
            ]}
          />

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>
                Primary Account
              </Text>

              <Text style={shared.muted}>
                Show this account first to members.
              </Text>
            </View>

            <Switch
              value={isPrimary}
              onValueChange={setIsPrimary}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>
                Active
              </Text>

              <Text style={shared.muted}>
                Members can use this account.
              </Text>
            </View>

            <Switch
              value={isActive}
              onValueChange={setIsActive}
            />
          </View>

          <Button
            title={
              saving
                ? 'SAVING...'
                : editingId
                  ? 'SAVE CHANGES'
                  : 'ADD PAYMENT ACCOUNT'
            }
            onPress={saveAccount}
          />

          {editingId && (
            <View style={{ marginTop: 8 }}>
              <Button
                title="CANCEL EDITING"
                outline
                onPress={resetForm}
              />
            </View>
          )}
        </Card>

        <View style={{ height: 30 }} />
      </ScrollView>
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  back: {
    color: colors.green,
    fontWeight: '900',
    fontSize: 11,
  },

  churchWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },

  churchChip: {
    borderWidth: 1,
    borderColor: '#D9E3DD',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#FFFFFF',
  },

  churchChipOn: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },

  churchText: {
    color: colors.green,
    fontSize: 11,
    fontWeight: '800',
  },

  churchTextOn: {
    color: '#FFFFFF',
  },

  accountHeader: {
    flexDirection: 'row',
  },

  method: {
    color: colors.green,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },

  accountName: {
    marginTop: 5,
    fontSize: 16,
    fontWeight: '900',
  },

  accountNumber: {
    marginTop: 3,
    fontSize: 19,
    color: colors.green,
    fontWeight: '900',
  },

  primaryBadge: {
    backgroundColor: '#275D45',
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    overflow: 'hidden',
  },

  activeBadge: {
    backgroundColor: '#E0F1E6',
    color: '#21623D',
    fontWeight: '900',
    fontSize: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    overflow: 'hidden',
  },

  inactiveBadge: {
    backgroundColor: '#ECECEC',
    color: '#6D6D6D',
  },

  instructions: {
    marginTop: 10,
    fontSize: 11,
    lineHeight: 17,
  },

  actions: {
    flexDirection: 'row',
    marginTop: 13,
    gap: 8,
  },

  editButton: {
    borderWidth: 1,
    borderColor: colors.green,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 10,
  },

  editText: {
    color: colors.green,
    fontSize: 9,
    fontWeight: '900',
  },

  deactivateButton: {
    borderWidth: 1,
    borderColor: '#A43B3B',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 10,
  },

  deactivateText: {
    color: '#A43B3B',
    fontSize: 9,
    fontWeight: '900',
  },

  label: {
    marginBottom: 6,
    marginTop: 7,
    color: colors.green,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },

  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#D9E3DD',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },

  methodWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 12,
  },

  methodChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#D9E3DD',
    borderRadius: 18,
  },

  methodChipOn: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },

  methodChipText: {
    color: colors.green,
    fontWeight: '800',
    fontSize: 10,
  },

  methodChipTextOn: {
    color: '#FFFFFF',
  },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    marginBottom: 7,
  },

  switchTitle: {
    fontSize: 13,
    fontWeight: '900',
  },
});

