import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { BuklodQrMatrix } from '@/components/BuklodQrMatrix';
import { supabase } from '@/lib/supabase';

type EventReview = { status: string; can_review: boolean; reviewed_at?: string | null };
type IssuedQr = { payload: string; expires_at: string };
export function BuklodAttendanceEventQrPanel({ eventId, canManage, eventOpen }: {
  eventId: string; canManage: boolean; eventOpen: boolean
}) {
  const [qr, setQr] = useState<IssuedQr | null>(null);
  const [status, setStatus] = useState<EventReview | null>(null);
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState('');
  const [working, setWorking] = useState(false);
  const loadStatus = useCallback(async () => {
    const { data } = await supabase.rpc('buklod_attendance_event_reward_status_v2', { p_event_id: eventId });
    if (data) setStatus(data as EventReview);
  }, [eventId]);
  const refreshQr = useCallback(async () => {
    if (!canManage || !eventOpen) return;
    const { data, error } = await supabase.rpc('buklod_issue_event_qr_v2', { p_event_id: eventId });
    if (error) { setQr(null); setMessage(error.message); }
    else setQr(data as IssuedQr);
  }, [canManage, eventId, eventOpen]);
  useEffect(() => { setQr(null); setStatus(null); setReason(''); setMessage(''); }, [eventId]);
  useFocusEffect(useCallback(() => {
    void loadStatus();
    void refreshQr();
    const interval = setInterval(() => { void refreshQr(); }, 45000);
    return () => clearInterval(interval);
  }, [loadStatus, refreshQr]));
  const review = async (approve: boolean) => {
    if (!status?.can_review || working || reason.trim().length < 10) {
      setMessage('Enter a review explanation of at least 10 characters.');
      return;
    }
    setWorking(true); setMessage('');
    const { error } = await supabase.rpc('buklod_review_event_rewards_v2', {
      p_event_id: eventId, p_approve: approve, p_reason: reason.trim(),
    });
    if (error) setMessage(error.message);
    else { setReason(''); setMessage(approve ? 'Event approved; verified rewards evaluated under caps.' : 'Event rewards rejected. Attendance records remain.'); await loadStatus(); }
    setWorking(false);
  };
  if (!canManage) return null;
  return (
    <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 14, gap: 10 }}>
      <Text style={{ color: '#173B2F', fontWeight: '900', fontSize: 15 }}>Event QR • Attendance V2</Text>
      <Text style={{ color: '#537063', fontSize: 12 }}>Attendees scan with BUKLOD. Code rotates automatically; registration does not grant BP.</Text>
      {qr?.payload && eventOpen ? (
        <View style={{ alignItems: 'center', gap: 4 }}>
          <BuklodQrMatrix value={qr.payload} size={206} />
          <Text style={{ fontSize: 11, color: '#537063' }}>Refreshing every 45 seconds</Text>
        </View>
      ) : eventOpen ? <ActivityIndicator color="#167944" /> : <Text style={{ fontSize: 12, color: '#537063' }}>Open the event to show its QR.</Text>}
      <Text style={{ fontSize: 12, color: '#173B2F', fontWeight: '800' }}>Reward review: {status?.status ?? 'pending'}</Text>
      <Text style={{ fontSize: 11, color: '#537063' }}>Independent scope-admin approval after the event is required. No creator self-approval.</Text>
      {status?.can_review ? (
        <>
          <TextInput value={reason} onChangeText={setReason} placeholder="Reason / event verification evidence"
            style={{ borderColor: '#CEDAD2', borderWidth: 1, borderRadius: 10, padding: 10, color: '#173B2F' }} />
          <View style={{ flexDirection: 'row', gap: 9 }}>
            <Pressable disabled={working} onPress={() => void review(true)} style={{ flex: 1, padding: 12, borderRadius: 9, backgroundColor: '#1B7843' }}>
              <Text style={{ textAlign: 'center', color: '#fff', fontWeight: '900', fontSize: 11 }}>APPROVE BP</Text>
            </Pressable>
            <Pressable disabled={working} onPress={() => void review(false)} style={{ flex: 1, padding: 12, borderRadius: 9, backgroundColor: '#7D4343' }}>
              <Text style={{ textAlign: 'center', color: '#fff', fontWeight: '900', fontSize: 11 }}>REJECT BP</Text>
            </Pressable>
          </View>
        </>
      ) : null}
      {!!message && <Text accessibilityRole="alert" style={{ fontSize: 12, color: '#7D4343' }}>{message}</Text>}
    </View>
  );
}