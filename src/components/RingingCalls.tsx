import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import BuklodAcceptedCallContent from '@/components/BuklodAcceptedCallContent';
import BuklodCallerAudioCues from '@/components/BuklodCallerAudioCues';
import { getCachedBuklodStreamVideoClient } from '@/lib/buklodStreamVideoClient';
import {
  findActiveCall,
  getBuklodCallSurfaceMode,
  isBuklodAcceptedCall,
  minimizeBuklodCallSurface,
  resetBuklodCallSurface,
  revealBuklodCallSurface,
  subscribeBuklodCallSurface,
} from '@/lib/buklodActiveCall';
import {
  RingingCallContent,
  StreamCall,
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


export function RingingCalls() {
  /* BUKLOD_CALL_REENTRY_R2
   * Recover the same live SDK call if useCalls() has not rehydrated
   * its list immediately after Android background/foreground transitions.
   * Never create a second call or alter Stream push handlers.
   */
  const observedCalls =
    useCalls();
  const cachedClient =
    getCachedBuklodStreamVideoClient();
  const cachedCalls =
    cachedClient?.state?.calls ?? [];
  const calls =
    observedCalls.length > 0
      ? observedCalls
      : cachedCalls;

  const insets =
    useSafeAreaInsets();

  const [
    surfaceMode,
    setSurfaceMode,
  ] =
    useState(
      getBuklodCallSurfaceMode
    );

  const [
    stateTick,
    setStateTick,
  ] =
    useState(0);

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
  // Android can resume an already-joined Telecom/Stream call without a
  // new incoming ring event. Re-read SDK call state when the app returns.
  useEffect(
    () => {
      const listener = AppState.addEventListener(
        'change',
        nextState => {
          if (nextState === 'active') {
            setStateTick(value => value + 1);
          }
        }
      );
      return () => listener.remove();
    },
    []
  );


  useEffect(
    () => {
      const subscriptions =
        calls.map(
          call =>
            call.state.callingState$
              .subscribe(
                () => {
                  setStateTick(
                    value =>
                      value + 1
                  );
                }
              )
        );

      return () => {
        subscriptions.forEach(
          subscription =>
            subscription.unsubscribe()
        );
      };
    },
    [
      calls,
    ]
  );


  const activeCall =
    findActiveCall(
      calls
    );

  const activeCallKey =
    activeCall
      ? callIdentity(
          activeCall
        )
      : null;

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
      stateTick,
    ]
  );


  const accepted =
    isBuklodAcceptedCall(
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
      stateTick,
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
            <BuklodCallerAudioCues />
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
