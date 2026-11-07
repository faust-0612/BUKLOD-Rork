import React, {
  useEffect,
  useRef,
  useState,
} from 'react';
import { useAudioPlayer } from 'expo-audio';
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
  const { useCallCallingState } = useCallStateHooks();
  const callingState = useCallCallingState();
  const player = useAudioPlayer(require('../../assets/sounds/buklod_ringback.wav'));

  useEffect(() => {
    if (!call?.isCreatedByMe || callingState !== CallingState.RINGING) return;
    let disposed = false;
    let enabled = false;
    player.loop = true;
    player.volume = 0.24;
    const sync = (state: string) => {
      if (disposed || !enabled) return;
      try {
        if (state === 'active') player.play();
        else player.pause();
      } catch {
        // A disposed audio player can throw while a ringing call terminates.
        // Audio cleanup must never crash the entire app.
      }
    };
    const subscription = AppState.addEventListener('change', sync);
    void getBuklodSoundSettings().then(settings => {
      if (disposed || !settings.calls) return;
      enabled = true;
      sync(AppState.currentState);
    }).catch(() => undefined);
    return () => {
      disposed = true;
      subscription.remove();
      try {
        player.pause();
        void Promise.resolve(player.seekTo(0)).catch(() => undefined);
      } catch {
        // Native audio may already be released after cancel/no-answer.
      }
    };
  }, [call?.isCreatedByMe, callingState, player]);
  return null;
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
