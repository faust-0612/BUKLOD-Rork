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
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

type RecoveryRequest = {
  id: string;
  user_id: string | null;
  username: string | null;
  full_name: string | null;
  status: string;
  created_at: string;
  requested_at?: string | null;
  login_method?: string | null;
  login_hint?: string | null;
  mobile_hint?: string | null;
  birth_date?: string | null;
  needs_match?: boolean;
  auto_delivery_ready?: boolean;
};

function methodLabel(value: string | null | undefined) {
  const method = String(value ?? '').toLowerCase();
  if (method === 'email') return 'Email account';
  if (method === 'mobile') return 'Mobile account';
  if (method === 'username') return 'Username account';
  if (method === 'needs_match') return 'Account match required';
  return 'BUKLOD account';
}

export default function AdminAccountRecoveryScreen() {
  const { hasRole } = useAuth();
  const verifyInFlight = useRef(false);
  const [rows, setRows] = useState<RecoveryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('');

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('account-recovery-v4', {
        body: { action: 'admin_list_requests' },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message ?? 'Could not load recovery requests.');
      setRows(Array.isArray(data.requests) ? data.requests : []);
      if (refresh) setStatusText('Recovery requests refreshed.');
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

  const verifyAccount = async (row: RecoveryRequest) => {
    if (verifyInFlight.current || busyId) return;

    if (row.needs_match || !row.user_id) {
      const message = 'This request still needs an account match. Verify the submitted identity and match the correct BUKLOD account first.';
      setStatusText(`ERROR: ${message}`);
      if (Platform.OS !== 'web') Alert.alert('Account Match Required', message);
      return;
    }

    if (!row.auto_delivery_ready) {
      const message = 'This is a legacy or expired recovery request. Ask the member to open the updated Forgot Password → Admin Help screen and submit a new request so automatic code delivery can be secured to that waiting screen.';
      setStatusText(`ERROR: ${message}`);
      if (Platform.OS !== 'web') Alert.alert('New Request Required', message);
      return;
    }

    const run = async () => {
      verifyInFlight.current = true;
      setBusyId(row.id);
      setStatusText(`Verifying ${row.full_name || 'this member'} and preparing automatic code delivery…`);

      try {
        const { data, error } = await supabase.functions.invoke('account-recovery-v4', {
          body: { action: 'admin_verify_request', requestId: row.id },
        });
        if (error) throw error;
        if (!data?.ok) throw new Error(data?.message ?? 'Could not verify recovery request.');
        if (data?.deliveredAutomatically !== true) {
          throw new Error('Verification completed without confirming automatic code delivery.');
        }

        const member = row.full_name || 'BUKLOD member';
        const message = `${member} verified. BUKLOD generated the one-time recovery code and delivered it automatically to the member's waiting recovery screen. No copying or manual sending is required.`;
        setRows((current) => current.filter((item) => item.id !== row.id));
        setStatusText(message);
        if (Platform.OS !== 'web') Alert.alert('ACCOUNT VERIFIED', message);
      } catch (error: any) {
        const message = String(error?.message ?? error ?? 'Could not verify recovery request.');
        setStatusText(`ERROR: ${message}`);
        if (Platform.OS !== 'web') Alert.alert('Account Recovery', message);
      } finally {
        verifyInFlight.current = false;
        setBusyId(null);
      }
    };

    if (Platform.OS === 'web') {
      void run();
      return;
    }

    Alert.alert(
      'Verify This Account Owner?',
      'Continue only after you have verified that this person owns the matched BUKLOD account. BUKLOD will automatically generate and deliver the recovery code to the member’s waiting recovery screen.',
      [
        { text: 'CANCEL', style: 'cancel' },
        { text: 'VERIFY', onPress: () => void run() },
      ]
    );
  };

  const rejectRequest = (row: RecoveryRequest) => {
    const run = async () => {
      if (busyId) return;
      setBusyId(row.id);
      try {
        const { data, error } = await supabase.functions.invoke('account-recovery-v4', {
          body: { action: 'admin_reject_request', requestId: row.id },
        });
        if (error) throw error;
        if (!data?.ok) throw new Error(data?.message ?? 'Could not reject request.');
        setRows((current) => current.filter((item) => item.id !== row.id));
        setStatusText('Recovery request rejected. The waiting recovery screen will receive the rejection status automatically.');
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
        Verify the member first. Tap VERIFY ACCOUNT once. BUKLOD then generates and delivers the one-time code directly to the member’s waiting recovery screen — no copying, reading, or manual sending by Admin.
      </Text>

      {!!statusText && (
        <View style={[styles.statusBox, statusText.startsWith('ERROR:') && styles.statusError]}>
          <Text style={[styles.statusText, statusText.startsWith('ERROR:') && styles.statusErrorText]}>{statusText}</Text>
        </View>
      )}

      <View style={styles.stepsCard}>
        <Text style={styles.stepsTitle}>Admin flow</Text>
        <Text style={styles.stepText}>1. Confirm the person using the saved account details.</Text>
        <Text style={styles.stepText}>2. Tap VERIFY ACCOUNT — AUTO DELIVER CODE once.</Text>
        <Text style={styles.stepText}>3. Done. BUKLOD generates the one-time code and sends it automatically to the member’s waiting recovery screen.</Text>
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
        rows.map((row) => {
          const needsMatch = !!row.needs_match || !row.user_id;
          const autoReady = !!row.auto_delivery_ready;
          const canVerify = !needsMatch && autoReady;
          const buttonLabel = needsMatch
            ? 'ACCOUNT MATCH REQUIRED'
            : autoReady
              ? 'VERIFY ACCOUNT — AUTO DELIVER CODE'
              : 'NEW MEMBER REQUEST REQUIRED';

          return (
            <View key={row.id} style={styles.card}>
              <View style={styles.cardHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{row.full_name || 'BUKLOD Member'}</Text>
                  <Text style={styles.method}>{methodLabel(row.login_method)}</Text>
                </View>
                <View style={[styles.pendingBadge, !canVerify && styles.warningBadge]}>
                  <Text style={[styles.pendingText, !canVerify && styles.warningText]}>
                    {needsMatch ? 'MATCH REQUIRED' : autoReady ? 'AWAITING VERIFICATION' : 'LEGACY / EXPIRED'}
                  </Text>
                </View>
              </View>

              <View style={styles.detailBox}>
                <DetailRow icon="account-key-outline" label="Saved login" value={row.login_hint || 'Not available'} />
                {!!row.mobile_hint && <DetailRow icon="phone-outline" label="Mobile on profile" value={row.mobile_hint} />}
                <DetailRow icon="cake-variant-outline" label="Birthday" value={row.birth_date || 'Not recorded'} />
                <DetailRow icon="clock-outline" label="Requested" value={new Date(row.requested_at || row.created_at).toLocaleString()} />
                <DetailRow
                  icon={autoReady ? 'cellphone-check' : 'cellphone-off'}
                  label="Automatic delivery"
                  value={autoReady ? 'Waiting recovery screen is securely linked' : 'Not available — member must submit a new updated request'}
                />
              </View>

              {!canVerify && (
                <View style={styles.warningCard}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#8A5A00" />
                  <Text style={styles.warningCardText}>
                    {needsMatch
                      ? 'Do not approve yet. This request is not uniquely matched to an account.'
                      : 'This request predates the automatic-delivery session or its private waiting session expired. Keep the record; ask the member to submit a new Admin Help request.'}
                  </Text>
                </View>
              )}

              <Pressable
                onPress={() => void verifyAccount(row)}
                disabled={busyId !== null || !canVerify}
                hitSlop={10}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.primary,
                  pressed && busyId === null && canVerify && styles.pressed,
                  (busyId !== null || !canVerify) && styles.disabled,
                ]}
              >
                {busyId === row.id ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="account-check-outline" size={19} color="#FFFFFF" />
                    <Text style={styles.primaryText}>{buttonLabel}</Text>
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
          );
        })
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
  warningBadge: { backgroundColor: '#FDE5E0' },
  warningText: { color: '#8A2E1F' },
  detailBox: { marginTop: 12, borderRadius: 11, backgroundColor: '#F6F9F7', padding: 10, gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  detailLabel: { color: '#78827B', fontSize: 10.5, fontWeight: '800' },
  detailValue: { marginTop: 1, color: colors.text, fontSize: 12.5, fontWeight: '800' },
  warningCard: { marginTop: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E8C977', backgroundColor: '#FFF8E5', padding: 10, flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  warningCardText: { flex: 1, color: '#6F4B00', fontSize: 11.5, lineHeight: 17, fontWeight: '700' },
  primary: { marginTop: 13, minHeight: 50, borderRadius: 11, backgroundColor: colors.green, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  primaryText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', textAlign: 'center' },
  reject: { marginTop: 8, minHeight: 43, borderRadius: 10, borderWidth: 1, borderColor: '#E5BABA', backgroundColor: '#FFF8F8', flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  rejectText: { color: '#A62828', fontSize: 10.5, fontWeight: '900' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.78 },
});