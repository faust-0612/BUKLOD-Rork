import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  CallContent,
  StreamCall,
  StreamVideo,
  StreamVideoClient,
} from '@stream-io/video-react-native-sdk';

import { supabase } from '@/lib/supabase';

type Props = {
  classroomId: string;
  sessionId: string;
  classroomName: string;
  onExit: () => void;
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
};

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

export default function ClassroomLiveView({ classroomId, sessionId, classroomName, onExit }: Props) {
  const [access, setAccess] = useState<AccessPayload | null>(null);
  const [client, setClient] = useState<any>(null);
  const [call, setCall] = useState<any>(null);
  const [errorText, setErrorText] = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);
  const [ending, setEnding] = useState(false);
  const participantId = useRef<string | null>(null);
  const left = useRef(false);

  useEffect(() => {
    let active = true;
    let localCall: any = null;

    const join = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('buklod-classroom-stream-access', {
          body: { action: 'access', session_id: sessionId },
        });
        if (error) throw error;
        if (!data?.token || !data?.api_key || !data?.call_id) {
          throw new Error(data?.error || 'Live-class access was not issued.');
        }
        const next = data as AccessPayload;
        if (!active) return;
        participantId.current = next.participant_id;
        setAccess(next);
        setRemaining(next.remaining_seconds);

        const nextClient: any = StreamVideoClient.getOrCreateInstance({
          apiKey: next.api_key,
          user: { id: next.user_id, name: next.user_name },
          token: next.token,
        });
        localCall = nextClient.call(next.call_type || 'default', next.call_id);
        await localCall.join({ create: next.role === 'FACULTY' });
        if (!active) {
          await localCall.leave().catch(() => undefined);
          return;
        }
        setClient(nextClient);
        setCall(localCall);
      } catch (error) {
        if (!active) return;
        setErrorText(error instanceof Error ? error.message : 'Could not join the live classroom.');
      }
    };

    void join();

    return () => {
      active = false;
      if (localCall) void localCall.leave().catch(() => undefined);
    };
  }, [sessionId]);

  useEffect(() => {
    const markLeave = async () => {
      if (left.current || !participantId.current) return;
      left.current = true;
      await supabase.functions.invoke('buklod-classroom-stream-access', {
        body: { action: 'leave', participant_id: participantId.current },
      }).catch(() => undefined);
    };
    return () => {
      void markLeave();
    };
  }, []);

  useEffect(() => {
    if (access?.hard_stop_at == null) return;
    const stopAt = new Date(access.hard_stop_at).getTime();
    const tick = () => {
      const next = Math.max(0, Math.floor((stopAt - Date.now()) / 1000));
      setRemaining(next);
      if (next <= 0) {
        void call?.leave?.().catch(() => undefined);
        Alert.alert('Live Class Ended', 'The 2-hour FREE live-class limit has been reached.');
        onExit();
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [access?.hard_stop_at, call, onExit]);

  useEffect(() => {
    const channel = supabase
      .channel(`classroom-live-state-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'buklod_education_classroom_live_sessions', filter: `id=eq.${sessionId}` },
        payload => {
          const status = String((payload.new as any)?.status ?? '');
          if (status && status !== 'LIVE') {
            void call?.leave?.().catch(() => undefined);
            onExit();
          }
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId, call, onExit]);

  const exitRoom = async () => {
    try {
      await call?.leave?.();
    } catch {
      // The route can still safely close even if Stream already disconnected.
    }
    if (!left.current && participantId.current) {
      left.current = true;
      await supabase.functions.invoke('buklod-classroom-stream-access', {
        body: { action: 'leave', participant_id: participantId.current },
      }).catch(() => undefined);
    }
    onExit();
  };

  const endClass = async () => {
    if (access?.role !== 'FACULTY' || ending) return;
    setEnding(true);
    try {
      const { error } = await supabase.rpc('buklod_classroom_end_live_v1', { p_session_id: sessionId });
      if (error) throw error;
      await call?.endCall?.().catch(() => undefined);
      await exitRoom();
    } catch (error) {
      Alert.alert('End Live Class', error instanceof Error ? error.message : 'Could not end the live class.');
    } finally {
      setEnding(false);
    }
  };

  if (errorText) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="video-off-outline" size={42} color="#b94b45" />
        <Text style={styles.errorTitle}>Could not open live class</Text>
        <Text style={styles.errorText}>{errorText}</Text>
        <Pressable style={styles.exitButton} onPress={onExit}><Text style={styles.exitText}>Back to Classroom</Text></Pressable>
      </View>
    );
  }

  if (!access || !client || !call) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1f7a3f" />
        <Text style={styles.loading}>Joining {classroomName}…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StreamVideo client={client}>
        <StreamCall call={call}>
          <CallContent />
        </StreamCall>
      </StreamVideo>

      <View style={styles.topBar} pointerEvents="box-none">
        <View style={styles.infoPill}>
          <View style={styles.liveDot} />
          <Text numberOfLines={1} style={styles.roomName}>{classroomName}</Text>
          <Text style={styles.timer}>{formatSeconds(remaining)}</Text>
        </View>
        {access.role === 'FACULTY' && (
          <Pressable disabled={ending} style={styles.endButton} onPress={endClass}>
            <Text style={styles.endText}>{ending ? 'Ending…' : 'End Class'}</Text>
          </Pressable>
        )}
      </View>

      <Pressable style={styles.leaveButton} onPress={exitRoom}>
        <MaterialCommunityIcons name="arrow-left" size={20} color="#fff" />
        <Text style={styles.leaveText}>Classroom</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#080c09' },
  center: { flex: 1, backgroundColor: '#f2f6f1', alignItems: 'center', justifyContent: 'center', padding: 28 },
  loading: { color: '#425249', fontWeight: '800', marginTop: 13 },
  errorTitle: { color: '#3b332f', fontWeight: '900', fontSize: 18, marginTop: 12 },
  errorText: { color: '#766d68', textAlign: 'center', lineHeight: 19, marginTop: 6 },
  exitButton: { backgroundColor: '#1f7a3f', borderRadius: 11, paddingHorizontal: 16, paddingVertical: 11, marginTop: 16 },
  exitText: { color: '#fff', fontWeight: '900' },
  topBar: { position: 'absolute', top: 42, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoPill: { flex: 1, minHeight: 40, borderRadius: 20, paddingHorizontal: 12, backgroundColor: 'rgba(15,25,18,0.82)', flexDirection: 'row', alignItems: 'center', gap: 7 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e34444' },
  roomName: { color: '#fff', fontWeight: '900', flex: 1 },
  timer: { color: '#dce9df', fontSize: 11, fontWeight: '900' },
  endButton: { backgroundColor: '#b62828', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 10 },
  endText: { color: '#fff', fontWeight: '900', fontSize: 11 },
  leaveButton: { position: 'absolute', left: 12, bottom: 28, borderRadius: 20, backgroundColor: 'rgba(15,25,18,0.86)', paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  leaveText: { color: '#fff', fontWeight: '900', fontSize: 11 },
});
