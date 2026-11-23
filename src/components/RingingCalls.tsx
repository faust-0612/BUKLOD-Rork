import React, {
  useEffect,
  useRef,
  useState,
} from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import {
  isBuklodCallOriginator,
  isBuklodRecipientPresentationReceipt,
} from '@/lib/buklodCallFeedback';
import {
  getBuklodSoundSettings,
  setBuklodCallSoundSuppressed,
} from '@/lib/buklodSounds';

import BuklodAcceptedCallContent from '@/components/BuklodAcceptedCallContent';
import BuklodCallRenderBoundary from '@/components/BuklodCallRenderBoundary';
import { subscribeBuklodCallingStateChanges } from '@/lib/buklodCallStateSubscription';
import {
  findActiveNonPttCall,
  getBuklodCallSurfaceMode,
  isBuklodAcceptedNonPttCall,
  minimizeBuklodCallSurface,
  resetBuklodCallSurface,
  revealBuklodCallSurface,
  subscribeBuklodCallSurface,
} from '@/lib/buklodActiveNonPttCall';
import {
  CallingState,
  RingingCallContent,
  StreamCall,
  useCall,
  useCallStateHooks,
  useCalls,
  useStreamVideoClient,
} from '@/lib/streamVideoSdk';

import {
  AppState,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

/**
 * Native Stream/Telecom/CallKit already owns the callee's ringtone.
 * Only the caller plays this ringback, preventing duplicate incoming rings.
 * Cleanup is tied to Stream's RINGING state, not an arbitrary timeout.
 */
function BuklodOutgoingRingback() {
  const call = useCall();
  const client = useStreamVideoClient();
  const { useCallCallingState } = useCallStateHooks();
  const callingState = useCallCallingState();
  const player = useAudioPlayer(require('../../assets/sounds/buklod_ringback.wav'));
  const playerStatus = useAudioPlayerStatus(player);
  const [soundAllowed, setSoundAllowed] = useState<boolean | null>(null);
  const [remotePresented, setRemotePresented] = useState(false);

  const currentUserId = client?.state?.connectedUser?.id;
  const outgoing = isBuklodCallOriginator(call, currentUserId);
  const ringing = callingState === CallingState.RINGING;

  // An incoming call is acknowledged only after its BUKLOD UI mounts in
  // the foreground. No receipt is sent for unseen background/FCM pushes.
  useEffect(() => {
    if (!call || outgoing || !ringing || AppState.currentState !== 'active') {
      return;
    }
    const timer = setTimeout(() => {
      if (AppState.currentState !== 'active') return;
      void call.sendCustomEvent({
        type: 'buklod.call.presented',
        call_cid: call.cid,
      }).catch(() => {
        // No positive receipt is shown to the caller on failure.
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [call, outgoing, ringing]);

  // A server-side call.ring is not a device-delivery receipt. Only a
  // remote authenticated member's acknowledgement can advance the label.
  useEffect(() => {
    if (!call || !outgoing || !ringing) return;
    const unsubscribe = call.on('custom', (event: any) => {
      if (isBuklodRecipientPresentationReceipt(call, event, currentUserId)) {
        setRemotePresented(true);
      }
    });
    return () => {
      try { unsubscribe?.(); } catch { /* disposed call */ }
    };
  }, [call, outgoing, ringing, currentUserId]);

  useEffect(() => {
    if (!outgoing || !ringing) return;
    let disposed = false;
    let enabled = false;
    player.loop = true;
    player.volume = 0.42;

    const sync = (state: string) => {
      if (disposed || !enabled) return;
      try {
        if (playerStatus.isLoaded && state === 'active') {
          player.play();
        } else {
          player.pause();
        }
      } catch {
        // Native audio can be disposed during cancellation or SDK teardown.
        // Visual delivery feedback must remain available even without audio.
      }
    };

    const subscription = AppState.addEventListener('change', sync);
    void getBuklodSoundSettings().then(settings => {
      if (disposed) return;
      enabled = settings.calls;
      setSoundAllowed(settings.calls);
      sync(AppState.currentState);
    }).catch(() => {
      if (!disposed) setSoundAllowed(false);
    });

    return () => {
      disposed = true;
      subscription.remove();
      try {
        player.pause();
        void Promise.resolve(player.seekTo(0)).catch(() => undefined);
      } catch {
        // Already released players must not crash the call surface.
      }
    };
  }, [outgoing, ringing, player, playerStatus.isLoaded]);

  if (!outgoing || !ringing) return null;

  const personal =
    String(call?.state?.custom?.buklod_call_scope ?? '').toUpperCase() ===
    'PERSONAL';

  const headline = remotePresented
    ? personal
      ? 'Bumukas ang tawag sa kabilang BUKLOD app'
      : 'May miyembrong nakakita ng tawag'
    : 'Naipadala ang call request';

  const explanation = remotePresented
    ? 'Naghihintay ng sagot. Hindi pa ibig sabihin na narinig ang ringtone.'
    : 'Hindi pa nakumpirma kung naabot ang kabilang phone.';

  const audioLabel =
    soundAllowed === false
      ? 'Ringback: naka-off sa BUKLOD Sounds'
      : playerStatus.playing
        ? '♪ Ringback: tumutunog sa app'
        : '♪ Ringback: hindi pa tumutunog';

  return (
    <View pointerEvents="none" style={s.callFeedback}>
      <Text accessibilityLiveRegion="polite" style={s.callFeedbackTitle}>
        {remotePresented ? '✓ ' : '◌ '}{headline}
      </Text>
      <Text style={s.callFeedbackHint}>{explanation}</Text>
      <Text style={s.callFeedbackAudio}>{audioLabel}</Text>
    </View>
  );
}

import {
  GestureHandlerRootView,
} from 'react-native-gesture-handler';

import {
  useSafeAreaInsets,
} from 'react-native-safe-area-context';


function callIdentity(
  call: any
) {
  return String(
    call?.cid ??
    call?.id ??
    call?.state?.call?.id ??
    ''
  );
}


function RingingCallsCore() {
  const calls =
    useCalls();

  const insets =
    useSafeAreaInsets();

  const [
    surfaceMode,
    setSurfaceMode,
  ] =
    useState(
      getBuklodCallSurfaceMode
    );

  const previousCallKey =
    useRef<string | null>(
      null
    );


  useEffect(
    () =>
      subscribeBuklodCallSurface(
        setSurfaceMode
      ),
    []
  );


  const activeCall =
    findActiveNonPttCall(
      calls
    );

  const activeCallKey =
    activeCall
      ? callIdentity(
          activeCall
        )
      : null;

  useEffect(() => {
    setBuklodCallSoundSuppressed(Boolean(activeCall));
    return () => setBuklodCallSoundSuppressed(false);
  }, [activeCallKey]);

  /*
   * A newly observed live call must always open its full surface.
   * A terminal call clears any minimized state so the next call
   * never inherits a stale "hidden" flag.
   */
  useEffect(
    () => {
      if (!activeCall) {
        previousCallKey.current =
          null;

        resetBuklodCallSurface();
        return;
      }

      if (
        activeCallKey !==
        previousCallKey.current
      ) {
        previousCallKey.current =
          activeCallKey;

        revealBuklodCallSurface();
      }
    },
    [
      activeCall,
      activeCallKey,
    ]
  );


  const accepted =
    isBuklodAcceptedNonPttCall(
      activeCall
    );

  const minimized =
    accepted &&
    surfaceMode ===
      'minimized';


  useEffect(
    () => {
      if (
        !activeCall ||
        !accepted ||
        minimized
      ) {
        return;
      }

      const subscription =
        BackHandler.addEventListener(
          'hardwareBackPress',
          () => {
            minimizeBuklodCallSurface();
            return true;
          }
        );

      return () => {
        subscription.remove();
      };
    },
    [
      accepted,
      activeCall,
      minimized,
    ]
  );


  if (!activeCall) {
    return null;
  }


  if (minimized) {
    return (
      <View
        pointerEvents="box-none"
        style={[
          s.minimizedHost,
          {
            paddingTop:
              Math.max(
                insets.top,
                8
              ) + 6,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Return to active call"
          onPress={
            revealBuklodCallSurface
          }
          style={({ pressed }) => [
            s.returnChip,
            pressed && {
              opacity: 0.78,
            },
          ]}
        >
          <Text
            style={
              s.returnChipText
            }
          >
            Call in progress · Return to call
          </Text>
        </Pressable>
      </View>
    );
  }


  return (
    <View
      style={
        s.overlay
      }
    >
      <GestureHandlerRootView
        unstable_forceActive
        style={
          s.gestureRoot
        }
      >
        <View
          style={[
            s.safeCallArea,
            {
              paddingBottom:
                Math.max(
                  insets.bottom,
                  16
                ) + 8,
            },
          ]}
        >
          <StreamCall
            call={
              activeCall
            }
          >
            <BuklodOutgoingRingback />
            <RingingCallContent
              CallContent={
                BuklodAcceptedCallContent
              }
            />
          </StreamCall>

          {accepted ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Hide active call"
              onPress={
                minimizeBuklodCallSurface
              }
              style={({ pressed }) => [
                s.hideButton,
                {
                  top:
                    Math.max(
                      insets.top,
                      8
                    ) + 6,
                },
                pressed && {
                  opacity: 0.72,
                },
              ]}
            >
              <Text
                style={
                  s.hideButtonText
                }
              >
                Hide
              </Text>
            </Pressable>
          ) : null}
        </View>
      </GestureHandlerRootView>
    </View>
  );
}



/**
 * Keep reactive SDK observables OUTSIDE the call UI crash boundary.
 * Their subscribe callbacks may fire synchronously for disposed calls.
 * Skip the initial BehaviorSubject snapshot, guard absent/closed streams,
 * and key the boundary to the active call so each new call gets a fresh UI.
 */
export function RingingCalls() {
  const calls = useCalls();
  const [, setCallStateRevision] = useState(0);

  useEffect(
    () => subscribeBuklodCallingStateChanges(
      calls,
      () => setCallStateRevision(value => value + 1),
    ),
    [calls],
  );

  const activeCall = findActiveNonPttCall(calls);
  const activeKey = activeCall ? callIdentity(activeCall) || 'active' : 'idle';

  const leaveCall = async () => {
    if (!activeCall) return;
    const accepted = isBuklodAcceptedNonPttCall(activeCall);
    if (accepted) {
      await activeCall.leave();
    } else {
      await activeCall.leave({
        reject: true,
        reason: activeCall.isCreatedByMe ? 'cancel' : 'decline',
      });
    }
  };

  return (
    <BuklodCallRenderBoundary
      key={activeKey}
      callActive={Boolean(activeCall)}
      onLeave={leaveCall}
    >
      <RingingCallsCore />
    </BuklodCallRenderBoundary>
  );
}

const s =
  StyleSheet.create({
    callFeedback: {
      position: 'absolute',
      top: '42%',
      left: 16,
      right: 16,
      alignItems: 'center',
      zIndex: 50,
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: 'rgba(0,0,0,0.50)',
    },
    callFeedbackTitle: {
      color: '#FFFFFF',
      textAlign: 'center',
      fontWeight: '800',
      fontSize: 14,
    },
    callFeedbackHint: {
      color: '#F2F2F2',
      textAlign: 'center',
      fontSize: 11,
    },
    callFeedbackAudio: {
      color: '#B3F4CF',
      textAlign: 'center',
      fontWeight: '700',
      fontSize: 11,
    },
    overlay: {
      ...StyleSheet.absoluteFill,

      zIndex: 10000,
      elevation: 10000,
    },

    gestureRoot: {
      flex: 1,
    },

    safeCallArea: {
      flex: 1,
      backgroundColor:
        '#000000',
    },

    hideButton: {
      position:
        'absolute',
      right: 14,
      zIndex: 10050,
      elevation: 10050,
      minHeight: 34,
      paddingHorizontal: 14,
      borderRadius: 17,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        'rgba(0,0,0,0.58)',
      borderWidth: 1,
      borderColor:
        'rgba(255,255,255,0.26)',
    },

    hideButtonText: {
      color:
        '#FFFFFF',
      fontSize: 11,
      fontWeight:
        '900',
    },

    minimizedHost: {
      position:
        'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10000,
      elevation: 10000,
      alignItems:
        'center',
      paddingHorizontal: 12,
    },

    returnChip: {
      maxWidth: 360,
      minHeight: 42,
      paddingHorizontal: 16,
      borderRadius: 21,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#143A2A',
      borderWidth: 1,
      borderColor:
        'rgba(255,255,255,0.22)',
    },

    returnChipText: {
      color:
        '#FFFFFF',
      fontSize: 12,
      fontWeight:
        '900',
    },
  });
