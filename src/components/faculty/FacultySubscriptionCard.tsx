import { useMemo, useState } from 'react';
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

import { supabase } from '@/lib/supabase';
import { useFacultyEntitlement } from '@/hooks/useFacultyEntitlement';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';

type PlanCode = 'MONTHLY' | 'YEARLY';

export default function FacultySubscriptionCard() {
  const { theme } = useBuklodPresentation();
  const {
    has_faculty_entitlement: active,
    faculty_pricing: pricing,
    loading,
    refresh,
  } = useFacultyEntitlement();

  const [plan, setPlan] = useState<PlanCode>('YEARLY');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const amount = plan === 'MONTHLY' ? pricing.monthly_php : pricing.yearly_php;
  const savings = Math.max(0, pricing.monthly_php * 12 - pricing.yearly_php);

  const styles = useMemo(() => createStyles(theme), [theme]);

  const submit = async () => {
    if (!reference.trim()) {
      Alert.alert('BUKLOD Faculty', 'Enter the GCash reference number for this payment.');
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc(
        'buklod_submit_personal_focus_app_payment_v2',
        {
          p_focus_app_code: 'faculty',
          p_plan_code: plan,
          p_gcash_reference: reference.trim(),
        }
      );

      if (error) throw error;
      setSubmitted(true);
      setReference('');
      await refresh();
      Alert.alert(
        'Payment submitted',
        `Your ${plan === 'MONTHLY' ? '₱299 monthly' : '₱1,999 yearly'} BUKLOD Faculty payment is pending verification.`
      );
      return data;
    } catch (error: any) {
      Alert.alert('BUKLOD Faculty', String(error?.message ?? error));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (active) {
    return (
      <View style={[styles.card, styles.activeCard]}>
        <View style={styles.row}>
          <View style={styles.iconBox}>
            <MaterialCommunityIcons name="shield-check-outline" size={24} color={theme.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>BUKLOD Faculty Active</Text>
            <Text style={styles.body}>
              Classroom faculty, Attendance faculty, and Quiz examiner access are bundled in this entitlement. No separate payment is required for those three faculty-side tools.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconBox}>
          <MaterialCommunityIcons name="human-male-board" size={24} color={theme.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>INDIVIDUAL FACULTY BUNDLE</Text>
          <Text style={styles.title}>BUKLOD Faculty</Text>
        </View>
      </View>

      <Text style={styles.body}>
        One Faculty subscription covers BUKLOD Classroom faculty controls, BUKLOD Attendance faculty controls, and BUKLOD Quiz examiner access. Student classroom use remains free.
      </Text>

      <View style={styles.planRow}>
        <Pressable
          onPress={() => setPlan('MONTHLY')}
          style={[styles.plan, plan === 'MONTHLY' && styles.planSelected]}
        >
          <Text style={[styles.planLabel, plan === 'MONTHLY' && styles.planLabelSelected]}>MONTHLY</Text>
          <Text style={[styles.planPrice, plan === 'MONTHLY' && styles.planLabelSelected]}>₱299</Text>
          <Text style={[styles.planMeta, plan === 'MONTHLY' && styles.planLabelSelected]}>1 month</Text>
        </Pressable>

        <Pressable
          onPress={() => setPlan('YEARLY')}
          style={[styles.plan, plan === 'YEARLY' && styles.planSelected]}
        >
          <Text style={[styles.planLabel, plan === 'YEARLY' && styles.planLabelSelected]}>YEARLY</Text>
          <Text style={[styles.planPrice, plan === 'YEARLY' && styles.planLabelSelected]}>₱1,999</Text>
          <Text style={[styles.planMeta, plan === 'YEARLY' && styles.planLabelSelected]}>12 months · save ₱{savings.toLocaleString()}</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>GCASH REFERENCE</Text>
      <TextInput
        value={reference}
        onChangeText={setReference}
        placeholder="Enter payment reference"
        placeholderTextColor={theme.textMuted}
        style={styles.input}
      />

      <Pressable disabled={busy || submitted} onPress={submit} style={[styles.submit, (busy || submitted) && styles.disabled]}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <MaterialCommunityIcons name={submitted ? 'clock-check-outline' : 'send-check-outline'} size={19} color="#fff" />
        )}
        <Text style={styles.submitText}>
          {submitted ? 'Pending verification' : `Submit ₱${amount.toLocaleString()} ${plan === 'MONTHLY' ? 'Monthly' : 'Yearly'} Payment`}
        </Text>
      </Pressable>

      <Text style={styles.note}>
        Existing active/grandfathered Faculty access is recognized automatically and will not be asked to pay again merely because the pricing model changed.
      </Text>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useBuklodPresentation>['theme']) {
  return StyleSheet.create({
    card: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      borderRadius: 20,
      padding: 16,
      gap: 12,
    },
    activeCard: {
      backgroundColor: theme.accentSoft,
    },
    row: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
    iconBox: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accentSoft,
    },
    eyebrow: { color: theme.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    title: { color: theme.textPrimary, fontSize: 19, fontWeight: '900', marginTop: 2 },
    body: { color: theme.textMuted, fontSize: 12, lineHeight: 18 },
    planRow: { flexDirection: 'row', gap: 9 },
    plan: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceElevated,
      borderRadius: 15,
      padding: 12,
    },
    planSelected: { backgroundColor: theme.accent, borderColor: theme.accent },
    planLabel: { color: theme.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
    planPrice: { color: theme.textPrimary, fontSize: 21, fontWeight: '900', marginTop: 3 },
    planMeta: { color: theme.textMuted, fontSize: 9, marginTop: 2 },
    planLabelSelected: { color: '#fff' },
    label: { color: theme.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceElevated,
      color: theme.textPrimary,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    submit: {
      minHeight: 46,
      borderRadius: 13,
      backgroundColor: theme.accent,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingHorizontal: 12,
    },
    submitText: { color: '#fff', fontWeight: '900', fontSize: 12 },
    note: { color: theme.textMuted, fontSize: 10, lineHeight: 15 },
    disabled: { opacity: 0.55 },
  });
}
