import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
  const [rows, setRows] = useState<RecoveryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [issuedCode, setIssuedCode] = useState<IssuedRecoveryCode | null>(null);
  const issuingRef = useRef<string | null>(null);

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
      Alert.alert('Account Recovery', String(error?.message ?? error ?? 'Could not load requests.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (hasRole('system_admin')) void load();
    else setLoading(false);
  }, [hasRole, load]);

  const issueCode = async (row: RecoveryRequest) => {
    if (issuingRef.current) return;
    issuingRef.current = row.id;
    setBusyId(row.id);
    try {
      const { data, error } = await supabase.functions.invoke('account-recovery-v3', {
        body: { action: 'admin_issue_code', requestId: row.id },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message ?? 'Could not issue recovery code.');

      const nextCode = String(data.code ?? '').trim();
      if (!nextCode) throw new Error('Recovery code was not returned. Refresh the request and try again.');

      setIssuedCode({
        code: nextCode,
        expiresAt: data?.expiresAt ? String(data.expiresAt) : null,
        memberName: row.full_name || 'BUKLOD Member',
        loginHint: row.login_hint || null,
      });

      await load();
    } catch (error: any) {
      Alert.alert('Account Recovery', String(error?.message ?? error ?? 'Could not issue code.'));
    } finally {
      issuingRef.current = null;
      setBusyId(null);
    }
  };

  const rejectRequest = (row: RecoveryRequest) => {
    Alert.alert(
      'Reject Recovery Request?',
      'Use Reject when identity cannot be verified or the request appears suspicious. No recovery code will be issued.',
      [
        { text: 'CANCEL', style: 'cancel' },
        {
          text: 'REJECT',
          style: 'destructive',
          onPress: () => void (async () => {
            setBusyId(row.id);
            try {
              const { data, error } = await supabase.functions.invoke('account-recovery-v3', {
                body: { action: 'admin_reject_request', requestId: row.id },
              });
              if (error) throw error;
              if (!data?.ok) throw new Error(data?.message ?? 'Could not reject request.');
              setRows((current) => current.filter((item) => item.id !== row.id));
            } catch (error: any) {
              Alert.alert('Account Recovery', String(error?.message ?? error ?? 'Could not reject request.'));
            } finally {
              setBusyId(null);
            }
          })(),
        },
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
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable onPress={() => router.back()} style={styles.back}>
        <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <Text style={styles.title}>Account Recovery Requests</Text>
      <Text style={styles.subtitle}>
        Verify the account owner first, then generate a one-time recovery code. The member uses that code to create a new password and then signs in normally.
      </Text>

      <View style={styles.stepsCard}>
        <StepRow number="1" text="Verify the member using the saved mobile/contact information or another trusted channel." />
        <StepRow number="2" text="Tap VERIFIED — GENERATE ONE-TIME CODE once. The code will appear on this screen." />
        <StepRow number="3" text="Give the code only to the verified member. It expires in 30 minutes and works once." />
        <StepRow number="4" text="Member: Forgot Password → Admin Help → enter code → create new password → Sign In." />
      </View>

      <View style={styles.warning}>
        <MaterialCommunityIcons name="shield-alert-outline" size={23} color="#8A5A00" />
        <Text style={styles.warningText}>
          Never ask for the member’s old password or Recovery PIN. Verification is only to establish identity. If uncertain, reject the request.
        </Text>
      </View>

      {!!issuedCode && (
        <View style={styles.issuedCard}>
          <View style={styles.issuedHead}>
            <MaterialCommunityIcons name="key-variant" size={24} color="#176B39" />
            <View style={{ flex: 1 }}>
              <Text style={styles.issuedTitle}>ONE-TIME CODE READY</Text>
              <Text style={styles.issuedMember}>{issuedCode.memberName}</Text>
            </View>
          </View>

          <Text selectable style={styles.codeText}>{issuedCode.code}</Text>
          <Text style={styles.expiryText}>Expires: {formatExpiry(issuedCode.expiresAt)}</Text>
          {!!issuedCode.loginHint && (
            <Text style={styles.issuedHint}>Account: {issuedCode.loginHint}</Text>
          )}

          <View style={styles.memberSteps}>
            <Text style={styles.memberStepsTitle}>Tell the member to do this:</Text>
            <Text style={styles.memberStepsText}>
              Open BUKLOD → Forgot Password → ADMIN HELP → “Already received a one-time code?” → enter this code → set a new password → SIGN IN.
            </Text>
          </View>

          <Pressable onPress={() => setIssuedCode(null)} style={styles.doneButton}>
            <MaterialCommunityIcons name="check" size={18} color="#176B39" />
            <Text style={styles.doneButtonText}>DONE — HIDE CODE</Text>
          </Pressable>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 28 }} color={colors.green} />
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="check-decagram-outline" size={28} color={colors.green} />
          <Text style={styles.emptyTitle}>No pending requests</Text>
          <Text style={styles.emptyText}>New account-recovery requests will appear here.</Text>
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
              <DetailRow
                icon="clock-outline"
                label="Requested"
                value={new Date(row.requested_at || row.created_at).toLocaleString()}
              />
            </View>

            <Text style={styles.verifyPrompt}>
              If you have already verified this person using the saved mobile/contact information, tap the button below once. The new recovery code will appear above.
            </Text>

            <Pressable
              accessibilityRole="button"
              onPress={() => void issueCode(row)}
              disabled={busyId !== null}
              hitSlop={8}
              style={({ pressed }) => [
                styles.primary,
                pressed && busyId === null && styles.primaryPressed,
                busyId !== null && styles.disabled,
              ]}
            >
              {busyId === row.id ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="key-plus" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryText}>VERIFIED — GENERATE ONE-TIME CODE</Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={() => rejectRequest(row)}
              disabled={busyId !== null}
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

function StepRow({ number, text }: { number: string; text: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{number}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
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
  stepsCard: { backgroundColor: '#EEF7F1', borderWidth: 1, borderColor: '#CAE3D1', borderRadius: 14, padding: 13, gap: 10, marginBottom: 12 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  stepNumber: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#176B39', alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: '#FFFFFF', fontWeight: '900', fontSize: 11 },
  stepText: { flex: 1, color: '#2F4937', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  warning: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 13, marginBottom: 16, borderRadius: 13, borderWidth: 1, borderColor: '#ECD59F', backgroundColor: '#FFF7E5' },
  warningText: { flex: 1, color: '#6F520E', fontSize: 12, lineHeight: 18 },
  issuedCard: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#62A978', borderRadius: 16, padding: 15, marginBottom: 16 },
  issuedHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  issuedTitle: { color: '#176B39', fontWeight: '900', fontSize: 13 },
  issuedMember: { marginTop: 1, color: colors.text, fontWeight: '900', fontSize: 16 },
  codeText: { marginTop: 15, textAlign: 'center', fontSize: 29, letterSpacing: 4, fontWeight: '900', color: '#102B1A', backgroundColor: '#F1F8F3', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 8 },
  expiryText: { marginTop: 9, textAlign: 'center', color: '#6A756D', fontSize: 11.5, fontWeight: '800' },
  issuedHint: { marginTop: 5, textAlign: 'center', color: '#516057', fontSize: 11.5, fontWeight: '700' },
  memberSteps: { marginTop: 13, borderRadius: 11, backgroundColor: '#F7F8F7', padding: 11 },
  memberStepsTitle: { color: colors.text, fontWeight: '900', fontSize: 12 },
  memberStepsText: { marginTop: 4, color: '#5D695F', fontSize: 11.5, lineHeight: 18 },
  doneButton: { marginTop: 10, minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: '#A9CEB5', backgroundColor: '#F4FAF6', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  doneButtonText: { color: '#176B39', fontWeight: '900', fontSize: 11 },
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
  verifyPrompt: { marginTop: 11, color: '#506157', fontSize: 11.5, lineHeight: 17, fontWeight: '700' },
  primary: { marginTop: 12, minHeight: 50, borderRadius: 10, backgroundColor: colors.green, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  primaryPressed: { opacity: 0.82 },
  primaryText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '900', textAlign: 'center' },
  reject: { marginTop: 8, minHeight: 43, borderRadius: 10, borderWidth: 1, borderColor: '#E5BABA', backgroundColor: '#FFF8F8', flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  rejectText: { color: '#A62828', fontSize: 10.5, fontWeight: '900' },
  disabled: { opacity: 0.55 },
});