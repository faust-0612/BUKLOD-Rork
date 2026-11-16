import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { AdminGate } from '@/components/AdminGate';
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Finding = { key: string; severity: string; count: number; status: string; last_seen_at: string };
type State = {
  finance_hold: boolean;
  control_version: number;
  scan_at: string | null;
  auth_audit_coverage: string;
  auth_audit_rows_24h: number;
  finance: { economics: boolean; settlement: boolean; withdrawal: boolean; payout_processing: boolean };
  findings: Finding[];
  last_actions: { action: string; at: string; version: number }[];
};
const cleanChecks = { backup_verified: false, admin_sessions_reviewed: false, api_security_checked: false, finance_reconciled: false };

export default function SecurityOperations() {
  const [data, setData] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [checks, setChecks] = useState(cleanChecks);
  const [releaseSha, setReleaseSha] = useState('');
  const [evidenceReference, setEvidenceReference] = useState('');

  const load = useCallback(async (scan = false) => {
    setBusy(true); setError(null);
    try {
      const name = scan ? 'buklod_admin_security_scan_now_v1' : 'buklod_admin_security_overview_v1';
      const { data: result, error: fault } = await supabase.rpc(name);
      if (fault) throw fault;
      if (!result) throw new Error('Security status unavailable.');
      setData(result as State);
    } catch (e: any) { setError(String(e?.message ?? 'Status request failed.')); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const scanAgeMinutes = data?.scan_at ? (Date.now() - new Date(data.scan_at).getTime()) / 60000 : Infinity;
  const scanStale = !Number.isFinite(scanAgeMinutes) || scanAgeMinutes > 45 || scanAgeMinutes < -5;
  const critical = data?.findings.some(item => item.severity === 'P0' || item.severity === 'P1') ?? false;
  const moneyActive = data ? Object.values(data.finance).some(Boolean) : false;

  const changeHold = useCallback(async () => {
    if (!data || busy) return;
    const enable = !data.finance_hold;
    const expected = enable ? 'HOLD BUKLOD FINANCE' : 'RELEASE BUKLOD FINANCE';
    if (confirmation.trim() !== expected || reason.trim().length < 20) {
      setError('Type exact confirmation and reason of at least 20 characters.'); return;
    }
    if (!enable && (!Object.values(checks).every(Boolean) ||
         !/^[0-9a-f]{40}$/.test(releaseSha.trim()) || evidenceReference.trim().length < 12)) {
      setError('Restore requires four evidence checks, exact SHA and an evidence reference.'); return;
    }
    setBusy(true); setError(null);
    try {
      const { data: next, error: fault } = await supabase.rpc('buklod_admin_security_finance_hold_v1', {
        p_enable: enable,
        p_expected_version: data.control_version,
        p_reason: reason.trim(),
        p_confirmation: confirmation.trim(),
        p_action_key: Crypto.randomUUID(),
        p_recovery_evidence: enable ? {} : {
          ...checks, release_sha: releaseSha.trim(), evidence_reference: evidenceReference.trim(),
        },
      });
      if (fault) throw fault;
      if (!next) throw new Error('Could not confirm the server state.');
      setData(next as State);
      setReason(''); setConfirmation(''); setChecks(cleanChecks);
      setReleaseSha(''); setEvidenceReference('');
    } catch (e: any) { setError(String(e?.message ?? 'Security action failed.')); }
    finally { setBusy(false); }
  }, [data, busy, confirmation, reason, checks, releaseSha, evidenceReference]);

  return <AdminGate>
    <ScrollView style={shared.screen} contentContainerStyle={shared.content}>
      <Text style={shared.h1}>Security Operations & Recovery</Text>
      <Text style={shared.muted}>Server-side alerts and audited containment. This does not verify external DDoS, Auth, media backup or account-session defenses.</Text>
      <Button title="BACK TO ADMIN" outline onPress={() => router.back()} />
      {error ? <Card><Text style={{ color: colors.danger }}>{error}</Text></Card> : null}
      {busy ? <ActivityIndicator color={colors.green} /> : null}
      <Button title="RUN SECURITY SCAN" outline onPress={() => { void load(true); }} />
      <Button title="REFRESH STATUS" outline onPress={() => { void load(); }} />
      {data ? <>
        <SectionTitle>SECURITY SIGNALS</SectionTitle>
        <Card>
          <Text style={[shared.h2, { color: critical || moneyActive ? colors.danger : scanStale ? colors.amber : colors.greenDark }]}>
            {critical || moneyActive ? '🔴 RED WARNING — SECURITY REVIEW REQUIRED' : scanStale ? '🟡 WARNING — SECURITY MONITORING DELAYED' : 'SECURITY SCAN CURRENT — NO ACTIVE CRITICAL FINDINGS'}
          </Text>
          <Text style={shared.body}>
            {critical || moneyActive
              ? 'May seryosong security signal o aktibong money switch. Buksan ang BSOC Security Operations at suriin agad. Hindi pa ito patunay na may nakapasok na hacker.'
              : scanStale
                ? 'Hindi sariwa ang huling security scan. Patakbuhin ang scan at suriin kung bakit naantala. Hindi ito all-clear.'
                : 'Walang kritikal na finding sa mga kasalukuyang database checks. Hindi pa nito saklaw ang lahat ng account hacking o external attacks.'}
          </Text>
        </Card>
        <Card>
          <Text style={shared.h2}>Last scan: {data.scan_at ? new Date(data.scan_at).toLocaleString() : 'NOT YET RUN'}</Text>
          <Text style={shared.muted}>
            Auth audit: {data.auth_audit_coverage === 'EVENTS_PRESENT' ? 'Events present (coverage not independently verified)' : 'UNVERIFIED'}
            {' • '}24h rows: {data.auth_audit_rows_24h}
          </Text>
          {data.findings.length === 0
            ? <Text style={shared.body}>No configured signals active. This is not an all-clear.</Text>
            : data.findings.map(item => <View key={item.key} style={styles.signal}>
                <Text style={{ fontWeight: '800', color: item.severity === 'P0' ? colors.danger : colors.amber }}>
                  {item.severity} • {item.key.replaceAll('_', ' ')}
                </Text>
                <Text style={shared.muted}>Observed: {item.count} • {new Date(item.last_seen_at).toLocaleString()}</Text>
              </View>)}
        </Card>
        <SectionTitle>CANONICAL FINANCE V3 CONTAINMENT</SectionTitle>
        <Card>
          <Text style={[shared.h2, { color: data.finance_hold ? colors.danger : colors.greenDark }]}>
            Emergency hold: {data.finance_hold ? 'ACTIVE' : 'INACTIVE'}
          </Text>
          <Text style={shared.body}>
            Economics {String(data.finance.economics)} • Settlement {String(data.finance.settlement)}
            {'\n'}Withdrawal {String(data.finance.withdrawal)} • Payout {String(data.finance.payout_processing)}
          </Text>
          <Text style={shared.muted}>Hold disables all four Finance V3 money switches and blocks re-enabling, without deleting history. Releasing never enables payouts.</Text>
          <TextInput style={styles.input} multiline editable={!busy} maxLength={500}
            placeholder="Incident/recovery rationale (20-500 characters)" value={reason} onChangeText={setReason} />
          <Text style={shared.body}>Type exactly: {data.finance_hold ? 'RELEASE BUKLOD FINANCE' : 'HOLD BUKLOD FINANCE'}</Text>
          <TextInput style={styles.input} editable={!busy} autoCapitalize="characters"
            placeholder="Exact confirmation" value={confirmation} onChangeText={setConfirmation} />
          {data.finance_hold ? <>
            <Text style={shared.muted}>AAL2 MFA and external restore verification required. Checkboxes record operator attestations; they do not perform verification.</Text>
            {(Object.keys(checks) as (keyof typeof checks)[]).map(key => <View key={key} style={styles.checkRow}>
              <Text style={{ flex: 1 }}>{key.replaceAll('_', ' ')}</Text>
              <Switch value={checks[key]} disabled={busy}
                onValueChange={value => setChecks(old => ({ ...old, [key]: value }))} />
            </View>)}
            <TextInput style={styles.input} editable={!busy} autoCapitalize="none"
              placeholder="Exact verified 40-character release SHA" value={releaseSha} onChangeText={setReleaseSha} />
            <TextInput style={styles.input} editable={!busy}
              placeholder="Evidence / restore test reference" value={evidenceReference} onChangeText={setEvidenceReference} />
          </> : null}
          <Pressable disabled={busy} onPress={() => { void changeHold(); }}
            style={[styles.action, { opacity: busy ? 0.5 : 1 }]}>
            <Text style={styles.actionText}>
              {data.finance_hold ? 'RELEASE FINANCE HOLD (MFA + EVIDENCE)' : 'ENABLE EMERGENCY FINANCE HOLD'}
            </Text>
          </Pressable>
        </Card>
        <SectionTitle>AUDITED ACTIONS</SectionTitle>
        <Card>
          {data.last_actions.length === 0 ? <Text style={shared.muted}>No actions recorded.</Text>
           : data.last_actions.map((a, i) => <Text key={String(i)} style={shared.body}>
              {a.action.replaceAll('_', ' ')} • v{a.version} • {new Date(a.at).toLocaleString()}
            </Text>)}
        </Card>
      </> : null}
    </ScrollView>
  </AdminGate>;
}
const styles = StyleSheet.create({
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 11,
    padding: 12, minHeight: 46, marginTop: 10, marginBottom: 10, textAlignVertical: 'top' },
  signal: { paddingVertical: 10, borderTopWidth: 1, borderColor: colors.line },
  action: { backgroundColor: colors.danger, padding: 15, borderRadius: 10, marginTop: 14 },
  actionText: { color: colors.white, fontWeight: '900', textAlign: 'center' },
  checkRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
});
