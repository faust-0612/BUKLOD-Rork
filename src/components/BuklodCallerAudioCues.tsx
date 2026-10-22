import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import {
  CallingState,
  useCall,
  useCallStateHooks,
} from '@/lib/streamVideoSdk';
import {
  startRingback,
  stopAllCallAudioCues,
  stopRingback,
} from '@/lib/buklodCallAudioCues';

/**
 * Caller-only ringback while waiting for answer.
 * Callee incoming ringtone path is left entirely to Stream/callingx.
 */
export default function BuklodCallerAudioCues() {
  const call = useCall();
  const { useCallCallingState } = useCallStateHooks();
  const callingState = useCallCallingState();
  const joinedRef = useRef(false);

  useEffect(() => {
    joinedRef.current = false;
    return () => {
      // Keep the short terminal beep owned by lifecycle; release ringback.
      stopRingback();
    };
  }, [call]);

  useEffect(() => {
    if (Platform.OS === 'web' || !call) {
      return;
    }

    const isCaller = call.isCreatedByMe === true;
    if (!isCaller) {
      stopRingback();
      return;
    }

    const state = String(callingState ?? '');
    const joined =
      callingState === CallingState.JOINED ||
      callingState === CallingState.JOINING ||
      callingState === CallingState.RECONNECTING ||
      state.toLowerCase().includes('reconnect');

    if (joined) {
      joinedRef.current = true;
      stopAllCallAudioCues();
      return;
    }

    const ringing = callingState === CallingState.RINGING;

    if (ringing && !joinedRef.current) {
      void startRingback();
      return;
    }

    stopRingback();
  }, [call, callingState]);

  return null;
}
