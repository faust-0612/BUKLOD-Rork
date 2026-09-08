import { useEffect, useMemo, useRef } from 'react';
import * as Network from 'expo-network';
import {
  NoiseCancellationProvider,
  useCall,
  useCallStateHooks,
  useNoiseCancellation,
} from '@stream-io/video-react-native-sdk';

import {
  applyClassroomInteractionEvent,
  ClassroomInteractionEvent,
  ClassroomLiveAuthorityState,
} from '@/lib/education/classroomLiveState';
import { supabase } from '@/lib/supabase';

type Props = {
  role: 'FACULTY' | 'STUDENT';
  userId: string;
  sessionId: string;
  authority: ClassroomLiveAuthorityState;
  onAuthority: (state: ClassroomLiveAuthorityState) => void;
  broadcast: (event: ClassroomInteractionEvent) => Promise<void>;
};

function participantUserId(participant: any) {
  return String(participant?.userId || participant?.user?.id || participant?.user_id || '');
}

function qualityLabel(participant: any) {
  return String(participant?.connectionQuality || participant?.connection_quality || '').toLowerCase();
}

function ClassroomAutomationInner({ role, userId, sessionId, authority, onAuthority, broadcast }: Props) {
  const call = useCall();
  const { useParticipants } = useCallStateHooks();
  const participants = useParticipants();
  const { isSupported, deviceSupportsAdvancedAudioProcessing, isEnabled, setEnabled } = useNoiseCancellation();
  const noResponseMarked = useRef<string | null>(null);
  const heardSpeech = useRef<string | null>(null);

  const mine = useMemo(
    () => participants.find((participant: any) => participantUserId(participant) === userId) as any,
    [participants, userId],
  );

  // Existing native package/config plugin is already present. Turn noise cancellation
  // on automatically only on capable devices so jeep/road noise is reduced without
  // adding another permanent button or burdening low-end devices.
  useEffect(() => {
    if (isSupported === true && deviceSupportsAdvancedAudioProcessing === true && !isEnabled) {
      void Promise.resolve(setEnabled(true)).catch(() => undefined);
    }
  }, [deviceSupportsAdvancedAudioProcessing, isEnabled, isSupported, setEnabled]);

  // Track actual local speech during a legitimate call/recitation. The main live
  // view already records SPEECH_ACTIVITY; this ref prevents a false no-response mark.
  useEffect(() => {
    if (
      role !== 'STUDENT' ||
      !authority.interactionId ||
      !authority.activeUserIds.includes(userId) ||
      !mine?.isSpeaking
    ) return;
    heardSpeech.current = authority.interactionId;
  }, [authority.activeUserIds, authority.interactionId, mine?.isSpeaking, role, userId]);

  // If a called student gives no detected speech after 12 seconds, collect both
  // Stream connection quality and OS network state, mark the event FOR REVIEW,
  // and turn local camera/mic back off. This never auto-deducts a grade.
  useEffect(() => {
    if (
      role !== 'STUDENT' ||
      !call ||
      !authority.interactionId ||
      authority.ended ||
      authority.muteAll ||
      !authority.activeUserIds.includes(userId)
    ) return;

    const interactionId = authority.interactionId;
    const timer = setTimeout(() => {
      if (heardSpeech.current === interactionId || noResponseMarked.current === interactionId) return;
      noResponseMarked.current = interactionId;

      void (async () => {
        let networkState: any = null;
        try {
          networkState = await Network.getNetworkStateAsync();
        } catch {
          networkState = null;
        }

        const quality = qualityLabel(mine);
        const connectionLooksPoor =
          quality.includes('poor') ||
          quality.includes('bad') ||
          networkState?.isConnected === false ||
          networkState?.isInternetReachable === false;

        await supabase.functions.invoke('buklod-classroom-stream-access', {
          body: {
            action: 'interaction_result',
            session_id: sessionId,
            interaction_id: interactionId,
            result: connectionLooksPoor ? 'NO_RESPONSE_NETWORK_REVIEW' : 'NO_RESPONSE_REVIEW',
            network_evidence: {
              stream_connection_quality: quality || null,
              network_type: networkState?.type ?? null,
              is_connected: networkState?.isConnected ?? null,
              is_internet_reachable: networkState?.isInternetReachable ?? null,
              observed_at: new Date().toISOString(),
              source: 'BUKLOD_CLASSROOM_NATIVE',
            },
          },
        }).catch(() => undefined);

        // Safety/data rule: if there was no response, media should not remain on.
        await call.microphone.disable().catch(() => undefined);
        await call.camera.disable().catch(() => undefined);
      })();
    }, 12_000);

    return () => clearTimeout(timer);
  }, [authority.activeUserIds, authority.ended, authority.interactionId, authority.muteAll, call, mine, role, sessionId, userId]);

  // Fail-safe convergence: a called/conversation state cannot stay stuck forever.
  // Faculty state automatically returns everyone to listening after 30 seconds;
  // any newer teacher command wins because the reducer rejects stale versions.
  useEffect(() => {
    if (
      role !== 'FACULTY' ||
      !authority.interactionId ||
      authority.ended ||
      !['ACTIVE_RECITATION', 'ACTIVE_CONVERSATION'].includes(authority.mode)
    ) return;

    const interactionId = authority.interactionId;
    const timer = setTimeout(() => {
      if (authority.interactionId !== interactionId) return;
      void (async () => {
        const { data, error } = await supabase.functions.invoke('buklod-classroom-stream-access', {
          body: {
            action: 'interaction',
            session_id: sessionId,
            interaction_type: 'RETURN_TO_LISTENING',
          },
        });
        if (error || !data?.event) return;
        const event = data.event as ClassroomInteractionEvent;
        onAuthority(applyClassroomInteractionEvent(authority, event));
        await broadcast(event).catch(() => undefined);
      })();
    }, 30_000);

    return () => clearTimeout(timer);
  }, [authority, broadcast, onAuthority, role, sessionId]);

  return null;
}

export default function ClassroomLiveAutomationLayer(props: Props) {
  return (
    <NoiseCancellationProvider>
      <ClassroomAutomationInner {...props} />
    </NoiseCancellationProvider>
  );
}
