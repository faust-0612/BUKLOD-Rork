import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

type LivePolicy = {
  responseWindowMs: number;
  degradedExtensionMs: number;
  evidenceWindowMs: number;
};

type NetworkSample = {
  observed_ms: number;
  observed_at: string;
  stream_connection_quality: string | null;
  network_type: string | null;
  is_connected: boolean | null;
  is_internet_reachable: boolean | null;
  poor: boolean;
};

const DEFAULT_POLICY: LivePolicy = {
  responseWindowMs: 12_000,
  degradedExtensionMs: 5_000,
  evidenceWindowMs: 10_000,
};

function participantUserId(participant: any) {
  return String(participant?.userId || participant?.user?.id || participant?.user_id || '');
}

function qualityLabel(participant: any) {
  return String(participant?.connectionQuality || participant?.connection_quality || '').toLowerCase();
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function normalizePolicy(value: any): LivePolicy {
  return {
    responseWindowMs: boundedNumber(value?.response_window_ms, DEFAULT_POLICY.responseWindowMs, 5_000, 30_000),
    degradedExtensionMs: boundedNumber(value?.degraded_extension_ms, DEFAULT_POLICY.degradedExtensionMs, 0, 15_000),
    evidenceWindowMs: boundedNumber(value?.evidence_window_ms, DEFAULT_POLICY.evidenceWindowMs, 5_000, 15_000),
  };
}

function summarizeEvidence(samples: NetworkSample[], startedAt: number, now: number, windowMs: number) {
  const from = Math.max(0, startedAt - windowMs);
  const relevant = samples.filter(sample => sample.observed_ms >= from && sample.observed_ms <= now).slice(-16);
  const poorSamples = relevant.filter(sample => sample.poor);
  const poorRatio = relevant.length ? poorSamples.length / relevant.length : 0;
  let transitions = 0;
  for (let index = 1; index < relevant.length; index += 1) {
    const previous = relevant[index - 1].is_connected;
    const current = relevant[index].is_connected;
    if (previous != null && current != null && previous !== current) transitions += 1;
  }
  const latest = relevant[relevant.length - 1] ?? null;
  const disconnectedNow = latest?.is_connected === false || latest?.is_internet_reachable === false;
  const sustainedPoor = disconnectedNow || (poorSamples.length >= 2 && poorRatio >= 0.5);
  return {
    relevant,
    poorSamples,
    poorRatio,
    transitions,
    latest,
    sustainedPoor,
    from,
  };
}

function ClassroomAutomationInner({ role, userId, sessionId, authority, onAuthority, broadcast }: Props) {
  const call = useCall();
  const { useParticipants } = useCallStateHooks();
  const participants = useParticipants();
  const { isSupported, deviceSupportsAdvancedAudioProcessing, isEnabled, setEnabled } = useNoiseCancellation();
  const noResponseMarked = useRef<string | null>(null);
  const heardSpeech = useRef<string | null>(null);
  const networkSamples = useRef<NetworkSample[]>([]);
  const interactionStart = useRef<{ id: string; startedAt: number } | null>(null);
  const authorityRef = useRef(authority);
  const mineRef = useRef<any>(null);
  const [livePolicy, setLivePolicy] = useState<LivePolicy>(DEFAULT_POLICY);

  authorityRef.current = authority;

  const mine = useMemo(
    () => participants.find((participant: any) => participantUserId(participant) === userId) as any,
    [participants, userId],
  );
  mineRef.current = mine;

  const captureNetworkSample = useCallback(async () => {
    let networkState: any = null;
    try {
      networkState = await Network.getNetworkStateAsync();
    } catch {
      networkState = null;
    }
    const quality = qualityLabel(mineRef.current);
    const poor =
      quality.includes('poor') ||
      quality.includes('bad') ||
      networkState?.isConnected === false ||
      networkState?.isInternetReachable === false;
    const now = Date.now();
    const sample: NetworkSample = {
      observed_ms: now,
      observed_at: new Date(now).toISOString(),
      stream_connection_quality: quality || null,
      network_type: networkState?.type == null ? null : String(networkState.type),
      is_connected: networkState?.isConnected ?? null,
      is_internet_reachable: networkState?.isInternetReachable ?? null,
      poor,
    };
    networkSamples.current = [...networkSamples.current.filter(item => item.observed_ms >= now - 30_000), sample];
    return sample;
  }, []);

  // The policy is server-authoritative but stored in the Classroom's existing
  // adaptive_config JSON. No new settings table or client-only punitive rule.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await supabase.rpc('buklod_classroom_live_policy_v1', { p_session_id: sessionId });
        if (!cancelled && !error) setLivePolicy(normalizePolicy(data));
      } catch {
        // Defaults are intentionally safe when the read-only policy lookup is unavailable.
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  // Keep only a short rolling local network window. This is intentionally not
  // persisted every few seconds: only meaningful interaction evidence is written.
  useEffect(() => {
    if (role !== 'STUDENT') return;
    let cancelled = false;
    const sample = async () => {
      if (cancelled) return;
      await captureNetworkSample();
    };
    void sample();
    const timer = setInterval(() => { void sample(); }, 2_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [captureNetworkSample, role]);

  // Existing native package/config plugin is already present. Turn noise cancellation
  // on automatically only on capable devices so jeep/road noise is reduced without
  // adding another permanent button or burdening low-end devices.
  useEffect(() => {
    if (isSupported === true && deviceSupportsAdvancedAudioProcessing === true && !isEnabled) {
      void Promise.resolve(setEnabled(true)).catch(() => undefined);
    }
  }, [deviceSupportsAdvancedAudioProcessing, isEnabled, isSupported, setEnabled]);

  useEffect(() => {
    const interactionId = authority.interactionId;
    const active = !!interactionId && authority.activeUserIds.includes(userId) && !authority.ended && !authority.muteAll;
    if (role === 'STUDENT' && active) {
      if (interactionStart.current?.id !== interactionId) {
        interactionStart.current = { id: interactionId, startedAt: Date.now() };
      }
    } else if (interactionStart.current?.id === interactionId || !active) {
      interactionStart.current = null;
    }
  }, [authority.activeUserIds, authority.ended, authority.interactionId, authority.muteAll, role, userId]);

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

  // A no-response classification uses a short rolling evidence window instead of
  // one transient network packet. Sustained degradation receives a configurable
  // grace window before the event is sent for faculty review. Grades are never
  // deducted here.
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
    const startedAt = interactionStart.current?.id === interactionId
      ? interactionStart.current.startedAt
      : Date.now();
    if (interactionStart.current?.id !== interactionId) interactionStart.current = { id: interactionId, startedAt };

    let cancelled = false;
    let graceTimer: ReturnType<typeof setTimeout> | null = null;

    const stillCurrent = () => {
      const current = authorityRef.current;
      return !cancelled &&
        current.interactionId === interactionId &&
        !current.ended &&
        !current.muteAll &&
        current.activeUserIds.includes(userId);
    };

    const finalizeNoResponse = async (networkExtensionMs: number) => {
      if (!stillCurrent() || heardSpeech.current === interactionId || noResponseMarked.current === interactionId) return;
      await captureNetworkSample();
      if (!stillCurrent() || heardSpeech.current === interactionId || noResponseMarked.current === interactionId) return;

      const now = Date.now();
      const summary = summarizeEvidence(networkSamples.current, startedAt, now, livePolicy.evidenceWindowMs);
      noResponseMarked.current = interactionId;

      await supabase.functions.invoke('buklod-classroom-stream-access', {
        body: {
          action: 'interaction_result',
          session_id: sessionId,
          interaction_id: interactionId,
          result: summary.sustainedPoor ? 'NO_RESPONSE_NETWORK_REVIEW' : 'NO_RESPONSE_REVIEW',
          network_evidence: {
            source: 'BUKLOD_CLASSROOM_NATIVE_ROLLING',
            interaction_received_at: new Date(startedAt).toISOString(),
            observed_at: new Date(now).toISOString(),
            response_window_ms: livePolicy.responseWindowMs,
            network_extension_ms: networkExtensionMs,
            evidence_window_ms: livePolicy.evidenceWindowMs,
            sample_count: summary.relevant.length,
            poor_sample_count: summary.poorSamples.length,
            poor_ratio: Number(summary.poorRatio.toFixed(3)),
            connectivity_transitions: summary.transitions,
            sustained_degraded: summary.sustainedPoor,
            stream_connection_quality: summary.latest?.stream_connection_quality ?? null,
            network_type: summary.latest?.network_type ?? null,
            is_connected: summary.latest?.is_connected ?? null,
            is_internet_reachable: summary.latest?.is_internet_reachable ?? null,
            samples: summary.relevant.map(sample => ({
              observed_at: sample.observed_at,
              stream_connection_quality: sample.stream_connection_quality,
              network_type: sample.network_type,
              is_connected: sample.is_connected,
              is_internet_reachable: sample.is_internet_reachable,
              poor: sample.poor,
            })),
          },
        },
      }).catch(() => undefined);

      // Safety/data rule: if there was no response, media should not remain on.
      await call.microphone.disable().catch(() => undefined);
      await call.camera.disable().catch(() => undefined);
    };

    const baseDelay = Math.max(0, startedAt + livePolicy.responseWindowMs - Date.now());
    const baseTimer = setTimeout(() => {
      void (async () => {
        if (!stillCurrent() || heardSpeech.current === interactionId || noResponseMarked.current === interactionId) return;
        await captureNetworkSample();
        const summary = summarizeEvidence(networkSamples.current, startedAt, Date.now(), livePolicy.evidenceWindowMs);
        if (summary.sustainedPoor && livePolicy.degradedExtensionMs > 0) {
          graceTimer = setTimeout(() => { void finalizeNoResponse(livePolicy.degradedExtensionMs); }, livePolicy.degradedExtensionMs);
          return;
        }
        await finalizeNoResponse(0);
      })();
    }, baseDelay);

    return () => {
      cancelled = true;
      clearTimeout(baseTimer);
      if (graceTimer) clearTimeout(graceTimer);
    };
  }, [authority.activeUserIds, authority.ended, authority.interactionId, authority.muteAll, call, captureNetworkSample, livePolicy, role, sessionId, userId]);

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
      if (authorityRef.current.interactionId !== interactionId) return;
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
        onAuthority(applyClassroomInteractionEvent(authorityRef.current, event));
        await broadcast(event).catch(() => undefined);
      })();
    }, 30_000);

    return () => clearTimeout(timer);
  }, [authority.ended, authority.interactionId, authority.mode, broadcast, onAuthority, role, sessionId]);

  return null;
}

export default function ClassroomLiveAutomationLayer(props: Props) {
  return (
    <NoiseCancellationProvider>
      <ClassroomAutomationInner {...props} />
    </NoiseCancellationProvider>
  );
}
