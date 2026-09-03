import React, {
  createElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  CallingState,
  type Call,
  type StreamVideoParticipant,
} from '@stream-io/video-client';

import { useCall } from '@/lib/streamVideoSdk';

/* BUKLOD_WEB_CALLING_R1
 * Real browser WebRTC call surface using Stream's low-level JS client.
 */

type Props = {
  mode?: 'audio' | 'video';
};

function useCallValue<T>(
  call: Call | undefined,
  current: () => T,
  observable: () => any,
  fallback: T,
) {
  const [value, setValue] = useState<T>(
    () => call ? current() : fallback
  );

  useEffect(() => {
    if (!call) {
      setValue(fallback);
      return;
    }

    setValue(current());
    const subscription = observable().subscribe(
      (next: T) => setValue(next)
    );

    return () => subscription.unsubscribe();
  }, [call]);

  return value;
}

function WebParticipantMedia({
  call,
  participant,
  showVideo,
}: {
  call: Call;
  participant: StreamVideoParticipant;
  showVideo: boolean;
}) {
  const videoRef = useRef<any>(null);
  const audioRef = useRef<any>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element || !showVideo) {
      return;
    }

    element.autoplay = true;
    element.playsInline = true;
    element.muted = Boolean(participant.isLocalParticipant);

    const untrack = call.trackElementVisibility(
      element,
      participant.sessionId,
      'videoTrack'
    );
    const unbind = call.bindVideoElement(
      element,
      participant.sessionId,
      'videoTrack'
    );

    return () => {
      try { unbind?.(); } catch {}
      try { untrack?.(); } catch {}
    };
  }, [call, participant.sessionId, participant.isLocalParticipant, showVideo]);

  useEffect(() => {
    if (participant.isLocalParticipant) {
      return;
    }

    const element = audioRef.current;
    if (!element) {
      return;
    }

    element.autoplay = true;
    const unbind = call.bindAudioElement(
      element,
      participant.sessionId,
      'audioTrack'
    );

    return () => {
      try { unbind?.(); } catch {}
    };
  }, [call, participant.sessionId, participant.isLocalParticipant]);

  return (
    <View style={styles.participantTile}>
      {showVideo ? (
        createElement('video', {
          ref: videoRef,
          autoPlay: true,
          playsInline: true,
          muted: Boolean(participant.isLocalParticipant),
          style: {
            width: '100%',
            height: '100%',
            minHeight: 210,
            objectFit: 'cover',
            backgroundColor: '#0B1713',
          },
        })
      ) : (
        <View style={styles.audioAvatar}>
          <MaterialCommunityIcons
            name="account-voice"
            size={42}
            color="#DDF6EA"
          />
        </View>
      )}

      {!participant.isLocalParticipant ?
        createElement('audio', {
          ref: audioRef,
          autoPlay: true,
        }) : null}

      <View style={styles.participantLabel}>
        <Text numberOfLines={1} style={styles.participantName}>
          {participant.name || participant.userId || 'BUKLOD member'}
          {participant.isLocalParticipant ? ' (You)' : ''}
        </Text>
      </View>
    </View>
  );
}

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function BuklodAcceptedCallContent({
  mode: modeProp,
}: Props) {
  const call = useCall();
  const participants = useCallValue<StreamVideoParticipant[]>(
    call,
    () => call?.state.participants ?? [],
    () => call!.state.participants$,
    [],
  );
  const callingState = useCallValue<any>(
    call,
    () => call?.state.callingState ?? CallingState.IDLE,
    () => call!.state.callingState$,
    CallingState.IDLE,
  );
  const startedAt = useCallValue<any>(
    call,
    () => call?.state.startedAt ?? null,
    () => call!.state.startedAt$,
    null,
  );
  const micStatus = useCallValue<string | undefined>(
    call,
    () => call?.microphone.state.status,
    () => call!.microphone.state.status$,
    undefined,
  );
  const cameraStatus = useCallValue<string | undefined>(
    call,
    () => call?.camera.state.status,
    () => call!.camera.state.status$,
    undefined,
  );
  const screenStatus = useCallValue<string | undefined>(
    call,
    () => call?.screenShare.state.status,
    () => call!.screenShare.state.status$,
    undefined,
  );

  const mode = useMemo<'audio' | 'video'>(() => {
    if (modeProp) {
      return modeProp;
    }

    return String(
      call?.state.custom?.buklod_call_mode ?? 'audio'
    ).toLowerCase() === 'video'
      ? 'video'
      : 'audio';
  }, [call, modeProp, call?.state.custom]);

  const [elapsed, setElapsed] = useState('00:00');
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    const base = startedAt
      ? new Date(startedAt as any).getTime()
      : Date.now();

    const tick = () => {
      setElapsed(
        formatDuration((Date.now() - base) / 1000)
      );
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  if (!call) {
    return null;
  }

  const run = async (
    key: string,
    action: () => Promise<any>
  ) => {
    if (busyAction) {
      return;
    }

    setBusyAction(key);
    setActionError(null);

    try {
      await action();
    } catch (error: any) {
      const message = String(
        error?.message ?? 'Call action failed.'
      );
      setActionError(message);
    } finally {
      setBusyAction(null);
    }
  };

  const reconnecting =
    callingState === CallingState.RECONNECTING ||
    String(callingState).toLowerCase().includes('reconnect');

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>
            {mode === 'video' ? 'BUKLOD Video Call' : 'BUKLOD Audio Call'}
          </Text>
          <Text style={styles.subtitle}>
            {reconnecting
              ? 'Reconnecting...'
              : `${elapsed}  •  ${participants.length} participant${participants.length === 1 ? '' : 's'}`}
          </Text>
        </View>

        <View style={styles.secureBadge}>
          <MaterialCommunityIcons name="shield-check" size={15} color="#8DE0B7" />
          <Text style={styles.secureText}>Live</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.grid}
        style={styles.mediaArea}
      >
        {participants.length > 0 ? participants.map(participant => (
          <WebParticipantMedia
            key={participant.sessionId}
            call={call}
            participant={participant}
            showVideo={mode === 'video'}
          />
        )) : (
          <View style={styles.waitingBox}>
            <ActivityIndicator color="#8DE0B7" />
            <Text style={styles.waitingText}>Connecting participants...</Text>
          </View>
        )}
      </ScrollView>

      {actionError ? (
        <Text style={styles.errorText}>{actionError}</Text>
      ) : null}

      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Toggle microphone"
          disabled={Boolean(busyAction)}
          onPress={() => void run('mic', () => call.microphone.toggle())}
          style={[styles.control, micStatus === 'disabled' && styles.controlOff]}
        >
          <MaterialCommunityIcons
            name={micStatus === 'disabled' ? 'microphone-off' : 'microphone'}
            size={22}
            color="#FFFFFF"
          />
          <Text style={styles.controlText}>Mic</Text>
        </Pressable>

        {mode === 'video' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Toggle camera"
            disabled={Boolean(busyAction)}
            onPress={() => void run('camera', () => call.camera.toggle())}
            style={[styles.control, cameraStatus === 'disabled' && styles.controlOff]}
          >
            <MaterialCommunityIcons
              name={cameraStatus === 'disabled' ? 'video-off' : 'video'}
              size={22}
              color="#FFFFFF"
            />
            <Text style={styles.controlText}>Camera</Text>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Toggle screen sharing"
          disabled={Boolean(busyAction)}
          onPress={() => void run('share', () => call.screenShare.toggle())}
          style={[styles.control, screenStatus === 'enabled' && styles.controlOn]}
        >
          <MaterialCommunityIcons name="monitor-share" size={22} color="#FFFFFF" />
          <Text style={styles.controlText}>Share</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Leave call"
          disabled={Boolean(busyAction)}
          onPress={() => void run('leave', () => call.leave())}
          style={[styles.control, styles.endControl]}
        >
          <MaterialCommunityIcons name="phone-hangup" size={22} color="#FFFFFF" />
          <Text style={styles.controlText}>End</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 420,
    backgroundColor: '#07110E',
  },
  topBar: {
    minHeight: 66,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.10)',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 3,
    color: '#AEC0B7',
    fontSize: 11,
    fontWeight: '700',
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(54,164,108,0.18)',
  },
  secureText: {
    color: '#BDEFD6',
    fontSize: 10,
    fontWeight: '800',
  },
  mediaArea: {
    flex: 1,
  },
  grid: {
    flexGrow: 1,
    padding: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  participantTile: {
    position: 'relative',
    width: '48%',
    minWidth: 260,
    maxWidth: 720,
    minHeight: 210,
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: '#10231C',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  audioAvatar: {
    minHeight: 210,
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantLabel: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  participantName: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  waitingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 250,
  },
  waitingText: {
    color: '#D1DED8',
    fontSize: 12,
    fontWeight: '700',
  },
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
  },
  control: {
    minWidth: 72,
    minHeight: 54,
    borderRadius: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: '#263A32',
  },
  controlOff: {
    backgroundColor: '#7A3434',
  },
  controlOn: {
    backgroundColor: '#286C4B',
  },
  endControl: {
    backgroundColor: '#B42F2F',
  },
  controlText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  errorText: {
    paddingHorizontal: 16,
    paddingTop: 8,
    textAlign: 'center',
    color: '#FFB2B2',
    fontSize: 11,
    fontWeight: '700',
  },
});
