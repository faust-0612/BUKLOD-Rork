import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  CallContent,
  CallControls,
  OwnCapability,
  ScreenShareToggleButton,
  useCall,
  useCallStateHooks,
} from '@/lib/streamVideoSdk';
import {
  ToggleCameraFaceButton,
  callManager,
} from '@stream-io/video-react-native-sdk';


/* PATCH_168E_SCOPE_CONNECT_CALLS */

function formatElapsed(
  seconds: number,
) {
  const total =
    Math.max(
      0,
      Math.floor(
        seconds
      )
    );

  const hours =
    Math.floor(
      total / 3600
    );

  const minutes =
    Math.floor(
      (
        total %
        3600
      ) / 60
    );

  const secs =
    total % 60;

  const mm =
    String(
      minutes
    ).padStart(
      2,
      '0'
    );

  const ss =
    String(
      secs
    ).padStart(
      2,
      '0'
    );

  if (
    hours <= 0
  ) {
    return `${mm}:${ss}`;
  }

  return [
    hours,
    mm,
    ss,
  ].join(':');
}

function BuklodCallControls() {
  const call =
    useCall();

  const {
    useHasPermissions,
  } =
    useCallStateHooks();

  const canEndForAll =
    useHasPermissions(
      OwnCapability.END_CALL
    );

  const [
    ending,
    setEnding,
  ] =
    useState(false);

  

  /* PATCH_179G_R3_EXPLICIT_CALL_DEVICE_CONTROLS */
  const [
    speakerForced,
    setSpeakerForced,
  ] =
    useState(false);

  const toggleSpeaker =
    () => {
      const next =
        !speakerForced;

      try {
        callManager.speaker
          .setForceSpeakerphoneOn(
            next
          );

        setSpeakerForced(
          next
        );
      }
      catch (
        error: any
      ) {
        Alert.alert(
          'Audio output',
          error?.message ??
            'Could not change the audio output.'
        );
      }
    };
const endForAll =
    () => {
      if (
        !call ||
        ending
      ) {
        return;
      }

      Alert.alert(
        'End call for everyone?',
        'All participants will be disconnected from this call.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text:
              'End for everyone',
            style:
              'destructive',
            onPress:
              () => {
                void (
                  async () => {
                    setEnding(true);

                    try {
                      await call
                        .endCall();
                    }
                    catch (
                      error: any
                    ) {
                      Alert.alert(
                        'Unable to end call',
                        error?.message ??
                        'Please try again.'
                      );
                    }
                    finally {
                      setEnding(false);
                    }
                  }
                )();
              },
          },
        ]
      );
    };

  return (
    <View>
      <CallControls />

      <View
        style={
          styles.extraControls
        }
      >

        <View
          style={
            styles.deviceControlBox
          }
        >
          <ToggleCameraFaceButton />

          <Text
            style={
              styles.extraLabel
            }
          >
            Flip
          </Text>
        </View>

        <View
          style={
            styles.deviceControlBox
          }
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              speakerForced
                ? 'Return to automatic audio output'
                : 'Force speaker output'
            }
            onPress={
              toggleSpeaker
            }
            style={({
              pressed,
            }) => [
              styles.speakerButton,
              speakerForced &&
                styles.speakerButtonOn,
              pressed && {
                opacity: 0.72,
              },
            ]}
          >
            <Text
              style={
                styles.speakerButtonText
              }
            >
              SPK
            </Text>
          </Pressable>

          <Text
            style={
              styles.extraLabel
            }
          >
            {speakerForced
              ? 'Speaker'
              : 'Audio'}
          </Text>
        </View>

        <View
          style={
            styles.screenShareBox
          }
        >
          <ScreenShareToggleButton
            screenShareOptions={{
              /*
               * iOS inApp mode does not require a broadcast
               * extension. On Android the type is ignored.
               */
              type: 'inApp',
              includeAudio:
                true,
            }}
          />

          <Text
            style={
              styles.extraLabel
            }
          >
            Share
          </Text>
        </View>

        {canEndForAll ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="End call for everyone"
            disabled={
              ending
            }
            onPress={
              endForAll
            }
            style={({
              pressed,
            }) => [
              styles.endAll,
              pressed && {
                opacity: 0.78,
              },
              ending && {
                opacity: 0.5,
              },
            ]}
          >
            <Text
              style={
                styles.endAllText
              }
            >
              {ending
                ? 'Ending...'
                : 'End for all'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function
BuklodAcceptedCallContent() {
  const {
    useParticipants,
    useCallSession,
  } =
    useCallStateHooks();

  const participants =
    useParticipants();

  const session =
    useCallSession();

  const startedAt =
    useMemo(
      () => {
        const raw =
          session?.started_at;

        if (!raw) {
          return Date.now();
        }

        const parsed =
          new Date(
            raw
          ).getTime();

        return Number.isFinite(
          parsed
        )
          ? parsed
          : Date.now();
      },
      [
        session?.started_at,
      ]
    );

  const [
    elapsed,
    setElapsed,
  ] =
    useState('00:00');

  useEffect(
    () => {
      const update =
        () => {
          setElapsed(
            formatElapsed(
              (
                Date.now() -
                startedAt
              ) / 1000
            )
          );
        };

      update();

      const timer =
        setInterval(
          update,
          1000
        );

      return () => {
        clearInterval(
          timer
        );
      };
    },
    [
      startedAt,
    ]
  );

  return (
    <View
      style={
        styles.root
      }
    >
      <CallContent
        CallControls={
          BuklodCallControls
        }
      />

      <View
        pointerEvents="none"
        style={
          styles.statusBadge
        }
      >
        <Text
          style={
            styles.statusText
          }
        >
          {elapsed}
          {'  \u2022  '}
          {participants.length}
          {' '}
          participant
          {participants.length === 1
            ? ''
            : 's'}
        </Text>
      </View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor:
        '#000000',
    },

    statusBadge: {
      position:
        'absolute',
      top: 14,
      alignSelf:
        'center',
      zIndex: 50,
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor:
        'rgba(0,0,0,0.58)',
    },

    statusText: {
      color:
        '#FFFFFF',
      fontSize: 11,
      fontWeight: '800',
    },

    extraControls: {
      alignItems:
        'center',
      justifyContent:
        'center',
      flexDirection:
        'row',
      gap: 14,
      paddingBottom: 8,
      backgroundColor:
        '#000000',
    },

        deviceControlBox: {
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    speakerButton: {
      minWidth: 42,
      minHeight: 42,
      borderRadius: 21,
      alignItems:
        'center',
      justifyContent:
        'center',
      borderWidth: 1,
      borderColor:
        'rgba(255,255,255,0.38)',
      backgroundColor:
        'rgba(255,255,255,0.10)',
    },

    speakerButtonOn: {
      backgroundColor:
        'rgba(255,255,255,0.28)',
    },

    speakerButtonText: {
      color:
        '#FFFFFF',
      fontSize: 10,
      fontWeight:
        '900',
    },

screenShareBox: {
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    extraLabel: {
      marginTop: 2,
      color:
        '#FFFFFF',
      fontSize: 9,
      fontWeight: '700',
      opacity: 0.86,
    },

    endAll: {
      minHeight: 36,
      paddingHorizontal: 13,
      borderRadius: 18,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#A82020',
    },

    endAllText: {
      color:
        '#FFFFFF',
      fontSize: 10,
      fontWeight: '900',
    },
  });
