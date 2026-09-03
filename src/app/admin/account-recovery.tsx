import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

type RecoveryRequest = {
  id: string;
  user_id: string;
  username: string;
  full_name: string | null;
  status: string;
  created_at: string;
  requested_at?: string | null;
  login_method?: string | null;
  login_hint?: string | null;
  mobile_hint?: string | null;
  birth_date?: string | null;
};

type IssuedRecoveryCode = {
  code: string;
  expiresAt: string | null;
  memberName: string;
  loginHint: string | null;
};

function methodLabel(value: string | null | undefined) {
  const method = String(value ?? '').toLowerCase();
  if (method === 'email') return 'Email account';
  if (method === 'mobile') return 'Mobile account';
  if (method === 'username') return 'Username account';
  return 'BUKLOD account';
}

function formatExpiry(value: string | null) {
  if (!value) return '30 minutes after issue';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '30 minutes after issue';
  return date.toLocaleString();
}

export default function AdminAccountRecoveryScreen() {
  const { hasRole } = useAuth();
  const scrollRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const issuingRef = useRef(false);
  const [rows, setRows] = useState<RecoveryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [issuedCode, setIssuedCode] = useState<IssuedRecoveryCode | null>(null);
  const [statusText, setStatusText] = useState('');

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('account-recovery-v3', {
        body: { action: 'admin_list_requests' },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message ?? 'Could not load recovery requests.');
      setRows(Array.isArray(data.requests) ? data.requests : []);
    } catch (error: any) {
      const message = String(error?.message ?? error ?? 'Could not load requests.');
      setStatusText(`ERROR: ${message}`);
      if (Platform.OS !== 'web') Alert.alert('Account Recovery', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (hasRole('system_admin')) void load();
    else setLoading(false);
  }, [hasRole, load]);

  const revealIssuedCode = (next: IssuedRecoveryCode) => {
    setIssuedCode(next);
    setStatusText(`One-time code generated for ${next.memberName}. Copy it before leaving this screen.`);
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 80);

    if (Platform.OS !== 'web') {
      Alert.alert(
        'ONE-TIME RECOVERY CODE',
        `${next.code}\n\nExpires: ${formatExpiry(next.expiresAt)}\n\nGive this code only to the verified member. The member opens Forgot Password → ADMIN HELP, enters this code, and creates a new password.`
      );
    }
  };

  const issueCode = async (row: RecoveryRequest) => {
    if (issuingRef.current || busyId) return;
    issuingRef.current = true;
    setBusyId(row.id);
    setStatusText(`Generating a one-time code for ${row.full_name || 'this member'}...`);

    try {
      const { data, error } = await supabase.functions.invoke('account-recovery-v3', {
        body: { action: 'admin_issue_code', requestId: row.id },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message ?? 'Could not issue recovery code.');

      const nextCode = String(data?.code ?? '').trim().toUpperCase();
      if (!/^[A-Z2-9]{10}$/.test(nextCode)) {
        throw new Error('Backend reported success but did not return a valid recovery code.');
      }

      const next: IssuedRecoveryCode = {
        code: nextCode,
        expiresAt: data?.expiresAt ? String(data.expiresAt) : null,
        memberName: row.full_name || 'BUKLOD Member',
        loginHint: row.login_hint || null,
      };

      revealIssuedCode(next);
      setRows((current) => current.filter((item) => item.id !== row.id));
    } catch (error: any) {
      const message = String(error?.message ?? error ?? 'Could not issue code.');
      setStatusText(`ERROR: ${message}`);
      if (Platform.OS !== 'web') Alert.alert('Account Recovery', message);
    } finally {
      issuingRef.current = false;
      setBusyId(null);
    }
  };

  const copyCode = async () => {
    if (!issuedCode?.code) return;
    await Clipboard.setStringAsync(issuedCode.code);
    setStatusText('Recovery code copied. Give it only to the verified member.');
    if (Platform.OS !== 'web') Alert.alert('Copied', 'Recovery code copied to clipboard.');
  };

  const rejectRequest = (row: RecoveryRequest) => {
    const run = async () => {
      if (busyId) return;
      setBusyId(row.id);
      try {
        const { data, error } = await supabase.functions.invoke('account-recovery-v3', {
          body: { action: 'admin_reject_request', requestId: row.id },
        });
        if (error) throw error;
        if (!data?.ok) throw new Error(data?.message ?? 'Could not reject request.');
        setRows((current) => current.filter((item) => item.id !== row.id));
        setStatusText('Recovery request rejected.');
      } catch (error: any) {
        const message = String(error?.message ?? error ?? 'Could not reject request.');
        setStatusText(`ERROR: ${message}`);
        if (Platform.OS !== 'web') Alert.alert('Account Recovery', message);
      } finally {
        setBusyId(null);
      }
    };

    if (Platform.OS === 'web') {
      void run();
      return;
    }

    Alert.alert(
      'Reject Recovery Request?',
      'Reject only when identity cannot be verified or the request appears suspicious.',
      [
        { text: 'CANCEL', style: 'cancel' },
        { text: 'REJECT', style: 'destructive', onPress: () => void run() },
      ]
    );
  };

  if (!hasRole('system_admin')) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="shield-lock-outline" size={34} color={colors.green} />
        <Text style={styles.title}>System Admin Only</Text>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
    >
      <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
        <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <Text style={styles.title}>Account Recovery Requests</Text>
      <Text style={styles.subtitle}>
        Verify the member first. Then tap the green button once. A successful recovery code must appear on this same page.
      </Text>

      {!!statusText && (
        <View style={[styles.statusBox, statusText.startsWith('ERROR:') && styles.statusError]}>
          <Text style={[styles.statusText, statusText.startsWith('ERROR:') && styles.statusErrorText]}>{statusText}</Text>
        </View>
      )}

      {!!issuedCode && (
        <View style={styles.issuedCard}>
          <View style={styles.issuedHead}>
            <MaterialCommunityIcons name="key-variant" size={26} color="#176B39" />
            <View style={{ flex: 1 }}>
              <Text style={styles.issuedTitle}>ONE-TIME CODE READY</Text>
              <Text style={styles.issuedMember}>{issuedCode.memberName}</Text>
            </View>
          </View>

          <Text selectable style={styles.codeText}>{issuedCode.code}</Text>
          <Text style={styles.expiryText}>Expires: {formatExpiry(issuedCode.expiresAt)}</Text>
          {!!issuedCode.loginHint && <Text style={styles.issuedHint}>Account: {issuedCode.loginHint}</Text>}

          <Pressable onPress={() => void copyCode()} style={styles.copyButton} hitSlop={8} accessibilityRole="button">
            <MaterialCommunityIcons name="content-copy" size={19} color="#FFFFFF" />
            <Text style={styles.copyButtonText}>COPY CODE</Text>
          </Pressable>

          <View style={styles.memberSteps}>
            <Text style={styles.memberStepsTitle}>Member instructions</Text>
            <Text style={styles.memberStepsText}>
              Forgot Password → ADMIN HELP → Already received a one-time code → enter this code → set a new password → SIGN IN.
            </Text>
          </View>
        </View>
      )}

      <View style={styles.stepsCard}>
        <Text style={styles.stepsTitle}>Admin flow</Text>
        <Text style={styles.stepText}>1. Confirm the person using the saved mobile/contact information.</Text>
        <Text style={styles.stepText}>2. Tap VERIFIED — GENERATE ONE-TIME CODE once.</Text>
        <Text style={styles.stepText}>3. Wait for the code to appear above, then copy or read it to the verified member.</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 28 }} color={colors.green} />
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="check-decagram-outline" size={28} color={colors.green} />
          <Text style={styles.emptyTitle}>No pending requests</Text>
          <Text style={styles.emptyText}>Pull down to refresh when a new recovery request is submitted.</Text>
        </View>
      ) : (
        rows.map((row) => (
          <View key={row.id} style={styles.card}>
            <View style={styles.cardHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{row.full_name || 'BUKLOD Member'}</Text>
                <Text style={styles.method}>{methodLabel(row.login_method)}</Text>
              </View>
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingText}>AWAITING VERIFICATION</Text>
              </View>
            </View>

            <View style={styles.detailBox}>
              <DetailRow icon="account-key-outline" label="Saved login" value={row.login_hint || 'Not available'} />
              {!!row.mobile_hint && <DetailRow icon="phone-outline" label="Mobile on profile" value={row.mobile_hint} />}
              <DetailRow icon="cake-variant-outline" label="Birthday" value={row.birth_date || 'Not recorded'} />
              <DetailRow icon="clock-outline" label="Requested" value={new Date(row.requested_at || row.created_at).toLocaleString()} />
            </View>

            <Pressable
              onPress={() => void issueCode(row)}
              disabled={busyId !== null}
              hitSlop={10}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.primary,
                pressed && busyId === null && styles.pressed,
                busyId !== null && styles.disabled,
              ]}
            >
              {busyId === row.id ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="key-plus" size={19} color="#FFFFFF" />
                  <Text style={styles.primaryText}>VERIFIED — GENERATE ONE-TIME CODE</Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={() => rejectRequest(row)}
              disabled={busyId !== null}
              hitSlop={8}
              accessibilityRole="button"
              style={[styles.reject, busyId !== null && styles.disabled]}
            >
              <MaterialCommunityIcons name="close-circle-outline" size={18} color="#A62828" />
              <Text style={styles.rejectText}>REJECT / CANNOT VERIFY</Text>
            </Pressable>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function DetailRow({ icon, label, value }: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <MaterialCommunityIcons name={icon} size={18} color={colors.green} />
      <View style={{ flex: 1 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 44, backgroundColor: '#F7F8F7', flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 8 },
  backText: { color: colors.text, fontWeight: '800' },
  title: { marginTop: 12, fontSize: 24, fontWeight: '900', color: colors.text },
  subtitle: { marginTop: 6, marginBottom: 13, color: '#647067', lineHeight: 19 },
  statusBox: { padding: 11, borderRadius: 11, borderWidth: 1, borderColor: '#B8D8C1', backgroundColor: '#EEF8F1', marginBottom: 12 },
  statusText: { color: '#245A34', fontWeight: '800', fontSize: 12, lineHeight: 18 },
  statusError: { borderColor: '#E2B8B8', backgroundColor: '#FFF4F4' },
  statusErrorText: { color: '#9D2626' },
  issuedCard: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#4F9C67', borderRadius: 16, padding: 15, marginBottom: 16 },
  issuedHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  issuedTitle: { color: '#176B39', fontWeight: '900', fontSize: 13 },
  issuedMember: { marginTop: 1, color: colors.text, fontWeight: '900', fontSize: 16 },
  codeText: { marginTop: 15, textAlign: 'center', fontSize: 30, letterSpacing: 4, fontWeight: '900', color: '#102B1A', backgroundColor: '#F1F8F3', borderRadius: 12, paddingVertical: 15, paddingHorizontal: 8 },
  expiryText: { marginTop: 9, textAlign: 'center', color: '#6A756D', fontSize: 11.5, fontWeight: '800' },
  issuedHint: { marginTop: 5, textAlign: 'center', color: '#516057', fontSize: 11.5, fontWeight: '700' },
  copyButton: { marginTop: 12, minHeight: 46, borderRadius: 10, backgroundColor: '#176B39', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  copyButtonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  memberSteps: { marginTop: 11, borderRadius: 11, backgroundColor: '#F7F8F7', padding: 11 },
  memberStepsTitle: { color: colors.text, fontWeight: '900', fontSize: 12 },
  memberStepsText: { marginTop: 4, color: '#5D695F', fontSize: 11.5, lineHeight: 18 },
  stepsCard: { backgroundColor: '#EEF7F1', borderWidth: 1, borderColor: '#CAE3D1', borderRadius: 14, padding: 13, gap: 7, marginBottom: 14 },
  stepsTitle: { color: colors.text, fontWeight: '900', fontSize: 13 },
  stepText: { color: '#2F4937', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  empty: { padding: 24, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE4DE', alignItems: 'center' },
  emptyTitle: { marginTop: 8, color: colors.text, fontWeight: '900' },
  emptyText: { marginTop: 4, color: '#68736A', textAlign: 'center' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 15, borderWidth: 1, borderColor: '#DEE4DF', padding: 14, marginBottom: 13 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  name: { fontSize: 17, fontWeight: '900', color: colors.text },
  method: { marginTop: 2, color: colors.green, fontWeight: '800', fontSize: 12 },
  pendingBadge: { backgroundColor: '#FFF0C9', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  pendingText: { color: '#7D5A00', fontWeight: '900', fontSize: 8.5 },
  detailBox: { marginTop: 12, borderRadius: 11, backgroundColor: '#F6F9F7', padding: 10, gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  detailLabel: { color: '#78827B', fontSize: 10.5, fontWeight: '800' },
  detailValue: { marginTop: 1, color: colors.text, fontSize: 12.5, fontWeight: '800' },
  primary: { marginTop: 13, minHeight: 50, borderRadius: 11, backgroundColor: colors.green, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  primaryText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', textAlign: 'center' },
  reject: { marginTop: 8, minHeight: 43, borderRadius: 10, borderWidth: 1, borderColor: '#E5BABA', backgroundColor: '#FFF8F8', flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  rejectText: { color: '#A62828', fontSize: 10.5, fontWeight: '900' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.78 },
});
