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

async function functionErrorMessage(error: any, fallback: string) {
  const context = error?.context;
  if (context) {
    try {
      const response = typeof context.clone === 'function' ? context.clone() : context;
      if (typeof response?.text === 'function') {
        const raw = String(await response.text()).trim();
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            const message = String(parsed?.message ?? parsed?.error ?? '').trim();
            if (message) return message;
          } catch {
            if (!raw.startsWith('<')) return raw;
          }
        }
      }
    } catch {
      // Fall through to the safe UI message below.
    }
  }

  const message = String(error?.message ?? '').trim();
  if (message && !/edge function returned a non-2xx status code/i.test(message)) return message;
  return fallback;
}

export default function AdminAccountRecoveryScreen() {
  const { hasRole } = useAuth();
  const actionInFlight = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const [confirmation, setConfirmation] = useState<{ action: 'verify' | 'reject'; requestId: string } | null>(null);
  const [rows, setRows] = useState<RecoveryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('');

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('account-recovery-v4', {
        body: { action: 'admin_list_requests' },
      });
      if (error) {
        throw new Error(await functionErrorMessage(error, 'Could not load recovery requests. Please refresh and try again.'));
      }
      if (!data?.ok) throw new Error(data?.message ?? 'Could not load recovery requests.');
      setLoadFailed(false);
      setRows(Array.isArray(data.requests) ? data.requests : []);
      setConfirmation(null);
      if (refresh) setStatusText('Recovery requests refreshed.');
    } catch (error: any) {
      const message = String(error?.message ?? error ?? 'Could not load requests.');
      setRows([]); // Never retain sensitive request data after an authorization failure.
      setLoadFailed(true);
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

  useEffect(() => {
    if (statusText) scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [statusText]);

  const verifyAccount = async (row: RecoveryRequest) => {
    if (actionInFlight.current || busyId) return;

    if (row.needs_match || !row.user_id) {
      const message = row.birth_date
        ? `Hindi ma-verify: ang submitted name + birthday (${row.birth_date}) ay hindi nag-match nang eksakto sa isang BUKLOD account. Ang birthday na nakikita rito ay SUBMITTED BIRTHDAY lamang, hindi patunay na iyon ang birthday na naka-save sa account. Hindi pinapayagan ang name-only approval. Mag-submit ulit gamit ang registered username, mobile number, o email kung available.`
        : 'Hindi ma-verify: hindi uniquely matched ang submitted identity sa isang BUKLOD account. Hindi pinapayagan ang name-only approval. Mag-submit ulit gamit ang registered username, mobile number, o email kung available.';
      setStatusText(`ERROR: ${message}`);
      if (Platform.OS !== 'web') Alert.alert('Account Match Required', message);
      return;
    }

    if (!row.auto_delivery_ready) {
      const message = 'Hindi ma-verify: lumang o expired recovery request ito at walang active private auto-delivery session. Buksan ng member ang updated Forgot Password → Admin Help at mag-submit ulit; panatilihin ang lumang record para sa audit history.';
      setStatusText(`ERROR: ${message}`);
      if (Platform.OS !== 'web') Alert.alert('New Request Required', message);
      return;
    }

    const run = async () => {
      actionInFlight.current = true;
      setBusyId(row.id);
      setStatusText(`Verifying ${row.full_name || 'this member'} and preparing automatic code delivery…`);

      try {
        const { data, error } = await supabase.functions.invoke('account-recovery-v4', {
          body: { action: 'admin_verify_request', requestId: row.id },
        });
        if (error) {
          throw new Error(await functionErrorMessage(
            error,
            'Hindi ma-verify ang request. Posibleng hindi matched ang account, expired/legacy ang recovery session, o hindi na naghihintay ang member recovery screen. Refresh the request list for the exact current status.'
          ));
        }
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
        actionInFlight.current = false;
        setBusyId(null);
      }
    };

    void run();
  };

  const rejectRequest = (row: RecoveryRequest) => {
    const run = async () => {
      if (actionInFlight.current || busyId) return;
      actionInFlight.current = true;
      setBusyId(row.id);
      setStatusText('Rejecting this recovery request…');
      try {
        const { data, error } = await supabase.functions.invoke('account-recovery-v4', {
          body: { action: 'admin_reject_request', requestId: row.id },
        });
        if (error) {
          throw new Error(await functionErrorMessage(error, 'Could not reject this recovery request. Refresh the list and try again.'));
        }
        if (!data?.ok) throw new Error(data?.message ?? 'Could not reject request.');
        setRows((current) => current.filter((item) => item.id !== row.id));
        setStatusText('Recovery request rejected. The waiting recovery screen will receive the rejection status automatically.');
      } catch (error: any) {
        const message = String(error?.message ?? error ?? 'Could not reject request.');
        setStatusText(`ERROR: ${message}`);
        if (Platform.OS !== 'web') Alert.alert('Account Recovery', message);
      } finally {
        actionInFlight.current = false;
        setBusyId(null);
      }
    };

    void run();
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
      ) : loadFailed ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="alert-circle-outline" size={28} color="#A62828" />
          <Text style={styles.emptyTitle}>Could not check recovery requests</Text>
          <Text style={styles.emptyText}>The queue is not verified. Please check your session or connection, then retry.</Text>
          <Pressable accessibilityRole="button" onPress={() => void load(true)} style={styles.primary}>
            <MaterialCommunityIcons name="refresh" size={19} color="#FFFFFF" />
            <Text style={styles.primaryText}>RETRY REQUEST LIST</Text>
          </Pressable>
        </View>
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
                <DetailRow
                  icon="cake-variant-outline"
                  label={needsMatch ? 'Submitted birthday (not yet matched to account)' : 'Birthday on matched account'}
                  value={row.birth_date || 'Not recorded'}
                />
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
                      ? row.birth_date
                        ? `HINDI MA-VERIFY: ang submitted name + birthday (${row.birth_date}) ay hindi uniquely matched sa account records. Name-only approval is blocked. Ang birthday na ito ay galing sa request at hindi nangangahulugang naka-save ito sa member profile.`
                        : 'HINDI MA-VERIFY: ang submitted identity ay hindi uniquely matched sa account records. Name-only approval is blocked.'
                      : 'HINDI MA-VERIFY: legacy/expired request ito at walang active private auto-delivery session. Keep the record; ask the member to submit a new Admin Help request from the updated recovery screen.'}
                  </Text>
                </View>
              )}

              {confirmation?.requestId === row.id ? (
                <View style={styles.confirmCard}>
                  <Text style={styles.confirmTitle}>
                    {confirmation.action === 'verify' ? 'Confirm verified identity' : 'Confirm rejection'}
                  </Text>
                  <Text style={styles.confirmText}>
                    {confirmation.action === 'verify'
                      ? 'Proceed only after confirming this person owns the matched account. A one-time code will be securely delivered to the member’s waiting recovery screen.'
                      : 'Reject only if ownership cannot be verified or the request appears suspicious. The member will see the outcome.'}
                  </Text>
                  <View style={styles.confirmActions}>
                    <Pressable accessibilityRole="button" onPress={() => setConfirmation(null)} style={styles.confirmCancel}>
                      <Text style={styles.confirmCancelText}>CANCEL</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={busyId !== null}
                      onPress={() => {
                        const action = confirmation.action;
                        setConfirmation(null);
                        if (action === 'verify') void verifyAccount(row);
                        else rejectRequest(row);
                      }}
                      style={[styles.confirmProceed, busyId !== null && styles.disabled]}
                    >
                      <Text style={styles.primaryText}>{confirmation.action === 'verify' ? 'CONFIRM VERIFY' : 'CONFIRM REJECT'}</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <>
                  <Pressable
                    onPress={() => setConfirmation({ action: 'verify', requestId: row.id })}
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
                    onPress={() => setConfirmation({ action: 'reject', requestId: row.id })}
                    disabled={busyId !== null}
                    hitSlop={8}
                    accessibilityRole="button"
                    style={[styles.reject, busyId !== null && styles.disabled]}
                  >
                    <MaterialCommunityIcons name="close-circle-outline" size={18} color="#A62828" />
                    <Text style={styles.rejectText}>REJECT / CANNOT VERIFY</Text>
                  </Pressable>
                </>
              )}
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
  confirmCard: { marginTop: 12, padding: 12, borderRadius: 11, borderWidth: 1, borderColor: '#C6D8C9', backgroundColor: '#F6FAF7' },
  confirmTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  confirmText: { marginTop: 6, color: '#526153', fontSize: 12, lineHeight: 18 },
  confirmActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  confirmCancel: { flex: 1, padding: 11, borderRadius: 9, alignItems: 'center', backgroundColor: '#E8ECE9' },
  confirmCancelText: { color: colors.text, fontWeight: '800', fontSize: 11 },
  confirmProceed: { flex: 1, padding: 11, borderRadius: 9, alignItems: 'center', backgroundColor: colors.green },
  reject: { marginTop: 8, minHeight: 43, borderRadius: 10, borderWidth: 1, borderColor: '#E5BABA', backgroundColor: '#FFF8F8', flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  rejectText: { color: '#A62828', fontSize: 10.5, fontWeight: '900' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.78 },
});