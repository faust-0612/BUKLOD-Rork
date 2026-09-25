import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { BuklodFeedbackBanner } from '@/components/BuklodFeedbackBanner';
import { useBuklodFeedback } from '@/providers/BuklodFeedbackProvider';
import { useBuklodI18n } from '@/providers/BuklodI18nProvider';
import {
  buildBuklodUserFeedback,
  trackBuklodFeedbackEvent,
  type BuklodUserFeedback,
} from '@/lib/buklodUserFeedback';

type RecoveryStatus = {
  pinConfigured: boolean;
  pinSetAt: string | null;
  loginMethod: string | null;
  loginHint: string | null;
};

export default function RecoveryPinScreen() {
  const { t } = useBuklodI18n();
  const { showFeedback } = useBuklodFeedback();
  const [feedback, setFeedback] =
    useState<BuklodUserFeedback | null>(null);
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(true);
  const [status, setStatus] = useState<RecoveryStatus>({
    pinConfigured: false,
    pinSetAt: null,
    loginMethod: null,
    loginHint: null,
  });
  const inFlight = useRef(false);

  const loadStatus = async () => {
    setStatusBusy(true);
    try {
      const { data, error } = await withBuklodTimeout(
        supabase.functions.invoke('account-recovery-v3', {
          body: { action: 'recovery_status' },
        }),
        15_000,
        'Recovery PIN status',
      );
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message ?? 'Could not load recovery status.');
      setStatus({
        pinConfigured: data.pinConfigured === true,
        pinSetAt: typeof data.pinSetAt === 'string' ? data.pinSetAt : null,
        loginMethod: typeof data.loginMethod === 'string' ? data.loginMethod : null,
        loginHint: typeof data.loginHint === 'string' ? data.loginHint : null,
      });
    } catch (error) {
      console.warn('Recovery PIN status could not be loaded.');
      const next = buildBuklodUserFeedback(
        error,
        {
          context: 'recovery',
          fallbackTitle: 'Recovery PIN status unavailable',
          fallbackMessage: t('recovery.pinStatusFailed'),
        },
      );
      setFeedback({
        ...next,
        tone: 'warning',
        title: 'Recovery PIN status unavailable',
        message: t('recovery.pinStatusFailed'),
        nextStep: 'Try again or open Need Help if it continues.',
        supportCode: next.supportCode ?? 'REC-100',
        needsSupport: true,
      });
      void trackBuklodFeedbackEvent({
        event: 'error_shown',
        category: next.category,
        supportCode: next.supportCode ?? 'REC-100',
        route: '/account/recovery-pin',
        feature: 'Recovery PIN',
        outcome: 'status_load_failed',
      });
    } finally {
      setStatusBusy(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const save = async () => {
    if (!/^\d{6}$/.test(pin)) {
      return Alert.alert('Recovery PIN', 'Create a PIN containing exactly 6 digits.');
    }
    if (pin !== confirm) {
      return Alert.alert('Recovery PIN', 'The PINs do not match.');
    }
    if (/^(\d)\1{5}$/.test(pin) || ['123456', '654321', '000000', '111111', '121212'].includes(pin)) {
      return Alert.alert('Recovery PIN', 'Choose a less predictable 6-digit PIN.');
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFeedback(null);
    void trackBuklodFeedbackEvent({
      event: 'recovery_attempted',
      route: '/account/recovery-pin',
      feature: 'Recovery PIN',
      outcome: 'set_pin',
    });

    try {
      const { data, error } = await withBuklodTimeout(
        supabase.functions.invoke('account-recovery-v3', {
          body: { action: 'set_pin', pin },
        }),
        15_000,
        'Save Recovery PIN',
      );
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message ?? 'Could not save Recovery PIN.');

      setPin('');
      setConfirm('');
      await loadStatus();
      const successFeedback: BuklodUserFeedback = {
        tone: 'success',
        category: null,
        title: t('recovery.pinSaved'),
        message:
          'Your account now has Recovery PIN protection. Keep the PIN somewhere only you can access.',
        nextStep: 'You can replace the PIN later from this screen.',
        supportCode: null,
        retryable: false,
        needsSupport: false,
      };
      setFeedback(successFeedback);
      showFeedback(successFeedback, { autoHideMs: 4800 });
      void trackBuklodFeedbackEvent({
        event: 'recovery_success',
        route: '/account/recovery-pin',
        feature: 'Recovery PIN',
        outcome: 'pin_saved',
      });
      Alert.alert(
        t('recovery.pinSaved'),
        'Your account now has PIN recovery protection. Keep this 6-digit PIN somewhere only you can access. BUKLOD will not display it later.'
      );
    } catch (error: any) {
      const next = buildBuklodUserFeedback(
        error,
        {
          context: 'recovery',
          fallbackTitle: 'Recovery PIN not saved',
          fallbackMessage:
            "BUKLOD couldn't save your Recovery PIN right now.",
        },
      );
      const safeFeedback: BuklodUserFeedback = {
        ...next,
        title: 'Recovery PIN not saved',
        message:
          "BUKLOD couldn't save your Recovery PIN right now.",
        nextStep: 'Try again. If it repeats, open Need Help.',
        supportCode: next.supportCode ?? 'REC-100',
        needsSupport: true,
      };
      setFeedback(safeFeedback);
      void trackBuklodFeedbackEvent({
        event: 'error_shown',
        category: safeFeedback.category,
        supportCode: safeFeedback.supportCode,
        route: '/account/recovery-pin',
        feature: 'Recovery PIN',
        outcome: 'pin_save_failed',
      });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)/buklod' as any);
          }}
          style={styles.back}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="shield-lock-outline" size={30} color={colors.green} />
        </View>

        <Text style={styles.title}>Recovery PIN</Text>
        <Text style={styles.subtitle}>
          Your private 6-digit fallback for recovering BUKLOD when you forget the password.
        </Text>

        {!!feedback && (
          <View style={styles.feedbackWrap}>
            <BuklodFeedbackBanner
              feedback={feedback}
              onRetry={
                feedback.retryable && !busy
                  ? () => void loadStatus()
                  : null
              }
              onNeedHelp={
                feedback.needsSupport
                  ? () => {
                      void trackBuklodFeedbackEvent({
                        event: 'support_opened_after_error',
                        category: feedback.category,
                        supportCode: feedback.supportCode,
                        route: '/account/recovery-pin',
                        feature: 'Recovery PIN',
                        outcome: 'need_help',
                      });
                      router.push({
                        pathname: '/help' as any,
                        params: {
                          category: 'RECOVERY_CODE',
                          errorCode: feedback.supportCode ?? 'REC-100',
                          message: feedback.message,
                          sourceRoute: '/account/recovery-pin',
                        },
                      });
                    }
                  : null
              }
            />
          </View>
        )}

        <View style={[styles.statusCard, status.pinConfigured ? styles.statusReady : styles.statusNeedsSetup]}>
          {statusBusy ? (
            <ActivityIndicator color={colors.green} />
          ) : (
            <>
              <MaterialCommunityIcons
                name={status.pinConfigured ? 'shield-check-outline' : 'shield-alert-outline'}
                size={24}
                color={status.pinConfigured ? colors.green : '#9A6500'}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.statusTitle}>
                  {status.pinConfigured ? 'Recovery protection is ON' : 'Recovery PIN is not set yet'}
                </Text>
                <Text style={styles.statusText}>
                  {status.pinConfigured
                    ? `Protected login: ${status.loginHint || 'your BUKLOD account'}${status.pinSetAt ? `\nLast updated: ${new Date(status.pinSetAt).toLocaleDateString()}` : ''}`
                    : 'Set one now so you can reset your password without waiting for admin assistance.'}
                </Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.notice}>
          <MaterialCommunityIcons name="information-outline" size={22} color={colors.green} />
          <Text style={styles.noticeText}>
            After you save it, PIN recovery works with the login saved on your account—username, mobile number, or email. The PIN itself is never displayed again.
          </Text>
        </View>

        <Text style={styles.label}>{status.pinConfigured ? 'New 6-digit Recovery PIN' : 'Create 6-digit Recovery PIN'}</Text>
        <TextInput
          value={pin}
          onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          placeholder="Enter 6 digits"
          style={styles.input}
        />

        <Text style={styles.label}>Confirm Recovery PIN</Text>
        <TextInput
          value={confirm}
          onChangeText={(value) => setConfirm(value.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          placeholder="Re-enter 6 digits"
          style={styles.input}
        />

        <Text style={styles.securityNote}>
          Avoid birthdays, repeated digits, 123456, 654321, 121212, and other easy-to-guess patterns.
        </Text>

        <Pressable onPress={save} disabled={busy} style={[styles.primary, busy && styles.disabled]}>
          {busy ? (
            <View style={styles.busyRow}>
              <ActivityIndicator color="#FFFFFF" />
              <Text style={styles.primaryText}>SAVING RECOVERY PIN…</Text>
            </View>
          ) : (
            <Text style={styles.primaryText}>
              {status.pinConfigured ? 'REPLACE RECOVERY PIN' : 'SAVE RECOVERY PIN'}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8F7' },
  content: { padding: 20, paddingBottom: 40 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 8 },
  backText: { color: colors.text, fontWeight: '800' },
  iconCircle: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#EAF4EC', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 16 },
  title: { marginTop: 14, textAlign: 'center', fontSize: 25, fontWeight: '900', color: colors.text },
  subtitle: { marginTop: 7, textAlign: 'center', color: '#647067', lineHeight: 20 },
  feedbackWrap: { marginTop: 12 },
  statusCard: { marginTop: 18, borderRadius: 13, padding: 13, flexDirection: 'row', gap: 10, alignItems: 'center', borderWidth: 1 },
  statusReady: { backgroundColor: '#EAF4EC', borderColor: '#B9D7C0' },
  statusNeedsSetup: { backgroundColor: '#FFF7E5', borderColor: '#E9CE91' },
  statusTitle: { color: colors.text, fontWeight: '900' },
  statusText: { marginTop: 3, color: '#526057', lineHeight: 17, fontSize: 12 },
  notice: { marginTop: 12, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE4DE', padding: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  noticeText: { flex: 1, color: '#405347', lineHeight: 19 },
  label: { marginTop: 18, marginBottom: 6, color: colors.text, fontWeight: '900' },
  input: { borderWidth: 1, borderColor: '#D7DED8', borderRadius: 12, backgroundColor: '#FFFFFF', minHeight: 52, paddingHorizontal: 14, fontSize: 18, letterSpacing: 3, color: colors.text },
  securityNote: { marginTop: 10, color: '#68736A', fontSize: 12, lineHeight: 18 },
  primary: { marginTop: 22, minHeight: 52, borderRadius: 12, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontWeight: '900' },
  disabled: { opacity: 0.6 },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
