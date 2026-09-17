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
  TextInput,
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

type RecoveryCandidate = {
  userId: string;
  fullName: string;
  loginMethod: string;
  loginHint: string;
  mobileHint?: string | null;
  birthDate?: string | null;
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
  const verifyInFlight = useRef(false);
  const matchInFlight = useRef(false);
  const [rows, setRows] = useState<RecoveryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [matchBusyId, setMatchBusyId] = useState<string | null>(null);
  const [matchQueries, setMatchQueries] = useState<Record<string, string>>({});
  const [matchResults, setMatchResults] = useState<Record<string, RecoveryCandidate[]>>({});
  const [matchSearched, setMatchSearched] = useState<Record<string, boolean>>({});
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

  const searchRecoveryAccounts = async (row: RecoveryRequest) => {
    if (matchInFlight.current || busyId || matchBusyId) return;
    if (!row.needs_match || row.user_id) return;
    if (!row.auto_delivery_ready) {
      const message = 'This recovery session already expired. Ask the member to submit a new Admin Help request.';
      setStatusText(`ERROR: ${message}`);
      if (Platform.OS !== 'web') Alert.alert('New Request Required', message);
      return;
    }

    const query = String(matchQueries[row.id] ?? '').trim();
    if (query.length < 3) {
      const message = 'Search using at least 3 characters from the registered username, mobile, email, or exact name.';
      setStatusText(`ERROR: ${message}`);
      if (Platform.OS !== 'web') Alert.alert('Find Member Account', message);
      return;
    }

    matchInFlight.current = true;
    setMatchBusyId(row.id);
    setMatchSearched((current) => ({ ...current, [row.id]: true }));
    setMatchResults((current) => ({ ...current, [row.id]: [] }));

    try {
      const { data, error } = await supabase.functions.invoke('account-recovery-match-v1', {
        body: {
          action: 'search_accounts',
          requestId: row.id,
          query,
        },
      });
      if (error) {
        throw new Error(
          await functionErrorMessage(
            error,
            'Could not search member accounts. Confirm that the secure recovery matching service is available.'
          )
        );
      }
      if (!data?.ok) throw new Error(data?.message ?? 'Could not search member accounts.');

      const candidates = Array.isArray(data?.candidates)
        ? data.candidates.filter(
            (item: any): item is RecoveryCandidate =>
              typeof item?.userId === 'string' &&
              typeof item?.fullName === 'string' &&
              typeof item?.loginHint === 'string'
          )
        : [];

      setMatchResults((current) => ({ ...current, [row.id]: candidates }));
      setStatusText(
        candidates.length
          ? `Found ${candidates.length} possible account${candidates.length === 1 ? '' : 's'}. Confirm the saved details before matching.`
          : 'No matching active BUKLOD account found. Try the exact username, mobile number, email, or a more exact name.'
      );
    } catch (error: any) {
      const message = String(error?.message ?? error ?? 'Could not search member accounts.');
      setStatusText(`ERROR: ${message}`);
      if (Platform.OS !== 'web') Alert.alert('Find Member Account', message);
    } finally {
      matchInFlight.current = false;
      setMatchBusyId(null);
    }
  };

  const matchRecoveryAccount = (row: RecoveryRequest, candidate: RecoveryCandidate) => {
    const run = async () => {
      if (matchInFlight.current || busyId || matchBusyId) return;
      matchInFlight.current = true;
      setMatchBusyId(row.id);
      setStatusText(`Matching the recovery request to ${candidate.fullName}…`);

      try {
        const { data, error } = await supabase.functions.invoke('account-recovery-match-v1', {
          body: {
            action: 'match_request',
            requestId: row.id,
            userId: candidate.userId,
          },
        });
        if (error) {
          throw new Error(
            await functionErrorMessage(
              error,
              'Could not match this recovery request. Refresh and try again.'
            )
          );
        }
        if (!data?.ok || !data?.matched) {
          throw new Error(data?.message ?? 'Could not match this recovery request.');
        }

        const matched = data.matched as RecoveryCandidate;
        setRows((current) =>
          current.map((item) =>
            item.id === row.id
              ? {
                  ...item,
                  user_id: matched.userId,
                  full_name: matched.fullName,
                  login_method: matched.loginMethod,
                  login_hint: matched.loginHint,
                  mobile_hint: matched.mobileHint ?? null,
                  birth_date: matched.birthDate ?? null,
                  needs_match: false,
                }
              : item
          )
        );
        setMatchQueries((current) => ({ ...current, [row.id]: '' }));
        setMatchResults((current) => ({ ...current, [row.id]: [] }));
        setMatchSearched((current) => ({ ...current, [row.id]: false }));
        setStatusText(
          `${matched.fullName} matched to this recovery request. Confirm identity, then tap VERIFY ACCOUNT — AUTO DELIVER CODE.`
        );
      } catch (error: any) {
        const message = String(error?.message ?? error ?? 'Could not match this recovery request.');
        setStatusText(`ERROR: ${message}`);
        if (Platform.OS !== 'web') Alert.alert('Match Recovery Account', message);
      } finally {
        matchInFlight.current = false;
        setMatchBusyId(null);
      }
    };

    if (Platform.OS === 'web') {
      void run();
      return;
    }

    Alert.alert(
      'Match This Account?',
      `Match this recovery request to ${candidate.fullName}?\n\n${methodLabel(candidate.loginMethod)}: ${candidate.loginHint}${
        candidate.birthDate ? `\nBirthday: ${candidate.birthDate}` : ''
      }\n\nContinue only after confirming these saved details belong to the person requesting recovery.`,
      [
        { text: 'CANCEL', style: 'cancel' },
        { text: 'MATCH ACCOUNT', onPress: () => void run() },
      ]
    );
  };

  const verifyAccount = async (row: RecoveryRequest) => {
    if (verifyInFlight.current || busyId || matchBusyId) return;

    if (row.needs_match || !row.user_id) {
      const message = row.auto_delivery_ready
        ? 'Match this recovery request to the correct BUKLOD account first using FIND MEMBER ACCOUNT below.'
        : 'This recovery request is unmatched and its private recovery session has expired. Ask the member to submit a new Admin Help request.';
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
      verifyInFlight.current = true;
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
      if (busyId || matchBusyId) return;
      setBusyId(row.id);
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
        Verify the member first. If BUKLOD could not uniquely match the submitted details, find and match the correct account here. Then VERIFY ACCOUNT once so the one-time code is delivered directly to the member’s waiting recovery screen.
      </Text>

      {!!statusText && (
        <View style={[styles.statusBox, statusText.startsWith('ERROR:') && styles.statusError]}>
          <Text style={[styles.statusText, statusText.startsWith('ERROR:') && styles.statusErrorText]}>{statusText}</Text>
        </View>
      )}

      <View style={styles.stepsCard}>
        <Text style={styles.stepsTitle}>Admin flow</Text>
        <Text style={styles.stepText}>1. Confirm the person using the submitted and saved account details.</Text>
        <Text style={styles.stepText}>2. If MATCH REQUIRED, securely find and match the correct member account first.</Text>
        <Text style={styles.stepText}>3. Tap VERIFY ACCOUNT — AUTO DELIVER CODE once.</Text>
        <Text style={styles.stepText}>4. Done. BUKLOD sends the one-time code automatically to the linked recovery screen.</Text>
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
          const rowMatching = matchBusyId === row.id;
          const rowResults = matchResults[row.id] ?? [];
          const rowSearched = matchSearched[row.id] === true;
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

              {needsMatch && autoReady && (
                <View style={styles.matchBox}>
                  <Text style={styles.matchTitle}>Find member account</Text>
                  <Text style={styles.matchHelp}>
                    Search the exact registered username, mobile number, email, or member name. Results show masked login details only. Match only after checking the saved details against the person requesting recovery.
                  </Text>
                  <TextInput
                    value={matchQueries[row.id] ?? ''}
                    onChangeText={(value) => {
                      setMatchQueries((current) => ({ ...current, [row.id]: value }));
                      setMatchSearched((current) => ({ ...current, [row.id]: false }));
                      setMatchResults((current) => ({ ...current, [row.id]: [] }));
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="Username, mobile, email, or exact name"
                    style={styles.matchInput}
                    editable={!rowMatching && busyId === null}
                    returnKeyType="search"
                    onSubmitEditing={() => void searchRecoveryAccounts(row)}
                  />
                  <Pressable
                    onPress={() => void searchRecoveryAccounts(row)}
                    disabled={rowMatching || busyId !== null || matchBusyId !== null}
                    style={[styles.matchSearchButton, (rowMatching || busyId !== null || matchBusyId !== null) && styles.disabled]}
                  >
                    {rowMatching ? (
                      <ActivityIndicator color={colors.green} />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="account-search-outline" size={18} color={colors.green} />
                        <Text style={styles.matchSearchText}>FIND ACCOUNT</Text>
                      </>
                    )}
                  </Pressable>

                  {rowSearched && !rowMatching && rowResults.length === 0 && (
                    <Text style={styles.noMatchText}>
                      No candidate found. Try the exact registered login or a more exact member name.
                    </Text>
                  )}

                  {rowResults.map((candidate) => (
                    <View key={candidate.userId} style={styles.candidateCard}>
                      <Text style={styles.candidateName}>{candidate.fullName}</Text>
                      <Text style={styles.candidateMeta}>
                        {methodLabel(candidate.loginMethod)}: {candidate.loginHint}
                      </Text>
                      {!!candidate.mobileHint && (
                        <Text style={styles.candidateMeta}>Mobile: {candidate.mobileHint}</Text>
                      )}
                      <Text style={styles.candidateMeta}>
                        Birthday: {candidate.birthDate || 'Not recorded'}
                      </Text>
                      <Pressable
                        onPress={() => matchRecoveryAccount(row, candidate)}
                        disabled={busyId !== null || matchBusyId !== null}
                        style={[styles.candidateButton, (busyId !== null || matchBusyId !== null) && styles.disabled]}
                      >
                        <MaterialCommunityIcons name="link-variant" size={17} color="#FFFFFF" />
                        <Text style={styles.candidateButtonText}>MATCH THIS ACCOUNT</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              {!canVerify && !(needsMatch && autoReady) && (
                <View style={styles.warningCard}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#8A5A00" />
                  <Text style={styles.warningCardText}>
                    {needsMatch
                      ? 'HINDI MA-VERIFY: unmatched at expired na ang secure waiting session. Keep the audit record and ask the member to submit a new Admin Help request.'
                      : 'HINDI MA-VERIFY: legacy/expired request ito at walang active private auto-delivery session. Keep the record; ask the member to submit a new Admin Help request from the updated recovery screen.'}
                  </Text>
                </View>
              )}

              <Pressable
                onPress={() => void verifyAccount(row)}
                disabled={busyId !== null || matchBusyId !== null || !canVerify}
                hitSlop={10}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.primary,
                  pressed && busyId === null && matchBusyId === null && canVerify && styles.pressed,
                  (busyId !== null || matchBusyId !== null || !canVerify) && styles.disabled,
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
                disabled={busyId !== null || matchBusyId !== null}
                hitSlop={8}
                accessibilityRole="button"
                style={[styles.reject, (busyId !== null || matchBusyId !== null) && styles.disabled]}
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
  matchBox: { marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: '#BFD8C6', backgroundColor: '#F1F8F3', padding: 12 },
  matchTitle: { color: colors.text, fontWeight: '900', fontSize: 13 },
  matchHelp: { marginTop: 4, color: '#526057', fontSize: 11.5, lineHeight: 17 },
  matchInput: { marginTop: 10, minHeight: 46, borderWidth: 1, borderColor: '#CFD9D1', borderRadius: 10, backgroundColor: '#FFFFFF', paddingHorizontal: 11, color: colors.text },
  matchSearchButton: { marginTop: 8, minHeight: 43, borderWidth: 1, borderColor: colors.green, borderRadius: 10, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  matchSearchText: { color: colors.green, fontWeight: '900', fontSize: 11 },
  noMatchText: { marginTop: 9, color: '#7A5B1C', fontSize: 11.5, lineHeight: 17, fontWeight: '700' },
  candidateCard: { marginTop: 10, borderWidth: 1, borderColor: '#D8E1DA', borderRadius: 10, backgroundColor: '#FFFFFF', padding: 10 },
  candidateName: { color: colors.text, fontWeight: '900', fontSize: 13.5 },
  candidateMeta: { marginTop: 3, color: '#5B665E', fontSize: 11.5, lineHeight: 16 },
  candidateButton: { marginTop: 9, minHeight: 40, borderRadius: 9, backgroundColor: colors.green, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  candidateButtonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 10.5 },
  warningCard: { marginTop: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E8C977', backgroundColor: '#FFF8E5', padding: 10, flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  warningCardText: { flex: 1, color: '#6F4B00', fontSize: 11.5, lineHeight: 17, fontWeight: '700' },
  primary: { marginTop: 13, minHeight: 50, borderRadius: 11, backgroundColor: colors.green, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  primaryText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', textAlign: 'center' },
  reject: { marginTop: 8, minHeight: 43, borderRadius: 10, borderWidth: 1, borderColor: '#E5BABA', backgroundColor: '#FFF8F8', flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  rejectText: { color: '#A62828', fontSize: 10.5, fontWeight: '900' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.78 },
});