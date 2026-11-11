import React, { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { StreamVideoParticipant } from '@stream-io/video-client';
import BuklodPttConversation from '@/components/BuklodPttConversation';
import { loadBuklodPttScopes, type BuklodPttConnection, type BuklodPttKind, type BuklodPttScope } from '@/ptt/buklodPttCore';
import { connectBuklodPttRuntime, disconnectBuklodPttRuntime, getBuklodPttRuntimeState, pttDown, pttUp, subscribeBuklodPttRuntime } from '@/ptt/buklodPttRuntime';

/* BUKLOD_PTT_WEB_LIVE_R1: existing authorization, Stream browser audio, shared server floor. */
const CHANNELS = Array.from({ length: 10 }, (_, i) => i + 1);
const MODES: BuklodPttKind[] = ['NORMAL', 'PRIORITY', 'SOS'];

function RemoteAudio({ connection, participant }: { connection: BuklodPttConnection; participant: StreamVideoParticipant }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const unbind = connection.call.bindAudioElement(ref.current, participant.sessionId, 'audioTrack');
    return () => { try { unbind?.(); } catch {} };
  }, [connection, participant.sessionId]);
  return createElement('audio', { ref, autoPlay: true, playsInline: true, 'data-buklod-ptt-audio': '1' });
}

export default function BuklodPttWebRoute() {
  const [scopes, setScopes] = useState<BuklodPttScope[]>([]);
  const [scopeId, setScopeId] = useState('');
  const [channel, setChannel] = useState(1);
  const [mode, setMode] = useState<BuklodPttKind>('NORMAL');
  const [runtime, setRuntime] = useState(getBuklodPttRuntimeState);
  const [participants, setParticipants] = useState<StreamVideoParticipant[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [held, setHeld] = useState(false);
  const [error, setError] = useState('');
  const [speakerStatus, setSpeakerStatus] = useState('ENABLE SPEAKER AUDIO');
  const holdRef = useRef(false);
  const busyRef = useRef(false);
  const alive = useRef(true);
  const connection = runtime.connection;
  const scope = scopes.find(s => s.id === scopeId);
  const connected = !!connection && connection.scope.id === scopeId && connection.channel === channel;
  const remote = participants.filter(p => !p.isLocalParticipant);
  const speaking = remote.some(p => p.isSpeaking);

  useEffect(() => subscribeBuklodPttRuntime(setRuntime), []);
  useEffect(() => {
    let active = true;
    alive.current = true;
    void loadBuklodPttScopes().then(rows => {
      if (!active) return;
      setScopes(rows);
      const current = getBuklodPttRuntimeState().connection;
      setScopeId(current && rows.some(s => s.id === current.scope.id) ? current.scope.id : rows[0]?.id || '');
      setChannel(current?.channel || 1);
    }).catch(e => { if (active) setError(e?.message || 'Could not load communities.'); })
      .finally(() => { if (active) setLoading(false); });
    const end = () => {
      if (!holdRef.current) return;
      holdRef.current = false;
      setHeld(false);
      void pttUp().catch(() => undefined);
    };
    const hidden = () => { if (document.hidden) end(); };
    window.addEventListener('blur', end);
    window.addEventListener('pagehide', end);
    window.addEventListener('mouseup', end);
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      active = false;
      alive.current = false;
      end();
      window.removeEventListener('blur', end);
      window.removeEventListener('pagehide', end);
      window.removeEventListener('mouseup', end);
      window.removeEventListener('touchend', end);
      window.removeEventListener('touchcancel', end);
      document.removeEventListener('visibilitychange', hidden);
      void disconnectBuklodPttRuntime().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (!connection) { setParticipants([]); return; }
    setParticipants(connection.call.state.participants ?? []);
    const subscription = connection.call.state.participants$.subscribe(setParticipants);
    return () => subscription.unsubscribe();
  }, [connection]);

  const changeTarget = useCallback(async (newScope: string, newChannel: number) => {
    if (busyRef.current || holdRef.current || (newScope === scopeId && newChannel === channel)) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      if (connection) await disconnectBuklodPttRuntime();
      if (alive.current) { setScopeId(newScope); setChannel(newChannel); }
    } catch (e: any) { if (alive.current) setError(e?.message || 'Could not switch channels.'); }
    finally { busyRef.current = false; if (alive.current) setBusy(false); }
  }, [scopeId, channel, connection]);

  const connect = useCallback(async () => {
    if (busyRef.current || holdRef.current || !scope) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      if (connected) await disconnectBuklodPttRuntime();
      else {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new Error('A secure HTTPS browser with microphone access is required.');
        }
        await connectBuklodPttRuntime(scope, channel);
      }
    } catch (e: any) { if (alive.current) setError(e?.message || 'PTT connection failed.'); }
    finally { busyRef.current = false; if (alive.current) setBusy(false); }
  }, [scope, channel, connected]);

  const start = useCallback(() => {
    if (!connected || busyRef.current || holdRef.current || runtime.requestingFloor || runtime.transmitting) return;
    holdRef.current = true; setHeld(true); setError('');
    void pttDown(mode).catch((e: any) => {
      if (alive.current) setError(e?.message || 'Transmission failed.');
      if (holdRef.current) { holdRef.current = false; if (alive.current) setHeld(false); void pttUp().catch(() => undefined); }
    });
  }, [connected, runtime.requestingFloor, runtime.transmitting, mode]);

  const stop = useCallback(() => {
    if (!holdRef.current) return;
    holdRef.current = false; setHeld(false);
    void pttUp().catch((e: any) => { if (alive.current) setError(e?.message || 'Release failed.'); });
  }, []);

  const resumeAudio = useCallback(async () => {
    const elements = Array.from(document.querySelectorAll('audio[data-buklod-ptt-audio]')) as HTMLAudioElement[];
    if (!elements.length) { setSpeakerStatus('SPEAKER READY'); return; }
    const result = await Promise.allSettled(elements.map(a => a.play()));
    setSpeakerStatus(result.some(r => r.status === 'rejected') ? 'SPEAKER BLOCKED BY BROWSER' : 'SPEAKER ENABLED');
  }, []);

  const status = !connected ? 'Disconnected' : runtime.transmitting ? 'Transmitting' :
    runtime.requestingFloor ? 'Requesting channel' : runtime.priorityReceiving ? 'Priority incoming' :
    speaking ? 'Receiving audio' : 'Connected · ready';

  return <ScrollView style={s.screen} contentContainerStyle={s.outer} keyboardShouldPersistTaps="handled">
    <View style={s.container}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Back" style={s.back}><MaterialCommunityIcons name="arrow-left" color="#C2E3E8" size={23} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.kicker}>LIVE COMMUNICATION</Text>
          <Text style={s.title}>BUKLOD PTT</Text>
          <Text style={s.hint}>Web ↔ Android · CH01–CH10 · Organization / Cluster</Text>
        </View>
        <View style={[s.dot, connected && s.dotOn]} />
      </View>
      <View style={s.card}>
        <Text style={s.heading}>COMMUNITY</Text>
        {loading ? <ActivityIndicator color="#56E0E8" /> :
          !scopes.length ? <Text style={s.hint}>No active organization or cluster membership found.</Text> :
          <View style={s.choices}>{scopes.map(item => <Pressable key={item.id} disabled={busy || held} onPress={() => void changeTarget(item.id, channel)}
            style={[s.option, item.id === scopeId && s.active]}>
            <Text style={s.optionText}>{item.name}</Text><Text style={s.hint}>{item.scope_type}</Text>
          </Pressable>)}</View>}
        <Text style={s.heading}>CHANNEL</Text>
        <View style={s.choices}>{CHANNELS.map(n => <Pressable key={n} disabled={busy || held} accessibilityLabel={'Channel ' + n}
          onPress={() => void changeTarget(scopeId, n)} style={[s.option, n === channel && s.active]}>
          <Text style={s.optionText}>{'CH' + String(n).padStart(2, '0')}</Text>
        </Pressable>)}</View>
        <View style={s.row}>
          <View style={{ flex: 1 }}><Text style={s.heading}>{status}</Text><Text style={s.hint}>Hold to transmit, release to mute.</Text></View>
          <Pressable disabled={busy || !scope} accessibilityRole="button" onPress={() => void connect()} style={[s.connect, (!scope || busy) && s.disabled]}>
            {busy ? <ActivityIndicator color="#081B27" /> : <Text style={s.buttonText}>{connected ? 'DISCONNECT' : 'CONNECT'}</Text>}
          </Pressable>
        </View>
      </View>
      <View style={s.card}>
        <Text style={s.heading}>TRANSMISSION MODE</Text>
        <View style={s.choices}>{MODES.map(item => <Pressable key={item} disabled={held || runtime.transmitting || runtime.requestingFloor}
          onPress={() => setMode(item)} style={[s.option, mode === item && s.active]}>
          <Text style={s.optionText}>{item}</Text>
        </Pressable>)}</View>
        <Pressable disabled={!connected || busy} accessibilityRole="button" accessibilityLabel="Hold to talk"
          onPressIn={start} onPressOut={stop}
          style={({ pressed }) => [s.talk, (held || runtime.transmitting || pressed) && s.talkOn, (!connected || busy) && s.disabled]}>
          <MaterialCommunityIcons name="microphone" color="#06272B" size={42} />
          <Text style={s.talkTitle}>{runtime.transmitting ? 'TRANSMITTING…' :
            runtime.requestingFloor || held ? 'REQUESTING CHANNEL…' : speaking ? 'RECEIVING AUDIO' : 'HOLD TO TALK'}</Text>
          <Text style={s.talkHint}>Press and hold · release to mute</Text>
        </Pressable>
        {mode !== 'NORMAL' && <Text style={s.warning}>Priority/SOS is for emergencies; server permissions and floor rules apply.</Text>}
        {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
        <Pressable onPress={() => void resumeAudio()} style={s.speaker} accessibilityRole="button">
          <MaterialCommunityIcons name="volume-high" color="#56E0E8" size={18} /><Text style={s.hint}>{speakerStatus}</Text>
        </Pressable>
        <Text style={s.hint}>{remote.length} other member(s) connected. Keep this tab open to receive; microphone needs browser permission. Audio mixing follows device settings.</Text>
        {connected && connection ? remote.map(item => <RemoteAudio key={item.sessionId} connection={connection} participant={item} />) : null}
      </View>
      {!!scope && <BuklodPttConversation scopeId={scope.id} channel={channel} connection={connected ? connection : null} />}
    </View>
  </ScrollView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#030A10' },
  outer: { padding: 16, paddingBottom: 70 },
  container: { width: '100%', maxWidth: 920, alignSelf: 'center', gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  back: { padding: 10, backgroundColor: '#102D3B', borderRadius: 12 },
  kicker: { fontSize: 10, color: '#56E0E8', fontWeight: '800', letterSpacing: 1 },
  title: { color: '#FFFFFF', fontWeight: '900', fontSize: 26 },
  hint: { fontSize: 12, color: '#A5C1CA', lineHeight: 18 },
  dot: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#647A85' },
  dotOn: { backgroundColor: '#25DC87' },
  card: { gap: 12, backgroundColor: '#081B27', borderColor: '#234451', borderWidth: 1, borderRadius: 16, padding: 15 },
  heading: { color: '#F1FCFF', fontWeight: '900', fontSize: 13 },
  choices: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  option: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 9, borderColor: '#315563', borderWidth: 1 },
  active: { borderColor: '#56E0E8', backgroundColor: '#155D55' },
  optionText: { color: '#E2F5F7', fontWeight: '800', fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  connect: { minWidth: 112, padding: 14, borderRadius: 10, alignItems: 'center', backgroundColor: '#56E0E8' },
  buttonText: { color: '#05202B', fontWeight: '900', fontSize: 12 },
  disabled: { opacity: 0.42 },
  talk: { minHeight: 180, padding: 16, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: '#56E0E8' },
  talkOn: { backgroundColor: '#25D08B' },
  talkTitle: { fontSize: 19, fontWeight: '900', color: '#06272B', textAlign: 'center' },
  talkHint: { fontSize: 12, color: '#0C4B50' },
  warning: { color: '#F7C4A1', fontSize: 12 },
  error: { color: '#FFA2A2', fontSize: 12, lineHeight: 18 },
  speaker: { alignSelf: 'flex-start', flexDirection: 'row', gap: 8, alignItems: 'center', borderColor: '#315563', borderWidth: 1, borderRadius: 9, padding: 10 },
});
