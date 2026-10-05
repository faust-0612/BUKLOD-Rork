import { ensureBuklodStreamVideoClient } from '@/lib/buklodStreamVideoClient';
import {
  buildBuklodScopeCallId,
  formatBuklodCallStartError,
} from '@/lib/buklodStreamCall';
import {
  restoreActiveNonPttCallIfAny,
} from '@/lib/buklodActiveNonPttCall';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  useStreamVideoClient,
} from '@/lib/streamVideoSdk';

import {
  supabase,
} from '@/lib/supabase';

import {
  type ConnectThemeRoles,
} from '@/lib/connectTheme';
import {
  useConnectTheme,
} from '@/providers/ConnectThemeProvider';

/* PATCH_168E_SCOPE_CONNECT_CALLS */

type Props = {
  scopeId: string;
  title?: string;
  compact?: boolean;
};

type CallMode =
  | 'audio'
  | 'video';

type RosterRow = {
  user_id: string;
  is_admin?: boolean | null;
};

function safeCallId(
  scopeId: string,
) {
  return buildBuklodScopeCallId(
    scopeId
  );
}

export default function
BuklodScopeCallLauncher({
  scopeId,
  title,
  compact = false,
}: Props) {
  const { theme } = useConnectTheme();
  const styles = useMemo(
    () => createCallStyles(theme),
    [theme]
  );
  const videoClient =
    useStreamVideoClient();

  const [
    enabled,
    setEnabled,
  ] =
    useState(false);

  const [
    scopeType,
    setScopeType,
  ] =
    useState('');

  const [
    roster,
    setRoster,
  ] =
    useState<RosterRow[]>([]);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    starting,
    setStarting,
  ] =
    useState<
      CallMode |
      null
    >(null);

  const load =
    useCallback(
      async () => {
        if (!scopeId) {
          setEnabled(false);
          setRoster([]);
          return;
        }

        setLoading(true);

        try {
          const details =
            await (
              supabase as any
            ).rpc(
              'buklod_connect_room_details',
              {
                _scope_id:
                  scopeId,
              }
            );

          if (details.error) {
            throw details.error;
          }

          const d =
            Array.isArray(
              details.data
            )
              ? details.data[0]
              : details.data;

          const type =
            String(
              d?.scope_type ??
              ''
            ).toUpperCase();

          const canCall =
            type === 'CLUSTER' ||
            type === 'ORGANIZATION' ||
            type === 'SUB_ORGANIZATION' ||
            type === 'SUB-ORGANIZATION' ||
            type === 'SUBORGANIZATION' ||
            type === 'SUB_ORG' ||
            type === 'SUB-ORG';

          setScopeType(type);
          setEnabled(canCall);

          if (!canCall) {
            setRoster([]);
            return;
          }

          const members =
            await (
              supabase as any
            ).rpc(
              'buklod_connect_scope_call_members',
              {
                _scope_id:
                  scopeId,
              }
            );

          if (members.error) {
            /*
             * The migration may not have been pushed yet.
             * Keep the UI mounted so the user gets a clear
             * error if they try before DB push.
             */
            console.warn(
              'Scope call roster:',
              members.error.message
            );
            setRoster([]);
            return;
          }

          const rows =
            Array.isArray(
              members.data
            )
              ? members.data
              : [];

          setRoster(
            rows
              .filter(
                (
                  row: any
                ) =>
                  Boolean(
                    row?.user_id
                  )
              )
              .map(
                (
                  row: any
                ): RosterRow => ({
                  user_id:
                    String(
                      row.user_id
                    ),
                  is_admin:
                    Boolean(
                      row.is_admin
                    ),
                })
              )
          );
        }
        catch (
          error: any
        ) {
          console.warn(
            'Scope call setup:',
            error?.message ??
            error
          );

          setEnabled(false);
          setRoster([]);
        }
        finally {
          setLoading(false);
        }
      },
      [
        scopeId,
      ]
    );

  useEffect(
    () => {
      void load();
    },
    [
      load,
    ]
  );

  const memberCount =
    roster.length;

  const largeGroup =
    memberCount >= 9;

  const label =
    useMemo(
      () => {
        if (
          scopeType ===
          'CLUSTER'
        ) {
          return 'Cluster Call';
        }

        if (
          scopeType ===
            'SUB_ORGANIZATION' ||
          scopeType ===
            'SUB-ORGANIZATION' ||
          scopeType ===
            'SUBORGANIZATION' ||
          scopeType ===
            'SUB_ORG' ||
          scopeType ===
            'SUB-ORG'
        ) {
          return 'Sub-organization Call';
        }

        return 'Organization Call';
      },
      [
        scopeType,
      ]
    );

  const startCall =
    useCallback(
      async (
        mode: CallMode,
      ) => {
      /* PATCH_179F_SCOPE_CALL_ALWAYS_AVAILABLE */
        if (
          starting !== null
        ) {
          return;
        }

        

        setStarting(mode);

        try {
          /* PATCH_175A_R2_SCOPE_CALL_CLIENT_READY */
          const callClient =
            videoClient ??
            await ensureBuklodStreamVideoClient();

          if (
            restoreActiveNonPttCallIfAny(
              callClient.state.calls
            )
          ) {
            return;
          }

          /*
           * Refresh immediately before ringing so membership
           * changes are respected.
           */
          const membersResult =
            await (
              supabase as any
            ).rpc(
              'buklod_connect_scope_call_members',
              {
                _scope_id:
                  scopeId,
              }
            );

          if (
            membersResult.error
          ) {
            throw membersResult.error;
          }

          const freshRows =
            (
              Array.isArray(
                membersResult.data
              )
                ? membersResult.data
                : []
            )
              .filter(
                (
                  row: any
                ) =>
                  Boolean(
                    row?.user_id
                  )
              )
              .map(
                (
                  row: any
                ): RosterRow => ({
                  user_id:
                    String(
                      row.user_id
                    ),
                  is_admin:
                    Boolean(
                      row.is_admin
                    ),
                })
              );

          setRoster(freshRows);

          if (
            freshRows.length <
            2
          ) {
            Alert.alert(
              'No other member yet',
              'At least two active members are needed to start a group call.'
            );
            return;
          }

          const callId =
            safeCallId(
              scopeId
            );

          const call =
            callClient.call(
              'default',
              callId
            );

          const isLarge =
            freshRows.length >=
            9;

          const isVideo =
            mode === 'video';

          await call.getOrCreate({
            ring: true,
            video: isVideo,

            data: {
              members:
                freshRows.map(
                  (row: { user_id: string; is_admin: boolean }) => ({
                    user_id:
                      row.user_id,

                    /*
                     * Built-in Stream roles:
                     * - admin = elevated call moderation
                     * - call_member = ordinary private call member
                     */
                    role:
                      row.is_admin
                        ? 'admin'
                        : 'call_member',
                  })
                ),

              custom: {
                buklod_scope_id:
                  scopeId,

                buklod_scope_type:
                  scopeType,

                buklod_call_mode:
                  mode,

                buklod_scope_name:
                  title ||
                  label,

                buklod_large_group:
                  isLarge,
              },

              settings_override: {
                audio: {
                  mic_default_on:
                    true,

                  default_device:
                    'speaker',
                },

                video: {
                  /*
                   * Audio call = camera off.
                   *
                   * Large group video = also starts camera off
                   * to save bandwidth/data. The call is still
                   * identified as a VIDEO call and users may
                   * turn cameras on manually.
                   */
                  camera_default_on:
                    isVideo &&
                    !isLarge,
                },

                ring: {
                  auto_cancel_timeout_ms:
                    45000,

                  incoming_call_timeout_ms:
                    30000,
                },
              },
            },
          });

          /*
           * Existing root <RingingCalls /> watches ringing calls.
           * The SDK automatically shows the outgoing screen and
           * transitions into accepted CallContent when answered.
           */
        }
        catch (
          error: any
        ) {
          console.warn(
            'BUKLOD scope call:',
            error
          );

          Alert.alert(
            'Call could not start',
            formatBuklodCallStartError(
              error
            )
          );
        }
        finally {
          setStarting(null);
        }
      },
      [
        label,
        scopeId,
        scopeType,
        starting,
        title,
        videoClient,
      ]
    );

  if (!enabled) {
    return null;
  }

  /* PATCH_172H_COMPACT_SCOPE_CALLS */
  if (compact) {
    return (
      <View
        style={
          styles.compactActions
        }
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start scope audio call"
          disabled={
            starting !== null
          }
          onPress={() =>
            void startCall(
              'audio'
            )
          }
          style={({
            pressed,
          }) => [
            styles.compactButton,
            pressed &&
              styles.pressed,
            starting !==
              null &&
              styles.disabled,
          ]}
        >
          {starting ===
          'audio' ? (
            <ActivityIndicator
              size="small"
              color={
                theme.accent
              }
            />
          ) : (
            <MaterialCommunityIcons
              name="phone-outline"
              size={21}
              color={
                theme.accent
              }
            />
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start scope video call"
          disabled={
            starting !== null
          }
          onPress={() =>
            void startCall(
              'video'
            )
          }
          style={({
            pressed,
          }) => [
            styles.compactButton,
            pressed &&
              styles.pressed,
            starting !==
              null &&
              styles.disabled,
          ]}
        >
          {starting ===
          'video' ? (
            <ActivityIndicator
              size="small"
              color={
                theme.accent
              }
            />
          ) : (
            <MaterialCommunityIcons
              name="video-outline"
              size={22}
              color={
                theme.accent
              }
            />
          )}
        </Pressable>
      </View>
    );
  }


  return (
    <View
      style={
        styles.card
      }
    >
      <View
        style={
          styles.copy
        }
      >
        <View
          style={
            styles.titleRow
          }
        >
          <MaterialCommunityIcons
            name="phone-in-talk-outline"
            size={18}
            color={
              theme.accent
            }
          />

          <Text
            style={
              styles.title
            }
          >
            {label}
          </Text>

          {loading ? (
            <ActivityIndicator
              size="small"
              color={
                theme.accent
              }
            />
          ) : (
            <Text
              style={
                styles.count
              }
            >
              {memberCount}
              {' '}
              member
              {memberCount === 1
                ? ''
                : 's'}
            </Text>
          )}
        </View>

        <Text
          style={
            styles.hint
          }
        >
          {largeGroup
            ? 'Data Saver: cameras start off for large-group video calls.'
            : 'Private call for active members of this community.'}
        </Text>
      </View>

      <View
        style={
          styles.actions
        }
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start audio call"
          disabled={
            starting !== null
          }
          onPress={
            () =>
              void startCall(
                'audio'
              )
          }
          style={({
            pressed,
          }) => [
            styles.button,
            styles.audioButton,
            pressed &&
              styles.pressed,
            starting !== null &&
              styles.disabled,
          ]}
        >
          {starting ===
          'audio' ? (
            <ActivityIndicator
              size="small"
              color="#FFFFFF"
            />
          ) : (
            <MaterialCommunityIcons
              name="phone"
              size={21}
              color="#FFFFFF"
            />
          )}

          <Text
            style={
              styles.buttonText
            }
          >
            Audio
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start video call"
          disabled={
            starting !== null
          }
          onPress={
            () =>
              void startCall(
                'video'
              )
          }
          style={({
            pressed,
          }) => [
            styles.button,
            styles.videoButton,
            pressed &&
              styles.pressed,
            starting !== null &&
              styles.disabled,
          ]}
        >
          {starting ===
          'video' ? (
            <ActivityIndicator
              size="small"
              color="#FFFFFF"
            />
          ) : (
            <MaterialCommunityIcons
              name="video"
              size={22}
              color="#FFFFFF"
            />
          )}

          <Text
            style={
              styles.buttonText
            }
          >
            Video
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function createCallStyles(theme: ConnectThemeRoles) {
  return StyleSheet.create({
    /* PATCH_172H_COMPACT_CALL_STYLES */
    compactActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },

    compactButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        theme.border,
      backgroundColor:
        theme.accentMuted,
    },

    card: {
      marginHorizontal: 12,
      marginTop: 8,
      marginBottom: 4,
      padding: 10,
      borderRadius: 15,
      borderWidth:
        StyleSheet
          .hairlineWidth,
      borderColor:
        theme.border,
      backgroundColor:
        theme.callControlSurface,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 10,
    },

    copy: {
      flex: 1,
      minWidth: 0,
    },

    titleRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 6,
    },

    title: {
      fontSize: 12,
      fontWeight: '900',
      color:
        theme.textPrimary,
    },

    count: {
      marginLeft: 2,
      fontSize: 9,
      fontWeight: '800',
      color:
        theme.textMuted,
    },

    hint: {
      marginTop: 3,
      fontSize: 9.5,
      lineHeight: 13,
      color:
        theme.textMuted,
    },

    actions: {
      flexDirection:
        'row',
      gap: 7,
    },

    button: {
      minWidth: 62,
      minHeight: 47,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 13,
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 2,
    },

    audioButton: {
      backgroundColor:
        theme.accent,
    },

    videoButton: {
      backgroundColor:
        theme.accentSoft,
    },

    buttonText: {
      color: '#FFFFFF',
      fontSize: 9,
      fontWeight: '900',
    },

    pressed: {
      opacity: 0.78,
      transform: [
        {
          scale: 0.98,
        },
      ],
    },

    disabled: {
      opacity: 0.55,
    },
  });
}

