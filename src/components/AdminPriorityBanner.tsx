import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { fetchAdminPriorityRequests, rankAdminPriority, type AdminPrioritySnapshot } from '@/lib/buklodAdminPriority';

/** Small action-first badge, separate from cached executive dashboard statistics. */
export function AdminPriorityBanner() {
  const { hasRole } = useAuth();
  const allowed = hasRole('system_admin');
  const [snapshot, setSnapshot] = useState<AdminPrioritySnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);
  const lastLoad = useRef(0);
  const alive = useRef(true);
  const load = useCallback(async () => {
    if (!allowed || busy.current) return;
    busy.current = true;
    lastLoad.current = Date.now();
    setLoading(true);
    try {
      const value = await fetchAdminPriorityRequests(false);
      if (alive.current) setSnapshot(value);
    } catch {
      if (alive.current) setSnapshot(current => current || {
        items: [], pendingTotal: 0, unreadSupportAlerts: null, failedSources: ['Priority requests'],
        cappedSources: [], refreshedAt: Date.now(),
      });
    } finally {
      busy.current = false;
      if (alive.current) setLoading(false);
    }
  }, [allowed]);

  useFocusEffect(useCallback(() => {
    alive.current = true;
    void load();
    return () => { alive.current = false; };
  }, [load]));

  useEffect(() => {
    if (!allowed) return;
    const trigger = () => {
      if (Date.now() - lastLoad.current >= 20000) void load();
    };
    const state = AppState.addEventListener('change', next => { if (next === 'active') trigger(); });
    const channel = supabase.channel('system-admin-priority-badge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, trigger)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_feedback' }, trigger)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'buklod_paid_ad_campaigns' }, trigger)
      .subscribe();
    return () => { state.remove(); void supabase.removeChannel(channel); };
  }, [allowed, load]);

  const count = snapshot?.pendingTotal || 0;
  const urgent = snapshot?.items.filter(item => rankAdminPriority(item) === 3).length || 0;
  const unresolved = !!snapshot?.failedSources.length;
  const capped = !!snapshot?.cappedSources.some(source => source !== 'BSOC support');

  return <Pressable
    accessibilityRole="button"
    accessibilityLabel="Open System Admin priority requests"
    onPress={() => router.push('/admin/priority-requests' as any)}
    style={s.card}>
    <View style={s.icon}><MaterialCommunityIcons name="bell-ring-outline" size={23} color="#FFFFFF" /></View>
    <View style={s.body}>
      <Text style={s.eyebrow}>ADMIN PRIORITY NOTIFICATIONS</Text>
      <Text style={s.title}>{loading && !snapshot ? 'Checking pending requests…' : count
        ? String(count) + (capped ? '+' : '') + ' requests need action'
        : unresolved ? 'Request queue needs verification' : 'No pending requests detected'}</Text>
      <Text style={s.subtitle}>
        {urgent ? urgent + ' urgent in latest items · ' : ''}
        {snapshot?.unreadSupportAlerts ? snapshot.unreadSupportAlerts + ' unread BSOC alerts · ' : ''}
        {unresolved ? 'Some sources unavailable' : 'Help, advertising, approvals and privacy'}
      </Text>
    </View>
    <MaterialCommunityIcons name="chevron-right" size={24} color="#2C6849" />
  </Pressable>;
}

const s = StyleSheet.create({
  card: { backgroundColor: '#F0F8F2', borderColor: '#BEDAC7', borderWidth: 1,
    padding: 14, marginVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 11 },
  icon: { backgroundColor: '#24603E', width: 43, height: 43,
    borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 3 },
  eyebrow: { fontSize: 10, fontWeight: '900', color: '#37674B', letterSpacing: 0.7 },
  title: { fontSize: 16, fontWeight: '900', color: '#1A4630' },
  subtitle: { fontSize: 11, color: '#567361', lineHeight: 16 },
});
