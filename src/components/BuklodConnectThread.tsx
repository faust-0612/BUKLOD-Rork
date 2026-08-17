/* PATCH_186J_R2_SINGLE_SHARED_POST_PHOTO */
/* PATCH_185A_R5_DIRECT_THREAD_LOADING_SAFE: existing direct guard retained */
/* PATCH_180A_R7_EXACT_CHAT_BODY_MOJIBAKE */
﻿import { ensureBuklodStreamVideoClient } from '@/lib/buklodStreamVideoClient';
import { repairMojibakeText } from '@/lib/repairMojibakeText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BuklodScopeCallLauncher from '@/components/BuklodScopeCallLauncher';
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  router,
} from 'expo-router';

import {
  Image as ExpoImage,
} from 'expo-image';
import {
  useStreamVideoClient,
} from '@/lib/streamVideoSdk';
import {
  supabase,
} from '@/lib/supabase';

import {
  useAuth,
} from '@/providers/AuthProvider';

import {
  colors,
} from '@/lib/theme';

import {
  ProfileAvatar,
} from '@/components/ProfileAvatar';
import {
  type ConnectPickedFile,
  formatConnectBytes,
  formatConnectTimestamp,
  openConnectAttachment,
  pickConnectFile,
  pickConnectGif,
  pickConnectPhoto,
  uploadConnectFile,
} from '@/lib/buklodConnect';
import { BuklodPhotoEditor } from '@/components/BuklodPhotoEditor';
/* PATCH_186B_PHOTO_EDITOR_IMPORT */

/* PATCH_167L_R5_COMPACT_INLINE_REACTION_DRAWER */
/* PATCH_167L_R9_ATTACHED_EMOJI_ONLY_REACTION */

type Props = {
  mode:
    | 'direct'
    | 'scope';
  containerId: string;
};

/* PATCH_173E_R3_SHARED_POST_RECEIVER
 *
 * Shared posts arrive through the SAME canonical direct/scope
 * message tables. This helper keeps the payload readable even
 * before any richer card UI is mounted.
 */
function cleanSharedPostBody(
  value: string,
): string {
  return String(
    value ??
      '',
  ).replace(
    /^\[\[BUKLOD_SHARED_POST:[0-9a-f-]{36}\]\]\s*/i,
    '',
  );
}


/* PATCH_185A_R5_SHARED_POST_PHOTO_PREVIEW */
function getBuklodSharedPostId185AR5(
  value: string | null | undefined,
): string | null {
  const match = String(value ?? '').match(
    /\[\[BUKLOD_SHARED_POST:([0-9a-f-]{36})\]\]/i,
  );

  return match?.[1] ?? null;
}

function BuklodSharedPostPhotoPreview185AR5({
  body,
}: {
  body: string;
}) {
  const postId =
    getBuklodSharedPostId185AR5(body);

  const [
    mediaUrl,
    setMediaUrl,
  ] =
    useState<string | null>(null);

  useEffect(() => {
    let active = true;

    setMediaUrl(null);

    if (!postId) {
      return () => {
        active = false;
      };
    }

    void (async () => {
      try {
        const {
          data: post,
          error: postError,
        } =
          await (supabase as any)
            .from('community_posts')
            .select('id,media_path')
            .eq('id', postId)
            .maybeSingle();

        if (
          !active ||
          postError ||
          !post?.media_path
        ) {
          return;
        }

        const {
          data: signed,
          error: signedError,
        } =
          await supabase.storage
            .from('community-media')
            .createSignedUrl(
              String(post.media_path),
              3600,
            );

        if (
          active &&
          !signedError &&
          signed?.signedUrl
        ) {
          setMediaUrl(signed.signedUrl);
        }
      }
      catch {
        /* Shared text remains usable if preview lookup fails. */
      }
    })();

    return () => {
      active = false;
    };
  }, [postId]);

  if (!postId) {
    return null;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open shared BUKLOD post"
      onPress={() =>
        router.push(
          `/post/${postId}` as any,
        )
      }
      style={{
        width:210,
        maxWidth:'100%',
        minHeight:58,
        marginBottom:7,
        borderRadius:12,
        overflow:'hidden',
        backgroundColor:'#E9F2ED',
      }}
    >
      {mediaUrl ? (
        <ExpoImage
          source={{ uri: mediaUrl }}
          style={{
            width:'100%',
            height:112,
          }}
          contentFit="cover"
          transition={100}
          cachePolicy="memory-disk"
        />
      ) : (
        <View
          style={{
            minHeight:58,
            paddingHorizontal:12,
            flexDirection:'row',
            alignItems:'center',
            gap:8,
          }}
        >
          <MaterialCommunityIcons
            name="image-outline"
            size={20}
            color={colors.greenDark}
          />
          <Text
            style={{
              flex:1,
              color:colors.greenDark,
              fontSize:11,
              fontWeight:'800',
            }}
          >
            Shared BUKLOD post
          </Text>
        </View>
      )}
    </Pressable>
  );
}

type Message = {
  id: string;
  sender_id: string;
  sender_name?: string;
  body: string;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_mime: string | null;
  attachment_size: number | null;
  created_at: string;
  delivery_state?:
    | 'sent'
    | 'not_sent';
};

type ReactionKey =
  | 'love'
  | 'amen'
  | 'haha'
  | 'praying';

type ReactionSummary = {
  counts: Record<
    ReactionKey,
    number
  >;
  mine:
    | ReactionKey
    | null;
};

/*
 * ASCII-only source escapes prevent mojibake while still
 * rendering native Unicode emoji at runtime.
 */
const REACTIONS: Array<{
  key: ReactionKey;
  emoji: string;
  label: string;
}> = [
  {
    key: 'love',
    emoji: '\u2764\uFE0F',
    label: 'Love',
  },
  {
    key: 'amen',
    emoji: '\uD83D\uDE4F',
    label: 'Amen',
  },
  {
    key: 'haha',
    emoji: '\uD83D\uDE02',
    label: 'Haha',
  },
  {
    key: 'praying',
    emoji: '\uD83E\uDD32',
    label: 'Praying',
  },
];

const REACTION_KEYS:
  readonly ReactionKey[] =
    REACTIONS.map(
      item => item.key
    );

function emptyCounts():
  Record<
    ReactionKey,
    number
  > {
  return {
    love: 0,
    amen: 0,
    haha: 0,
    praying: 0,
  };
}


/* PATCH_172A_MODERN_PERSONAL_REACTIONS */
type ComposerPickerTab =
  | 'emoji'
  | 'gif'
  | 'avatar';

const QUICK_SEND_EMOJIS = [
  '\u{1F44D}',
  '\u2764\uFE0F',
  '\u{1F602}',
  '\u{1F64F}',
  '\u{1F389}',
  '\u{1F60D}',
  '\u{1F62E}',
  '\u{1F622}',
] as const;

const EXTENDED_SEND_EMOJIS = [
  '\u{1F600}','\u{1F603}','\u{1F604}','\u{1F601}',
  '\u{1F606}','\u{1F605}','\u{1F923}','\u{1F602}',
  '\u{1F642}','\u{1F643}','\u{1FAE0}','\u{1F609}',
  '\u{1F60A}','\u{1F607}','\u{1F970}','\u{1F60D}',
  '\u{1F929}','\u{1F618}','\u{1F617}','\u{1F61A}',
  '\u{1F60B}','\u{1F61B}','\u{1F61C}','\u{1F92A}',
  '\u{1F914}','\u{1FAE1}','\u{1F910}','\u{1F928}',
  '\u{1F610}','\u{1F611}','\u{1F636}','\u{1FAE5}',
  '\u{1F60F}','\u{1F612}','\u{1F644}','\u{1F62C}',
  '\u{1F925}','\u{1F60C}','\u{1F614}','\u{1F62A}',
  '\u{1F924}','\u{1F634}','\u{1F637}','\u{1F912}',
  '\u{1F915}','\u{1F922}','\u{1F92E}','\u{1F975}',
  '\u{1F976}','\u{1F974}','\u{1F635}','\u{1FAE8}',
  '\u{1F920}','\u{1F973}','\u{1F978}','\u{1F60E}',
  '\u{1F913}','\u{1F9D0}','\u{1F615}','\u{1FAE4}',
  '\u{1F61F}','\u{1F641}','\u2639\uFE0F','\u{1F62E}',
  '\u{1F632}','\u{1F633}','\u{1F97A}','\u{1F626}',
  '\u{1F627}','\u{1F628}','\u{1F630}','\u{1F625}',
  '\u{1F622}','\u{1F62D}','\u{1F631}','\u{1F616}',
  '\u{1F623}','\u{1F61E}','\u{1F613}','\u{1F629}',
  '\u{1F624}','\u{1F621}','\u{1F620}','\u{1F92C}',
  '\u{1F608}','\u{1F47F}','\u{1F480}','\u{1F4A9}',
  '\u{1F44D}','\u{1F44E}','\u{1F44F}','\u{1F64C}',
  '\u{1F450}','\u{1F932}','\u{1F91D}','\u{1F64F}',
  '\u{1F4AA}','\u{1F44C}','\u270C\uFE0F','\u{1F91E}',
  '\u{1F91F}','\u{1F918}','\u{1F919}','\u{1F448}',
  '\u{1F449}','\u{1F446}','\u{1F447}','\u261D\uFE0F',
  '\u{1F590}\uFE0F','\u{1F44B}','\u{1F91A}','\u{1F596}',
  '\u2764\uFE0F','\u{1F9E1}','\u{1F49B}','\u{1F49A}',
  '\u{1F499}','\u{1F49C}','\u{1F90E}','\u{1F5A4}',
  '\u{1F90D}','\u{1FA77}','\u{1FA75}','\u{1FA76}',
  '\u{1F494}','\u2763\uFE0F','\u{1F495}','\u{1F49E}',
  '\u{1F493}','\u{1F497}','\u{1F496}','\u{1F498}',
  '\u{1F49D}','\u{1F49F}','\u{1F389}','\u{1F38A}',
  '\u{1F381}','\u{1F525}','\u2728','\u{1F31F}',
  '\u{1F4AF}','\u2705','\u{1F4A5}','\u{1F4AB}',
] as const;

const AVATAR_SEND_REACTIONS = [
  { key: 'love', emoji: '\u2764\uFE0F', label: 'Love' },
  { key: 'laugh', emoji: '\u{1F602}', label: 'Laugh' },
  { key: 'pray', emoji: '\u{1F64F}', label: 'Pray' },
  { key: 'yes', emoji: '\u{1F44D}', label: 'Yes' },
  { key: 'celebrate', emoji: '\u{1F389}', label: 'Celebrate' },
  { key: 'wow', emoji: '\u{1F62E}', label: 'Wow' },
  { key: 'sad', emoji: '\u{1F622}', label: 'Sad' },
  { key: 'with_you', emoji: '\u{1F91D}', label: 'With you' },
] as const;

const AVATAR_REACTION_PREFIX =
  '[[BUKLOD_AVATAR_REACTION:';

function parseAvatarReaction(
  body: string
) {
  const match =
    /^\[\[BUKLOD_AVATAR_REACTION:([a-z_]+)\]\]$/
      .exec(
        String(body ?? '')
          .trim()
      );

  if (!match) {
    return null;
  }

  return (
    AVATAR_SEND_REACTIONS.find(
      item =>
        item.key ===
        match[1]
    ) ??
    null
  );
}

/* PATCH_180A_R6_THREAD_MOJIBAKE */
function repairBuklodMessageText(
  value: string | null | undefined
) {
  const input =
    String(value ?? '');

  if (
    !/[\u00C2\u00C3\u00E2\u00F0\u00EF]/.test(
      input
    )
  ) {
    return input;
  }

  const cp1252:
    Record<number, number> = {
      0x20AC: 0x80,
      0x201A: 0x82,
      0x0192: 0x83,
      0x201E: 0x84,
      0x2026: 0x85,
      0x2020: 0x86,
      0x2021: 0x87,
      0x02C6: 0x88,
      0x2030: 0x89,
      0x0160: 0x8A,
      0x2039: 0x8B,
      0x0152: 0x8C,
      0x017D: 0x8E,
      0x2018: 0x91,
      0x2019: 0x92,
      0x201C: 0x93,
      0x201D: 0x94,
      0x2022: 0x95,
      0x2013: 0x96,
      0x2014: 0x97,
      0x02DC: 0x98,
      0x2122: 0x99,
      0x0161: 0x9A,
      0x203A: 0x9B,
      0x0153: 0x9C,
      0x017E: 0x9E,
      0x0178: 0x9F,
    };

  const suspectCount =
    (text: string) =>
      (
        text.match(
          /[\u00C2\u00C3\u00E2\u00F0\u00EF]/g
        ) || []
      ).length;

  return input.replace(
    /[\x00-\xFF\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178]+/g,
    run => {
      if (
        !/[\u00C2\u00C3\u00E2\u00F0\u00EF]/.test(
          run
        )
      ) {
        return run;
      }

      const bytes: number[] = [];

      for (const char of run) {
        const code =
          char.codePointAt(0) ?? 0;

        if (code <= 0xFF) {
          bytes.push(code);
          continue;
        }

        const mapped =
          cp1252[code];

        if (
          typeof mapped !==
          'number'
        ) {
          return run;
        }

        bytes.push(mapped);
      }

      try {
        const encoded =
          bytes
            .map(
              byte =>
                '%' +
                byte
                  .toString(16)
                  .padStart(2, '0')
            )
            .join('');

        const decoded =
          decodeURIComponent(
            encoded
          );

        return (
          suspectCount(decoded) <
          suspectCount(run)
        )
          ? decoded
          : run;
      }
      catch {
        return run;
      }
    }
  );
}

export default function
BuklodConnectThread({
  mode,
  containerId,
}: Props) {
  /* PATCH_169G_CONNECT_SAFE_INSETS */
  const insets =
    useSafeAreaInsets();

  const {
    profile,
  } =
    useAuth();

  const profileId =
    (profile as any)?.id as
      | string
      | undefined;

  const [title, setTitle] =
    useState('Connect');

  const [subtitle, setSubtitle] =
    useState('');

  const [
    otherUserId,
    setOtherUserId,
  ] =
    useState<
      string | null
    >(null);

    /* PATCH_171E_DIRECT_CALLS_NO_LEGACY_ROUTE */
  const directVideoClient =
    useStreamVideoClient();

  const [
    directCallStarting,
    setDirectCallStarting,
  ] =
    useState<
      'audio'
      | 'video'
      | null
    >(null);

  /* PATCH_171H_PERSONAL_CALL_STATUS */
  useEffect(
    () => {
      if (!directVideoClient) {
        return;
      }

      return directVideoClient.on(
        'call.rejected',
        (event: any) => {
          const scope =
            String(
              event?.call?.custom
                ?.buklod_call_scope ??
              ''
            ).toUpperCase();

          if (
            scope !== 'PERSONAL'
          ) {
            return;
          }

          const myId =
            directVideoClient
              .state
              .connectedUser
              ?.id;

          if (
            !myId ||
            event?.call
              ?.created_by
              ?.id !== myId
          ) {
            return;
          }

          const reason =
            String(
              event?.reason ?? ''
            ).toLowerCase();

          if (reason === 'busy') {
            Alert.alert(
              'Call unavailable',
              'This person is currently on another call.'
            );
            return;
          }

          if (reason === 'timeout') {
            Alert.alert(
              'Call unavailable',
              'This person is not available or offline.'
            );
            return;
          }

          if (
            reason === 'decline' ||
            reason === 'rejected'
          ) {
            Alert.alert(
              'Call declined',
              'This person declined the call.'
            );
          }
        }
      );
    },
    [
      directVideoClient,
    ]
  );

  const startDirectCall =
    useCallback(
      async (
        callMode:
          | 'audio'
          | 'video'
      ) => {
      /* PATCH_179F_DIRECT_CALL_ALWAYS_AVAILABLE */
        if (
          directCallStarting !==
          null
        ) {
          return;
        }

        if (
          mode !== 'direct'
        ) {
          return;
        }

        if (
          !profileId ||
          !otherUserId ||
          !containerId
        ) {
          Alert.alert(
            'Call',
            'The personal conversation is still loading.'
          );
          return;
        }

        

        setDirectCallStarting(
          callMode
        );

        try {
          /* PATCH_175A_R2_DIRECT_CALL_CLIENT_READY */
          const callClient =
            directVideoClient ??
            await ensureBuklodStreamVideoClient();

          const safeThread =
            String(
              containerId
            )
              .replace(
                /[^a-zA-Z0-9_-]/g,
                ''
              )
              .slice(
                0,
                28
              );

          const callId =
            [
              'buklod',
              'personal',
              safeThread ||
                'thread',
              Date.now()
                .toString(36),
              Math.random()
                .toString(36)
                .slice(
                  2,
                  9
                ),
            ].join('-');

          const call =
            callClient.call(
              'default',
              callId
            );

          const isVideo =
            callMode ===
            'video';

          await call.getOrCreate({
            ring: true,
            video:
              isVideo,

            data: {
              members: [
                {
                  user_id:
                    profileId,
                },
                {
                  user_id:
                    otherUserId,
                },
              ],

              custom: {
                buklod_call_scope:
                  'PERSONAL',

                buklod_call_mode:
                  callMode,

                buklod_thread_id:
                  containerId,

                buklod_call_title:
                  title ||
                  'BUKLOD Connect',
              },

              settings_override: {
        audio: {
          mic_default_on: true,
          default_device: 'speaker',
        },

        ...(isVideo
          ? {
              video: {
                camera_default_on: true,
                target_resolution: {
                  width: 1280,
                  height: 720,
                  bitrate: 1500000,
                },
              },
            }
          : {}),

        ring: {
          auto_cancel_timeout_ms: 45000,
          incoming_call_timeout_ms: 30000,
        },
      },
            },
          });

          /*
           * IMPORTANT:
           * No router.push here.
           *
           * RingingCalls is globally mounted by
           * StreamVideoProvider and handles the
           * outgoing/incoming call interface.
           *
           * A call must NEVER create/open another
           * message conversation screen.
           */
        }
        catch (
          error: any
        ) {
          console.warn(
            'BUKLOD direct call:',
            error
          );

          Alert.alert(
            callMode ===
            'video'
              ? 'Video Call'
              : 'Audio Call',

            error?.message ??
              'Could not start the call.'
          );
        }
        finally {
          setDirectCallStarting(
            null
          );
        }
      },
      [
        containerId,
        directCallStarting,
        directVideoClient,
        mode,
        otherUserId,
        profileId,
        title,
      ]
    );

const [
    messages,
    setMessages,
  ] =
    useState<Message[]>([]);

  const [
    reactions,
    setReactions,
  ] =
    useState<
      Record<
        string,
        ReactionSummary
      >
    >({});

  const [draft, setDraft] =
    useState('');

  const composerInputRef =
    useRef<TextInput | null>(
      null
    );

  const [
    composerQuickOpen,
    setComposerQuickOpen,
  ] =
    useState(false);

  const [
    composerPickerOpen,
    setComposerPickerOpen,
  ] =
    useState(false);

  const [
    composerPickerTab,
    setComposerPickerTab,
  ] =
    useState<ComposerPickerTab>(
      'emoji'
    );

  const [
    directPeerReadAt,
    setDirectPeerReadAt,
  ] =
    useState<string | null>(
      null
    );

  const [
    attachmentUrls,
    setAttachmentUrls,
  ] =
    useState<
      Record<string, string>
    >({});

  const [file, setFile] =
    useState<
      ConnectPickedFile | null
    >(null);

  /* PATCH_186B_PHOTO_EDITOR_CONNECT_STATE */
  const [
    photoEditorSource,
    setPhotoEditorSource,
  ] = useState<ConnectPickedFile | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [sending, setSending] =
    useState(false);
  /* PATCH_168D_OFFICE_ORGANIZER */
  const [
    officeEnabled,
    setOfficeEnabled,
  ] =
    useState(false);

  useEffect(() => {
    let active = true;

    if (
      mode !== 'scope' ||
      !containerId
    ) {
      setOfficeEnabled(false);
      return () => {
        active = false;
      };
    }

    void (async () => {
      const details =
        await (
          supabase as any
        ).rpc(
          'buklod_connect_room_details',
          {
            _scope_id:
              containerId,
          }
        );

      if (!active) {
        return;
      }

      if (details.error) {
        setOfficeEnabled(false);
        return;
      }

      const d =
        Array.isArray(
          details.data
        )
          ? details.data[0]
          : details.data;

      const scopeType =
        String(
          d?.scope_type ??
          ''
        ).toUpperCase();

      setOfficeEnabled(
        [
          'CLUSTER',
          'ORGANIZATION',
          'SUB_ORGANIZATION',
          'SUB-ORGANIZATION',
          'SUBORGANIZATION',
          'SUB_ORG',
          'SUB-ORG',
        ].includes(scopeType)
      );
    })();

    return () => {
      active = false;
    };
  }, [
    containerId,
    mode,
  ]);

  const [
    optionMenu,
    setOptionMenu,
  ] =
    useState<
      'attach'
      | null
    >(null);

  const [
    reactionTargetId,
    setReactionTargetId,
  ] =
    useState<
      string | null
    >(null);

  const listRef =
    useRef<
      FlatList<Message>
    >(null);

  const loadReactions =
    useCallback(
      async () => {
        if (
          !containerId ||
          !profileId
        ) {
          return;
        }

        const table =
          mode === 'direct'
            ? 'buklod_connect_direct_message_reactions'
            : 'buklod_connect_scope_message_reactions';

        const containerField =
          mode === 'direct'
            ? 'thread_id'
            : 'scope_id';

        const result =
          await (supabase as any)
            .from(table)
            .select(
              'message_id,user_id,reaction'
            )
            .eq(
              containerField,
              containerId
            )
            .limit(5000);

        if (result.error) {
          setReactions({});
          return;
        }

        const next:
          Record<
            string,
            ReactionSummary
          > = {};

        for (
          const row of
          result.data ?? []
        ) {
          const messageId =
            String(
              row.message_id ??
                ''
            );

          const key =
            String(
              row.reaction ??
                ''
            ) as ReactionKey;

          if (
            !messageId ||
            !(
              REACTION_KEYS as
                readonly string[]
            ).includes(key)
          ) {
            continue;
          }

          if (!next[messageId]) {
            next[messageId] = {
              counts:
                emptyCounts(),
              mine: null,
            };
          }

          next[
            messageId
          ].counts[key] += 1;

          if (
            row.user_id ===
            profileId
          ) {
            next[
              messageId
            ].mine = key;
          }
        }

        setReactions(next);
      },
      [
        containerId,
        mode,
        profileId,
      ]
    );

  const loadPeerRead =
    useCallback(
      async () => {
        if (
          mode !== 'direct' ||
          !containerId ||
          !profileId
        ) {
          setDirectPeerReadAt(
            null
          );
          return;
        }

        const result =
          await (
            supabase as any
          ).rpc(
            'buklod_connect_direct_peer_read_v1',
            {
              _thread_id:
                containerId,
            }
          );

        if (result.error) {
          setDirectPeerReadAt(
            null
          );
          return;
        }

        const raw =
          Array.isArray(
            result.data
          )
            ? result.data[0]
            : result.data;

        const value =
          typeof raw === 'string'
            ? raw
            : raw?.last_read_at ??
              raw?.buklod_connect_direct_peer_read_v1 ??
              null;

        setDirectPeerReadAt(
          value
            ? String(value)
            : null
        );
      },
      [
        containerId,
        mode,
        profileId,
      ]
    );

  const load =
    useCallback(
      async () => {
        if (
          !containerId ||
          !profileId
        ) {
          return;
        }

        if (
          mode === 'direct'
        ) {
          const details =
            await (
              supabase as any
            ).rpc(
              'buklod_connect_direct_thread_details',
              {
                _thread_id:
                  containerId,
              }
            );

          if (details.error) {
            Alert.alert(
              'Connect',
              details.error.message
            );

            router.back();
            return;
          }

          const d =
            Array.isArray(
              details.data
            )
              ? details.data[0]
              : details.data;

          setTitle(
            d?.other_user_name ||
              'Connect'
          );

          setSubtitle(
            'PERSONAL'
          );

          setOtherUserId(
            d?.other_user_id ??
              null
          );

          const rows =
            await (
              supabase as any
            )
              .from(
                'buklod_connect_direct_messages'
              )
              .select(
                'id,sender_id,body,attachment_path,attachment_name,attachment_mime,attachment_size,created_at'
              )
              .eq(
                'thread_id',
                containerId
              )
              .order(
                'created_at',
                {
                  ascending: true,
                }
              )
              .limit(300);

          if (!rows.error) {
            setMessages(
              rows.data ?? []
            );
          }

          await (
            supabase as any
          ).rpc(
            'buklod_connect_mark_direct_read',
            {
              _thread_id:
                containerId,
            }
          );
        }
        else {
          const details =
            await (
              supabase as any
            ).rpc(
              'buklod_connect_room_details',
              {
                _scope_id:
                  containerId,
              }
            );

          if (details.error) {
            Alert.alert(
              'Community Connect',
              details.error.message
            );

            router.back();
            return;
          }

          const d =
            Array.isArray(
              details.data
            )
              ? details.data[0]
              : details.data;

          setTitle(
            d?.scope_name ||
              'Community Connect'
          );

          setSubtitle(
            d?.scope_type ===
            'LOCAL'
              ? 'BARANGAY ' + String.fromCodePoint(0x2022) + ' AUTOMATIC ROOM'
              : `${
                  d?.scope_type ??
                  'COMMUNITY'
                } ${String.fromCodePoint(0x2022)} AUTOMATIC ROOM`
          );

          const rows =
            await (
              supabase as any
            ).rpc(
              'buklod_connect_scope_messages_v1',
              {
                _scope_id:
                  containerId,
                _limit: 300,
              }
            );

          if (!rows.error) {
            setMessages(
              rows.data ?? []
            );
          }

          await (
            supabase as any
          ).rpc(
            'buklod_connect_mark_scope_read',
            {
              _scope_id:
                containerId,
            }
          );
        }

        await loadReactions();

        setLoading(false);

        requestAnimationFrame(
          () =>
            listRef.current
              ?.scrollToEnd({
                animated: false,
              })
        );
      },
      [
        containerId,
        loadReactions,
        mode,
        profileId,
      ]
    );

  useEffect(() => {
    void load();

    if (
      !containerId ||
      !profileId
    ) {
      return;
    }

    const messageTable =
      mode === 'direct'
        ? 'buklod_connect_direct_messages'
        : 'buklod_connect_scope_messages';

    const messageFilter =
      mode === 'direct'
        ? `thread_id=eq.${containerId}`
        : `scope_id=eq.${containerId}`;

    const reactionTable =
      mode === 'direct'
        ? 'buklod_connect_direct_message_reactions'
        : 'buklod_connect_scope_message_reactions';

    const reactionFilter =
      mode === 'direct'
        ? `thread_id=eq.${containerId}`
        : `scope_id=eq.${containerId}`;

    const channel =
      supabase
        .channel(
          `connect-${mode}-${containerId}`
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table:
              messageTable,
            filter:
              messageFilter,
          },
          () => void load()
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table:
              reactionTable,
            filter:
              reactionFilter,
          },
          () =>
            void loadReactions()
        )
        .subscribe();

    return () => {
      void supabase
        .removeChannel(
          channel
        );
    };
  }, [
    containerId,
    load,
    loadReactions,
    mode,
    profileId,
  ]);

  useEffect(() => {
    if (
      mode !== 'direct'
    ) {
      return;
    }

    void loadPeerRead();

    const timer =
      setInterval(
        () => {
          void loadPeerRead();
        },
        4000
      );

    return () =>
      clearInterval(timer);
  }, [
    loadPeerRead,
    mode,
  ]);

  useEffect(() => {
    let active = true;

    const pending =
      messages.filter(
        item =>
          !!item.attachment_path &&
          String(
            item.attachment_mime ??
            ''
          ).startsWith(
            'image/'
          ) &&
          !attachmentUrls[
            item.attachment_path!
          ]
      );

    if (!pending.length) {
      return;
    }

    void Promise.all(
      pending.map(
        async item => {
          const result =
            await supabase
              .storage
              .from(
                'connect-files'
              )
              .createSignedUrl(
                item
                  .attachment_path!,
                3600
              );

          return {
            path:
              item
                .attachment_path!,
            url:
              result.data
                ?.signedUrl ??
              null,
          };
        }
      )
    ).then(rows => {
      if (!active) {
        return;
      }

      setAttachmentUrls(
        current => {
          const next = {
            ...current,
          };

          for (
            const row of rows
          ) {
            if (
              row.url
            ) {
              next[
                row.path
              ] =
                row.url;
            }
          }

          return next;
        }
      );
    });

    return () => {
      active = false;
    };
  }, [
    attachmentUrls,
    messages,
  ]);

  const closeOptionMenu =
    () => {
      setOptionMenu(null);
      setReactionTargetId(null);
    };

  const chooseFile =
    async () => {
      closeOptionMenu();

      try {
        const picked =
          await pickConnectFile();

        if (picked) {
          setFile(picked);
        }
      }
      catch (e: any) {
        Alert.alert(
          'Attachment',
          e?.message ||
            String(e)
        );
      }
    };
  /* PATCH_186B_PHOTO_EDITOR_CONNECT_FLOW */
  const choosePhoto =
    async () => {
      closeOptionMenu();

      try {
        const picked =
          await pickConnectPhoto();

        if (picked) {
          setPhotoEditorSource(
            picked
          );
        }
      }
      catch (e: any) {
        Alert.alert(
          'Photo',
          e?.message ||
            String(e)
        );
      }
    };

  const attachLongPress =
    useRef(false);
  const attachResetTimer =
    useRef<
      ReturnType<
        typeof setTimeout
      > | null
    >(null);
  const [
    attachPopoverOpen,
    setAttachPopoverOpen,
  ] =
    useState(false);
  /* PATCH_172A_R7_INLINE_ATTACH_POPOVER */
  const openAttachMenu =
    () => {
      attachLongPress.current =
        true;

      if (
        attachResetTimer.current
      ) {
        clearTimeout(
          attachResetTimer.current
        );
      }

      attachResetTimer.current =
        setTimeout(
          () => {
            attachLongPress.current =
              false;
            attachResetTimer.current =
              null;
          },
          900
        );

      setAttachPopoverOpen(
        true
      );
    };

  const handleAttachPress =
    () => {
      if (
        attachLongPress.current
      ) {
        attachLongPress.current =
          false;
        return;
      }

      if (
        attachPopoverOpen
      ) {
        setAttachPopoverOpen(
          false
        );
        return;
      }

      void chooseFile();
    };

  const openReactionMenu =
    (
      messageId: string
    ) => {
      setOptionMenu(null);
      setReactionTargetId(
        current =>
          current ===
          messageId
            ? null
            : messageId
      );
    };

  /* PATCH_167L_R7_OPTIMISTIC_REACTION */
  const reactToMessage =
    async (
      messageId: string,
      reaction: ReactionKey
    ) => {
      /* UI_002_R11_R3_CLOSE_PICKER */
      setReactionTargetId(
        null
      );
      setOptionMenu(
        null
      );

      if (!profileId) {
        return;
      }

      const previous =
        reactions[
          messageId
        ] ?? {
          counts:
            emptyCounts(),
          mine: null,
        };

      const previousSnapshot:
        ReactionSummary = {
          counts: {
            ...previous.counts,
          },
          mine:
            previous.mine,
        };

      const nextMine:
        ReactionKey | null =
          previous.mine ===
          reaction
            ? null
            : reaction;

      const nextCounts = {
        ...previous.counts,
      };

      if (
        previous.mine
      ) {
        nextCounts[
          previous.mine
        ] =
          Math.max(
            0,
            (
              nextCounts[
                previous.mine
              ] ?? 0
            ) - 1
          );
      }

      if (
        nextMine
      ) {
        nextCounts[
          nextMine
        ] =
          (
            nextCounts[
              nextMine
            ] ?? 0
          ) + 1;
      }

      setReactions(
        current => ({
          ...current,
          [messageId]: {
            counts:
              nextCounts,
            mine:
              nextMine,
          },
        })
      );

      setReactionTargetId(
        null
      );

      try {
        const result =
          await (
            supabase as any
          ).rpc(
            'buklod_connect_set_reaction',
            {
              _mode: mode,
              _container_id:
                containerId,
              _message_id:
                messageId,
              _reaction:
                reaction,
            }
          );

        if (result.error) {
          throw result.error;
        }

        /* PATCH_167L_R10: realtime sync only; no immediate reaction refetch. */
      }
      catch (e: any) {
        setReactions(
          current => ({
            ...current,
            [messageId]:
              previousSnapshot,
          })
        );

        const message =
          String(
            e?.message ??
            e ??
            'Could not save reaction.'
          );

        const backendMissing =
          /buklod_connect_set_reaction|schema cache|does not exist|could not find the function/i
            .test(message);

        Alert.alert(
          'Reaction',
          backendMissing
            ? 'Reaction database update is not active yet. Run the Supabase database migration, then try again.'
            : message
        );
      }
    };

  const appendNotSent =
    (
      text: string,
      attachmentName:
        string | null =
          null
    ) => {
      if (!profileId) {
        return;
      }

      setMessages(
        current => [
          ...current,
          {
            id:
              `local-not-sent-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,
            sender_id:
              profileId,
            body:
              text,
            attachment_path:
              null,
            attachment_name:
              attachmentName,
            attachment_mime:
              null,
            attachment_size:
              null,
            created_at:
              new Date()
                .toISOString(),
            delivery_state:
              'not_sent',
          },
        ]
      );
    };

  const sendQuickBody =
    async (
      text: string
    ) => {
      if (
        mode !== 'direct' ||
        !profileId ||
        sending ||
        !text.trim()
      ) {
        return;
      }

      setComposerQuickOpen(
        false
      );
      setComposerPickerOpen(
        false
      );
      setSending(true);

      try {
        const result =
          await (
            supabase as any
          )
            .from(
              'buklod_connect_direct_messages'
            )
            .insert({
              thread_id:
                containerId,
              sender_id:
                profileId,
              body:
                text.trim(),
              attachment_path:
                null,
              attachment_name:
                null,
              attachment_mime:
                null,
              attachment_size:
                null,
            });

        if (result.error) {
          throw result.error;
        }

        await load();
      }
      catch (e: any) {
        appendNotSent(
          text
        );

        Alert.alert(
          'Send Message',
          e?.message ||
            String(e)
        );
      }
      finally {
        setSending(false);
      }
    };

  const chooseAndSendGif =
    async () => {
      if (
        mode !== 'direct' ||
        !profileId ||
        sending
      ) {
        return;
      }

      setComposerPickerOpen(
        false
      );
      setComposerQuickOpen(
        false
      );

      let picked:
        ConnectPickedFile | null =
          null;

      try {
        picked =
          await pickConnectGif();

        if (!picked) {
          return;
        }

        setSending(true);

        const uploaded =
          await uploadConnectFile(
            {
              mode: 'direct',
              containerId,
              file:
                picked,
            }
          );

        const result =
          await (
            supabase as any
          )
            .from(
              'buklod_connect_direct_messages'
            )
            .insert({
              thread_id:
                containerId,
              sender_id:
                profileId,
              body: '',
              attachment_path:
                uploaded.path,
              attachment_name:
                uploaded.name,
              attachment_mime:
                'image/gif',
              attachment_size:
                uploaded.size,
            });

        if (result.error) {
          throw result.error;
        }

        await load();
      }
      catch (e: any) {
        appendNotSent(
          'GIF',
          picked?.name ??
            null
        );

        Alert.alert(
          'GIF',
          e?.message ||
            String(e)
        );
      }
      finally {
        setSending(false);
      }
    };

  const sendAvatarReaction =
    (
      key: string
    ) =>
      void sendQuickBody(
        `${AVATAR_REACTION_PREFIX}${key}]]`
      );

  const send =
    async () => {
      if (
        !profileId ||
        sending
      ) {
        return;
      }

      const text =
        draft.trim();

      if (
        !text &&
        !file
      ) {
        return;
      }

      setSending(true);

      try {
        const uploaded =
          file
            ? await uploadConnectFile(
                {
                  mode,
                  containerId,
                  file,
                }
              )
            : null;

        const table =
          mode === 'direct'
            ? 'buklod_connect_direct_messages'
            : 'buklod_connect_scope_messages';

        const payload: any = {
          sender_id:
            profileId,
          body: text,
          attachment_path:
            uploaded?.path ??
            null,
          attachment_name:
            uploaded?.name ??
            null,
          attachment_mime:
            uploaded?.mimeType ??
            null,
          attachment_size:
            uploaded?.size ??
            null,
        };

        if (
          mode === 'direct'
        ) {
          payload.thread_id =
            containerId;
        }
        else {
          payload.scope_id =
            containerId;
        }

        const result =
          await (
            supabase as any
          )
            .from(table)
            .insert(payload);

        if (result.error) {
          throw result.error;
        }

        setDraft('');
        setFile(null);

        await load();
      }
      catch (e: any) {
        /* PATCH_172A_NORMAL_SEND_FAILURE */
        appendNotSent(
          text ||
            (
              file
                ? 'Attachment'
                : 'Message'
            ),
          file?.name ??
            null
        );

        Alert.alert(
          'Send Message',
          e?.message ||
            String(e)
        );
      }
      finally {
        setSending(false);
      }
    };

  /* PATCH_172H_ORGANIZATION_SCOPE_FLAG */
  const organizationScope =
    mode === 'scope' &&
    (
      subtitle
        .toUpperCase()
        .startsWith(
          'ORGANIZATION'
        ) ||
      subtitle
        .toUpperCase()
        .startsWith(
          'SUB_ORGANIZATION'
        ) ||
      subtitle
        .toUpperCase()
        .startsWith(
          'SUB-ORGANIZATION'
        ) ||
      subtitle
        .toUpperCase()
        .startsWith(
          'SUB ORG'
        ) ||
      subtitle
        .toUpperCase()
        .startsWith(
          'SUB_ORG'
        ) ||
      subtitle
        .toUpperCase()
        .startsWith(
          'SUB-ORG'
        )
    );

  /* PATCH_172I_CLUSTER_SCOPE_FLAG */
  const clusterScope =
    mode === 'scope' &&
    subtitle
      .toUpperCase()
      .startsWith(
        'CLUSTER'
      );

  const managedCompactScope =
    organizationScope ||
    clusterScope;

  if (loading && mode !== 'direct' /* PATCH_185A_R2_DIRECT_THREAD_NO_BLOCKING_SPINNER */) {
    return (
      <View
        style={
          styles.center
        }
      >
        <ActivityIndicator
          color={
            colors.green
          }
        />
      </View>
    );
  }

  return (
    <View
      /* PATCH_169H_TOP_SAFE_AREA */
      style={[
        {
          /* UI_002_R10_TINY_BOTTOM_CLEARANCE */
          height: Math.min(Math.max(insets.bottom, 0), 6),
          backgroundColor: '#FFFFFF',
        },
        {
          /* UI_002_R10_R3_PARENT_FILL */
          flex: 1,
        },
      ]}
    >
      <View
        style={
          [
        styles.header,
        {
          /* UI_002_R13_R3_MESSAGES_TOP_SAFE */
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: 8,
          minHeight: 58 + Math.max(insets.top, 12),
          overflow: 'visible',
        },
      ]
        }
      >
        <Pressable
          onPress={
            () =>
              router.back()
          }
          style={
            styles.headerButton
          }
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={23}
            color={
              colors.greenDark
            }
          />
        </Pressable>

        <View
          style={
            styles.headerCopy
          }
        >
          <Text
            numberOfLines={1}
            style={
              styles.headerTitle
            }
          >
            {title}
          </Text>

                  {/* PATCH_172G_ORG_HEADER_SUBTITLE */}
        {/* PATCH_172I_CLUSTER_SUBTITLE_MATCH */}
        {!managedCompactScope && (
          <Text
            style={
              styles.headerSub
            }
          >
            {subtitle}
          </Text>
        )}
        </View>

        {mode === 'direct' &&
        !!otherUserId ? (
          <View
            style={{
              flexDirection:
                'row',
              alignItems:
                'center',
              gap: 3,
              flexShrink: 0,
       marginLeft: 'auto',
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start voice call"
              disabled={
                directCallStarting !==
                null
              }
              onPress={() =>
                void startDirectCall(
                  'audio'
                )
              }
              hitSlop={8}
              style={[
                styles.headerButton,
                directCallStarting !==
                  null && {
                  opacity: 0.45,
                },
              ]}
            >
              {directCallStarting ===
              'audio' ? (
                <ActivityIndicator
                  size="small"
                  color={
                    colors.greenDark
                  }
                />
              ) : (
                <MaterialCommunityIcons
                  name="phone"
                  size={22}
                  color={
                    colors.greenDark
                  }
                />
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start video call"
              disabled={
                directCallStarting !==
                null
              }
              onPress={() =>
                void startDirectCall(
                  'video'
                )
              }
              hitSlop={8}
              style={[
                styles.headerButton,
                directCallStarting !==
                  null && {
                  opacity: 0.45,
                },
              ]}
            >
              {directCallStarting ===
              'video' ? (
                <ActivityIndicator
                  size="small"
                  color={
                    colors.greenDark
                  }
                />
              ) : (
                <MaterialCommunityIcons
                  name="video-outline"
                  size={24}
                  color={
                    colors.greenDark
                  }
                />
              )}
            </Pressable>
          </View>
        ) : (/* PATCH_172I_CLUSTER_HEADER_ACTIONS_MATCH */
          managedCompactScope &&
          officeEnabled) ? (
          <View
            /* PATCH_172H_HEADER_ACTIONS */
            style={
              styles.headerActions
            }
          >
            <Pressable
            accessibilityLabel="Open Organizer Office"
            onPress={() =>
              router.push({
                pathname:
                  '/office/[scopeId]',
                params: {
                  scopeId:
                    containerId,
                },
              } as any)
            }
            style={
              styles.headerButton
            }
          >
            <MaterialCommunityIcons
              name="briefcase-outline"
              size={23}
              color={
                colors.greenDark
              }
            />
          </Pressable>

            <BuklodScopeCallLauncher
              scopeId={
                containerId
              }
              title={
                title
              }
              compact
            />
          </View>
        ) : (
          <View
            style={
              styles.headerButton
            }
          >
            <MaterialCommunityIcons
              name="link-variant"
              size={21}
              color={
                colors.greenDark
              }
            />
          </View>
        )}
      </View>

      {/* PATCH_172G_ORG_AUTOMATIC_NOTE */}
      {/* PATCH_172I_CLUSTER_AUTO_ROOM_MATCH */}
      {!managedCompactScope && (
        mode === 'scope' &&
       !(
         subtitle.toUpperCase().startsWith('ORGANIZATION') ||
         subtitle.toUpperCase().startsWith('SUB_ORGANIZATION') ||
         subtitle.toUpperCase().startsWith('SUB-ORGANIZATION') ||
         subtitle.toUpperCase().startsWith('SUB ORG') ||
         subtitle.toUpperCase().startsWith('SUB_ORG') ||
         subtitle.toUpperCase().startsWith('SUB-ORG')
       ) && (
        <View
          style={
            styles.note
          }
        >
          <MaterialCommunityIcons
            name="shield-check-outline"
            size={17}
            color={
              colors.greenDark
            }
          />

          <Text
            style={
              styles.noteText
            }
          >
            Automatic room. It cannot be manually left while your membership is active.
          </Text>
        </View>
      )
      )}

      {/* PATCH_172G_ORG_OFFICE_ROW */}
      {/* PATCH_172I_CLUSTER_OFFICE_ROW_MATCH */}
      {!managedCompactScope && (
        mode === 'scope' &&
       officeEnabled &&
       subtitle.toUpperCase().startsWith('CLUSTER') && (
        <Pressable
          accessibilityLabel="Open Organizer Office files"
          onPress={() =>
            router.push({
              pathname:
                '/office/[scopeId]',
              params: {
                scopeId:
                  containerId,
              },
            } as any)
          }
          style={
            styles.note
          }
        >
          <MaterialCommunityIcons
            name="folder-multiple-outline"
            size={18}
            color={
              colors.greenDark
            }
          />

          <Text
            style={
              styles.noteText
            }
          >
            Organizer Office {String.fromCodePoint(0x2022)} Files, folders, reports, forms, archive and secure sharing
          </Text>

          <MaterialCommunityIcons
            name="chevron-right"
            size={19}
            color={
              colors.greenDark
            }
          />
        </Pressable>
      )
      )}
      {/* PATCH_168E_SCOPE_CONNECT_CALLS_MOUNT */}
      {/* PATCH_172H_ORG_NO_CALL_CARD */}
      {/* PATCH_172I_CLUSTER_NO_CALL_CARD */}
      {!managedCompactScope && (
        mode === 'scope' &&
      !organizationScope ? (
        <BuklodScopeCallLauncher
          scopeId={containerId}
          title={title}
        />
      ) : null
      )}
<FlatList
        ref={listRef}
        data={messages}
        keyExtractor={
          item =>
            item.id
        }
        contentContainerStyle={
          styles.messages
        }
        onContentSizeChange={
          () =>
            listRef.current
              ?.scrollToEnd({
                animated: true,
              })
        }
        ListEmptyComponent={
          <View
            style={
              styles.empty
            }
          >
            <Text
              style={
                styles.emptyTitle
              }
            >
              Start the conversation
            </Text>
          </View>
        }
        renderItem={({
          item,
        }) => {
          const own =
            item.sender_id ===
            profileId;

          const summary =
            reactions[
              item.id
            ] ?? {
              counts:
                emptyCounts(),
              mine: null,
            };

          const totalReactions =
            REACTION_KEYS.reduce(
              (
                total,
                key
              ) =>
                total +
                (
                  summary.counts[
                    key
                  ] ??
                  0
                ),
              0
            );

          const hasMine =
            summary.mine !==
            null;

          const mineReaction =
            summary.mine
              ? REACTIONS.find(
                  reaction =>
                    reaction.key ===
                    summary.mine
                ) ?? null
              : null;

          const isPhoto =
            String(
              item
                .attachment_mime ??
                ''
            ).startsWith(
              'image/'
            );

          /* PATCH_172A_AVATAR_BUBBLE */
          const avatarReaction =
            parseAvatarReaction(
              item.body
            );

          /* PATCH_172A_R5_STANDALONE_REACTION */
          const standaloneEmojiReaction =
            mode === 'direct' &&
            !avatarReaction &&
            !item.attachment_path &&
            (
              (
                QUICK_SEND_EMOJIS as readonly string[]
              ).includes(
                item.body.trim()
              ) ||
              (
                EXTENDED_SEND_EMOJIS as readonly string[]
              ).includes(
                item.body.trim()
              )
            );

          const standaloneReaction =
            mode === 'direct' &&
            (
              !!avatarReaction ||
              standaloneEmojiReaction
            );
          const imageUrl =
            item.attachment_path
              ? attachmentUrls[
                  item
                    .attachment_path
                ] ??
                null
              : null;
          return (
            <View
              style={[
                styles.wrap,
                own
                  ? styles.own
                  : styles.other,
              ]}
            >
          {/* PATCH_180A_R4_CHAT_BUBBLE_PROFILE_PICTURE */}
          {/* PATCH_180A_R6_CHAT_AVATARS_BOTH_SIDES */}
          {mode === 'direct' && (
            <View
              pointerEvents="none"
              style={[
                styles.messageSenderAvatar,
                own &&
                  styles.messageSenderAvatarOwn,
              ]}
            >
              <ProfileAvatar
                userId={item.sender_id}
                name={
                  own
                    ? (
                        (profile as any)
                          ?.full_name ||
                        'You'
                      )
                    : (
                        item.sender_name ||
                        title ||
                        'BUKLOD Member'
                      )
                }
                size={36}
              />
            </View>
          )}

              <Pressable
                style={[
                  styles.bubble,
                  own
                    ? styles.bubbleOwn
                    : styles.bubbleOther,
                  standaloneReaction &&
                    styles.standaloneReactionBubble,
                  mode === 'direct' &&
                    (
                      own
                        ? styles.bubbleWithSenderAvatarOwn
                        : styles.bubbleWithSenderAvatar
                    ),

                ]}
              
                onLongPress={() => {
                  /* UI_002_R11_R3_LONG_PRESS */
                  openReactionMenu(
                    item.id
                  );
                }}
                delayLongPress={280}
                accessibilityHint="Long press for reactions.">
                {mode ===
                  'scope' &&
                !own &&
                !!item.sender_name && (
                  <Text
                    style={
                      styles.sender
                    }
                  >
                    {
                      repairBuklodMessageText(item.sender_name)
                    }
                  </Text>
                )}

                                {avatarReaction && (
                  <View
                    style={
                      styles.avatarSticker
                    }
                  >
                    <View
                      style={
                        styles.avatarStickerVisual
                      }
                    >
                      <ProfileAvatar
                        userId={
                          item.sender_id
                        }
                        name={
                          own
                            ? (
                                (profile as any)
                                  ?.full_name ||
                                'You'
                              )
                            : (
                                item.sender_name ||
                                title ||
                                'BUKLOD Member'
                              )
                        }
                        size={58}
                      />

                      <Text
                        style={
                          styles.avatarStickerEmoji
                        }
                      >
                        {
                          avatarReaction.emoji
                        }
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.avatarStickerLabel,
                        own &&
                          styles.avatarStickerLabelOwn,
                      ]}
                    >
                      {
                        avatarReaction.label
                      }
                    </Text>
                  </View>
                )}
                {standaloneEmojiReaction && (
                  <Text
                    style={
                      styles.standaloneReactionText
                    }
                  >
                    {
                      repairBuklodMessageText(item.body).trim()
                    }
                  </Text>
                )}
{!avatarReaction && !standaloneEmojiReaction && !!item.body && (
                  <>
                  
                  <>
                  {/* PATCH_185A_R5_SHARED_POST_PREVIEW_RENDER */}
                  <BuklodSharedPostPhotoPreview185AR5
                    body={item.body}
                  />
                  <Text
                    style={[
                      styles.body,
                      own &&
                        styles.bodyOwn,
                    ]}
                  >
                    {repairMojibakeText(repairBuklodMessageText(cleanSharedPostBody(item.body)))}
                  </Text>
                </>
                </>
                )}

                                {isPhoto &&
                  !!item.attachment_path &&
                  !!imageUrl && (
                  <Pressable
                    accessibilityLabel={
                      item.attachment_mime ===
                        'image/gif'
                        ? 'Open animated GIF'
                        : 'Open photo'
                    }
                    onPress={() =>
                      void openConnectAttachment(
                        item.attachment_path!
                      )
                    }
                    style={
                      styles.inlineMediaPress
                    }
                  
                    onLongPress={() => {
                      /* UI_002_R11_R4_NESTED_REACTIVE */
                      openReactionMenu(
                        item.id
                      );
                    }}
                    delayLongPress={280}>
                    <ExpoImage
                      source={{
                        uri: imageUrl,
                      }}
                      style={
                        styles.inlineMedia
                      }
                      contentFit="cover"
                      transition={120}
                    />

                    {item.attachment_mime ===
                      'image/gif' && (
                      <View
                        style={
                          styles.gifBadge
                        }
                      >
                        <Text
                          style={
                            styles.gifBadgeText
                          }
                        >
                          GIF
                        </Text>
                      </View>
                    )}
                  </Pressable>
                )}
{!!item.attachment_path && !isPhoto && (
                  <Pressable
                    accessibilityLabel={
                      isPhoto
                        ? 'Open photo'
                        : 'Open attachment'
                    }
                    onPress={() =>
                      void openConnectAttachment(
                        item
                          .attachment_path!
                      ).catch(
                        (e: any) =>
                          Alert.alert(
                            isPhoto
                              ? 'Photo'
                              : 'Attachment',
                            e?.message ||
                              String(
                                e
                              )
                          )
                      )
                    }
                    style={[
                      styles.fileChip,
                      own &&
                        styles
                          .fileChipOwn,
                    ]}
                  
                    onLongPress={() => {
                      /* UI_002_R11_R4_NESTED_REACTIVE */
                      openReactionMenu(
                        item.id
                      );
                    }}
                    delayLongPress={280}>
                    <MaterialCommunityIcons
                      name={
                        isPhoto
                          ? 'image-outline'
                          : 'paperclip'
                      }
                      size={18}
                      color={
                        own
                          ? '#FFFFFF'
                          : colors
                              .greenDark
                      }
                    />

                    <View
                      style={{
                        flex: 1,
                      }}
                    >
                      <Text
                        numberOfLines={
                          1
                        }
                        style={[
                          styles
                            .fileName,
                          own &&
                            styles
                              .white,
                        ]}
                      >
                        {
                          item
                            .attachment_name ||
                          (
                            isPhoto
                              ? 'Photo'
                              : 'Attachment'
                          )
                        }
                      </Text>

                      <Text
                        style={[
                          styles
                            .fileSize,
                          own &&
                            styles
                              .whiteSoft,
                        ]}
                      >
                        {
                          formatConnectBytes(
                            item
                              .attachment_size
                          )
                        }
                      </Text>
                    </View>
                  </Pressable>
                )}

                                <View
                  style={
                    styles.timeRow
                  }
                >
                  <Text
                    style={[
                      styles.time,
                      own &&
                        !standaloneReaction &&
                        styles.whiteSoft,
                    ]}
                  >
                    {
                      formatConnectTimestamp(
                        item.created_at
                      )
                    }
                  </Text>

                  {own &&
                    mode ===
                      'direct' && (
                    <Text
                      style={[
                        styles.deliveryState,
                        standaloneReaction &&
                          styles.deliveryStandalone,
                        item.delivery_state ===
                          'not_sent' &&
                          styles.deliveryNotSent,
                      ]}
                    >
                      {
                        item.delivery_state ===
                          'not_sent'
                          ? '\u2022 Not sent'
                          : (
                              directPeerReadAt &&
                              new Date(
                                directPeerReadAt
                              ).getTime() >=
                                new Date(
                                  item.created_at
                                ).getTime()
                            )
                          ? '\u2022 Seen'
                          : '\u2022 Sent'
                      }
                    </Text>
                  )}
                </View>
              </Pressable>

              <View
                style={[
                  styles
                    .reactionRow,
                  own
                    ? styles
                        .reactionRowOwn
                    : styles
                        .reactionRowOther,
                , {
          /* UI_002_R11_R3_FAR_CORNER */
          position: 'absolute',
          bottom: -5,
          overflow: 'visible',
          zIndex: 70,
          ...(own
            ? {
                right: 0,
                alignItems: 'flex-end',
              }
            : {
                left: 0,
                alignItems: 'flex-start',
              }),
        }]}
              >
                {/* UI_002_R11_R3_PASSIVE_STAMP */}
                {totalReactions > 0 && (
                  <View
                    pointerEvents="none"
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: 22,
                      paddingHorizontal: 2,
                      gap: 1,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 18,
                        lineHeight: 22,
                        textAlign: 'center',
                      }}
                    >
                      {
                        (
                          summary.mine
                            ? REACTIONS.find(
                                r =>
                                  r.key ===
                                  summary.mine
                              )
                            : REACTIONS.find(
                                r =>
                                  (
                                    summary.counts[
                                      r.key
                                    ] ?? 0
                                  ) > 0
                              )
                        )?.emoji ?? ''
                      }
                    </Text>
                
                    {totalReactions > 1 && (
                      <Text
                        style={{
                          fontSize: 8,
                          lineHeight: 10,
                          fontWeight: '900',
                          color: '#59665F',
                          marginLeft: -1,
                        }}
                      >
                        {
                          totalReactions > 99
                            ? '99+'
                            : totalReactions
                        }
                      </Text>
                    )}
                  </View>
                )}

                {reactionTargetId ===
                  item.id && (
                  <View
                    style={[
                      styles
                        .reactionInlinePicker,
                      own
                        ? styles
                            .reactionInlinePickerOwn
                        : styles
                            .reactionInlinePickerOther,
                    ]}
                  >
                    {REACTIONS.map(
                      reaction => {
                        const selected =
                          summary.mine ===
                          reaction.key;

                        const count =
                          summary.counts[
                            reaction.key
                          ] ?? 0;

                        return (
                          <Pressable
                            key={
                              reaction.key
                            }
                            accessibilityRole="button"
                            accessibilityLabel={
                              reaction.label
                            }
                            onPressIn={() =>
                              void reactToMessage(
                                item.id,
                                reaction.key
                              )
                            }
                            style={({
                              pressed,
                            }) => [
                              styles
                                .reactionInlineOption,
                              selected &&
                                styles
                                  .reactionInlineOptionSelected,
                              pressed && {
                                opacity:
                                  0.58,
                              },
                            ]}
                          >
                            <Text
                              style={
                                styles
                                  .reactionInlineEmoji
                              }
                            >
                              {
                                reaction.emoji
                              }
                            </Text>

                            {count >
                              0 && (
                              <Text
                                style={[
                                  styles
                                    .reactionInlineCount,
                                  selected &&
                                    styles
                                      .reactionInlineCountSelected,
                                ]}
                              >
                                {count}
                              </Text>
                            )}
                          </Pressable>
                        );
                      }
                    )}
                  </View>
                )}
              </View>
            </View>
          );
        }}
      />

      {!!file && (
        <View
          style={
            styles.selectedFile
          }
        >
          <MaterialCommunityIcons
            name={
              file.mimeType
                .toLowerCase()
                .startsWith(
                  'image/'
                )
                ? 'image-outline'
                : 'file-outline'
            }
            size={19}
            color={
              colors.greenDark
            }
          />

          <View
            style={{
              flex: 1,
            }}
          >
            <Text
              numberOfLines={1}
              style={
                styles.selectedName
              }
            >
              {file.name}
            </Text>

            <Text
              style={
                styles.selectedSize
              }
            >
              {
                formatConnectBytes(
                  file.size
                )
              }
            </Text>
          </View>

          <Pressable
            onPress={() =>
              setFile(null)
            }
          >
            <MaterialCommunityIcons
              name="close"
              size={21}
              color={
                colors.muted
              }
            />
          </Pressable>
        </View>
      )}

      <View
        /* PATCH_169H_COMPACT_COMPOSER */
        style={
          [
        styles.composer,
        {
          /* UI_002_R10_R3_COMPOSER_BOTTOM */
          marginTop: 'auto',
        },
      ]
        }
      >
                <View
          style={
            styles.attachPopoverWrap
          }
        >
          <Pressable
            onPress={
              handleAttachPress
            }
            onLongPress={
              openAttachMenu
            }
            delayLongPress={360}
            accessibilityLabel="Attach"
            accessibilityHint="Tap for a file. Long press for Photo or File beside this button without closing the keyboard."
            style={
              styles.attach
            }
          >
            <MaterialCommunityIcons
              name="paperclip"
              size={22}
              color={
                colors.greenDark
              }
            />
          </Pressable>

          {attachPopoverOpen && (
            <View
              style={
                styles.attachInlinePopover
              }
            >
              <Pressable
                accessibilityLabel="Attach photo"
                onPress={() => {
                  setAttachPopoverOpen(
                    false
                  );
                  void choosePhoto();
                }}
                style={
                  styles.attachPopoverAction
                }
              >
                <MaterialCommunityIcons
                  name="image-outline"
                  size={19}
                  color={
                    colors.greenDark
                  }
                />
                <Text
                  style={
                    styles.attachPopoverText
                  }
                >
                  Photo
                </Text>
              </Pressable>

              <View
                style={
                  styles.attachPopoverDivider
                }
              />

              <Pressable
                accessibilityLabel="Attach file"
                onPress={() => {
                  setAttachPopoverOpen(
                    false
                  );
                  void chooseFile();
                }}
                style={
                  styles.attachPopoverAction
                }
              >
                <MaterialCommunityIcons
                  name="file-outline"
                  size={19}
                  color={
                    colors.greenDark
                  }
                />
                <Text
                  style={
                    styles.attachPopoverText
                  }
                >
                  File
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {mode ===
          'direct' && (
          <View
            style={
              styles
                .composerReactionWrap
            }
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Emoji, GIF and avatar reactions"
              accessibilityHint="Tap for quick emoji. Long press for the full Emoji, GIF and Avatar Reaction picker."
              onPress={() =>
                setComposerQuickOpen(
                  current =>
                    !current
                )
              }
              onLongPress={() => {
                setComposerQuickOpen(
                  false
                );
                setComposerPickerTab(
                  'emoji'
                );
                setComposerPickerOpen(
                  true
                );
              }}
              delayLongPress={330}
              style={
                styles
                  .composerReactionButton
              }
            >
              <Text
                style={
                  styles
                    .composerReactionEmoji
                }
              >
                {'\u{1F642}'}
              </Text>
            </Pressable>

            {composerQuickOpen && (
              <View
                style={
                  styles.quickEmojiTray
                }
              >
                {QUICK_SEND_EMOJIS
                  .map(emoji => (
                    <Pressable
                      key={emoji}
                      onPress={() =>
                        void sendQuickBody(
                          emoji
                        )
                      }
                      style={
                        styles
                          .quickEmojiButton
                      }
                    >
                      <Text
                        style={
                          styles
                            .quickEmojiText
                        }
                      >
                        {emoji}
                      </Text>
                    </Pressable>
                  ))}

                <Pressable
                  accessibilityLabel="More reactions"
                  onPress={() => {
                    setComposerQuickOpen(
                      false
                    );
                    setComposerPickerOpen(
                      true
                    );
                  }}
                  style={
                    styles
                      .quickEmojiMore
                  }
                >
                  <MaterialCommunityIcons
                    name="dots-horizontal"
                    size={19}
                    color={
                      colors.greenDark
                    }
                  />
                </Pressable>
              </View>
            )}
          </View>
        )}
        <TextInput
          ref={composerInputRef}
          value={draft}
          onChangeText={
            setDraft
          }
          placeholder={
            mode === 'direct'
              ? 'Message...'
              : 'Message community...'
          }
          multiline
          style={
            styles.input
          }
        />

        <Pressable
          disabled={
            sending
          }
          onPress={
            () =>
              void send()
          }
          style={[
            styles.send,
            sending && {
              opacity: 0.5,
            },
          ]}
        >
          {sending ? (
            <ActivityIndicator
              size="small"
              color="#FFFFFF"
            />
          ) : (
            <MaterialCommunityIcons
              name="send"
              size={20}
              color="#FFFFFF"
            />
          )}
        </Pressable>
      </View>
      {/* PATCH_169H_BOTTOM_SAFE_SPACER */}
      <View
        style={{
          height: Math.min(Math.max(insets.bottom, 0), 6),
          backgroundColor:
            '#FFFFFF',
        }}
      />

      {/* PATCH_172A_FULL_REACTION_PICKER */}
      <Modal
        visible={
          composerPickerOpen
        }
        transparent
        animationType="slide"
        onRequestClose={() =>
          setComposerPickerOpen(
            false
          )
        }
      >
        <Pressable
          style={
            styles.modernPickerBackdrop
          }
          onPress={() =>
            setComposerPickerOpen(
              false
            )
          }
        >
          <Pressable
            style={
              styles.modernPickerSheet
            }
            onPress={event =>
              event.stopPropagation()
            }
          >
            <View
              style={
                styles.modernPickerHandle
              }
            />

            <View
              style={
                styles.modernPickerHeader
              }
            >
              <View
                style={{flex: 1}}
              >
                <Text
                  style={
                    styles.modernPickerTitle
                  }
                >
                  Reactions
                </Text>

                <Text
                  style={
                    styles.modernPickerSub
                  }
                >
                  Tap an item to send it instantly.
                </Text>
              </View>

              <Pressable
                onPress={() =>
                  setComposerPickerOpen(
                    false
                  )
                }
                style={
                  styles.modernPickerClose
                }
              >
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color={
                    colors.text
                  }
                />
              </Pressable>
            </View>

            <View
              style={
                styles.modernPickerTabs
              }
            >
              {(
                [
                  ['emoji','Emoji'],
                  ['gif','GIF'],
                  ['avatar','Avatar'],
                ] as const
              ).map(
                ([key,label]) => (
                  <Pressable
                    key={key}
                    onPress={() =>
                      setComposerPickerTab(
                        key
                      )
                    }
                    style={[
                      styles.modernPickerTab,
                      composerPickerTab ===
                        key &&
                        styles.modernPickerTabOn,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modernPickerTabText,
                        composerPickerTab ===
                          key &&
                          styles.modernPickerTabTextOn,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                )
              )}
            </View>

            {composerPickerTab ===
              'emoji' && (
              <>
                <Pressable
                  onPress={() => {
                    setComposerPickerOpen(
                      false
                    );

                    requestAnimationFrame(
                      () =>
                        composerInputRef
                          .current
                          ?.focus()
                    );
                  }}
                  style={
                    styles.nativeEmojiRow
                  }
                >
                  <MaterialCommunityIcons
                    name="keyboard-outline"
                    size={21}
                    color={
                      colors.greenDark
                    }
                  />

                  <View
                    style={{flex: 1}}
                  >
                    <Text
                      style={
                        styles.nativeEmojiTitle
                      }
                    >
                      Native device keyboard
                    </Text>

                    <Text
                      style={
                        styles.nativeEmojiSub
                      }
                    >
                      Access the complete emoji set available on this device.
                    </Text>
                  </View>
                </Pressable>

                <ScrollView
                  style={
                    styles.extendedEmojiScroll
                  }
                  contentContainerStyle={
                    styles.extendedEmojiGrid
                  }
                  keyboardShouldPersistTaps="handled"
                >
                  {EXTENDED_SEND_EMOJIS
                    .map(
                      (
                        emoji,
                        index
                      ) => (
                        <Pressable
                          key={
                            `${emoji}-${index}`
                          }
                          onPress={() =>
                            void sendQuickBody(
                              emoji
                            )
                          }
                          style={
                            styles.extendedEmojiButton
                          }
                        >
                          <Text
                            style={
                              styles.extendedEmojiText
                            }
                          >
                            {emoji}
                          </Text>
                        </Pressable>
                      )
                    )}
                </ScrollView>
              </>
            )}

            {composerPickerTab ===
              'gif' && (
              <View
                style={
                  styles.gifPickerPanel
                }
              >
                <Text
                  style={
                    styles.gifPickerIcon
                  }
                >
                  {'\u{1F3AC}'}
                </Text>

                <Text
                  style={
                    styles.gifPickerTitle
                  }
                >
                  Animated GIF
                </Text>

                <Text
                  style={
                    styles.gifPickerText
                  }
                >
                  Choose an animated GIF from your phone. Animation is preserved and sent through the private Connect media bucket.
                </Text>

                <Pressable
                  disabled={
                    sending
                  }
                  onPress={() =>
                    void chooseAndSendGif()
                  }
                  style={[
                    styles.gifPickerButton,
                    sending && {
                      opacity: 0.5,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="file-gif-box"
                    size={22}
                    color="#FFFFFF"
                  />

                  <Text
                    style={
                      styles.gifPickerButtonText
                    }
                  >
                    CHOOSE GIF
                  </Text>
                </Pressable>
              </View>
            )}

            {composerPickerTab ===
              'avatar' && (
              <ScrollView
                style={
                  styles.avatarReactionScroll
                }
                contentContainerStyle={
                  styles.avatarReactionGrid
                }
                keyboardShouldPersistTaps="handled"
              >
                {AVATAR_SEND_REACTIONS
                  .map(item => (
                    <Pressable
                      key={item.key}
                      onPress={() =>
                        sendAvatarReaction(
                          item.key
                        )
                      }
                      style={
                        styles.avatarReactionChoice
                      }
                    >
                      <View
                        style={
                          styles.avatarReactionPreview
                        }
                      >
                        <ProfileAvatar
                          userId={
                            profileId
                          }
                          name={
                            (profile as any)
                              ?.full_name ||
                            'You'
                          }
                          size={52}
                        />

                        <Text
                          style={
                            styles.avatarReactionBadge
                          }
                        >
                          {item.emoji}
                        </Text>
                      </View>

                      <Text
                        style={
                          styles.avatarReactionChoiceLabel
                        }
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        visible={
          optionMenu ===
          'attach'
        }
        transparent
        animationType="fade"
        onRequestClose={
          closeOptionMenu
        }
      >
        <Pressable
          style={
            styles.modalBackdrop
          }
          onPress={
            closeOptionMenu
          }
        >
          <Pressable
            style={
              styles.optionSheet
            }
            onPress={
              event =>
                event.stopPropagation()
            }
          >
            <View
              style={
                styles.sheetHandle
              }
            />

            <Text
              style={
                styles.sheetTitle
              }
            >
              Attach
            </Text>

            <Pressable
              onPress={() =>
                void choosePhoto()
              }
              style={
                styles.optionRow
              }
            >
              <MaterialCommunityIcons
                name="image-edit-outline"
                size={23}
                color={
                  colors.greenDark
                }
              />

              <View
                style={{
                  flex: 1,
                }}
              >
                <Text
                  style={
                    styles.optionTitle
                  }
                >
                  Photo
                </Text>

                <Text
                  style={
                    styles.optionSub
                  }
                >
                  Choose from Gallery, then crop/edit before attaching.
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() =>
                void chooseFile()
              }
              style={
                styles.optionRow
              }
            >
              <MaterialCommunityIcons
                name="file-outline"
                size={23}
                color={
                  colors.greenDark
                }
              />

              <View
                style={{
                  flex: 1,
                }}
              >
                <Text
                  style={
                    styles.optionTitle
                  }
                >
                  File
                </Text>

                <Text
                  style={
                    styles.optionSub
                  }
                >
                  Choose a document or other supported file.
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={
                closeOptionMenu
              }
              style={
                styles.cancelRow
              }
            >
              <Text
                style={
                  styles.cancelText
                }
              >
                Cancel
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    
        {/* PATCH_186B_PHOTO_EDITOR_CONNECT_MODAL */}
        <BuklodPhotoEditor
          visible={!!photoEditorSource}
          sourceUri={photoEditorSource?.uri ?? null}
          onCancel={() =>
            setPhotoEditorSource(null)
          }
          onDone={edited => {
            setFile({
              uri: edited.uri,
              name: `photo-${Date.now()}.jpg`,
              mimeType: edited.mimeType,
              size: edited.sizeBytes,
            });

            setPhotoEditorSource(null);
          }}
        />
</View>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor:
        '#F5F7F6',
    },

    center: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    header: {
      minHeight: 58,
      paddingHorizontal:
        10,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 8,
      borderBottomWidth:
        StyleSheet
          .hairlineWidth,
      borderBottomColor:
        colors.line,
      backgroundColor:
        '#FFFFFF',
    },

    /* PATCH_172H_HEADER_ACTION_STYLE */
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexShrink: 0,
    },

    headerButton: {
      width: 42,
      height: 42,
      borderRadius: 13,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.greenSoft,
    },

    headerCopy: {
      flex: 1,
      minWidth: 0,
    },

    headerTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '900',
    },

    headerSub: {
      marginTop: 1,
      color: colors.green,
      fontSize: 12,
      fontWeight: '900',
    },

    note: {
      minHeight: 42,
      paddingHorizontal:
        12,
      paddingVertical: 8,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 8,
      backgroundColor:
        '#ECF7F0',
    },

    noteText: {
      flex: 1,
      color:
        colors.greenDark,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '800',
    },

    messages: {
      padding: 12,
      paddingBottom: 18,
      flexGrow: 1,
      justifyContent:
        'flex-end',
    },

    empty: {
      alignItems:
        'center',
      paddingVertical: 40,
    },

    emptyTitle: {
      color: colors.text,
      fontSize: 15.5,
      fontWeight: '900',
    },

    wrap: {
      width: '100%',
      marginBottom: 22,
      position: 'relative',
      overflow: 'visible',
    },

    own: {
      alignItems:
        'flex-end',
    },

    other: {
      alignItems:
        'flex-start',
    },

    bubble: {
      maxWidth: '86%',
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 18,
      overflow: 'visible',
    },

    bubbleOwn: {
      backgroundColor:
        colors.greenDark,
      borderBottomRightRadius:
        5,
    },

    bubbleOther: {
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        colors.line,
      borderBottomLeftRadius:
        5,
    },

    sender: {
      marginBottom: 4,
      color: colors.green,
      fontSize: 12,
      fontWeight: '900',
    },

    body: {
      color: colors.text,
      fontSize: 14.5,
      lineHeight: 21,
    },

    bodyOwn: {
      color: '#FFFFFF',
    },

    time: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 12,
    },

    white: {
      color: '#FFFFFF',
    },

    whiteSoft: {
      color:
        'rgba(255,255,255,0.72)',
    },

    fileChip: {
      minWidth: 190,
      marginTop: 4,
      padding: 9,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 7,
      borderRadius: 11,
      backgroundColor:
        '#EEF6F1',
    },

    fileChipOwn: {
      backgroundColor:
        'rgba(255,255,255,0.13)',
    },

    fileName: {
      color:
        colors.greenDark,
      fontSize: 12.5,
      fontWeight: '900',
    },

    fileSize: {
      marginTop: 2,
      color: colors.muted,
      fontSize: 12,
    },

    reactionRow: {
      position: 'absolute',
      bottom: -14,
      height: 28,
      minHeight: 48,
      width: '88%',
      overflow: 'visible',
      zIndex: 40,
    },

    reactionRowOwn: {
      right: 0,
      alignItems:
        'flex-end',
    },

    reactionRowOther: {
      left: 0,
      alignItems:
        'flex-start',
    },

    reactionTrigger: {
      width: 30,
      height: 28,
      alignItems:
        'center',
      justifyContent:
        'center',
      position: 'relative',
      backgroundColor:
        'transparent',
      borderWidth: 0,
      padding: 0,
      margin: 0,
    },

    reactionTriggerActive: {
      backgroundColor:
        'transparent',
      borderWidth: 0,
    },

    reactionTriggerMine: {
      backgroundColor:
        'transparent',
      borderWidth: 0,
    },

    reactionTriggerEmoji: {
      fontSize: 18,
      lineHeight: 22,
      textAlign: 'center',
    },
    reactionBadge: {
      position: 'absolute',
      top: -6,
      right: -8,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 9,
      backgroundColor:
        colors.greenDark,
      borderWidth: 1.5,
      borderColor:
        '#FFFFFF',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    reactionBadgeText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '900',
    },


    reactionInlinePicker: {
      position: 'absolute',
      top: -2,
      height: 34,
      paddingHorizontal: 4,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 2,
      borderWidth: 1,
      borderColor:
        colors.line,
      borderRadius: 13,
      backgroundColor:
        '#FFFFFF',
      zIndex: 50,
      elevation: 16,
    },

    reactionInlinePickerOwn: {
      right: 28,
    },

    reactionInlinePickerOther: {
      left: 28,
    },

    reactionInlineOption: {
      minWidth: 32,
      height: 28,
      paddingHorizontal: 4,
      borderRadius: 14,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 2,
    },

    reactionInlineOptionSelected: {
      backgroundColor:
        colors.greenSoft,
      borderWidth: 1,
      borderColor:
        colors.greenDark,
    },

    reactionInlineEmoji: {
      fontSize: 16,
      lineHeight: 20,
    },

    reactionInlineCount: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: '900',
    },

    reactionInlineCountSelected: {
      color:
        colors.greenDark,
    },

    timeRow: {
      marginTop: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },

    deliveryState: {
      color:
        'rgba(255,255,255,0.76)',
      fontSize: 12,
      lineHeight: 12,
      fontWeight: '800',
    },

    deliveryNotSent: {
      color: '#FFD0CB',
    },

    inlineMediaPress: {
      width: 238,
      maxWidth: '100%',
      marginTop: 5,
      borderRadius: 15,
      overflow: 'hidden',
      position: 'relative',
      backgroundColor:
        'rgba(0,0,0,0.08)',
    },

    inlineMedia: {
      width: '100%',
      height: 220,
    },

    gifBadge: {
      position: 'absolute',
      right: 8,
      bottom: 8,
      minWidth: 34,
      height: 22,
      paddingHorizontal: 7,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        'rgba(0,0,0,0.68)',
    },

    gifBadgeText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '900',
    },

    avatarSticker: {
      minWidth: 112,
      alignItems: 'center',
      paddingVertical: 3,
    },

    avatarStickerVisual: {
      width: 90,
      height: 76,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },

    avatarStickerEmoji: {
      position: 'absolute',
      right: 1,
      bottom: 0,
      fontSize: 32,
      lineHeight: 36,
    },

    avatarStickerLabel: {
      marginTop: 3,
      color: colors.greenDark,
      fontSize: 12.5,
      fontWeight: '900',
    },

    avatarStickerLabelOwn: {
      color: colors.greenDark,
    },

    composerReactionWrap: {
      width: 38,
      height: 38,
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 90,
    },

    composerReactionButton: {
      width: 38,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },

    composerReactionEmoji: {
      fontSize: 23,
      lineHeight: 28,
    },

    quickEmojiTray: {
      position: 'absolute',
      left: 0,
      bottom: 44,
      minHeight: 44,
      paddingHorizontal: 5,
      paddingVertical: 4,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 1,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: '#FFFFFF',
      elevation: 18,
      zIndex: 120,
    },

    quickEmojiButton: {
      width: 34,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 17,
    },

    quickEmojiText: {
      fontSize: 21,
      lineHeight: 26,
    },

    quickEmojiMore: {
      width: 32,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 17,
      backgroundColor:
        colors.greenSoft,
    },

    modernPickerBackdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor:
        'rgba(0,0,0,0.34)',
    },

    modernPickerSheet: {
      maxHeight: '76%',
      minHeight: 380,
      paddingTop: 8,
      paddingHorizontal: 14,
      paddingBottom: 20,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      backgroundColor: '#FFFFFF',
    },

    modernPickerHandle: {
      alignSelf: 'center',
      width: 44,
      height: 4,
      marginBottom: 10,
      borderRadius: 2,
      backgroundColor: '#D9DEDB',
    },

    modernPickerHeader: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    modernPickerTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '900',
    },

    modernPickerSub: {
      marginTop: 2,
      color: colors.muted,
      fontSize: 12,
    },

    modernPickerClose: {
      width: 38,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor:
        '#F2F5F3',
    },

    modernPickerTabs: {
      marginTop: 7,
      marginBottom: 10,
      padding: 3,
      flexDirection: 'row',
      gap: 3,
      borderRadius: 14,
      backgroundColor:
        '#EEF3F0',
    },

    modernPickerTab: {
      flex: 1,
      minHeight: 38,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 11,
    },

    modernPickerTabOn: {
      backgroundColor: '#FFFFFF',
    },

    modernPickerTabText: {
      color: colors.muted,
      fontSize: 12.5,
      fontWeight: '900',
    },

    modernPickerTabTextOn: {
      color: colors.greenDark,
    },

    nativeEmojiRow: {
      minHeight: 58,
      marginBottom: 8,
      paddingHorizontal: 11,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 15,
      backgroundColor:
        '#F8FAF9',
    },

    nativeEmojiTitle: {
      color: colors.text,
      fontSize: 13.5,
      fontWeight: '900',
    },

    nativeEmojiSub: {
      marginTop: 2,
      color: colors.muted,
      fontSize: 12,
      lineHeight: 11,
    },

    extendedEmojiScroll: {
      maxHeight: 360,
    },

    extendedEmojiGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent:
        'space-between',
      gap: 4,
      paddingBottom: 14,
    },

    extendedEmojiButton: {
      width: '12%',
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
    },

    extendedEmojiText: {
      fontSize: 25,
      lineHeight: 31,
    },

    gifPickerPanel: {
      minHeight: 260,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },

    gifPickerIcon: {
      fontSize: 42,
      lineHeight: 50,
    },

    gifPickerTitle: {
      marginTop: 5,
      color: colors.text,
      fontSize: 16,
      fontWeight: '900',
    },

    gifPickerText: {
      maxWidth: 330,
      marginTop: 6,
      color: colors.muted,
      fontSize: 12.5,
      lineHeight: 18,
      textAlign: 'center',
    },

    gifPickerButton: {
      minWidth: 160,
      height: 46,
      marginTop: 16,
      paddingHorizontal: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 14,
      backgroundColor:
        colors.greenDark,
    },

    gifPickerButtonText: {
      color: '#FFFFFF',
      fontSize: 12.5,
      fontWeight: '900',
    },

    avatarReactionScroll: {
      maxHeight: 360,
    },

    avatarReactionGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      paddingBottom: 14,
    },

    avatarReactionChoice: {
      width: '47%',
      minHeight: 112,
      padding: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 17,
      backgroundColor:
        '#F9FBFA',
    },

    avatarReactionPreview: {
      width: 82,
      height: 68,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },

    avatarReactionBadge: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      fontSize: 28,
      lineHeight: 32,
    },

    avatarReactionChoiceLabel: {
      marginTop: 4,
      color: colors.greenDark,
      fontSize: 12.5,
      fontWeight: '900',
    },
    standaloneReactionBubble: {
      maxWidth: '92%',
      paddingHorizontal: 0,
      paddingVertical: 0,
      borderRadius: 0,
      backgroundColor:
        'transparent',
      overflow: 'visible',
      elevation: 0,
      shadowOpacity: 0,
    },

    standaloneReactionText: {
      fontSize: 42,
      lineHeight: 50,
      textAlign: 'center',
      includeFontPadding: false,
    },

    deliveryStandalone: {
      color: colors.muted,
    },

    attachPopoverWrap: {
      width: 43,
      height: 43,
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'visible',
      zIndex: 220,
      elevation: 20,
    },

    attachInlinePopover: {
      position: 'absolute',
      left: 46,
      bottom: 0,
      minWidth: 146,
      height: 43,
      paddingHorizontal: 6,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 14,
      backgroundColor: '#FFFFFF',
      zIndex: 260,
      elevation: 22,
      shadowColor: '#000000',
      shadowOpacity: 0.14,
      shadowRadius: 8,
      shadowOffset: {
        width: 0,
        height: 4,
      },
    },

    attachPopoverAction: {
      minWidth: 61,
      height: 35,
      paddingHorizontal: 7,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      borderRadius: 10,
    },

    attachPopoverText: {
      color: colors.greenDark,
      fontSize: 12.5,
      fontWeight: '900',
    },

    attachPopoverDivider: {
      width: 1,
      height: 22,
      backgroundColor: colors.line,
    },
    selectedFile: {
      minHeight: 48,
      marginHorizontal: 10,
      marginBottom: 6,
      paddingHorizontal:
        11,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 8,
      borderWidth: 1,
      borderColor:
        colors.line,
      borderRadius: 13,
      backgroundColor:
        '#FFFFFF',
    },

    selectedName: {
      color: colors.text,
      fontSize: 12.5,
      fontWeight: '900',
    },

    selectedSize: {
      marginTop: 2,
      color: colors.muted,
      fontSize: 12,
    },

    composer: {
      minHeight: 50,
      
      flexDirection:
        'row',
      alignItems:
        'flex-end',
      gap: 7,
      borderTopWidth:
        StyleSheet
          .hairlineWidth,
      borderTopColor:
        colors.line,
      backgroundColor:
        '#FFFFFF',
      paddingVertical: 5,
      paddingHorizontal: 8,
    },

    attach: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.greenSoft,
    },

    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 82,
      paddingHorizontal:
        12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor:
        colors.line,
      borderRadius: 16,
      backgroundColor:
        '#F8FAF9',
      color: colors.text,
      fontSize: 14.5,
      textAlignVertical:
        'top',
    },

    send: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.greenDark,
    },

    modalBackdrop: {
      flex: 1,
      justifyContent:
        'flex-end',
      backgroundColor:
        'rgba(0,0,0,0.28)',
    },

    optionSheet: {
      paddingTop: 8,
      paddingHorizontal:
        11,
      paddingBottom: 18,
      borderTopLeftRadius:
        24,
      borderTopRightRadius:
        24,
      backgroundColor:
        '#FFFFFF',
    },

    sheetHandle: {
      alignSelf:
        'center',
      width: 42,
      height: 4,
      marginBottom: 10,
      borderRadius: 2,
      backgroundColor:
        '#D9DEDB',
    },

    sheetTitle: {
      marginBottom: 8,
      color: colors.text,
      fontSize: 15.5,
      fontWeight: '900',
      textAlign: 'center',
    },

    optionRow: {
      minHeight: 58,
      marginBottom: 7,
      paddingHorizontal:
        12,
      paddingVertical: 9,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 7,
      borderWidth: 1,
      borderColor:
        colors.line,
      borderRadius: 13,
      backgroundColor:
        '#F9FBFA',
    },

    optionRowSelected: {
      borderColor:
        colors.greenDark,
      backgroundColor:
        colors.greenSoft,
      borderWidth: 2,
    },

    optionEmoji: {
      width: 30,
      textAlign: 'center',
      fontSize: 21,
    },

    optionTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '900',
    },

    optionSub: {
      marginTop: 2,
      color: colors.muted,
      fontSize: 12,
      lineHeight: 12,
    },

    cancelRow: {
      minHeight: 48,
      marginTop: 3,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    cancelText: {
      color: colors.muted,
      fontSize: 13.5,
      fontWeight: '900',
    },
  
  messageSenderAvatar: {
    position: 'absolute',
    left: 0,
    top: 2,
    zIndex: 6,
  },
  messageSenderAvatarOwn: {
    left: undefined,
    right: 0,
  },
  bubbleWithSenderAvatar: {
    marginLeft: 44,
  },
  bubbleWithSenderAvatarOwn: {
    marginRight: 44,
  },
});

