import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import { readClusterScopeId } from '@/lib/buklodCluster';
import { supabase } from '@/lib/supabase';

type Checkin = {
  id: string;
  event_id: string;
  member_id: string;
  member_name: string | null;
  event: string;
  place: string | null;
  starts_at: string;
  checked_in_at: string;
  cluster: string;
};

function displayTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Time unavailable'
    : date.toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
}

export default function ClusterHomeCheckinReview() {
  const params = useLocalSearchParams();
  const scopeId = readClusterScopeId(params as Record<string, unknown>);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [rows, setRows] = useState<Checkin[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [scopeName, setScopeName] = useState('Cluster');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    setAllowed(false);
    setRows([]);
    try {
      if (!scopeId) throw new Error('Missing Cluster ID. Open through Manage Cluster.');
      const { data: canReview, error: accessError } = await (supabase as any).rpc(
        'buklod_cluster_can_review_home_checkin_v1', { p_scope_id: scopeId }
      );
      if (accessError) throw accessError;
      if (canReview !== true) {
        setError('Only an active admin of this exact Cluster can review Check In Today.');
        return;
      }
      setAllowed(true);
      const { data, error: queueError } = await (supabase as any).rpc(
        'cluster_get_buklod_home_checkin_queue_v1', { p_scope_id: scopeId }
      );
      if (queueError) throw queueError;
      if (!Array.isArray(data)) throw new Error('Invalid attendance queue response.');
      setRows(data as Checkin[]);
      if (data.length) setScopeName(String(data[0].cluster || 'Cluster'));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load the attendance queue.');
    } finally {
      setLoading(false);
    }
  }, [scopeId]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const review = async (item: Checkin, approve: boolean) => {
    const reason = (notes[item.id] ?? '').trim();
    if (busy || !allowed || reason.length < 8) return;
    setBusy(item.id);
    setError('');
    try {
      const { data: reviewResult, error: reviewError } = await (supabase as any).rpc(
        'cluster_review_buklod_home_checkin_v1', {
          p_checkin_id: item.id, p_approve: approve, p_reason: reason,
        }
      );
      if (reviewError) throw reviewError;
      if (!reviewResult || reviewResult.status !== (approve ? 'approved' : 'rejected')) {
        throw new Error('Attendance review was not confirmed by the server. Refresh the queue.');
      }
      setNotes(current => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      await refresh();
      const award = Number(reviewResult.points);
      Alert.alert('Attendance reviewed',
        approve
          ? reviewResult.credited === true && Number.isFinite(award) && award > 0
            ? `Verified. ${award} BP was recorded in the member ledger.`
            : 'Attendance verified. No new BP credit was issued (already credited or ineligible).'
          : 'Check-in rejected with your note.');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Review failed. Try refreshing.';
      setError(message);
      Alert.alert('Review failed', message);
    } finally {
      setBusy(null);
    }
  };

  const confirm = (item: Checkin, approve: boolean) => {
    if (busy || (notes[item.id] ?? '').trim().length < 8) return;
    Alert.alert(approve ? 'Verify attendance?' : 'Reject attendance?',
      `${item.member_name || 'Member'} · ${item.event}\n${approve ? 'Award eligible +10 BP after review?' : 'Reject this check-in?'}`, [
        { text: 'Cancel', style: 'cancel' },
        { text: approve ? 'Verify' : 'Reject', style: approve ? 'default' : 'destructive',
          onPress: () => { void review(item, approve); } },
      ]);
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Cluster Attendance Verification' }} />
      <ScrollView contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={loading && allowed} onRefresh={() => { void refresh(); }} />}>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={styles.back}>‹ Back to Cluster</Text>
        </Pressable>
        <Text style={styles.eyebrow}>EXACT-CLUSTER ADMIN</Text>
        <Text style={styles.title}>Verify Check In Today</Text>
        <Text style={styles.help}>
          {scopeName} · Review actual attendance, event venue and recorded time.
          Approval is limited to this Cluster and credits BP only once per event.
        </Text>
        {loading && <ActivityIndicator color="#176B4A" />}
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        {allowed && !loading && rows.length === 0 && (
          <Text style={styles.empty}>No pending check-ins for this Cluster.</Text>
        )}
        {allowed && rows.map(item => {
          const reason = (notes[item.id] ?? '').trim();
          const disabled = !!busy || reason.length < 8;
          return <View style={styles.card} key={item.id}>
            <Text style={styles.event}>{item.event}</Text>
            <Text style={styles.member}>{item.member_name || `Member ${item.member_id.slice(0, 8)}`}</Text>
            <Text style={styles.meta}>Venue: {item.place || 'Not recorded'}</Text>
            <Text style={styles.meta}>Event: {displayTime(item.starts_at)}</Text>
            <Text style={styles.meta}>Check-in: {displayTime(item.checked_in_at)}</Text>
            <TextInput
              value={notes[item.id] ?? ''}
              onChangeText={value => setNotes(current => ({ ...current, [item.id]: value }))}
              style={styles.input}
              placeholder="Reason for verification (at least 8 characters)"
              placeholderTextColor="#718077"
              multiline
              editable={!busy}
            />
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" disabled={disabled}
                onPress={() => confirm(item, true)}
                style={[styles.action, disabled && styles.disabled]}>
                <Text style={styles.actionText}>Verify +10 BP</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={disabled}
                onPress={() => confirm(item, false)}
                style={[styles.action, styles.reject, disabled && styles.disabled]}>
                <Text style={styles.actionText}>Reject</Text>
              </Pressable>
            </View>
          </View>;
        })}
        <Pressable onPress={() => { void refresh(); }} style={styles.refresh}>
          <Text style={styles.refreshText}>Refresh pending check-ins</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F8F5' },
  content: { padding: 16, paddingBottom: 40, gap: 10 },
  back: { color: '#176B4A', fontWeight: '800', fontSize: 13, paddingVertical: 8 },
  eyebrow: { color: '#557569', letterSpacing: 1, fontWeight: '800', fontSize: 10 },
  title: { color: '#163E2D', fontWeight: '900', fontSize: 22 },
  help: { color: '#597168', lineHeight: 19, fontSize: 12 },
  error: { padding: 12, borderRadius: 11, backgroundColor: '#FFE7DF', color: '#8F352B' },
  empty: { padding: 16, color: '#557569', backgroundColor: 'white', borderRadius: 12 },
  card: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 14,
    borderWidth: 1, borderColor: '#D7E6DB', gap: 8 },
  event: { color: '#174F31', fontWeight: '900', fontSize: 15 },
  member: { color: '#203B2D', fontWeight: '800', fontSize: 15 },
  meta: { color: '#5C6F63', fontSize: 12 },
  input: { borderWidth: 1, borderColor: '#CFDDD1', backgroundColor: '#FFFFFF',
    borderRadius: 10, padding: 12, minHeight: 70, color: '#183B29',
    textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, backgroundColor: '#126E3D', padding: 12, borderRadius: 10, alignItems: 'center' },
  reject: { backgroundColor: '#AD4C3D' },
  disabled: { opacity: 0.4 },
  actionText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  refresh: { padding: 12, alignItems: 'center' },
  refreshText: { color: '#176B4A', fontWeight: '800' },
});
