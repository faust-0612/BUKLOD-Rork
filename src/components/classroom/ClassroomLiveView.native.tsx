import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  StreamCall,
  StreamVideo,
  StreamVideoClient,
  useCall,
  useCallStateHooks,
} from '@stream-io/video-react-native-sdk';

import BuklodAcceptedCallContent from '@/components/BuklodAcceptedCallContent';
import ClassroomLiveAutomationLayer from '@/components/classroom/ClassroomLiveAutomationLayer';
import {
  applyClassroomInteractionEvent,
  ClassroomInteractionEvent,
  ClassroomLiveAuthorityState,
  createClassroomLiveAuthorityState,
  desiredStudentMedia,
} from '@/lib/education/classroomLiveState';
import { supabase } from '@/lib/supabase';

type Props = {
  classroomId: string;
  sessionId: string;
  classroomName: string;
  onExit: () => void;
};

type ServerLiveState = {
  session_id: string;
  version: number;
  interaction_id: string | null;
  mode: string;
  active_user_id: string | null;
  active_user_ids: string[] | null;
  mute_all: boolean;
  ended: boolean;
};

type AccessPayload = {
  api_key: string;
  token: string;
  user_id: string;
  user_name: string;
  call_type: string;
  call_id: string;
  role: 'FACULTY' | 'STUDENT';
  plan_key: 'FREE' | 'PREMIUM';
  hard_stop_at: string | null;
  remaining_seconds: number | null;
  participant_id: string | null;
  attendance_session_id?: string | null;
  state?: ServerLiveState | null;
};

type BreakoutRoom = { id: string; name: string; status: string; timer_ends_at?: string | null; call_id?: string };

function formatSeconds(value: number | null) {
  if (value == null) return 'PREMIUM';
  const seconds = Math.max(0, Math.floor(value));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${minutes}:${String(secs).padStart(2, '0')}`;
}

function stateFromServer(sessionId: string, state?: ServerLiveState | null): ClassroomLiveAuthorityState {
  if (!state) return createClassroomLiveAuthorityState(sessionId);
  return {
    sessionId,
    version: Number(state.version || 0),
    interactionId: state.interaction_id || null,
    mode: (state.mode || 'LISTENING') as any,
    activeUserId: state.active_user_id || null,
    activeUserIds: Array.isArray(state.active_user_ids) ? state.active_user_ids : state.active_user_id ? [state.active_user_id] : [],
    muteAll: !!state.mute_all,
    ended: !!state.ended,
  };
}

function participantUserId(participant: any) {
  return String(participant?.userId || participant?.user?.id || participant?.user_id || '');
}

function participantName(participant: any) {
  return String(participant?.name || participant?.user?.name || participantUserId(participant).slice(0, 8) || 'Student');
}

function ClassroomRoom({
  access,
  sessionId,
  authority,
  onAuthority,
  broadcast,
  breakouts,
  currentBreakoutId,
  onOpenBreakout,
  onReturnMain,
  onRefreshBreakouts,
}: {
  access: AccessPayload;
  sessionId: string;
  authority: ClassroomLiveAuthorityState;
  onAuthority: (next: ClassroomLiveAuthorityState) => void;
  broadcast: (event: ClassroomInteractionEvent | { kind: 'BREAKOUT_REFRESH' }) => Promise<void>;
  breakouts: BreakoutRoom[];
  currentBreakoutId: string | null;
  onOpenBreakout: (roomId: string) => Promise<void>;
  onReturnMain: () => Promise<void>;
  onRefreshBreakouts: () => Promise<void>;
}) {
  const call = useCall();
  const { useParticipants } = useCallStateHooks();
  const participants = useParticipants();
  const [sending, setSending] = useState(false);
  const responseSentFor = useRef<string | null>(null);

  const students = useMemo(
    () => participants.filter((participant: any) => {
      const id = participantUserId(participant);
      return id && id !== access.user_id;
    }),
    [participants, access.user_id],
  );

  const issueInteraction = useCallback(async (type: string, targetUserId?: string, targetUserIds?: string[]) => {
    if (access.role !== 'FACULTY' || sending) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('buklod-classroom-stream-access', {
        body: { action: 'interaction', session_id: sessionId, interaction_type: type, target_user_id: targetUserId || null, target_user_ids: targetUserIds || [] },
      });
      if (error || !data?.event) throw error ?? new Error(data?.error || 'Classroom interaction was not issued.');
      const event = data.event as ClassroomInteractionEvent;
      onAuthority(applyClassroomInteractionEvent(authority, event));
      await broadcast(event);
    } catch (error) {
      Alert.alert('Classroom Control', error instanceof Error ? error.message : 'Could not update the live classroom.');
    } finally {
      setSending(false);
    }
  }, [access.role, authority, broadcast, onAuthority, sending, sessionId]);

  useEffect(() => {
    if (!call || access.role !== 'STUDENT') return;
    const desired = desiredStudentMedia(authority, access.user_id);
    let cancelled = false;
    void (async () => {
      try {
        if (desired.microphone) await call.microphone.enable();
        else await call.microphone.disable();
        if (cancelled) return;
        if (desired.camera) await call.camera.enable();
        else await call.camera.disable();
      } catch (error) {
        if (!cancelled) console.warn('BUKLOD Classroom media transition', error);
      }
    })();
    return () => { cancelled = true; };
  }, [access.role, access.user_id, authority.version, authority.muteAll, authority.ended, call]);

  useEffect(() => {
    if (access.role !== 'STUDENT' || !authority.interactionId || !authority.activeUserIds.includes(access.user_id)) return;
    const mine = participants.find((participant: any) => participantUserId(participant) === access.user_id) as any;
    if (!mine?.isSpeaking || responseSentFor.current === authority.interactionId) return;
    responseSentFor.current = authority.interactionId;
    void supabase.functions.invoke('buklod-classroom-stream-access', {
      body: {
        action: 'interaction_result',
        session_id: sessionId,
        interaction_id: authority.interactionId,
        result: 'SPEECH_ACTIVITY',
        network_evidence: { connection_quality: mine?.connectionQuality || mine?.connection_quality || null },
      },
    }).catch(() => undefined);
  }, [access.role, access.user_id, authority.interactionId, authority.activeUserIds, participants, sessionId]);

  const randomStudent = () => {
    if (!students.length) return Alert.alert('Random Student', 'No connected student is currently eligible.');
    const chosen = students[Math.floor(Math.random() * students.length)];
    void issueInteraction('CALL_STUDENT', participantUserId(chosen));
  };

  const createBreakouts = async () => {
    if (access.role !== 'FACULTY') return;
    if (students.length < 2) return Alert.alert('Breakout Rooms', 'At least two connected students are needed.');
    const groups: string[][] = [[], []];
    students.forEach((p: any, index: number) => groups[index % 2].push(participantUserId(p)));
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('buklod-classroom-stream-access', {
        body: {
          action: 'create_breakouts',
          session_id: sessionId,
          rooms: groups.map((user_ids, index) => ({ name: `Breakout ${index + 1}`, user_ids, timer_minutes: 15 })),
        },
      });
      if (error) throw error;
      await onRefreshBreakouts();
      await broadcast({ kind: 'BREAKOUT_REFRESH' });
    } catch (error) {
      Alert.alert('Breakout Rooms', error instanceof Error ? error.message : 'Could not create breakout rooms.');
    } finally {
      setSending(false);
    }
  };

  const closeBreakouts = async () => {
    if (access.role !== 'FACULTY') return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('buklod-classroom-stream-access', { body: { action: 'close_breakouts', session_id: sessionId } });
      if (error) throw error;
      await onRefreshBreakouts();
      await broadcast({ kind: 'BREAKOUT_REFRESH' });
    } catch (error) {
      Alert.alert('Breakout Rooms', error instanceof Error ? error.message : 'Could not close breakout rooms.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.roomRoot}>
      <BuklodAcceptedCallContent />

      {access.role === 'FACULTY' && (
        <View style={styles.teacherDock}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.teacherDockRow}>
            <Pressable style={styles.controlChip} onPress={randomStudent} disabled={sending}>
              <MaterialCommunityIcons name="dice-5-outline" size={17} color="#fff" /><Text style={styles.controlText}>Random</Text>
            </Pressable>
            <Pressable style={styles.controlChip} onPress={() => void issueInteraction('MUTE_ALL')} disabled={sending}>
              <MaterialCommunityIcons name="microphone-off" size={17} color="#fff" /><Text style={styles.controlText}>Mute All</Text>
            </Pressable>
            <Pressable style={styles.controlChip} onPress={() => void issueInteraction('RETURN_TO_LISTENING')} disabled={sending}>
              <MaterialCommunityIcons name="account-arrow-down-outline" size={17} color="#fff" /><Text style={styles.controlText}>Standby</Text>
            </Pressable>
            <Pressable style={styles.controlChip} onPress={createBreakouts} disabled={sending}>
              <MaterialCommunityIcons name="account-group-outline" size={17} color="#fff" /><Text style={styles.controlText}>Breakout</Text>
            </Pressable>
            {!!breakouts.length && <Pressable style={styles.controlChipDanger} onPress={closeBreakouts} disabled={sending}><Text style={styles.controlText}>Return All</Text></Pressable>}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.studentRail}>
            {students.map((participant: any) => {
              const id = participantUserId(participant);
              const active = authority.activeUserIds.includes(id);
              return (
                <Pressable key={id} onPress={() => void issueInteraction('CALL_STUDENT', id)} style={[styles.studentChip, active && styles.studentChipActive]}>
                  <Text numberOfLines={1} style={styles.studentChipText}>{participantName(participant)}</Text>
                  {!!participant?.isSpeaking && <MaterialCommunityIcons name="waveform" size={14} color="#fff" />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {access.role === 'STUDENT' && authority.activeUserIds.includes(access.user_id) && !authority.muteAll && (
        <View pointerEvents="none" style={styles.calledCue}>
          <Text style={styles.calledCueTitle}>YOU'RE BEING CALLED</Text>
          <Text style={styles.calledCueText}>Your classroom mic/camera are active for this interaction. You can still mute or turn camera off immediately.</Text>
        </View>
      )}

      {!!breakouts.length && (
        <View style={styles.breakoutTray}>
          {currentBreakoutId ? (
            <Pressable style={styles.breakoutButton} onPress={() => void onReturnMain()}><Text style={styles.breakoutButtonText}>Return to Main Room</Text></Pressable>
          ) : (
            breakouts.map(room => <Pressable key={room.id} style={styles.breakoutButton} onPress={() => void onOpenBreakout(room.id)}><Text style={styles.breakoutButtonText}>{room.name}</Text></Pressable>)
          )}
        </View>
      )}
    </View>
  );
}

export default function ClassroomLiveView({ classroomId, sessionId, classroomName, onExit }: Props) {
  const [prejoin, setPrejoin] = useState(true);
  const [cameraPreview, setCameraPreview] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [micPermission, setMicPermission] = useState<boolean | null>(null);
  const [access, setAccess] = useState<AccessPayload | null>(null);
  const [client, setClient] = useState<any>(null);
  const [call, setCall] = useState<any>(null);
  const [errorText, setErrorText] = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);
  const [ending, setEnding] = useState(false);
  const [authority, setAuthority] = useState<ClassroomLiveAuthorityState>(() => createClassroomLiveAuthorityState(sessionId));
  const [breakouts, setBreakouts] = useState<BreakoutRoom[]>([]);
  const [currentBreakoutId, setCurrentBreakoutId] = useState<string | null>(null);
  const mainCallId = useRef<string | null>(null);
  const participantId = useRef<string | null>(null);
  const left = useRef(false);
  const channelRef = useRef<any>(null);

  const checkHardware = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setCameraPermission(true);
      setMicPermission(true);
      return;
    }
    const currentCamera = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
    const currentMic = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    setCameraPermission(currentCamera);
    setMicPermission(currentMic);
  }, []);

  useEffect(() => { void checkHardware(); }, [checkHardware]);

  const requestHardware = async () => {
    if (Platform.OS !== 'android') return;
    const result = await PermissionsAndroid.requestMultiple([PermissionsAndroid.PERMISSIONS.CAMERA, PermissionsAndroid.PERMISSIONS.RECORD_AUDIO]);
    setCameraPermission(result[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED);
    setMicPermission(result[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED);
  };

  const refreshBreakouts = useCallback(async () => {
    if (!access) return;
    const { data, error } = await supabase.functions.invoke('buklod-classroom-stream-access', { body: { action: 'state', session_id: sessionId } });
    if (error) return;
    if (data?.state) {
      const next = stateFromServer(sessionId, data.state);
      setAuthority(current => next.version > current.version ? next : current);
    }
    const raw = Array.isArray(data?.breakout_rooms) ? data.breakout_rooms : [];
    const rooms: BreakoutRoom[] = raw.map((item: any) => item?.buklod_education_classroom_breakout_rooms || item).filter((item: any) => item?.id);
    setBreakouts(rooms);
  }, [access, sessionId]);

  const broadcast = useCallback(async (payload: ClassroomInteractionEvent | { kind: 'BREAKOUT_REFRESH' }) => {
    await channelRef.current?.send?.({ type: 'broadcast', event: 'classroom-control', payload });
  }, []);

  useEffect(() => {
    if (prejoin) return;
    let active = true;
    let localCall: any = null;
    const join = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('buklod-classroom-stream-access', { body: { action: 'access', session_id: sessionId } });
        if (error) throw error;
        if (!data?.token || !data?.api_key || !data?.call_id) throw new Error(data?.error || 'Live-class access was not issued.');
        const next = data as AccessPayload;
        if (!active) return;
        participantId.current = next.participant_id;
        mainCallId.current = next.call_id;
        setAccess(next);
        setAuthority(stateFromServer(sessionId, next.state));
        setRemaining(next.remaining_seconds);
        const nextClient: any = StreamVideoClient.getOrCreateInstance({ apiKey: next.api_key, user: { id: next.user_id, name: next.user_name }, token: next.token });
        localCall = nextClient.call(next.call_type || 'default', next.call_id);
        await localCall.join({ create: next.role === 'FACULTY' });
        if (next.role === 'STUDENT') {
          await localCall.microphone.disable().catch(() => undefined);
          await localCall.camera.disable().catch(() => undefined);
        }
        if (!active) { await localCall.leave().catch(() => undefined); return; }
        setClient(nextClient);
        setCall(localCall);
      } catch (error) {
        if (active) setErrorText(error instanceof Error ? error.message : 'Could not join the live classroom.');
      }
    };
    void join();
    return () => { active = false; if (localCall) void localCall.leave().catch(() => undefined); };
  }, [prejoin, sessionId]);

  useEffect(() => {
    if (!access) return;
    const channel = supabase.channel(`classroom-control-${sessionId}`, { config: { broadcast: { self: true, ack: true } } })
      .on('broadcast', { event: 'classroom-control' }, ({ payload }: any) => {
        if (payload?.kind === 'BREAKOUT_REFRESH') { void refreshBreakouts(); return; }
        const event = payload as ClassroomInteractionEvent;
        setAuthority(current => applyClassroomInteractionEvent(current, event));
      })
      .subscribe();
    channelRef.current = channel;
    const poll = setInterval(() => { void refreshBreakouts(); }, 8000);
    void refreshBreakouts();
    return () => { clearInterval(poll); channelRef.current = null; void supabase.removeChannel(channel); };
  }, [access, refreshBreakouts, sessionId]);

  useEffect(() => {
    const markLeave = async () => {
      if (left.current || !participantId.current) return;
      left.current = true;
      await supabase.functions.invoke('buklod-classroom-stream-access', { body: { action: 'leave', participant_id: participantId.current } }).catch(() => undefined);
    };
    return () => { void markLeave(); };
  }, []);

  useEffect(() => {
    if (access?.hard_stop_at == null) return;
    const stopAt = new Date(access.hard_stop_at).getTime();
    const tick = () => {
      const next = Math.max(0, Math.floor((stopAt - Date.now()) / 1000));
      setRemaining(next);
      if (next <= 0) {
        void call?.leave?.().catch(() => undefined);
        Alert.alert('Live Class Ended', 'The FREE live-class time allowance has been reached.');
        onExit();
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [access?.hard_stop_at, call, onExit]);

  useEffect(() => {
    if (!access) return;
    const channel = supabase.channel(`classroom-live-state-${sessionId}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'buklod_education_classroom_live_sessions', filter: `id=eq.${sessionId}` }, payload => {
      const status = String((payload.new as any)?.status ?? '');
      if (status && status !== 'LIVE') { void call?.leave?.().catch(() => undefined); onExit(); }
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [access, sessionId, call, onExit]);

  const exitRoom = async () => {
    try { await call?.leave?.(); } catch { /* already disconnected */ }
    if (!left.current && participantId.current) {
      left.current = true;
      await supabase.functions.invoke('buklod-classroom-stream-access', { body: { action: 'leave', participant_id: participantId.current } }).catch(() => undefined);
    }
    onExit();
  };

  const swapCall = useCallback(async (roomId: string | null) => {
    if (!client || !access) return;
    try {
      let callId = mainCallId.current;
      if (roomId) {
        const { data, error } = await supabase.functions.invoke('buklod-classroom-stream-access', { body: { action: 'breakout_access', session_id: sessionId, room_id: roomId } });
        if (error || !data?.call_id) throw error ?? new Error(data?.error || 'Breakout access was not issued.');
        callId = data.call_id;
      }
      if (!callId) throw new Error('Main classroom call is unavailable.');
      await call?.leave?.().catch(() => undefined);
      const nextCall = client.call(access.call_type || 'default', callId);
      await nextCall.join({ create: access.role === 'FACULTY' });
      if (access.role === 'STUDENT') { await nextCall.microphone.disable().catch(() => undefined); await nextCall.camera.disable().catch(() => undefined); }
      setCall(nextCall);
      setCurrentBreakoutId(roomId);
    } catch (error) {
      Alert.alert('Live Room', error instanceof Error ? error.message : 'Could not switch rooms.');
    }
  }, [access, call, client, sessionId]);

  const endClass = async () => {
    if (access?.role !== 'FACULTY' || ending) return;
    setEnding(true);
    try {
      const { data: interaction } = await supabase.functions.invoke('buklod-classroom-stream-access', { body: { action: 'interaction', session_id: sessionId, interaction_type: 'CLASS_ENDED' } });
      if (interaction?.event) await broadcast(interaction.event);
      const { error } = await supabase.rpc('buklod_classroom_end_live_v1', { p_session_id: sessionId });
      if (error) throw error;
      await call?.endCall?.().catch(() => undefined);
      await exitRoom();
    } catch (error) {
      Alert.alert('End Live Class', error instanceof Error ? error.message : 'Could not end the live class.');
    } finally { setEnding(false); }
  };

  if (prejoin) {
    return (
      <View style={styles.prejoin}>
        <Text style={styles.prejoinEyebrow}>PRE-JOIN HARDWARE CHECK</Text>
        <Text style={styles.prejoinTitle}>{classroomName}</Text>
        <View style={styles.previewBox}>
          {cameraPermission && cameraPreview ? <CameraView style={StyleSheet.absoluteFill} facing="front" /> : <MaterialCommunityIcons name="camera-off-outline" size={48} color="#7d8b82" />}
        </View>
        <View style={styles.permissionRow}>
          <Text style={styles.permissionText}>Camera: {cameraPermission == null ? 'checking' : cameraPermission ? 'ready' : 'permission needed'}</Text>
          <Text style={styles.permissionText}>Mic: {micPermission == null ? 'checking' : micPermission ? 'ready' : 'permission needed'}</Text>
        </View>
        {(!cameraPermission || !micPermission) && <Pressable style={styles.permissionButton} onPress={requestHardware}><Text style={styles.permissionButtonText}>Allow Camera & Microphone</Text></Pressable>}
        <Pressable disabled={!cameraPermission} style={[styles.previewToggle, !cameraPermission && styles.disabled]} onPress={() => setCameraPreview(value => !value)}>
          <MaterialCommunityIcons name={cameraPreview ? 'camera-off-outline' : 'camera-outline'} size={19} color="#1f7a3f" />
          <Text style={styles.previewToggleText}>{cameraPreview ? 'Turn preview off' : 'Test camera preview'}</Text>
        </Pressable>
        <Text style={styles.prejoinNote}>Students join in low-data listening mode: camera OFF and microphone OFF. During a legitimate recitation, Classroom may activate them temporarily; manual mute/camera-off remains available.</Text>
        <Pressable style={styles.joinButton} onPress={() => setPrejoin(false)}><Text style={styles.joinButtonText}>Join Live Classroom</Text></Pressable>
        <Pressable style={styles.cancelJoin} onPress={onExit}><Text style={styles.cancelJoinText}>Back</Text></Pressable>
      </View>
    );
  }

  if (errorText) return <View style={styles.center}><MaterialCommunityIcons name="video-off-outline" size={42} color="#b94b45" /><Text style={styles.errorTitle}>Could not open live class</Text><Text style={styles.errorText}>{errorText}</Text><Pressable style={styles.exitButton} onPress={onExit}><Text style={styles.exitText}>Back to Classroom</Text></Pressable></View>;
  if (!access || !client || !call) return <View style={styles.center}><ActivityIndicator size="large" color="#1f7a3f" /><Text style={styles.loading}>Joining {classroomName}…</Text></View>;

  return (
    <View style={styles.screen}>
      <StreamVideo client={client}>
        <StreamCall call={call}>
          <ClassroomLiveAutomationLayer
            role={access.role}
            userId={access.user_id}
            sessionId={sessionId}
            authority={authority}
            onAuthority={setAuthority}
            broadcast={async event => broadcast(event)}
          />
          <ClassroomRoom access={access} sessionId={sessionId} authority={authority} onAuthority={setAuthority} broadcast={broadcast} breakouts={breakouts} currentBreakoutId={currentBreakoutId} onOpenBreakout={roomId => swapCall(roomId)} onReturnMain={() => swapCall(null)} onRefreshBreakouts={refreshBreakouts} />
        </StreamCall>
      </StreamVideo>
      <View style={styles.topBar} pointerEvents="box-none">
        <View style={styles.infoPill}><View style={styles.liveDot} /><Text numberOfLines={1} style={styles.roomName}>{currentBreakoutId ? 'BREAKOUT' : classroomName}</Text><Text style={styles.timer}>{formatSeconds(remaining)}</Text></View>
        {access.role === 'FACULTY' && <Pressable disabled={ending} style={styles.endButton} onPress={endClass}><Text style={styles.endText}>{ending ? 'Ending…' : 'End Class'}</Text></Pressable>}
      </View>
      <Pressable style={styles.leaveButton} onPress={exitRoom}><MaterialCommunityIcons name="arrow-left" size={20} color="#fff" /><Text style={styles.leaveText}>Classroom</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#080c09' }, roomRoot: { flex: 1 },
  center: { flex: 1, backgroundColor: '#f2f6f1', alignItems: 'center', justifyContent: 'center', padding: 28 }, loading: { color: '#425249', fontWeight: '800', marginTop: 13 },
  errorTitle: { color: '#3b332f', fontWeight: '900', fontSize: 18, marginTop: 12 }, errorText: { color: '#766d68', textAlign: 'center', lineHeight: 19, marginTop: 6 }, exitButton: { backgroundColor: '#1f7a3f', borderRadius: 11, paddingHorizontal: 16, paddingVertical: 11, marginTop: 16 }, exitText: { color: '#fff', fontWeight: '900' },
  prejoin: { flex: 1, backgroundColor: '#f2f6f1', padding: 22, paddingTop: 58 }, prejoinEyebrow: { color: '#1f7a3f', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, prejoinTitle: { color: '#17311f', fontSize: 27, fontWeight: '900', marginTop: 4, marginBottom: 16 }, previewBox: { height: 260, borderRadius: 20, overflow: 'hidden', backgroundColor: '#dfe7e1', alignItems: 'center', justifyContent: 'center' }, permissionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 11 }, permissionText: { color: '#526159', fontSize: 11, fontWeight: '800' }, permissionButton: { backgroundColor: '#e3eee5', borderRadius: 11, padding: 12, marginTop: 10, alignItems: 'center' }, permissionButtonText: { color: '#1f7a3f', fontWeight: '900' }, previewToggle: { flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', padding: 12, marginTop: 6 }, previewToggleText: { color: '#1f7a3f', fontWeight: '900' }, prejoinNote: { color: '#68756d', fontSize: 11, lineHeight: 17, marginTop: 8 }, joinButton: { backgroundColor: '#1f7a3f', borderRadius: 13, padding: 14, alignItems: 'center', marginTop: 16 }, joinButtonText: { color: '#fff', fontWeight: '900' }, cancelJoin: { alignItems: 'center', padding: 12 }, cancelJoinText: { color: '#68756d', fontWeight: '800' }, disabled: { opacity: 0.45 },
  topBar: { position: 'absolute', top: 42, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }, infoPill: { flex: 1, minHeight: 40, borderRadius: 20, paddingHorizontal: 12, backgroundColor: 'rgba(15,25,18,0.82)', flexDirection: 'row', alignItems: 'center', gap: 7 }, liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e34444' }, roomName: { color: '#fff', fontWeight: '900', flex: 1 }, timer: { color: '#dce9df', fontSize: 11, fontWeight: '900' }, endButton: { backgroundColor: '#b62828', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 10 }, endText: { color: '#fff', fontWeight: '900', fontSize: 11 }, leaveButton: { position: 'absolute', left: 12, bottom: 28, borderRadius: 20, backgroundColor: 'rgba(15,25,18,0.86)', paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 5 }, leaveText: { color: '#fff', fontWeight: '900', fontSize: 11 },
  teacherDock: { position: 'absolute', left: 10, right: 10, bottom: 92, backgroundColor: 'rgba(6,12,8,0.86)', borderRadius: 16, paddingVertical: 8 }, teacherDockRow: { paddingHorizontal: 8, gap: 7 }, controlChip: { minHeight: 34, borderRadius: 17, paddingHorizontal: 11, backgroundColor: '#245c38', flexDirection: 'row', alignItems: 'center', gap: 5 }, controlChipDanger: { minHeight: 34, borderRadius: 17, paddingHorizontal: 11, backgroundColor: '#9d3030', flexDirection: 'row', alignItems: 'center' }, controlText: { color: '#fff', fontSize: 10, fontWeight: '900' }, studentRail: { paddingHorizontal: 8, paddingTop: 7, gap: 6 }, studentChip: { maxWidth: 140, minHeight: 30, borderRadius: 15, paddingHorizontal: 10, backgroundColor: 'rgba(255,255,255,0.13)', flexDirection: 'row', alignItems: 'center', gap: 4 }, studentChipActive: { backgroundColor: '#1f7a3f' }, studentChipText: { color: '#fff', fontSize: 10, fontWeight: '800', maxWidth: 105 },
  calledCue: { position: 'absolute', top: 96, alignSelf: 'center', maxWidth: '86%', backgroundColor: 'rgba(31,122,63,0.95)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 11 }, calledCueTitle: { color: '#fff', fontWeight: '900', textAlign: 'center' }, calledCueText: { color: 'rgba(255,255,255,0.88)', fontSize: 10, lineHeight: 14, textAlign: 'center', marginTop: 3 }, breakoutTray: { position: 'absolute', right: 10, top: 94, gap: 6 }, breakoutButton: { backgroundColor: 'rgba(35,69,47,0.94)', borderRadius: 14, paddingHorizontal: 11, paddingVertical: 8 }, breakoutButtonText: { color: '#fff', fontSize: 10, fontWeight: '900' },
});
