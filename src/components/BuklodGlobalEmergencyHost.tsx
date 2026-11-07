/**
 * App-wide BUKLOD Emergency SOS overlay.
 *
 * Safety boundaries:
 * - Foreground in-app interruption only (no OS full-screen intent claim).
 * - All recipient incident details require BOTH the current user's canonical
 *   notification and a fresh, proximity-authorized nearby-help RPC result.
 * - No raw creator coordinates, recipient location or signed tokens rendered.
 * - No new public Realtime subscription per user: canonical push is primary,
 *   with a bounded foreground inbox check as a lost-push fallback.
 * - Dismissal is account+incident scoped, never cancels an SOS server-side.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator, Alert, AppState, Linking, Modal, Pressable,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { acquireBuklodAdSafetyLock } from '@/lib/buklodGlobalAdController';
import {
  emitBuklodEmergencySignal,
  isBuklodEmergencyId,
  subscribeBuklodEmergencySignal,
  type BuklodEmergencySignal,
} from '@/lib/buklodEmergencySignal';
import BuklodEmergencyPushBridge from '@/components/BuklodEmergencyPushBridge';

type Emergency = {
  id: string;
  origin: 'sender' | 'recipient';
  category: string;
  message: string;
  created_at: string;
  expires_at: string;
  status: string;
  distance_km: number | null;
  can_help_count: number | null;
  on_my_way_count: number | null;
  confirm_count: number | null;
  my_response: string | null;
};
type DisplayState = {
  incidentId: string;
  origin: 'sender' | 'recipient';
  emergency: Emergency | null;
  verified: boolean;
  checking: boolean;
  minimized: boolean;
  error: string | null;
};
type Nearby = {
  id: string; creator_id: string; kind: string; category: string;
  message: string; status: string; distance_km: number | null;
  created_at: string; expires_at: string;
  can_help_count: number; on_my_way_count: number; confirm_count: number;
  my_response: string | null;
};
const LOOKBACK_MS = 2 * 60 * 60 * 1000;
const FOREGROUND_INBOX_MS = 45_000;
const ACTIVE_REFRESH_MS = 15_000;
const RECENT_LIMIT = 8;
const persistentKey = (owner: string) => `@buklod/sos/minimized/v2/${owner}`;
const freshActive = (row: { status: string; expires_at: string }) =>
  row.status === 'ACTIVE' && new Date(row.expires_at).getTime() > Date.now();

function fromNearby(row: Nearby, origin: 'sender' | 'recipient'): Emergency {
  return {
    id: row.id, origin, category: row.category, message: row.message,
    created_at: row.created_at, expires_at: row.expires_at,
    status: row.status, distance_km: origin === 'recipient' ? row.distance_km : null,
    can_help_count: Number(row.can_help_count ?? 0),
    on_my_way_count: Number(row.on_my_way_count ?? 0),
    confirm_count: Number(row.confirm_count ?? 0),
    my_response: row.my_response ?? null,
  };
}
function formatDistance(value: number | null) {
  return value == null || !Number.isFinite(value) ? 'Nearby' : `About ${Math.max(0, value).toFixed(1)} km away`;
}
function titleCase(category: string) {
  return category.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

export default function BuklodGlobalEmergencyHost() {
  const { user } = useAuth();
  const owner = user?.id ?? null;
  const [shown, setShown] = useState<DisplayState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const accountEpoch = useRef(0);
  const dismissed = useRef<Set<string>>(new Set());
  const inboxInFlight = useRef(false);
  const lastInboxCheck = useRef(0);
  const currentOwner = useRef(owner);
  const candidateInFlight = useRef<Set<string>>(new Set());

  useEffect(() => {
    currentOwner.current = owner;
    const epoch = ++accountEpoch.current;
    dismissed.current = new Set();
    setShown(null);
    if (!owner) return;
    let cancelled = false;
    void AsyncStorage.getItem(persistentKey(owner)).then(raw => {
      if (cancelled || accountEpoch.current !== epoch) return;
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      dismissed.current = new Set(Array.isArray(parsed)
        ? parsed.filter(isBuklodEmergencyId).slice(-48) : []);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [owner]);

  const loadVerified = useCallback(async (
    incidentId: string,
    origin: 'sender' | 'recipient',
  ): Promise<Emergency | null> => {
    if (!owner || !isBuklodEmergencyId(incidentId)) return null;
    if (origin === 'recipient') {
      // Push payload alone NEVER authorizes displaying the incident.
      const { data: entitlement, error: entitlementError } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', owner)
        .eq('kind', 'community_emergency')
        .contains('data', { help_request_id: incidentId })
        .limit(1)
        .maybeSingle();
      if (entitlementError) throw entitlementError;
      if (!entitlement) return null;
    } else {
      const { data: mine, error: mineError } = await supabase
        .from('buklod_help_requests')
        .select('id,creator_id,kind,category,message,status,created_at,expires_at')
        .eq('id', incidentId)
        .eq('creator_id', owner)
        .maybeSingle();
      if (mineError) throw mineError;
      if (!mine || mine.kind !== 'EMERGENCY' || !freshActive(mine)) return null;
    }
    // This RPC enforces recent opted-in presence and <= server-approved radius.
    // For recipients its absence must fail closed, not trust the push contents.
    const { data: nearby, error: nearbyError } = await supabase.rpc(
      'buklod_help_list_nearby', { p_limit: 50 },
    );
    if (nearbyError) throw nearbyError;
    const item = ((nearby ?? []) as Nearby[]).find(
      row => row.id === incidentId && row.kind === 'EMERGENCY' && freshActive(row),
    );
    if (!item) return null;
    if (origin === 'sender' && item.creator_id !== owner) return null;
    if (origin === 'recipient' && item.creator_id === owner) return null;
    return fromNearby(item, origin);
  }, [owner]);

  const offer = useCallback(async (signal: BuklodEmergencySignal, quiet = false) => {
    if (!owner || !foreground || !isBuklodEmergencyId(signal.incidentId)) return;
    const epoch = accountEpoch.current;
    const id = signal.incidentId;
    if (candidateInFlight.current.has(id)) return;
    candidateInFlight.current.add(id);
    const minimized = dismissed.current.has(id);
    if (!quiet && !minimized) {
      setShown(current => current?.incidentId === id
        ? current
        : { incidentId: id, origin: signal.origin, emergency: null,
            verified: false, checking: true, minimized: false, error: null });
    }
    try {
      const incident = await loadVerified(id, signal.origin);
      if (accountEpoch.current !== epoch || currentOwner.current !== owner) return;
      if (!incident) {
        // Expired/unauthorized/no longer within eligible range: do not reveal details.
        setShown(current => current?.incidentId === id
          ? { ...current, emergency: null, verified: false, checking: false,
              error: 'This SOS could not be verified as active and nearby.' }
          : current);
        return;
      }
      setShown(current => {
        // A different active alert has priority until the person minimizes it.
        if (quiet && current?.verified && !current.minimized && current.incidentId !== id) return current;
        if (current?.incidentId === id) {
          return { ...current, emergency: incident, verified: true, checking: false,
            error: null, minimized: current.minimized || minimized };
        }
        return { incidentId: id, origin: signal.origin, emergency: incident,
          verified: true, checking: false, error: null, minimized };
      });
    } catch {
      if (accountEpoch.current !== epoch) return;
      setShown(current => current?.incidentId === id
        ? { ...current, emergency: null, verified: false, checking: false,
            error: 'Could not verify this SOS. Check your connection and retry.' }
        : current);
    } finally {
      candidateInFlight.current.delete(id);
    }
  }, [owner, foreground, loadVerified]);

  useEffect(() => subscribeBuklodEmergencySignal(signal => {
    void offer(signal);
  }), [offer]);

  const scanInbox = useCallback(async () => {
    if (!owner || !foreground || inboxInFlight.current ||
        Date.now() - lastInboxCheck.current < 8_000) return;
    inboxInFlight.current = true;
    lastInboxCheck.current = Date.now();
    const epoch = accountEpoch.current;
    try {
      const { data, error } = await supabase.from('notifications')
        .select('data,created_at')
        .eq('user_id', owner)
        .eq('kind', 'community_emergency')
        .gte('created_at', new Date(Date.now() - LOOKBACK_MS).toISOString())
        .order('created_at', { ascending: false }).limit(RECENT_LIMIT);
      if (error) throw error;
      if (accountEpoch.current !== epoch) return;
      for (const row of data ?? []) {
        const payload = row.data as Record<string, unknown> | null;
        const id = payload?.help_request_id;
        if (!isBuklodEmergencyId(id)) continue;
        if (dismissed.current.has(id)) {
          if (!shown) void offer({ incidentId: id, origin: 'recipient' }, true);
          continue;
        }
        if (shown?.verified && !shown.minimized) break;
        void offer({ incidentId: id, origin: 'recipient' }, true);
        break;
      }
    } catch {
      // A missed background fetch does not affect existing push delivery.
    } finally {
      inboxInFlight.current = false;
    }
  }, [foreground, owner, offer, shown]);

  useEffect(() => {
    if (!owner || !foreground) return;
    void scanInbox();
    const timer = setInterval(() => { void scanInbox(); }, FOREGROUND_INBOX_MS);
    return () => clearInterval(timer);
  }, [owner, foreground, scanInbox]);

  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      const active = state === 'active';
      setForeground(active);
      if (active) lastInboxCheck.current = 0;
    });
    return () => listener.remove();
  }, []);

  useEffect(() => {
    if (!owner || !foreground || !shown?.incidentId) return;
    const id = shown.incidentId;
    const origin = shown.origin;
    const timer = setInterval(() => { void offer({ incidentId: id, origin }); }, ACTIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [owner, foreground, shown?.incidentId, shown?.origin, offer]);

  useEffect(() => {
    if (!shown || shown.minimized || !foreground) return;
    return acquireBuklodAdSafetyLock('transaction');
  }, [shown?.incidentId, shown?.minimized, foreground]);

  const minimize = useCallback(() => {
    if (!owner || !shown) return;
    const id = shown.incidentId;
    dismissed.current.add(id);
    void AsyncStorage.setItem(
      persistentKey(owner),
      JSON.stringify([...dismissed.current].slice(-48)),
    ).catch(() => undefined);
    setShown(current => current?.incidentId === id ? { ...current, minimized: true } : current);
  }, [owner, shown]);

  const respond = useCallback(async (type: 'CAN_HELP'|'ON_MY_WAY'|'CANNOT_HELP'|'FALSE_ALERT') => {
    if (!shown?.verified || shown.origin !== 'recipient' || submitting ||
        shown.emergency?.status !== 'ACTIVE') return;
    const id = shown.incidentId;
    if (type === 'FALSE_ALERT') {
      Alert.alert('Report a possible false SOS?', 'Only flag suspected abuse, not an incident you cannot personally verify.', [
        { text: 'Keep alert', style: 'cancel' },
        { text: 'Flag for review', style: 'destructive',
          onPress: () => { void respondConfirmed('FALSE_ALERT'); } },
      ]);
      return;
    }
    await respondConfirmed(type);

    async function respondConfirmed(responseType: 'CAN_HELP'|'ON_MY_WAY'|'CANNOT_HELP'|'FALSE_ALERT') {
      setSubmitting(true);
      try {
        const { error } = await supabase.rpc('buklod_help_respond', {
          p_request_id: id, p_response_type: responseType,
        });
        if (error) throw error;
        if (responseType === 'CANNOT_HELP') minimize();
        else void offer({ incidentId: id, origin: 'recipient' });
      } catch (error: any) {
        Alert.alert('Response not saved',
          String(error?.message ?? 'Please check nearby safety alerts and retry.'));
      } finally {
        setSubmitting(false);
      }
    }
  }, [shown, submitting, minimize, offer]);

  const resolve = useCallback(() => {
    if (!shown?.verified || shown.origin !== 'sender' || submitting) return;
    const id = shown.incidentId;
    Alert.alert('End this SOS?', 'Only resolve this emergency when you are safe or no longer need assistance.', [
      { text: 'Keep active', style: 'cancel' },
      { text: "I'm safe · Resolve", onPress: () => {
        void (async () => {
          setSubmitting(true);
          try {
            const { error } = await supabase.rpc('buklod_help_resolve', {
              p_request_id: id, p_status: 'RESOLVED',
            });
            if (error) throw error;
            dismissed.current.add(id);
            setShown(current => current?.incidentId === id ? null : current);
          } catch (error: any) {
            Alert.alert('Could not resolve SOS', String(error?.message ?? 'Retry while connected.'));
          } finally {
            setSubmitting(false);
          }
        })();
      } },
    ]);
  }, [shown, submitting]);

  const event = shown?.emergency;
  if (!owner) return null;

  return (
    <>
      <BuklodEmergencyPushBridge />
      {shown?.minimized && shown.verified && event ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open active BUKLOD emergency"
          onPress={() => setShown(current => current ? { ...current, minimized: false } : null)}
          style={styles.floating}
        >
          <MaterialCommunityIcons name="alarm-light" color="#FFFFFF" size={20}/>
          <Text style={styles.floatingText}>ACTIVE SOS · View alert</Text>
        </Pressable>
      ) : null}
      <Modal
        visible={Boolean(shown && !shown.minimized && foreground)}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={minimize}
      >
        <View style={styles.backdrop}>
          <View style={styles.panel}>
            <ScrollView contentContainerStyle={styles.body}
              keyboardShouldPersistTaps="handled">
              <View style={styles.topRow}>
                <View style={styles.redIcon}>
                  <MaterialCommunityIcons name="alarm-light" size={28} color="#FFFFFF"/>
                </View>
                <View style={styles.topCopy}>
                  <Text style={styles.eyebrow}>
                    {shown?.origin === 'sender' ? 'YOUR EMERGENCY SOS' : 'EMERGENCY NEAR YOU'}
                  </Text>
                  <Text style={styles.heading}>
                    {shown?.origin === 'sender' ? 'Your SOS is active' : 'A BUKLOD member needs help'}
                  </Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Minimize SOS"
                  onPress={minimize} style={styles.minimize}>
                  <MaterialCommunityIcons name="minus" size={22} color="#334338"/>
                </Pressable>
              </View>

              {shown?.checking ? (
                <View style={styles.status}>
                  <ActivityIndicator color="#B42318"/>
                  <Text style={styles.statusText}>Verifying emergency details securely…</Text>
                </View>
              ) : !shown?.verified || !event ? (
                <View style={styles.status}>
                  <MaterialCommunityIcons name="shield-alert-outline" size={24} color="#B42318"/>
                  <Text style={styles.statusText}>
                    {shown?.error ?? 'This SOS could not be verified.'}
                  </Text>
                  <Pressable accessibilityRole="button" style={styles.outline}
                    onPress={() => shown && void offer({ incidentId: shown.incidentId, origin: shown.origin })}>
                    <Text style={styles.outlineText}>Check again</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <View style={styles.severity}>
                    <MaterialCommunityIcons name="alert-circle" size={18} color="#B42318"/>
                    <Text style={styles.severityText}>{titleCase(event.category)} · Active emergency</Text>
                  </View>
                  <Text style={styles.message}>
                    {event.message.trim() || 'Emergency assistance requested by a BUKLOD member.'}
                  </Text>
                  <View style={styles.location}>
                    <MaterialCommunityIcons name="map-marker-radius-outline" size={20} color="#527362"/>
                    <Text style={styles.locationText}>
                      {shown?.origin === 'sender'
                        ? 'Your precise location is protected for nearby matching.'
                        : formatDistance(event.distance_km) + ' · Exact location is protected.'}
                    </Text>
                  </View>
                  <View style={styles.metrics}>
                    <View style={styles.metric}>
                      <Text style={styles.metricNumber}>{event.can_help_count ?? '—'}</Text>
                      <Text style={styles.metricLabel}>Can help</Text>
                    </View>
                    <View style={styles.metric}>
                      <Text style={styles.metricNumber}>{event.on_my_way_count ?? '—'}</Text>
                      <Text style={styles.metricLabel}>On the way</Text>
                    </View>
                    <View style={styles.metric}>
                      <Text style={styles.metricNumber}>{event.confirm_count ?? '—'}</Text>
                      <Text style={styles.metricLabel}>Confirmed</Text>
                    </View>
                  </View>
                  {shown.origin === 'sender' ? (
                    <>
                      <Text style={styles.hint}>Your SOS remains active until resolved or expired.
                        Push delivery and physical arrival are not guaranteed. Contact official emergency services when needed.</Text>
                      <Pressable accessibilityRole="button"
                        accessibilityLabel="I am safe, resolve my emergency"
                        disabled={submitting}
                        style={styles.primary} onPress={resolve}>
                        <MaterialCommunityIcons name="check-circle-outline" size={20} color="#FFFFFF"/>
                        <Text style={styles.primaryText}>I'M SAFE · END SOS</Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Text style={styles.hint}>
                        Respond only if you can help safely. BUKLOD does not replace emergency services.
                      </Text>
                      <View style={styles.buttonRow}>
                        <Pressable accessibilityRole="button" disabled={submitting}
                          onPress={() => void respond('CAN_HELP')} style={styles.primary}>
                          <MaterialCommunityIcons name="hand-heart-outline" size={18} color="#FFFFFF"/>
                          <Text style={styles.primaryText}>CAN HELP</Text>
                        </Pressable>
                        <Pressable accessibilityRole="button" disabled={submitting}
                          onPress={() => void respond('ON_MY_WAY')} style={styles.primary}>
                          <MaterialCommunityIcons name="navigation" size={18} color="#FFFFFF"/>
                          <Text style={styles.primaryText}>ON MY WAY</Text>
                        </Pressable>
                      </View>
                      <View style={styles.secondaryRow}>
                        <Pressable accessibilityRole="button" disabled={submitting}
                          onPress={() => void respond('CANNOT_HELP')}>
                          <Text style={styles.outlineText}>Can't help now</Text>
                        </Pressable>
                        <Pressable accessibilityRole="button" disabled={submitting}
                          onPress={() => void respond('FALSE_ALERT')}>
                          <Text style={styles.report}>Report possible false alert</Text>
                        </Pressable>
                      </View>
                      {event.my_response ? (
                        <Text style={styles.ack}>Your response: {event.my_response.replaceAll('_',' ')}</Text>
                      ) : null}
                    </>
                  )}
                </>
              )}
              <Text style={styles.footer}>Emergency assistance: contact your local emergency services directly.</Text>
              <Pressable accessibilityRole="button" onPress={minimize} style={styles.later}>
                <Text style={styles.laterText}>Minimize · Continue using BUKLOD</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles=StyleSheet.create({
  backdrop:{flex:1,backgroundColor:'rgba(6,12,9,0.73)',justifyContent:'center',paddingHorizontal:14,paddingVertical:30},
  panel:{backgroundColor:'#FFFFFF',borderRadius:24,maxHeight:'92%',overflow:'hidden',borderWidth:2,borderColor:'#EBB9B6'},
  body:{padding:18,gap:14},
  topRow:{flexDirection:'row',alignItems:'center',gap:11},
  redIcon:{width:49,height:49,borderRadius:15,backgroundColor:'#B42318',alignItems:'center',justifyContent:'center'},
  topCopy:{flex:1,gap:3},
  eyebrow:{fontSize:10,color:'#B42318',fontWeight:'900',letterSpacing:1},
  heading:{fontSize:18,lineHeight:23,color:'#192B20',fontWeight:'900'},
  minimize:{width:38,height:38,borderRadius:19,backgroundColor:'#F0F4F1',alignItems:'center',justifyContent:'center'},
  severity:{flexDirection:'row',alignItems:'center',gap:7,backgroundColor:'#FFF0EE',borderRadius:12,padding:11},
  severityText:{color:'#B42318',fontSize:13,fontWeight:'900',flex:1},
  message:{color:'#273B30',fontSize:17,lineHeight:24,fontWeight:'700'},
  location:{flexDirection:'row',alignItems:'center',gap:7},
  locationText:{flex:1,color:'#527362',fontSize:12,lineHeight:17},
  metrics:{flexDirection:'row',gap:8},
  metric:{flex:1,backgroundColor:'#F1F6F2',borderRadius:13,paddingVertical:12,paddingHorizontal:5,alignItems:'center',gap:3},
  metricNumber:{fontSize:19,fontWeight:'900',color:'#224A34'},
  metricLabel:{fontSize:10,fontWeight:'800',color:'#617C6B'},
  hint:{fontSize:12,lineHeight:18,color:'#65786D'},
  buttonRow:{flexDirection:'row',gap:8},
  primary:{flex:1,minHeight:48,borderRadius:14,backgroundColor:'#B42318',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingHorizontal:11},
  primaryText:{fontSize:11,fontWeight:'900',color:'#FFFFFF'},
  secondaryRow:{flexDirection:'row',justifyContent:'space-between',gap:10,paddingVertical:7},
  outline:{borderWidth:1,borderColor:'#C4D7C8',paddingHorizontal:14,paddingVertical:10,borderRadius:12},
  outlineText:{color:'#1D6B48',fontSize:12,fontWeight:'800'},
  report:{color:'#9D483F',fontSize:11,fontWeight:'800'},
  status:{paddingVertical:18,alignItems:'center',gap:12},
  statusText:{fontSize:12,color:'#52685A',textAlign:'center'},
  ack:{fontSize:12,fontWeight:'900',color:'#1D6B48'},
  footer:{fontSize:11,lineHeight:16,color:'#7B877F',textAlign:'center'},
  later:{paddingVertical:10,alignItems:'center'},
  laterText:{fontSize:12,fontWeight:'800',color:'#516858'},
  floating:{position:'absolute',right:16,bottom:92,borderRadius:22,backgroundColor:'#B42318',zIndex:9000,
    elevation:12,paddingHorizontal:14,minHeight:44,flexDirection:'row',alignItems:'center',gap:8,
    borderWidth:2,borderColor:'#FFFFFF'},
  floatingText:{fontSize:12,fontWeight:'900',color:'#FFFFFF'},
});
