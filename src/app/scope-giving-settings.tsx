import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';

type ScopeReceiver = {
  scope_id: string;
  scope_name: string;
  scope_kind: string;
  parent_name: string | null;
  gcash_name: string;
  gcash_mobile: string;
  gcash_payment_url: string | null;
  active: boolean;
};

function normalizeMobile(value: string) {
  let digits = value.replace(/\D/g, '');

  if (digits.startsWith('63') && digits.length === 12) {
    digits = '0' + digits.slice(2);
  }

  return digits;
}

export default function ScopeGivingSettingsScreen() {
  const params = useLocalSearchParams<{ scopeId?: string }>();

  const scopeId =
    typeof params.scopeId === 'string'
      ? params.scopeId
      : '';

  const [scope, setScope] = useState<ScopeReceiver | null>(null);
  const [gcashName, setGcashName] = useState('');
  const [gcashMobile, setGcashMobile] = useState('');
  const [paymentUrl, setPaymentUrl] = useState('');
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!scopeId) return;

    setBusy(true);

    try {
      const { data, error } = await supabase.rpc(
        'giving_get_receiver_admin_scope',
        { p_scope_id: scopeId },
      );

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;

      if (!row) {
        throw new Error(
          'You do not have permission to manage Giving for this scope.',
        );
      }

      const receiver = row as ScopeReceiver;

      setScope(receiver);
      setGcashName(receiver.gcash_name || '');
      setGcashMobile(receiver.gcash_mobile || '');
      setPaymentUrl(receiver.gcash_payment_url || '');
      setActive(receiver.active !== false);
    } catch (error: any) {
      Alert.alert(
        'Giving / GCash Settings',
        error?.message || 'Could not load this scope.',
      );
    } finally {
      setBusy(false);
    }
  }, [scopeId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!scopeId) return;

    const mobile = normalizeMobile(gcashMobile);

    if (!gcashName.trim()) {
      Alert.alert(
        'GCash receiver',
        'Enter the receiving GCash name.',
      );
      return;
    }

    if (!/^09[0-9]{9}$/.test(mobile)) {
      Alert.alert(
        'GCash mobile',
        'Enter a valid 09XXXXXXXXX mobile number.',
      );
      return;
    }

    if (
      paymentUrl.trim() &&
      !/^https:\/\//i.test(paymentUrl.trim())
    ) {
      Alert.alert(
        'Payment URL',
        'Optional payment URL must start with https://',
      );
      return;
    }

    setBusy(true);

    try {
      const { error } = await supabase.rpc(
        'giving_upsert_scope_receiver',
        {
          p_scope_id: scopeId,
          p_gcash_name: gcashName.trim(),
          p_gcash_mobile: mobile,
          p_gcash_payment_url: paymentUrl.trim() || null,
          p_active: active,
        },
      );

      if (error) throw error;

      Alert.alert(
        'Saved',
        'This scope is now using the saved GCash receiver in BUKLOD Giving.',
      );

      await load();
    } catch (error: any) {
      Alert.alert(
        'Could not save',
        error?.message || 'GCash settings were not saved.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{ title: 'Giving / GCash Settings' }}
      />

      <ScrollView
        contentContainerStyle={styles.wrap}
        keyboardShouldPersistTaps="handled">

        <View style={styles.card}>
          <Text style={styles.eyebrow}>EXACT BUKLOD SCOPE</Text>

          <Text style={styles.scopeName}>
            {scope?.scope_name || 'Loading...'}
          </Text>

          <Text style={styles.scopeMeta}>
            {scope?.scope_kind || ''}
            {scope?.parent_name
              ? ' - ' + scope.parent_name
              : ''}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>GCASH RECEIVER NAME</Text>

          <TextInput
            value={gcashName}
            onChangeText={setGcashName}
            placeholder="e.g. MZB Ministry Inc."
            style={styles.input}
          />

          <Text style={styles.label}>GCASH MOBILE</Text>

          <TextInput
            value={gcashMobile}
            onChangeText={setGcashMobile}
            keyboardType="phone-pad"
            placeholder="09XXXXXXXXX"
            style={styles.input}
          />

          <Text style={styles.label}>
            OPTIONAL MERCHANT / PAYMENT URL
          </Text>

          <TextInput
            value={paymentUrl}
            onChangeText={setPaymentUrl}
            autoCapitalize="none"
            keyboardType="url"
            placeholder="https://..."
            style={styles.input}
          />

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>ACCEPT GIVING</Text>
              <Text style={styles.help}>
                Turn off to temporarily stop this exact scope from receiving.
              </Text>
            </View>

            <Switch
              value={active}
              onValueChange={setActive}
            />
          </View>

          <Text
            onPress={busy ? undefined : save}
            style={[
              styles.save,
              busy && styles.disabled,
            ]}>
            {busy ? 'SAVING...' : 'SAVE GCASH SETTINGS'}
          </Text>
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Security</Text>
          <Text style={styles.noticeText}>
            Save only the public receiving name, GCash mobile, and optional HTTPS payment URL.
            Never store MPIN, OTP, wallet password, or wallet secret.
          </Text>
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>
            How BUKLOD Giving uses this
          </Text>
          <Text style={styles.noticeText}>
            The sender only selects this Organization, Sub-organization, or Cluster in For:.
            BUKLOD Giving reads the saved receiver automatically. The sender cannot edit it.
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: 18,
    gap: 12,
    backgroundColor: '#F6F8F7',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DDE5E1',
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 10,
  },
  eyebrow: {
    color: '#6B7972',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  scopeName: {
    color: '#153B2E',
    fontSize: 22,
    fontWeight: '900',
  },
  scopeMeta: {
    color: '#6B7972',
    fontSize: 12,
  },
  label: {
    color: '#5E6D66',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  input: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D9E1DD',
    backgroundColor: '#FFFFFF',
    color: '#17231E',
    paddingHorizontal: 13,
  },
  switchRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  help: {
    color: '#728078',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  save: {
    marginTop: 4,
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: '#176B4A',
    color: '#FFFFFF',
    textAlign: 'center',
    textAlignVertical: 'center',
    paddingVertical: 15,
    fontSize: 13,
    fontWeight: '900',
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.55,
  },
  notice: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#EAF3EE',
  },
  noticeTitle: {
    color: '#205C43',
    fontWeight: '900',
  },
  noticeText: {
    color: '#50645A',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
});