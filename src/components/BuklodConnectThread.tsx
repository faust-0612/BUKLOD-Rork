/* PATCH_186J_R2_SINGLE_SHARED_POST_PHOTO */
/* PATCH_185A_R5_DIRECT_THREAD_LOADING_SAFE: existing direct guard retained */
/* PATCH_180A_R7_EXACT_CHAT_BODY_MOJIBAKE */
﻿import { ensureBuklodStreamVideoClient } from '@/lib/buklodStreamVideoClient';
import {
  buildBuklodPersonalCallId,
  formatBuklodCallStartError,
} from '@/lib/buklodStreamCall';
import { repairMojibakeText } from '@/lib/repairMojibakeText';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConnectComposerKeyboardInset, CONNECT_COMPOSER_RESERVED_HEIGHT } from '@/lib/useConnectComposerKeyboardInset';
import { useBuklodPersistentNavOccupiedHeight } from '@/lib/buklodSafeArea';
import BuklodScopeCallLauncher from '@/components/BuklodScopeCallLauncher';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  Share,
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
import * as Clipboard from 'expo-clipboard';
import {
  useStreamVideoClient,
} from '@/lib/streamVideoSdk';
import { supabase } from '@/lib/supabase';
import { getOfflineCache, setOfflineCache } from '@/lib/offlineCache';
import { useNetwork } from '@/providers/NetworkProvider';

import {
  useAuth,
} from '@/providers/AuthProvider';

import {
  type ConnectThemeRoles,
} from '@/lib/connectTheme';
import {
  ConnectThemeProvider,
  useConnectTheme,
} from '@/providers/ConnectThemeProvider';
import {
  ChatBackgroundProvider,
} from '@/providers/ChatBackgroundProvider';
import { ConnectComposer } from '@/components/connect/ConnectComposer';
import { ConnectComposerPicker } from '@/components/connect/ConnectComposerPicker';
import { ConnectMessageActionSheet, type ConnectMessageActionAnchor } from '@/components/connect/ConnectMessageActionSheet';
import { ConnectMessageBubble } from '@/components/connect/ConnectMessageBubble';
import { ConnectPressable } from '@/components/connect/ConnectPressable';
import { ConnectThreadBackground } from '@/components/connect/ConnectThreadBackground';
import { ConnectThemeSelectorButton } from '@/components/connect/ConnectThemeSelector';
import { ConnectThreadHeader } from '@/components/connect/ConnectThreadHeader';
import {
  type ConnectPickedFile,
  encodeConnectAlbumBody,
  formatConnectBytes,
  formatConnectTimestamp,
  getConnectMessageImagePaths,
  isConnectStoragePath,
  openConnectAttachment,
  parseConnectAlbumBody,
  pickConnectFile,
  pickConnectPhotos,
  uploadConnectFile,
} from '@/lib/buklodConnect';
import {
  setConnectMessageReaction,
} from '@/lib/buklodConnectSetReaction';
import {
  CONNECT_MESSAGE_REACTIONS,
  CONNECT_MESSAGE_REACTION_KEYS,
  emptyConnectMessageReactionCounts,
  type ConnectMessageReactionKey,
} from '@/lib/buklodConnectMessageReactions';
import {
  CONNECT_GIF_CATALOG,
  downloadConnectCatalogGif,
} from '@/lib/buklodConnectGifCatalog';
import {
  buildConnectReplyBody,
  CONNECT_DELETED_BODY,
  getConnectForwardText,
  getConnectMessageCopyText,
  getConnectMessagePreview,
  isConnectDeletedMessage,
  clearHiddenConnectMessageIds,
  loadHiddenConnectMessageIds,
  parseConnectReplyBody,
  saveHiddenConnectMessageIds,
} from '@/lib/connectMessageActions';
import {
  fetchDirectConnectMessages,
  fetchScopeConnectMessages,
} from '@/lib/buklodConnectMessageHistory';
import {
  FLATLIST_TUNING,
} from '@/lib/performanceInstrumentation';
import {
  SCALE_LIMITS,
} from '@/lib/performanceScale';
import { acquireSharedRealtimeSubscription } from '@/lib/performance';
import { BuklodPhotoEditor } from '@/components/BuklodPhotoEditor';
import { ConnectPhotoViewer } from '@/components/connect/ConnectPhotoViewer';
/* PATCH_186B_PHOTO_EDITOR_IMPORT */

/* PATCH_167L_R5_COMPACT_INLINE_REACTION_DRAWER */
/* PATCH_167L_R9_ATTACHED_EMOJI_ONLY_REACTION */

type Props = {
  mode:
    | 'direct'
    | 'scope';
  containerId: string;
  initialTitle?: string;
  initialSubtitle?: string;
  initialOtherUserId?: string;
  pendingTargetUserId?: string;
  onBackOverride?: () => void;
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
  const { theme } = useConnectTheme();
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
        backgroundColor: theme.surface,
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
            color={theme.accent}
          />
          <Text
            style={{
              flex:1,
              color:theme.accent,
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

type ComposerPhoto = ConnectPickedFile & {
  id: string;
};

type Message = {
  id: string;
  sender_id: string;
  sender_name?: string | null;
  body: string;
  attachment_path?: string | null;
  attachment_name?: string | null;
  attachment_mime?: string | null;
  attachment_size?: number | null;
  created_at: string;
  deleted_at?: string | null;
  delivery_state?:
    | 'pending'
    | 'sent'
    | 'not_sent';
  pending_album?: ComposerPhoto[] | null;
};

type ReactionKey = ConnectMessageReactionKey;

type ReactionSummary = {
  counts: Record<
    ReactionKey,
    number
  >;
  mine:
    | ReactionKey
    | null;
};

const REACTIONS = CONNECT_MESSAGE_REACTIONS;
const REACTION_KEYS = CONNECT_MESSAGE_REACTION_KEYS;

function emptyCounts() {
  return emptyConnectMessageReactionCounts();
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

function mergeServerMessages(
  server: Message[],
  current: Message[],
): Message[] {
  const locals = current.filter(item =>
    String(item.id).startsWith('local-')
  );

  const kept = locals.filter(local => {
    if (local.delivery_state === 'not_sent') {
      return true;
    }

    if (local.delivery_state !== 'pending') {
      return false;
    }

    const localTime =
      new Date(local.created_at).getTime();
    const localCaption =
      parseConnectAlbumBody(local.body).caption;
    const localHasMedia =
      !!(
        local.attachment_path ||
        local.pending_album?.length
      );

    return !server.some(row => {
      const rowCaption =
        parseConnectAlbumBody(row.body).caption;
      const rowHasMedia = !!row.attachment_path;

      return (
        row.sender_id === local.sender_id &&
        rowCaption === localCaption &&
        rowHasMedia === localHasMedia &&
        Math.abs(
          new Date(row.created_at).getTime() -
            localTime
        ) < 120000
      );
    });
  });

  if (!kept.length) {
    return server;
  }

  return [...server, ...kept].sort(
    (a, b) =>
      new Date(a.created_at).getTime() -
      new Date(b.created_at).getTime()
  );
}

function BuklodConnectThreadInner({
  mode,
  containerId,
  initialTitle,
  initialSubtitle,
  initialOtherUserId,
  pendingTargetUserId,
  onBackOverride,
}: Props) {
  /* PATCH_169G_CONNECT_SAFE_INSETS */
  const insets =
    useSafeAreaInsets();
  const navOccupied =
    useBuklodPersistentNavOccupiedHeight();
  const threadBodyRef =
    useRef<View | null>(null);
  const {
    composerBottom,
    clearComposerInset,
    resyncComposerInset,
  } = useConnectComposerKeyboardInset(threadBodyRef);

  const { theme } = useConnectTheme();
  const styles = useMemo(
    () => createThreadStyles(theme),
    [theme]
  );

  const {
    profile,
  } =
    useAuth();

  const profileId =
    (profile as any)?.id as
      | string
      | undefined;

  const [
    resolvedContainerId,
    setResolvedContainerId,
  ] = useState(containerId);

  const effectiveContainerId =
    resolvedContainerId || containerId;

  /* BUKLOD_OFFLINE_R2_CONNECT_THREAD */
  const { online } =
    useNetwork();
  const [title, setTitle] =
    useState(initialTitle || 'Connect');

  const [subtitle, setSubtitle] =
    useState(initialSubtitle || '');

  const [
    otherUserId,
    setOtherUserId,
  ] =
    useState<
      string | null
    >(initialOtherUserId ?? null);

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
          !effectiveContainerId
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

          const callId =
            buildBuklodPersonalCallId(
              effectiveContainerId
            );

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
                  effectiveContainerId,

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

            formatBuklodCallStartError(
              error
            )
          );
        }
        finally {
          setDirectCallStarting(
            null
          );
        }
      },
      [
        effectiveContainerId,
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

  const [
    photos,
    setPhotos,
  ] =
    useState<ComposerPhoto[]>([]);

  /* PATCH_186B_PHOTO_EDITOR_CONNECT_STATE */
  const [
    photoEditorSource,
    setPhotoEditorSource,
  ] = useState<ConnectPickedFile | null>(null);

  const [
    photoEditorTargetId,
    setPhotoEditorTargetId,
  ] = useState<string | null>(null);

  const [
    photoViewer,
    setPhotoViewer,
  ] = useState<{
    uris: string[];
    index: number;
  } | null>(null);

  const [
    uploadingAttachment,
    setUploadingAttachment,
  ] = useState(false);

  const inflightTextSendsRef =
    useRef(new Set<string>());

  const sendInFlightRef =
    useRef(false);

  const draftRef =
    useRef(draft);

  const fileRef =
    useRef(file);
  const photosRef =
    useRef(photos);

  draftRef.current = draft;
  fileRef.current = file;
  photosRef.current = photos;

  useEffect(() => {
    if (containerId) {
      setResolvedContainerId(containerId);
    }
  }, [containerId]);

  useEffect(() => {
    if (
      !pendingTargetUserId ||
      containerId
    ) {
      return;
    }

    let active = true;

    void (async () => {
      const result =
        await (supabase as any).rpc(
          'buklod_connect_get_or_create_direct_thread',
          {
            _target_user_id:
              pendingTargetUserId,
          }
        );

      if (!active) {
        return;
      }

      if (result.error) {
        Alert.alert(
          'Connect',
          result.error.message
        );
        router.back();
        return;
      }

      const raw = Array.isArray(result.data)
        ? result.data[0]
        : result.data;
      const threadId =
        typeof raw === 'string'
          ? raw
          : raw?.thread_id ?? raw?.id;

      if (!threadId) {
        Alert.alert(
          'Connect',
          'Could not open conversation.'
        );
        router.back();
        return;
      }

      setResolvedContainerId(
        String(threadId)
      );
    })();

    return () => {
      active = false;
    };
  }, [
    pendingTargetUserId,
    containerId,
  ]);

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
      !effectiveContainerId
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
              effectiveContainerId,
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
    effectiveContainerId,
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

  const [
    actionTargetMessage,
    setActionTargetMessage,
  ] = useState<Message | null>(null);

  const [
    actionAnchor,
    setActionAnchor,
  ] = useState<
    ConnectMessageActionAnchor | null
  >(null);

  const [
    replyTo,
    setReplyTo,
  ] = useState<Message | null>(null);

  const [
    hiddenMessageIds,
    setHiddenMessageIds,
  ] = useState<Set<string>>(new Set());

  const replyToRef =
    useRef<Message | null>(null);

  replyToRef.current = replyTo;

  const visibleMessages =
    useMemo(
      () => {
        const filtered = messages.filter(
          item =>
            !hiddenMessageIds.has(
              item.id
            )
        );

        if (
          filtered.length <=
          SCALE_LIMITS.connectRenderWindow
        ) {
          return filtered;
        }

        return filtered.slice(
          filtered.length -
            SCALE_LIMITS.connectRenderWindow
        );
      },
      [
        hiddenMessageIds,
        messages,
      ]
    );

  const hiddenMessageCount =
    messages.length -
    visibleMessages.length;

  const messageById =
    useMemo(() => {
      const map = new Map<
        string,
        Message
      >();

      for (const item of messages) {
        map.set(item.id, item);
      }

      return map;
    }, [messages]);

  const listRef =
    useRef<
      FlatList<Message>
    >(null);

  /* PATCH_191B_CONNECT_SCROLL_ANCHOR */
  const connectScrollOffsetRef =
    useRef(0);

  const connectReadingOlderRef =
    useRef(false);

  const connectPreserveScrollRef =
    useRef(false);

  const connectPreserveOffsetRef =
    useRef(0);

  const connectPreserveTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const armConnectScrollPreservation =
    () => {
      if (!connectReadingOlderRef.current) {
        return;
      }

      connectPreserveOffsetRef.current =
        connectScrollOffsetRef.current;

      connectPreserveScrollRef.current =
        true;

      if (connectPreserveTimerRef.current) {
        clearTimeout(
          connectPreserveTimerRef.current
        );
      }

      connectPreserveTimerRef.current =
        setTimeout(
          () => {
            connectPreserveScrollRef.current =
              false;
            connectPreserveTimerRef.current =
              null;
          },
          8000
        );
    };

  useEffect(
    () => {
      if (!connectPreserveScrollRef.current) {
        return;
      }

      const offset =
        connectPreserveOffsetRef.current;

      requestAnimationFrame(
        () => {
          listRef.current
            ?.scrollToOffset({
              offset,
              animated: false,
            });

          connectPreserveScrollRef.current =
            false;

          if (
            connectPreserveTimerRef.current
          ) {
            clearTimeout(
              connectPreserveTimerRef.current
            );
            connectPreserveTimerRef.current =
              null;
          }
        }
      );
    },
    [messages]
  );

  const connectThreadOfflineCacheKey =
    `connect-thread:${mode}:${effectiveContainerId}`;

  useEffect(() => {
    if (
      !profileId ||
      !effectiveContainerId
    ) {
      return;
    }

    let active = true;

    void getOfflineCache<{
      messages: Message[];
      title: string;
      subtitle: string;
      otherUserId: string | null;
      draft: string;
    }>(
      connectThreadOfflineCacheKey,
      {
        userId: profileId,
        allowStale: true,
      }
    )
      .then(cached => {
        if (
          !active ||
          !cached?.data
        ) {
          return;
        }

        const value =
          cached.data;

        if (
          value.messages?.length
        ) {
          setMessages(current =>
            current.length
              ? current
              : value.messages
          );
        }

        if (
          value.title
        ) {
          setTitle(current =>
            current &&
            current !== 'Connect'
              ? current
              : value.title
          );
        }

        if (
          value.subtitle
        ) {
          setSubtitle(current =>
            current
              ? current
              : value.subtitle
          );
        }

        if (
          value.otherUserId
        ) {
          setOtherUserId(current =>
            current ??
            value.otherUserId
          );
        }

        if (
          value.draft
        ) {
          setDraft(current =>
            current
              ? current
              : value.draft
          );
        }

      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [
    connectThreadOfflineCacheKey,
    effectiveContainerId,
    profileId,
  ]);

  useEffect(() => {
    if (
      !profileId ||
      !effectiveContainerId
    ) {
      return;
    }

    const timer =
      setTimeout(() => {
        void setOfflineCache(
          connectThreadOfflineCacheKey,
          {
            messages,
            title,
            subtitle,
            otherUserId,
            draft,
          },
          {
            userId: profileId,
            ttlMs: 7 * 24 * 60 * 60 * 1000,
          }
        ).catch(
          () => undefined
        );
      }, 250);

    return () =>
      clearTimeout(timer);
  }, [
    connectThreadOfflineCacheKey,
    effectiveContainerId,
    draft,
    messages,
    otherUserId,
    profileId,
    subtitle,
    title,
  ]);
  const loadReactions =
    useCallback(
      async () => {
        if (
          !effectiveContainerId ||
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
              effectiveContainerId
            )
            .limit(
              SCALE_LIMITS.connectReactions
            );

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
        effectiveContainerId,
        mode,
        profileId,
      ]
    );

  const loadPeerRead =
    useCallback(
      async () => {
        if (
          mode !== 'direct' ||
          !effectiveContainerId ||
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
                effectiveContainerId,
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
        effectiveContainerId,
        mode,
        profileId,
      ]
    );

  const load =
    useCallback(
      async () => {
        if (
          !effectiveContainerId ||
          !profileId
        ) {
          return;
        }

        try {
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
                  effectiveContainerId,
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
            await fetchDirectConnectMessages(
              effectiveContainerId
            );

          setMessages(current =>
            mergeServerMessages(
              rows,
              current
            )
          );

          const readResult =
            await (
              supabase as any
            ).rpc(
              'buklod_connect_mark_direct_read',
              {
                _thread_id:
                  effectiveContainerId,
              }
            );

          if (readResult.error) {
            console.warn(
              'Connect mark direct read:',
              readResult.error.message
            );
          }
        }
        else {
          const details =
            await (
              supabase as any
            ).rpc(
              'buklod_connect_room_details',
              {
                _scope_id:
                  effectiveContainerId,
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
            await fetchScopeConnectMessages(
              effectiveContainerId
            );

          setMessages(current =>
            mergeServerMessages(
              rows,
              current
            )
          );

          const readResult =
            await (
              supabase as any
            ).rpc(
              'buklod_connect_mark_scope_read',
              {
                _scope_id:
                  effectiveContainerId,
              }
            );

          if (readResult.error) {
            console.warn(
              'Connect mark scope read:',
              readResult.error.message
            );
          }
        }

        await loadReactions();

        requestAnimationFrame(
          () =>
            listRef.current
              ?.scrollToEnd({
                animated: false,
              })
        );
      } catch (error: any) {
        console.warn(
          'Connect history load:',
          error?.message ?? error
        );

        Alert.alert(
          'Connect',
          'Could not load message history. Pull to reopen this chat or try again.',
        );
      }
      },
      [
        effectiveContainerId,
        loadReactions,
        mode,
        profileId,
      ]
    );

  useEffect(() => {
    if (!effectiveContainerId) {
      setHiddenMessageIds(new Set());
      return;
    }

    let active = true;

    void loadHiddenConnectMessageIds(
      mode,
      effectiveContainerId
    ).then(ids => {
      if (active) {
        setHiddenMessageIds(ids);
      }
    });

    return () => {
      active = false;
    };
  }, [
    effectiveContainerId,
    mode,
  ]);

  useEffect(() => {
    void load();

    if (
      !effectiveContainerId ||
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
        ? `thread_id=eq.${effectiveContainerId}`
        : `scope_id=eq.${effectiveContainerId}`;

    const reactionTable =
      mode === 'direct'
        ? 'buklod_connect_direct_message_reactions'
        : 'buklod_connect_scope_message_reactions';

    const reactionFilter =
      mode === 'direct'
        ? `thread_id=eq.${effectiveContainerId}`
        : `scope_id=eq.${effectiveContainerId}`;

    const registryKey =
      `connect-thread:${mode}:${profileId}:${effectiveContainerId}`;

    const release =
      acquireSharedRealtimeSubscription<
        'message' | 'reaction'
      >(
        registryKey,
        eventKind => {
          if (eventKind === 'reaction') {
            void loadReactions();
            return;
          }

          void load();
        },
        emit => {
          const channel = supabase
            .channel(
              `connect-thread-${mode}-${effectiveContainerId}`
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
              () => emit('message')
            )
            .on(
              'postgres_changes',
              {
                event: 'UPDATE',
                schema: 'public',
                table:
                  messageTable,
                filter:
                  messageFilter,
              },
              () => emit('message')
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
              () => emit('reaction')
            );

          const subscribed =
            channel.subscribe();

          return () => {
            void supabase.removeChannel(
              subscribed
            );
          };
        },
      );

    return release;
  }, [
    effectiveContainerId,
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
        SCALE_LIMITS.connectPeerReadPollMs
      );

    return () =>
      clearInterval(timer);
  }, [
    loadPeerRead,
    mode,
  ]);

  useEffect(() => {
    let active = true;

    const pendingPaths = Array.from(
      new Set(
        messages.flatMap(item => {
          if (item.pending_album?.length) {
            return [];
          }

          return getConnectMessageImagePaths(
            item
          ).filter(path =>
            isConnectStoragePath(path)
          );
        })
      )
    ).filter(path => !attachmentUrls[path]);

    if (!pendingPaths.length) {
      return;
    }

    void Promise.all(
      pendingPaths.map(
        async path => {
          const result =
            await supabase
              .storage
              .from(
                'connect-files'
              )
              .createSignedUrl(
                path,
                3600
              );

          return {
            path,
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
          setPhotos([]);
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
          await pickConnectPhotos();

        if (!picked.length) {
          return;
        }

        setFile(null);
        setPhotos(current => {
          const remaining =
            Math.max(
              0,
              12 - current.length
            );

          if (!remaining) {
            return current;
          }

          return [
            ...current,
            ...picked.slice(0, remaining).map(photo => ({
              ...photo,
              id: `photo-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,
            })),
          ];
        });
      }
      catch (e: any) {
        Alert.alert(
          'Photo',
          e?.message ||
            String(e)
        );
      }
    };

  const handleAttachPress =
    () => {
      void chooseFile();
    };

  const openMessageActions =
    (
      message: Message,
      anchor: ConnectMessageActionAnchor,
    ) => {
      armConnectScrollPreservation();
      setOptionMenu(null);
      setReactionTargetId(message.id);
      setActionTargetMessage(message);
      setActionAnchor(anchor);
    };

  const closeMessageActions =
    () => {
      setActionTargetMessage(null);
      setActionAnchor(null);
      setReactionTargetId(null);
    };

  const clearReply =
    () => {
      setReplyTo(null);
    };

  const handleMessageReply =
    () => {
      if (!actionTargetMessage) {
        return;
      }

      setReplyTo(actionTargetMessage);
      setReactionTargetId(null);
      setActionTargetMessage(null);
      setActionAnchor(null);

      requestAnimationFrame(() =>
        composerInputRef.current?.focus()
      );
    };

  const handleMessageCopy =
    async () => {
      if (!actionTargetMessage) {
        return;
      }

      const text =
        getConnectMessageCopyText(
          actionTargetMessage
        );

      if (!text) {
        Alert.alert(
          'Copy',
          'Nothing to copy for this message.'
        );
        return;
      }

      await Clipboard.setStringAsync(
        text
      );
    };

  const handleMessageForward =
    async () => {
      if (!actionTargetMessage) {
        return;
      }

      try {
        await Share.share({
          message:
            getConnectForwardText(
              actionTargetMessage
            ),
        });
      }
      catch {
        /* User dismissed share sheet. */
      }
    };

  const handleRestoreHiddenMessages =
    async () => {
      if (!effectiveContainerId) {
        return;
      }

      setHiddenMessageIds(new Set());

      await clearHiddenConnectMessageIds(
        mode,
        effectiveContainerId
      );
    };

  const handleDeleteForMe =
    async () => {
      if (
        !actionTargetMessage ||
        !effectiveContainerId
      ) {
        return;
      }

      const next = new Set(
        hiddenMessageIds
      );

      next.add(
        actionTargetMessage.id
      );
      setHiddenMessageIds(next);
      setReactionTargetId(null);
      setActionAnchor(null);

      await saveHiddenConnectMessageIds(
        mode,
        effectiveContainerId,
        next
      );
    };

  const handleDeleteForEveryone =
    async () => {
      if (!actionTargetMessage) {
        return;
      }

      const target =
        actionTargetMessage;

      setReactionTargetId(null);
      setActionAnchor(null);

      try {
        const result =
          await (
            supabase as any
          ).rpc(
            'buklod_connect_delete_message_for_everyone_v1',
            {
              p_message_id:
                target.id,
            }
          );

        if (result.error) {
          throw result.error;
        }

        setMessages(current =>
          current.map(item =>
            item.id === target.id
              ? {
                  ...item,
                  body:
                    CONNECT_DELETED_BODY,
                  attachment_path:
                    null,
                  attachment_name:
                    null,
                  attachment_mime:
                    null,
                  attachment_size:
                    null,
                  deleted_at:
                    new Date().toISOString(),
                }
              : item
          )
        );
      }
      catch (e: any) {
        const message =
          String(
            e?.message ?? e ?? ''
          );

        Alert.alert(
          'Delete',
          /function.*does not exist/i.test(
            message
          )
            ? 'Delete for everyone needs the latest database update.'
            : message ||
                'Could not delete message.'
        );
      }
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
          await setConnectMessageReaction(
            {
              mode,
              containerId:
                effectiveContainerId,
              messageId,
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
          /buklod_connect_set_reaction|unsupported reaction|schema cache|does not exist|could not find the function/i
            .test(message);

        Alert.alert(
          'Reaction',
          backendMissing
            ? 'Reaction update is not active yet. Apply the latest Supabase migrations, then try again.'
            : message
        );
      }
    };

  const makeLocalMessageId =
    () =>
      `local-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

  const appendOptimisticMessage =
    (
      text: string,
      localId: string
    ) => {
      if (!profileId) {
        return;
      }

      setMessages(
        current => [
          ...current,
          {
            id: localId,
            sender_id:
              profileId,
            body: text,
            attachment_path:
              null,
            attachment_name:
              null,
            attachment_mime:
              null,
            attachment_size:
              null,
            created_at:
              new Date()
                .toISOString(),
            delivery_state:
              'pending',
          },
        ]
      );

      requestAnimationFrame(
        () =>
          listRef.current
            ?.scrollToEnd({
              animated: true,
            })
      );
    };

  const markLocalMessageSent =
    (localId: string) => {
      setMessages(
        current =>
          current.map(
            item =>
              item.id ===
              localId
                ? {
                    ...item,
                    delivery_state:
                      'sent',
                  }
                : item
          )
      );
    };

  const markLocalMessageFailed =
    (localId: string) => {
      setMessages(
        current =>
          current.map(
            item =>
              item.id ===
              localId
                ? {
                    ...item,
                    delivery_state:
                      'not_sent',
                  }
                : item
          )
      );
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

  const insertDraftEmoji =
    (
      emoji: string
    ) => {
      const next =
        `${draftRef.current ?? ''}${emoji}`;

      draftRef.current =
        next;

      setDraft(next);

      setComposerPickerOpen(
        false
      );
    };

  const sendQuickBody =
    async (
      text: string
    ) => {
      if (
        mode !== 'direct' ||
        !profileId ||
        !effectiveContainerId ||
        !text.trim()
      ) {
        return;
      }

      const trimmed =
        text.trim();
      const inflightKey =
        `quick:${trimmed}`;

      if (
        inflightTextSendsRef.current.has(
          inflightKey
        )
      ) {
        return;
      }

      inflightTextSendsRef.current.add(
        inflightKey
      );

      setComposerPickerOpen(
        false
      );

      const localId =
        makeLocalMessageId();

      appendOptimisticMessage(
        trimmed,
        localId
      );

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
                effectiveContainerId,
              sender_id:
                profileId,
              body:
                trimmed,
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

        markLocalMessageSent(
          localId
        );
      }
      catch {
        markLocalMessageFailed(
          localId
        );
      }
      finally {
        inflightTextSendsRef.current.delete(
          inflightKey
        );
      }
    };

  const sendConnectGifFile =
    async (
      picked: ConnectPickedFile
    ) => {
      if (
        mode !== 'direct' ||
        !profileId ||
        !effectiveContainerId ||
        uploadingAttachment
      ) {
        return;
      }

      setComposerPickerOpen(false);

      setUploadingAttachment(true);

      try {
        const uploaded =
          await uploadConnectFile({
            mode: 'direct',
            containerId:
              effectiveContainerId,
            file: picked,
          });

        const result =
          await (
            supabase as any
          )
            .from(
              'buklod_connect_direct_messages'
            )
            .insert({
              thread_id:
                effectiveContainerId,
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
      }
      catch (e: any) {
        appendNotSent(
          'GIF',
          picked.name
        );

        Alert.alert(
          'GIF',
          e?.message ||
            String(e)
        );
      }
      finally {
        setUploadingAttachment(
          false
        );
      }
    };

  const sendCatalogGif =
    async (gifId: string) => {
      const item =
        CONNECT_GIF_CATALOG.find(
          entry => entry.id === gifId
        );

      if (!item) {
        return;
      }

      try {
        const picked =
          await downloadConnectCatalogGif(
            item
          );

        await sendConnectGifFile(picked);
      }
      catch (e: any) {
        Alert.alert(
          'GIF',
          e?.message ||
            String(e)
        );
      }
    };

  const sendAvatarReaction =
    (
      key: string
    ) =>
      void sendQuickBody(
        `${AVATAR_REACTION_PREFIX}${key}]]`
      );

  const sendCapturedText =
    (
      trimmed: string,
      replyMessage?: Message | null
    ) => {
      if (
        !profileId ||
        !effectiveContainerId ||
        !trimmed
      ) {
        return;
      }

      const reply =
        replyMessage ??
        replyToRef.current;
      const outbound =
        reply?.id &&
        !/^\[\[BUKLOD_REPLY:v1:/i.test(
          trimmed
        )
          ? buildConnectReplyBody(
              reply.id,
              trimmed
            )
          : trimmed;

      const localId =
        makeLocalMessageId();

      inflightTextSendsRef.current.add(
        localId
      );

      appendOptimisticMessage(
        outbound,
        localId
      );

      void (async () => {
        try {
          const table =
            mode === 'direct'
              ? 'buklod_connect_direct_messages'
              : 'buklod_connect_scope_messages';

          const payload: any = {
            sender_id:
              profileId,
            body:
              outbound,
            attachment_path:
              null,
            attachment_name:
              null,
            attachment_mime:
              null,
            attachment_size:
              null,
          };

          if (
            mode === 'direct'
          ) {
            payload.thread_id =
              effectiveContainerId;
          }
          else {
            payload.scope_id =
              effectiveContainerId;
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

          markLocalMessageSent(
            localId
          );
        }
        catch {
          markLocalMessageFailed(
            localId
          );
        }
        finally {
          inflightTextSendsRef.current.delete(
            localId
          );
        }
      })();
    };

  const sendAlbum =
    (
      album: ComposerPhoto[],
      caption: string,
      replyMessage?: Message | null
    ) => {
      if (
        !profileId ||
        !effectiveContainerId ||
        !album.length
      ) {
        return;
      }

      const localId =
        makeLocalMessageId();
      const snapshot =
        album.map(photo => ({
          ...photo,
        }));
      const first =
        snapshot[0];
      const reply =
        replyMessage ??
        replyToRef.current;
      const outboundCaption =
        reply?.id
          ? buildConnectReplyBody(
              reply.id,
              caption
            )
          : caption;

      setAttachmentUrls(
        current => {
          const next = {
            ...current,
          };

          for (const photo of snapshot) {
            next[photo.uri] =
              photo.uri;
          }

          return next;
        }
      );

      setMessages(
        current => [
          ...current,
          {
            id: localId,
            sender_id:
              profileId,
            body: outboundCaption,
            attachment_path:
              first.uri,
            attachment_name:
              first.name,
            attachment_mime:
              first.mimeType,
            attachment_size:
              first.size,
            created_at:
              new Date()
                .toISOString(),
            delivery_state:
              'pending',
            pending_album:
              snapshot,
          },
        ]
      );

      requestAnimationFrame(
        () =>
          listRef.current
            ?.scrollToEnd({
              animated: true,
            })
      );

      void (async () => {
        try {
          const uploaded: Array<{
            path: string;
            name: string;
            mimeType: string;
            size: number;
          }> = [];

          for (
            let index = 0;
            index < snapshot.length;
            index += 1
          ) {
            const photo =
              snapshot[index];
            const row =
              await uploadConnectFile(
                {
                  mode,
                  containerId:
                    effectiveContainerId,
                  file: photo,
                  uniqueKey: `${Date.now()}-${index}-${Math.random()
                    .toString(36)
                    .slice(2, 8)}`,
                }
              );

            uploaded.push(row);

            setAttachmentUrls(
              current => ({
                ...current,
                [row.path]:
                  photo.uri,
              })
            );
          }

          const paths =
            uploaded.map(
              row => row.path
            );
          const body =
            encodeConnectAlbumBody(
              paths,
              caption
            );
          const outbound =
            reply?.id
              ? buildConnectReplyBody(
                  reply.id,
                  body
                )
              : body;
          const table =
            mode === 'direct'
              ? 'buklod_connect_direct_messages'
              : 'buklod_connect_scope_messages';
          const payload: any = {
            sender_id:
              profileId,
            body: outbound,
            attachment_path:
              uploaded[0].path,
            attachment_name:
              uploaded[0].name,
            attachment_mime:
              uploaded[0].mimeType,
            attachment_size:
              uploaded[0].size,
          };

          if (mode === 'direct') {
            payload.thread_id =
              effectiveContainerId;
          }
          else {
            payload.scope_id =
              effectiveContainerId;
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

          setMessages(
            current =>
              current.map(
                item =>
                  item.id ===
                  localId
                    ? {
                        ...item,
                        body: outbound,
                        attachment_path:
                          uploaded[0]
                            .path,
                        attachment_name:
                          uploaded[0]
                            .name,
                        attachment_mime:
                          uploaded[0]
                            .mimeType,
                        attachment_size:
                          uploaded[0]
                            .size,
                        delivery_state:
                          'sent',
                      }
                    : item
              )
          );
        }
        catch {
          markLocalMessageFailed(
            localId
          );
        }
      })();
    };

  const retryFailedMessage =
    (
      item: Message
    ) => {
      if (
        item.delivery_state !==
        'not_sent'
      ) {
        return;
      }

      const caption =
        parseConnectAlbumBody(
          item.body
        ).caption.trim();

      setMessages(
        current =>
          current.filter(
            row =>
              row.id !==
              item.id
          )
      );

      if (item.pending_album?.length) {
        sendAlbum(
          item.pending_album,
          caption
        );
        return;
      }

      if (!caption) {
        return;
      }

      sendCapturedText(caption);
    };

  const send =
    () => {
      if (
        sendInFlightRef.current
      ) {
        return;
      }

      if (
        !profileId ||
        !effectiveContainerId
      ) {
        return;
      }

      const currentPhotos =
        photosRef.current;
      const currentFile =
        fileRef.current;
      const text =
        String(
          draftRef.current ??
            ''
        ).trim();

      if (
        !text &&
        !currentFile &&
        !currentPhotos.length
      ) {
        return;
      }

      if (!online) {
        Alert.alert(
          'Offline',
          'Your message draft is saved on this device. Reconnect to send it.'
        );
        return;
      }

      clearComposerInset();
      Keyboard.dismiss();
      composerInputRef.current?.blur();

      sendInFlightRef.current =
        true;
      const activeReply =
        replyToRef.current;
      setReplyTo(null);

      if (currentPhotos.length) {
        const savedPhotos =
          currentPhotos.map(
            photo => ({
              ...photo,
            })
          );
        const savedText =
          text;

        draftRef.current = '';
        photosRef.current = [];
        fileRef.current = null;
        setDraft('');
        setPhotos([]);
        setFile(null);
        sendAlbum(
          savedPhotos,
          savedText,
          activeReply
        );
        sendInFlightRef.current =
          false;
        return;
      }

      if (currentFile) {
        const savedFile =
          currentFile;
        const savedText =
          activeReply?.id
            ? buildConnectReplyBody(
                activeReply.id,
                text
              )
            : text;
        const localId =
          makeLocalMessageId();
        const isImage =
          savedFile.mimeType
            .toLowerCase()
            .startsWith(
              'image/'
            );

        draftRef.current = '';
        fileRef.current = null;
        setDraft('');
        setFile(null);

        if (isImage) {
          setAttachmentUrls(
            current => ({
              ...current,
              [savedFile.uri]:
                savedFile.uri,
            })
          );
        }

        setMessages(
          current => [
            ...current,
            {
              id: localId,
              sender_id:
                profileId,
              body: savedText,
              attachment_path:
                savedFile.uri,
              attachment_name:
                savedFile.name,
              attachment_mime:
                savedFile.mimeType,
              attachment_size:
                savedFile.size,
              created_at:
                new Date()
                  .toISOString(),
              delivery_state:
                'pending',
              pending_album:
                isImage
                  ? [
                      {
                        ...savedFile,
                        id: localId,
                      },
                    ]
                  : null,
            },
          ]
        );

        requestAnimationFrame(
          () =>
            listRef.current
              ?.scrollToEnd({
                animated: true,
              })
        );

        void (async () => {
          try {
            const uploaded =
              await uploadConnectFile(
                {
                  mode,
                  containerId:
                    effectiveContainerId,
                  file:
                    savedFile,
                }
              );

            if (isImage) {
              setAttachmentUrls(
                current => ({
                  ...current,
                  [uploaded.path]:
                    savedFile.uri,
                })
              );
            }

            const table =
              mode === 'direct'
                ? 'buklod_connect_direct_messages'
                : 'buklod_connect_scope_messages';

            const payload: any = {
              sender_id:
                profileId,
              body:
                savedText,
              attachment_path:
                uploaded.path,
              attachment_name:
                uploaded.name,
              attachment_mime:
                uploaded.mimeType,
              attachment_size:
                uploaded.size,
            };

            if (
              mode === 'direct'
            ) {
              payload.thread_id =
                effectiveContainerId;
            }
            else {
              payload.scope_id =
                effectiveContainerId;
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

            setMessages(
              current =>
                current.map(
                  item =>
                    item.id ===
                    localId
                      ? {
                          ...item,
                          attachment_path:
                            uploaded.path,
                          attachment_name:
                            uploaded.name,
                          attachment_mime:
                            uploaded.mimeType,
                          attachment_size:
                            uploaded.size,
                          delivery_state:
                            'sent',
                        }
                      : item
                )
            );
          }
          catch (e: any) {
            markLocalMessageFailed(
              localId
            );

            Alert.alert(
              'Send Message',
              e?.message ||
                String(e)
            );
          }
          finally {
            sendInFlightRef.current =
              false;
          }
        })();

        return;
      }

      draftRef.current = '';
      setDraft('');
      sendCapturedText(
        text,
        activeReply
      );
      setTimeout(
        () => {
          sendInFlightRef.current =
            false;
        },
        450
      );
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

  const embeddedInWorkspace =
    managedCompactScope &&
    Boolean(onBackOverride);

  return (
    <ConnectThreadBackground
      style={{
        paddingBottom:
          navOccupied > 0
            ? 0
            : Math.max(
                insets.bottom,
                6
              ),
      }}
    >
      <ConnectThreadHeader
        title={title}
        subtitle={subtitle}
        showSubtitle={!managedCompactScope}
        compactEmbedded={embeddedInWorkspace}
        paddingTop={
          embeddedInWorkspace
            ? 4
            : Math.max(insets.top, 12)
        }
        otherUserId={mode === 'direct' ? otherUserId : null}
        showDirectCalls={mode === 'direct' && !!otherUserId}
        callStarting={directCallStarting}
        onBack={() => {
          if (onBackOverride) {
            onBackOverride();
            return;
          }

          router.back();
        }}
        onAudioCall={() => void startDirectCall('audio')}
        onVideoCall={() => void startDirectCall('video')}
        appearanceSlot={
          <ConnectThemeSelectorButton
            threadId={effectiveContainerId}
          />
        }
        rightSlot={
          managedCompactScope && officeEnabled ? (
            <View style={styles.headerActions}>
              <ConnectPressable
                accessibilityLabel="Open Organizer Office"
                onPress={() =>
                  router.push({
                    pathname: '/office/[scopeId]',
                    params: { scopeId: effectiveContainerId },
                  } as any)
                }
                style={styles.headerButton}
              >
                <MaterialCommunityIcons
                  name="briefcase-outline"
                  size={23}
                  color={theme.accent}
                />
              </ConnectPressable>
              <BuklodScopeCallLauncher
                scopeId={effectiveContainerId}
                title={title}
                compact
              />
            </View>
          ) : undefined
        }
      />

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
              theme.accent
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
                  effectiveContainerId,
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
              theme.accent
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
              theme.accent
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
          scopeId={effectiveContainerId}
          title={title}
        />
      ) : null
      )}
      <View
        ref={threadBodyRef}
        onLayout={() => {
          resyncComposerInset();
        }}
        style={{ flex: 1 }}
      >
<FlatList
        ref={listRef}
        style={{ flex: 1 }}
        data={visibleMessages}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
        removeClippedSubviews={false}
        initialNumToRender={
          FLATLIST_TUNING.connectThread.initialNumToRender
        }
        maxToRenderPerBatch={
          FLATLIST_TUNING.connectThread.maxToRenderPerBatch
        }
        updateCellsBatchingPeriod={
          FLATLIST_TUNING.connectThread.updateCellsBatchingPeriod
        }
        windowSize={
          FLATLIST_TUNING.connectThread.windowSize
        }
        keyExtractor={
          item =>
            item.id
        }
        contentContainerStyle={[
          styles.messages,
          {
            paddingBottom:
              CONNECT_COMPOSER_RESERVED_HEIGHT +
              composerBottom +
              18,
          },
        ]}
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
            {hiddenMessageCount > 0 ? (
              <>
                <Text
                  style={
                    styles.emptyTitle
                  }
                >
                  {hiddenMessageCount}{' '}
                  hidden message
                  {hiddenMessageCount === 1
                    ? ''
                    : 's'}
                </Text>
                <Pressable
                  onPress={() =>
                    void handleRestoreHiddenMessages()
                  }
                  style={
                    styles.restoreButton
                  }
                >
                  <Text
                    style={
                      styles.restoreButtonText
                    }
                  >
                    Restore chat history
                  </Text>
                </Pressable>
              </>
            ) : (
              <Text
                style={
                  styles.emptyTitle
                }
              >
                Start the conversation
              </Text>
            )}
          </View>
        }
        
        onScroll={(event) => {
          const {
            contentOffset,
            contentSize,
            layoutMeasurement,
          } = event.nativeEvent;

          connectScrollOffsetRef.current =
            contentOffset.y;

          const distanceFromBottom =
            contentSize.height -
            (
              contentOffset.y +
              layoutMeasurement.height
            );

          connectReadingOlderRef.current =
            distanceFromBottom > 120;
        }}
        scrollEventThrottle={16}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
        }}
        renderItem={({
          item,
        }) => {
          const own =
            item.sender_id ===
            profileId;

          const messageDeleted =
            isConnectDeletedMessage(
              item
            );

          const parsedReply =
            parseConnectReplyBody(
              item.body
            );
          const messageBody =
            parsedReply.text;
          const replySource =
            parsedReply.replyToId
              ? messageById.get(
                  parsedReply.replyToId
                )
              : null;
          const replyQuote =
            parsedReply.replyToId
              ? {
                  senderName:
                    replySource?.sender_id ===
                    profileId
                      ? 'You'
                      : resolvePersonDisplayName(
                          replySource?.sender_name ??
                            title,
                          replySource?.sender_id,
                        ),
                  text:
                    getConnectMessagePreview(
                      replySource ?? {
                        id:
                          parsedReply.replyToId,
                        sender_id: '',
                        body: '',
                      }
                    ),
                }
              : null;

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
            ) ||
            !!item.pending_album?.length ||
            parseConnectAlbumBody(
              messageBody
            ).paths.length > 0;

          const albumCaption =
            parseConnectAlbumBody(
              messageBody
            ).caption;

          const photoUrls =
            item.pending_album?.length
              ? item.pending_album.map(
                  photo => photo.uri
                )
              : getConnectMessageImagePaths(
                  item
                )
                  .map(path =>
                    attachmentUrls[path] ??
                    (
                      isConnectStoragePath(
                        path
                      )
                        ? null
                        : path
                    )
                  )
                  .filter(
                    (uri): uri is string =>
                      !!uri
                  );

          /* PATCH_172A_AVATAR_BUBBLE */
          const avatarReaction =
            messageDeleted
              ? null
              : parseAvatarReaction(
                  messageBody
                );

          /* PATCH_172A_R5_STANDALONE_REACTION */
          const standaloneEmojiReaction =
            mode === 'direct' &&
            !messageDeleted &&
            !avatarReaction &&
            !item.attachment_path &&
            (
              (
                QUICK_SEND_EMOJIS as readonly string[]
              ).includes(
                messageBody.trim()
              ) ||
              (
                EXTENDED_SEND_EMOJIS as readonly string[]
              ).includes(
                messageBody.trim()
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
          const deliveryLabel =
            own && mode === 'direct'
              ? (
                  item.delivery_state === 'not_sent'
                    ? '\u2022 Not sent'
                    : item.delivery_state === 'pending'
                      ? '\u2022 Sending'
                      : (
                          directPeerReadAt &&
                          new Date(directPeerReadAt).getTime() >=
                            new Date(item.created_at).getTime()
                        )
                        ? '\u2022 Seen'
                        : '\u2022 Sent'
                )
              : null;

          void hasMine;

          return (
            <View>
            <ConnectMessageBubble
              own={own}
              deleted={messageDeleted}
              replyQuote={replyQuote}
              showSenderAvatar={mode === 'direct'}
              senderUserId={item.sender_id}
              senderName={
                own
                  ? ((profile as any)?.full_name || 'You')
                  : resolvePersonDisplayName(
                      item.sender_name ?? title,
                      item.sender_id,
                    )
              }
              senderLabel={
                mode === 'scope' && !own && item.sender_name
                  ? repairBuklodMessageText(item.sender_name)
                  : null
              }
              standaloneReaction={standaloneReaction}
              avatarReaction={avatarReaction}
              standaloneEmoji={
                standaloneEmojiReaction
                  ? repairBuklodMessageText(messageBody).trim()
                  : null
              }
              bodyText={
                !messageDeleted &&
                !avatarReaction &&
                !standaloneEmojiReaction &&
                albumCaption
                  ? repairMojibakeText(
                      repairBuklodMessageText(
                        cleanSharedPostBody(albumCaption)
                      )
                    )
                  : null
              }
              sharedPostSlot={
                !messageDeleted &&
                !avatarReaction &&
                !standaloneEmojiReaction &&
                messageBody ? (
                  <BuklodSharedPostPhotoPreview185AR5
                    body={messageBody}
                  />
                ) : null
              }
              photoUrl={!messageDeleted && isPhoto ? imageUrl : null}
              photoUrls={!messageDeleted && isPhoto ? photoUrls : []}
              isGif={
                photoUrls.length <= 1 &&
                item.attachment_mime === 'image/gif'
              }
              fileName={
                !messageDeleted &&
                item.attachment_path &&
                !isPhoto
                  ? (item.attachment_name || 'Attachment')
                  : null
              }
              fileSizeLabel={
                !messageDeleted &&
                item.attachment_path &&
                !isPhoto
                  ? formatConnectBytes(item.attachment_size)
                  : null
              }
              timeLabel={formatConnectTimestamp(item.created_at)}
              deliveryLabel={deliveryLabel}
              deliveryNotSent={item.delivery_state === 'not_sent'}
              stampEmoji={
                (
                  mineReaction ??
                  REACTIONS.find(
                    reaction =>
                      (summary.counts[reaction.key] ?? 0) > 0
                  )
                )?.emoji
              }
              totalReactions={totalReactions}
              pickerOpen={false}
              reactionOptions={REACTIONS.map(reaction => ({
                key: reaction.key,
                emoji: reaction.emoji,
                label: reaction.label,
                count: summary.counts[reaction.key] ?? 0,
                selected: summary.mine === reaction.key,
              }))}
              onLongPress={anchor =>
                openMessageActions(
                  item,
                  anchor,
                )
              }
              onReact={key =>
                void reactToMessage(
                  item.id,
                  key as ReactionKey
                )
              }
              onOpenPhoto={index => {
                if (photoUrls.length) {
                  setPhotoViewer({
                    uris: photoUrls,
                    index: Math.max(
                      0,
                      Math.min(
                        index ?? 0,
                        photoUrls.length - 1
                      )
                    ),
                  });
                  return;
                }

                if (item.attachment_path) {
                  void openConnectAttachment(
                    item.attachment_path
                  );
                }
              }}
              onOpenFile={() =>
                item.attachment_path
                  ? void openConnectAttachment(
                      item.attachment_path
                    ).catch((e: any) =>
                      Alert.alert(
                        'Attachment',
                        e?.message || String(e)
                      )
                    )
                  : undefined
              }
            />
            {own && item.delivery_state === 'not_sent' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry send"
                onPress={() => retryFailedMessage(item)}
                style={{
                  alignSelf: 'flex-end',
                  minHeight: 44,
                  marginTop: -6,
                  marginBottom: 8,
                  paddingHorizontal: 12,
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    color: theme.accent,
                    fontSize: 12.5,
                    fontWeight: '800',
                  }}
                >
                  Retry
                </Text>
              </Pressable>
            ) : null}
            </View>
          );
        }}
      />

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: composerBottom,
          zIndex: 20,
        }}
      >
      <ConnectComposer
        mode={mode}
        draft={draft}
        selectedFile={
          file
            ? {
                name: file.name,
                sizeLabel: formatConnectBytes(file.size),
                isImage: file.mimeType
                  .toLowerCase()
                  .startsWith('image/'),
              }
            : null
        }
        selectedPhotos={photos.map(photo => ({
          id: photo.id,
          uri: photo.uri,
        }))}
        inputRef={composerInputRef}
        replyToName={
          replyTo
            ? replyTo.sender_id === profileId
              ? 'You'
              : resolvePersonDisplayName(
                  replyTo.sender_name ?? title,
                  replyTo.sender_id,
                )
            : null
        }
        replyToPreview={
          replyTo
            ? getConnectMessagePreview(replyTo)
            : null
        }
        onClearReply={clearReply}
        onChangeDraft={value => {
          draftRef.current = value;
          setDraft(value);
        }}
        onSend={send}
        onAttachPress={handleAttachPress}
        onChoosePhoto={() => void choosePhoto()}
        onClearFile={() => {
          fileRef.current = null;
          setFile(null);
        }}
        onPhotoPress={id => {
          const index = photos.findIndex(
            photo => photo.id === id
          );
          if (index < 0) return;
          setPhotoViewer({
            uris: photos.map(photo => photo.uri),
            index,
          });
        }}
        onPhotoLongPress={id => {
          const photo = photos.find(
            item => item.id === id
          );
          if (!photo) return;
          const index = photos.findIndex(
            item => item.id === id
          );

          Alert.alert('Photo', undefined, [
            {
              text: 'Edit',
              onPress: () => {
                setPhotoEditorTargetId(id);
                setPhotoEditorSource(photo);
              },
            },
            {
              text: 'View full screen',
              onPress: () =>
                setPhotoViewer({
                  uris: photos.map(item => item.uri),
                  index: Math.max(0, index),
                }),
            },
            {
              text: 'Remove',
              style: 'destructive',
              onPress: () =>
                setPhotos(current =>
                  current.filter(item => item.id !== id)
                ),
            },
            {
              text: 'Cancel',
              style: 'cancel',
            },
          ]);
        }}
        onRemovePhoto={id => {
          setPhotos(current =>
            current.filter(item => item.id !== id)
          );
        }}
        onMovePhoto={(id, direction) => {
          setPhotos(current => {
            const index = current.findIndex(
              item => item.id === id
            );
            const nextIndex = index + direction;
            if (
              index < 0 ||
              nextIndex < 0 ||
              nextIndex >= current.length
            ) {
              return current;
            }

            const next = [...current];
            const [moved] = next.splice(index, 1);
            next.splice(nextIndex, 0, moved);
            return next;
          });
        }}
        onOpenComposerPicker={() => {
          setComposerPickerTab('emoji');
          setComposerPickerOpen(true);
        }}
      />
      </View>
      </View>

      <ConnectMessageActionSheet
        visible={!!actionTargetMessage}
        anchor={actionAnchor}
        own={
          actionTargetMessage?.sender_id ===
          profileId
        }
        reactionOptions={
          actionTargetMessage
            ? REACTIONS.map(reaction => {
                const summary =
                  reactions[
                    actionTargetMessage.id
                  ] ?? {
                    counts: emptyCounts(),
                    mine: null,
                  };

                return {
                  key: reaction.key,
                  emoji: reaction.emoji,
                  label: reaction.label,
                  count:
                    summary.counts[reaction.key] ?? 0,
                  selected:
                    summary.mine === reaction.key,
                };
              })
            : []
        }
        onReact={key => {
          if (!actionTargetMessage) {
            return;
          }

          void reactToMessage(
            actionTargetMessage.id,
            key as ReactionKey
          );
        }}
        onClose={closeMessageActions}
        onReply={handleMessageReply}
        onCopy={() => void handleMessageCopy()}
        onForward={() => void handleMessageForward()}
        onDeleteForMe={() =>
          void handleDeleteForMe()
        }
        onDeleteForEveryone={() =>
          void handleDeleteForEveryone()
        }
      />

      <ConnectComposerPicker
        visible={composerPickerOpen}
        tab={composerPickerTab}
        sending={uploadingAttachment}
        emojis={EXTENDED_SEND_EMOJIS}
        avatarChoices={AVATAR_SEND_REACTIONS}
        profileId={profileId}
        profileName={(profile as any)?.full_name || 'You'}
        gifs={CONNECT_GIF_CATALOG}
        onClose={() => setComposerPickerOpen(false)}
        onTabChange={setComposerPickerTab}
        onNativeKeyboard={() => {
          setComposerPickerOpen(false);
          requestAnimationFrame(() =>
            composerInputRef.current?.focus()
          );
        }}
        onSendEmoji={insertDraftEmoji}
        onSendGif={gifId => {
          void sendCatalogGif(gifId);
        }}
        onSendAvatar={key => sendAvatarReaction(key)}
      />
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
                  theme.accent
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
                  theme.accent
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
          onCancel={() => {
            setPhotoEditorSource(null);
            setPhotoEditorTargetId(null);
          }}
          onDone={edited => {
            const nextPhoto: ConnectPickedFile = {
              uri: edited.uri,
              name: `photo-${Date.now()}.jpg`,
              mimeType: edited.mimeType,
              size: edited.sizeBytes,
            };

            if (photoEditorTargetId) {
              setPhotos(current =>
                current.map(photo =>
                  photo.id === photoEditorTargetId
                    ? {
                        ...photo,
                        ...nextPhoto,
                      }
                    : photo
                )
              );
            }

            setPhotoEditorSource(null);
            setPhotoEditorTargetId(null);
          }}
        />
        <ConnectPhotoViewer
          visible={!!photoViewer}
          uris={photoViewer?.uris ?? []}
          initialIndex={photoViewer?.index ?? 0}
          onClose={() => setPhotoViewer(null)}
        />
    </ConnectThreadBackground>
  );
}

function createThreadStyles(theme: ConnectThemeRoles) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor:
        theme.canvas,
    },

    center: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        theme.canvas,
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
        theme.border,
      backgroundColor:
        theme.headerSurface,
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
        theme.accentMuted,
    },

    headerCopy: {
      flex: 1,
      minWidth: 0,
    },

    headerTitle: {
      color: theme.textPrimary,
      fontSize: 15,
      fontWeight: '900',
    },

    headerSub: {
      marginTop: 1,
      color: theme.accent,
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
        theme.accentMuted,
    },

    noteText: {
      flex: 1,
      color:
        theme.accent,
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
      color: theme.textPrimary,
      fontSize: 15.5,
      fontWeight: '900',
    },

    restoreButton: {
      marginTop: 10,
      minHeight: 38,
      paddingHorizontal: 14,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accentMuted,
      borderWidth: 1,
      borderColor: theme.border,
    },

    restoreButtonText: {
      color: theme.accent,
      fontSize: 12,
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
        theme.accent,
      borderBottomRightRadius:
        5,
    },

    bubbleOther: {
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        theme.border,
      borderBottomLeftRadius:
        5,
    },

    sender: {
      marginBottom: 4,
      color: theme.accent,
      fontSize: 12,
      fontWeight: '900',
    },

    body: {
      color: theme.textPrimary,
      fontSize: 14.5,
      lineHeight: 21,
    },

    bodyOwn: {
      color: '#FFFFFF',
    },

    time: {
      color: theme.textMuted,
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
        theme.accent,
      fontSize: 12.5,
      fontWeight: '900',
    },

    fileSize: {
      marginTop: 2,
      color: theme.textMuted,
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
        theme.accent,
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
        theme.border,
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
        theme.accentMuted,
      borderWidth: 1,
      borderColor:
        theme.accent,
    },

    reactionInlineEmoji: {
      fontSize: 16,
      lineHeight: 20,
    },

    reactionInlineCount: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '900',
    },

    reactionInlineCountSelected: {
      color:
        theme.accent,
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
      color: theme.accent,
      fontSize: 12.5,
      fontWeight: '900',
    },

    avatarStickerLabelOwn: {
      color: theme.accent,
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
      borderColor: theme.border,
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
        theme.accentMuted,
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
      color: theme.textPrimary,
      fontSize: 17,
      fontWeight: '900',
    },

    modernPickerSub: {
      marginTop: 2,
      color: theme.textMuted,
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
      color: theme.textMuted,
      fontSize: 12.5,
      fontWeight: '900',
    },

    modernPickerTabTextOn: {
      color: theme.accent,
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
      borderColor: theme.border,
      borderRadius: 15,
      backgroundColor:
        '#F8FAF9',
    },

    nativeEmojiTitle: {
      color: theme.textPrimary,
      fontSize: 13.5,
      fontWeight: '900',
    },

    nativeEmojiSub: {
      marginTop: 2,
      color: theme.textMuted,
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
      color: theme.textPrimary,
      fontSize: 16,
      fontWeight: '900',
    },

    gifPickerText: {
      maxWidth: 330,
      marginTop: 6,
      color: theme.textMuted,
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
        theme.accent,
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
      borderColor: theme.border,
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
      color: theme.accent,
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
      color: theme.textMuted,
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
      borderColor: theme.border,
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
      color: theme.accent,
      fontSize: 12.5,
      fontWeight: '900',
    },

    attachPopoverDivider: {
      width: 1,
      height: 22,
      backgroundColor: theme.border,
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
        theme.border,
      borderRadius: 13,
      backgroundColor:
        '#FFFFFF',
    },

    selectedName: {
      color: theme.textPrimary,
      fontSize: 12.5,
      fontWeight: '900',
    },

    selectedSize: {
      marginTop: 2,
      color: theme.textMuted,
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
        theme.border,
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
        theme.accentMuted,
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
        theme.border,
      borderRadius: 16,
      backgroundColor:
        '#F8FAF9',
      color: theme.textPrimary,
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
        theme.accent,
    },

    modalBackdrop: {
      flex: 1,
      justifyContent:
        'flex-end',
      backgroundColor:
        'rgba(0,0,0,0.55)',
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
        theme.surfaceElevated,
    },

    sheetHandle: {
      alignSelf:
        'center',
      width: 42,
      height: 4,
      marginBottom: 10,
      borderRadius: 2,
      backgroundColor:
        theme.border,
    },

    sheetTitle: {
      marginBottom: 8,
      color: theme.textPrimary,
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
        theme.border,
      borderRadius: 13,
      backgroundColor:
        theme.surface,
    },

    optionRowSelected: {
      borderColor:
        theme.accent,
      backgroundColor:
        theme.accentMuted,
      borderWidth: 2,
    },

    optionEmoji: {
      width: 30,
      textAlign: 'center',
      fontSize: 21,
    },

    optionTitle: {
      color: theme.textPrimary,
      fontSize: 14,
      fontWeight: '900',
    },

    optionSub: {
      marginTop: 2,
      color: theme.textMuted,
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
      color: theme.textMuted,
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
}




export default function BuklodConnectThread(props: Props) {
  return (
    <ConnectThemeProvider>
      <ChatBackgroundProvider
        threadId={props.containerId}
      >
        <BuklodConnectThreadInner {...props} />
      </ChatBackgroundProvider>
    </ConnectThemeProvider>
  );
}
