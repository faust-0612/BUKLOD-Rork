import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { supabase } from '@/lib/supabase';

type Case = {
  id: string;
  user_id: string | null;
  name: string | null;
  username: string | null;
  status: string;
  required_action: string;
  last_sign_in: string;
  first_notice: string;
  verified_external_notice: string | null;
  deletion_eligible_at: string | null;
  admin_hold: boolean;
  admin_hold_reason: string | null;
};
type Month = {
  month: string; new: number; pending: number; held: number;
  undelivered: number; deleted: number;
};
type Snapshot = {
  cases: Case[]; months: Month[];
  auto_delete_live: boolean;
};

const formatDate = (value: string | null | undefined) =>
  value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleDateString()
    : 'Not verified';

export default function AdminDormancyReview() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [holdReason, setHoldReason] = useState('Identity, account recovery, record retention or payout review');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: requestError } = await supabase.rpc('buklod_admin_dormancy_summary_v1' as any);
      if (requestError) throw requestError;
      const value = data as unknown as Snapshot;
      if (!value || !Array.isArray(value.cases) || !Array.isArray(value.months)) {
        throw new Error('Unexpected account-review response.');
      }
      setSnapshot(value);
      setError('');
    } catch (err: any) {
      setError(String(err?.message || 'Monthly account review is not available.'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const changeHold = async (item: Case, desired: boolean) => {
    if (busy) return;
    const reason = holdReason.trim();
    if (desired && reason.length < 8) {
      Alert.alert('Reason required', 'Write at least 8 characters explaining the hold.');
      return;
    }
    const title = desired ? 'Protect this account?' : 'Release admin hold?';
    const message = desired
      ? 'This will prevent automatic deletion while the account is under review.'
      : 'Release will only remove your hold; all separate delivery, retention and finance requirements remain mandatory.';
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: async () => {
        setBusy(item.id);
        try {
          const { error: updateError } = await supabase.rpc('buklod_admin_set_dormancy_hold_v1' as any, {
            p_case_id: item.id, p_hold: desired, p_reason: desired ? reason : null,
          });
          if (updateError) throw updateError;
          await load();
        } catch (err: any) {
          Alert.alert('Account protection', String(err?.message || 'The hold was not changed.'));
        } finally {
          setBusy(null);
        }
      } },
    ]);
  };

  return (
    <View>
      <SectionTitle>MONTHLY ACCOUNT PROTECTION</SectionTitle>
      <Card>
        <Text style={shared.h2}>Dormant-account candidate review</Text>
        <Text style={shared.body}>
          Monthly reports and admin holds are separate from voluntary account deletion.
          A missed login alone does not authorize deletion. The 180-day response clock
          starts only after verified external delivery to the account owner.
        </Text>
        <Text style={shared.muted}>
          Permanent auto-deletion is NOT live until delivery verification, financial/legal
          retention, owned media cleanup and server security checks pass.
        </Text>
        <View style={{ marginTop: 8 }}>
          <Button title="REFRESH MONTHLY REVIEW" onPress={() => void load()} />
        </View>
      </Card>
      {loading && <ActivityIndicator accessibilityLabel="Loading account review" />}
      {!!error && (
        <Card>
          <Text accessibilityRole="alert" style={{ color: '#A34229' }}>
            Account review is unavailable: {error}. Existing user accounts remain unchanged.
          </Text>
        </Card>
      )}
      {snapshot && !loading && (
        <>
          <Card>
            <Text style={shared.h2}>Last 12 monthly reports</Text>
            {snapshot.months.length === 0 && (
              <Text style={shared.muted}>No monthly scan has run yet.</Text>
            )}
            {snapshot.months.map(month => (
              <Text key={month.month} style={shared.body}>
                {month.month}: {month.new} new · {month.pending} pending · {month.held} held
                {' · '}{month.undelivered} not externally notified · {month.deleted} deleted
              </Text>
            ))}
            <Text style={shared.muted}>
              Current pending cases displayed: {snapshot.cases.length} (maximum 100).
              Automatic deletion live: {snapshot.auto_delete_live ? 'Yes' : 'No'}.
            </Text>
          </Card>
          <Card>
            <Text style={shared.h2}>Hold reason</Text>
            <TextInput
              accessibilityLabel="Admin hold reason"
              placeholder="Why must this account be protected?"
              multiline
              maxLength={300}
              value={holdReason}
              onChangeText={setHoldReason}
              style={{ minHeight: 64, borderWidth: 1, borderColor: '#CAD8CE',
                borderRadius: 8, padding: 10, color: '#16271B' }}
            />
          </Card>
          {snapshot.cases.map(item => (
            <Card key={item.id}>
              <Text style={shared.h2}>{item.name || item.username || 'Member account'}</Text>
              <Text style={shared.muted}>
                Last sign-in: {formatDate(item.last_sign_in)} · In-app notice: {formatDate(item.first_notice)}
              </Text>
              <Text style={shared.body}>
                Required action: {item.required_action.replaceAll('_',' ')}
              </Text>
              <Text style={shared.muted}>
                Verified external notice: {formatDate(item.verified_external_notice)}
                {' · '}Earliest eligible date: {formatDate(item.deletion_eligible_at)}
              </Text>
              {!!item.admin_hold && (
                <Text style={shared.body}>Protected by admin hold: {item.admin_hold_reason || 'Review pending'}</Text>
              )}
              <View style={{ marginTop: 8 }}>
                <Button
                  title={busy === item.id ? 'UPDATING...' : item.admin_hold ? 'RELEASE ADMIN HOLD' : 'HOLD — DO NOT AUTO DELETE'}
                  onPress={() => void changeHold(item, !item.admin_hold)}
                  disabled={!!busy}
                />
              </View>
            </Card>
          ))}
          {snapshot.cases.length === 0 && (
            <Card><Text style={shared.muted}>No candidates for deletion review.</Text></Card>
          )}
        </>
      )}
    </View>
  );
}
