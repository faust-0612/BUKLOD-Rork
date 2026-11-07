/* PATCH_186J_R2_SINGLE_SHARED_POST_PHOTO */
/* PATCH_185A_R5_DIRECT_THREAD_LOADING_SAFE: existing direct guard retained */
/* PATCH_180A_R7_EXACT_CHAT_BODY_MOJIBAKE */
﻿import { ensureBuklodStreamVideoClient } from '@/lib/buklodStreamVideoClient';
import {
  buildBuklodPersonalCallId,
  formatBuklodCallStartError,
} from '@/lib/buklodStreamCall';
import {
  restoreActiveNonPttCallIfAny,
} from '@/lib/buklodActiveNonPttCall';
import { repairMojibakeText } from '@/lib/repairMojibakeText';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConnectComposerKeyboardInset, CONNECT_COMPOSER_RESERVED_HEIGHT } from '@/lib/useConnectComposerKeyboardInset';
import {
  isBuklodScopedWorkspacePath,
  normalizeBuklodPathname,
  useBuklodPersistentNavOccupiedHeight,
} from '@/lib/buklodSafeArea';
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
  useFocusEffect,
  usePathname,
} from 'expo-router';

import {
  Image as ExpoImage,
} from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import {
  useStreamVideoClient,
} from '@/lib/streamVideoSdk';
import { supabase } from '@/lib/supabase';
import { notifyConnectRead } from '@/lib/connectReadSync';
import { playBuklodCue, setBuklodActiveMessageThread } from '@/lib/buklodSounds';
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
import { HIBLA, hiblaCalendarDay, hiblaDayHeading } from '@/lib/connectHibla';
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
  fetchDirectConnectHistoryPage,
  fetchScopeConnectHistoryPage,
} from '@/lib/buklodConnectMessageHistory';
import {
  CONNECT_LOAD_OLDER_PX,
  CONNECT_NEAR_BOTTOM_PX,
  connectBubbleGrouping,
  connectPhotoSlots,
  connectScrollAction,
  connectSignedUrlNeedsRefresh,
  connectThreadSessionKey,
  connectComposerDockBottom,
  mergeConnectServerMessages,
  readersForMessageWindow,
  roomCursorCoversMessage,
  shouldAdvanceConnectReadCursor,
  type ConnectReadCursorReason,
  type ConnectScopeReader,
} from '@/lib/connectChatWindow';
import {
  fetchScopeConnectReaders,
} from '@/lib/connectScopeReaders';
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
  storagePath?: string | null;
  storageMeta?: {
    path: string;
    name: string;
    mimeType: string;
    size: number;
  } | null;
  uploadState?: 'pending' | 'uploading' | 'uploaded' | 'failed';
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

function BuklodConnectThreadInner({
  mode,
  containerId,
  initialTitle,
  initialSubtitle,
  initialOtherUserId,
  pendingTargetUserId,
  onBackOverride,
}: Props) {
  // Web dock closes in-place on navigation, lookup failure and Back.
  // Keep the override in a ref so pending RPCs do not restart on re-renders.
  const dockBackRef = useRef(onBackOverride);
  dockBackRef.current = onBackOverride;
  const leaveThread = useCallback(() => {
    if (dockBackRef.current) dockBackRef.current();
    else router.back();
  }, []);

  /* PATCH_169G_CONNECT_SAFE_INSETS */
  const insets =
    useSafeAreaInsets();
  const pathname = usePathname();
  const navOccupied =
    useBuklodPersistentNavOccupiedHeight();
  const threadBodyRef =
    useRef<View | null>(null);
  const {
    composerBottom,
    keyboardVisible,
    clearComposerInset,
    resyncComposerInset,
  } = useConnectComposerKeyboardInset(threadBodyRef);
  /*
   * Public Connect routes no longer render/reserve the old persistent nav pane,
   * but useBuklodPersistentNavOccupiedHeight can still report height there.
   * Dock the write-message row above the phone/system nav instead of hiding under it.
   */
  // Public navigation is outside the thread viewport; avoid duplicate safe-area clearance.
  const shellReservesPersistentNav =
    navOccupied > 0 &&
    !isBuklodScopedWorkspacePath(pathname) &&
    !normalizeBuklodPathname(pathname).startsWith('/connect/personal/') &&
    !normalizeBuklodPathname(pathname).startsWith('/connect/community/');
  // Standalone/scoped threads without public navigation retain phone clearance.
  const phoneNavClearance = shellReservesPersistentNav
    ? 0
    : Math.max(insets.bottom, 8) + 12;
  // The IME replaces the phone-navigation clearance, it does not add to it.
  // In particular an embedded Cluster/Org thread can already be resized by
  // Android and must not float a second safe-area gap above the keyboard.
  const composerDockBottom = connectComposerDockBottom(
    keyboardVisible,
    composerBottom,
    phoneNavClearance
  );

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

  useFocusEffect(useCallback(() => {
    if (!effectiveContainerId) return;
    setBuklodActiveMessageThread(effectiveContainerId);
    return () => setBuklodActiveMessageThread(null);
  }, [effectiveContainerId]));

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
          const callClient = await ensureBuklodStreamVideoClient();

          /*
           * If any normal BUKLOD call is already live,
           * the Call button is a "return to call" action.
           * Never mint a second ringing call while one is active.
           */
          if (
            restoreActiveNonPttCallIfAny(
              callClient.state.calls
            )
          ) {
            return;
          }

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
    scopeReaders,
    setScopeReaders,
  ] = useState<ConnectScopeReader[]>([]);
  const [scopeReadersAvailable, setScopeReadersAvailable] = useState(false);

  const [
    seenDetail,
    setSeenDetail,
  ] = useState<{ messageId: string; readers: ConnectScopeReader[]; available: boolean } | null>(null);

  const [
    hasOlder,
    setHasOlder,
  ] = useState(false);

  const [
    loadingOlder,
    setLoadingOlder,
  ] = useState(false);

  const [
    listAnchored,
    setListAnchored,
  ] = useState(false);
  const [historyLoadError, setHistoryLoadError] =
    useState<string | null>(null);

  const [
    awayFromLatest,
    setAwayFromLatest,
  ] = useState(false);

  const [
    newWhileAway,
    setNewWhileAway,
  ] = useState(0);

  const [
    failedAttachmentPaths,
    setFailedAttachmentPaths,
  ] = useState<Record<string, boolean>>({});

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
        leaveThread();
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
        leaveThread();
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
      () =>
        messages.filter(
          item =>
            !hiddenMessageIds.has(
              item.id
            )
        ),
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

  const connectScrollOffsetRef =
    useRef(0);

  const nearBottomRef =
    useRef(true);

  const listAnchoredRef =
    useRef(false);

  const pendingVisibleReadRef =
    useRef<ConnectReadCursorReason | null>(null);

  const pinLatestOnOpenRef =
    useRef(true);

  const followOwnSendRef =
    useRef(false);

  const suppressStickRef =
    useRef(false);

  const initialLoadSettledRef =
    useRef(false);

  const olderPagesLoadedRef =
    useRef(false);

  const loadingOlderRef =
    useRef(false);

  const historyCursorRef =
    useRef<{
      createdAt: string;
      id: string;
    } | null>(null);

  const messagesLengthRef =
    useRef(0);

  const messagesRef =
    useRef<Message[]>([]);

  const contentHeightRef =
    useRef(0);

  const attachmentSignedAtRef =
    useRef<Record<string, number>>({});

  const attachmentSigningRef =
    useRef<Map<string, Promise<string | null>>>(
      new Map()
    );

  const attachmentRetryRef =
    useRef<Record<string, number>>({});

  const threadSessionKeyValue =
    connectThreadSessionKey({
      profileId,
      mode,
      containerId: effectiveContainerId,
    });

  const [
    threadSession,
    setThreadSession,
  ] = useState(threadSessionKeyValue);
  const [offlineHydrated, setOfflineHydrated] = useState(false);

  if (threadSession !== threadSessionKeyValue) {
    setThreadSession(threadSessionKeyValue);
    setOfflineHydrated(false);
    setMessages([]);
    setReactions({});
    setAttachmentUrls({});
    setDirectPeerReadAt(null);
    setScopeReaders([]);
    setScopeReadersAvailable(false);
    setSeenDetail(null);
    setHasOlder(false);
    setLoadingOlder(false);
    setListAnchored(false);
    setHistoryLoadError(null);
    listAnchoredRef.current = false;
    pendingVisibleReadRef.current = null;
    setAwayFromLatest(false);
    setNewWhileAway(0);
    setFailedAttachmentPaths({});
    pinLatestOnOpenRef.current = true;
    followOwnSendRef.current = false;
    suppressStickRef.current = false;
    initialLoadSettledRef.current = false;
    olderPagesLoadedRef.current = false;
    loadingOlderRef.current = false;
    historyCursorRef.current = null;
    messagesLengthRef.current = 0;
    messagesRef.current = [];
    contentHeightRef.current = 0;
    nearBottomRef.current = true;
    attachmentSignedAtRef.current = {};
    attachmentSigningRef.current = new Map();
    attachmentRetryRef.current = {};
  }

  messagesLengthRef.current = messages.length;
  messagesRef.current = messages;

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
    let anchorTimer: ReturnType<typeof setTimeout> | null = null;

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
          // Render locally saved messages immediately while the network
          // refresh and secondary user/reaction lookups continue.
          if (!initialLoadSettledRef.current) {
            initialLoadSettledRef.current = true;
            anchorTimer = setTimeout(() => {
              if (!active || !pinLatestOnOpenRef.current) return;
              listRef.current?.scrollToEnd({ animated: false });
              pinLatestOnOpenRef.current = false;
              nearBottomRef.current = true;
              listAnchoredRef.current = true;
              setListAnchored(true);
            }, 64);
          }
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
      .catch(() => undefined)
      .finally(() => {
        if (active) setOfflineHydrated(true);
      });

    return () => {
      active = false;
      if (anchorTimer) clearTimeout(anchorTimer);
    };
  }, [
    connectThreadOfflineCacheKey,
    effectiveContainerId,
    profileId,
  ]);

  useEffect(() => {
    if (
      !profileId ||
      !effectiveContainerId ||
      !offlineHydrated
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
    offlineHydrated,
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

  const markVisibleRoomRead = (
    reason: ConnectReadCursorReason
  ) => {
    if (
      !effectiveContainerId ||
      !profileId ||
      !shouldAdvanceConnectReadCursor({
        listAnchored: listAnchoredRef.current,
        nearLatest: nearBottomRef.current,
        reason,
      })
    ) {
      return;
    }

    pendingVisibleReadRef.current = null;

    const containerId = effectiveContainerId;
    const readMode = mode;

    void (async () => {
      const result = await (supabase as any).rpc(
        readMode === 'direct'
          ? 'buklod_connect_mark_direct_read'
          : 'buklod_connect_mark_scope_read',
        readMode === 'direct'
          ? { _thread_id: containerId }
          : { _scope_id: containerId }
      );

      if (result.error) {
        console.warn(
          'Connect mark read:',
          result.error.message
        );
        return;
      }

      // Only a confirmed database cursor update may clear unread UI.
      notifyConnectRead(profileId);

      if (readMode === 'scope') {
        const readers = await fetchScopeConnectReaders(
          containerId
        );
        if (readers) {
          setScopeReaders(readers);
          setScopeReadersAvailable(true);
        }
        return;
      }

      void loadPeerRead();
    })();
  };

  const scheduleInitialAnchor = (
    markOnReveal = false
  ) => {
    const action = connectScrollAction({
      intent: 'open',
      nearBottom: nearBottomRef.current,
      initialSettled: initialLoadSettledRef.current,
    });

    if (action === 'wait') {
      return;
    }

    setTimeout(() => {
      if (!pinLatestOnOpenRef.current) {
        return;
      }

      if (messagesLengthRef.current < 1) {
        pinLatestOnOpenRef.current = false;
        nearBottomRef.current = true;
        listAnchoredRef.current = true;
        setListAnchored(true);
        if (markOnReveal) {
          markVisibleRoomRead('open');
        }
        return;
      }

      listRef.current?.scrollToEnd({
        animated: false,
      });

      setTimeout(() => {
        listRef.current?.scrollToEnd({
          animated: false,
        });
        pinLatestOnOpenRef.current = false;
        nearBottomRef.current = true;
        listAnchoredRef.current = true;
        setAwayFromLatest(false);
        setNewWhileAway(0);
        setListAnchored(true);
        if (markOnReveal) {
          markVisibleRoomRead('open');
        }
      }, 32);
    }, 48);
  };

  const applyHistoryPage = (
    page: {
      messages: Message[];
      hasOlder: boolean;
      oldestCursor: {
        createdAt: string;
        id: string;
      } | null;
    }
  ) => {
    const current = messagesRef.current;
    const next = mergeConnectServerMessages(
      page.messages,
      current,
      olderPagesLoadedRef.current
        ? 'retain-older'
        : 'replace'
    );

    if (
      initialLoadSettledRef.current &&
      !pinLatestOnOpenRef.current &&
      !nearBottomRef.current
    ) {
      const known = new Set(
        current.map(item => item.id)
      );
      const incoming = next.filter(
        item =>
          !known.has(item.id) &&
          !String(item.id).startsWith('local-') &&
          item.sender_id !== profileId
      );

      if (incoming.length) {
        setNewWhileAway(
          count => count + incoming.length
        );
      }
    }

    messagesRef.current = next;
    messagesLengthRef.current = next.length;
    setMessages(next);

    if (!olderPagesLoadedRef.current) {
      setHasOlder(page.hasOlder);
      historyCursorRef.current = page.oldestCursor;
    }
  };

  // Bound message/reaction bursts to one history request plus one trailing refresh.
  // Each thread session has its own generation so late results cannot replace
  // another conversation after a fast navigation.
  const loadInFlightRef = useRef(false);
  const loadQueuedRef = useRef(false);
  const loadSessionRef = useRef(threadSessionKeyValue);
  const currentLoadSessionRef = useRef(threadSessionKeyValue);
  currentLoadSessionRef.current = threadSessionKeyValue;

  const load =
    useCallback(
      async () => {
        if (
          !effectiveContainerId ||
          !profileId
        ) {
          return;
        }

        const requestSession = threadSessionKeyValue;
        if (
          loadInFlightRef.current &&
          loadSessionRef.current === requestSession
        ) {
          loadQueuedRef.current = true;
          return;
        }

        if (loadSessionRef.current !== requestSession) {
          loadQueuedRef.current = false;
        }
        loadSessionRef.current = requestSession;
        loadInFlightRef.current = true;
        setHistoryLoadError(null);

        try {
        const newestBeforeLoad =
          messagesRef.current[messagesRef.current.length - 1] ?? null;

        if (
          mode === 'direct'
        ) {
          const [details, page] =
            await Promise.all([
              (supabase as any).rpc(
                'buklod_connect_direct_thread_details',
                {
                  _thread_id: effectiveContainerId,
                }
              ),
              fetchDirectConnectHistoryPage(
                effectiveContainerId
              ),
            ]);
          
          if (currentLoadSessionRef.current !== requestSession) {
            return;
          }

          if (details.error) {
            Alert.alert(
              'Connect',
              details.error.message
            );

            leaveThread();
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

          applyHistoryPage(page);
        }
        else {
          const [details, page] =
            await Promise.all([
              (supabase as any).rpc(
                'buklod_connect_room_details',
                {
                  _scope_id: effectiveContainerId,
                }
              ),
              fetchScopeConnectHistoryPage(
                effectiveContainerId
              ),
            ]);

          if (currentLoadSessionRef.current !== requestSession) {
            return;
          }

          if (details.error) {
            Alert.alert(
              'Community Connect',
              details.error.message
            );

            leaveThread();
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

          applyHistoryPage(page);

          // Reader avatars are secondary to displaying the conversation.
          if (!initialLoadSettledRef.current) {
            void fetchScopeConnectReaders(
              effectiveContainerId
            ).then(readers => {
              if (currentLoadSessionRef.current === requestSession) {
                setScopeReaders(readers ?? []);
                setScopeReadersAvailable(readers !== null);
              }
            }).catch(() => undefined);
          }
        }

        // Reactions have their own realtime listener. Avoid refetching the
        // full reaction table on every new message, and do not gate first paint.
        if (!initialLoadSettledRef.current) {
          void loadReactions();
        }

        const newestAfterLoad =
          messagesRef.current[messagesRef.current.length - 1] ?? null;
        const hasNewerMessage =
          !!newestAfterLoad &&
          (
            !newestBeforeLoad ||
            newestAfterLoad.id !== newestBeforeLoad.id ||
            newestAfterLoad.created_at !== newestBeforeLoad.created_at
          );
        const reloading =
          initialLoadSettledRef.current;
        initialLoadSettledRef.current = true;

        if (!reloading) {
          scheduleInitialAnchor(true);
        } else if (
          nearBottomRef.current &&
          listAnchoredRef.current &&
          hasNewerMessage
        ) {
          // Wait until the new row is scrolled into view. now() before that
          // would cover a message the reader has not seen yet.
          pendingVisibleReadRef.current = 'incoming';
        } else if (
          nearBottomRef.current &&
          listAnchoredRef.current &&
          !hasNewerMessage
        ) {
          markVisibleRoomRead('reconnect');
        }
      } catch (error: any) {
        if (currentLoadSessionRef.current !== requestSession) {
          return;
        }
        console.warn(
          'Connect history load:',
          error?.message ?? error
        );
        setHistoryLoadError('Messages could not be refreshed. Check your connection and retry.');

        initialLoadSettledRef.current = true;
        scheduleInitialAnchor(false);

      } finally {
        if (currentLoadSessionRef.current === requestSession) {
          loadInFlightRef.current = false;
          if (loadQueuedRef.current) {
            loadQueuedRef.current = false;
            void load();
          }
        }
      }
      },
      [
        effectiveContainerId,
        loadReactions,
        mode,
        profileId,
        threadSessionKeyValue,
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
    if (
      mode !== 'scope' ||
      !effectiveContainerId ||
      !profileId
    ) {
      return;
    }

    let active = true;

    const refreshReaders = () => {
      void fetchScopeConnectReaders(
        effectiveContainerId
      ).then(readers => {
        if (active && readers) {
          setScopeReaders(readers);
          setScopeReadersAvailable(true);
        }
      });
    };

    const timer = setInterval(
      refreshReaders,
      SCALE_LIMITS.connectPeerReadPollMs
    );

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [
    effectiveContainerId,
    mode,
    profileId,
  ]);

  const signAttachmentPath = useCallback(
    async (path: string, force = false) => {
      const signedAt =
        attachmentSignedAtRef.current[path] ?? 0;

      if (
        !force &&
        attachmentUrls[path] &&
        !connectSignedUrlNeedsRefresh(
          signedAt,
          Date.now()
        )
      ) {
        return attachmentUrls[path];
      }

      if (!force) {
        const existing =
          attachmentSigningRef.current.get(path);
        if (existing) {
          return existing;
        }
      }

      const task = (async () => {
        const result = await supabase.storage
          .from('connect-files')
          .createSignedUrl(path, 3600);
        const url = result.data?.signedUrl ?? null;

        if (url) {
          attachmentSignedAtRef.current[path] = Date.now();
          setFailedAttachmentPaths(current => {
            if (!current[path]) {
              return current;
            }
            const next = { ...current };
            delete next[path];
            return next;
          });
          setAttachmentUrls(current => ({
            ...current,
            [path]: url,
          }));
        } else {
          setFailedAttachmentPaths(current => ({
            ...current,
            [path]: true,
          }));
        }

        attachmentSigningRef.current.delete(path);
        return url;
      })();

      attachmentSigningRef.current.set(path, task);
      return task;
    },
    [attachmentUrls]
  );

  useEffect(() => {
    const now = Date.now();
    const paths = Array.from(
      new Set(
        messages.flatMap(item => {
          if (item.pending_album?.length) {
            return [];
          }

          return getConnectMessageImagePaths(item).filter(path =>
            isConnectStoragePath(path)
          );
        })
      )
    );

    for (const path of paths) {
      const retries = attachmentRetryRef.current[path] ?? 0;
      const signedAt = attachmentSignedAtRef.current[path] ?? 0;
      const missing = !attachmentUrls[path];
      const expired = connectSignedUrlNeedsRefresh(signedAt, now);
      const failed = !!failedAttachmentPaths[path];

      if (failed && retries >= 3 && !expired) {
        continue;
      }

      if (missing || expired) {
        if (failed) {
          attachmentRetryRef.current[path] = retries + 1;
        }
        void signAttachmentPath(path, expired || failed);
      }
    }
  }, [
    attachmentUrls,
    failedAttachmentPaths,
    messages,
    signAttachmentPath,
  ]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      for (const [path, signedAt] of Object.entries(
        attachmentSignedAtRef.current
      )) {
        if (connectSignedUrlNeedsRefresh(signedAt, now)) {
          void signAttachmentPath(path, true);
        }
      }
    }, 60_000);

    return () => clearInterval(timer);
  }, [signAttachmentPath]);

  const loadOlder = useCallback(async () => {
    if (
      loadingOlderRef.current ||
      !hasOlder ||
      !historyCursorRef.current ||
      !effectiveContainerId
    ) {
      return;
    }

    loadingOlderRef.current = true;
    setLoadingOlder(true);
    suppressStickRef.current = true;

    try {
      const page =
        mode === 'direct'
          ? await fetchDirectConnectHistoryPage(
              effectiveContainerId,
              SCALE_LIMITS.connectOlderPage,
              historyCursorRef.current
            )
          : await fetchScopeConnectHistoryPage(
              effectiveContainerId,
              SCALE_LIMITS.connectOlderPage,
              historyCursorRef.current
            );

      const previousCursor = historyCursorRef.current;
      const cursorMoved =
        !!page.oldestCursor &&
        (
          !previousCursor ||
          page.oldestCursor.id !== previousCursor.id ||
          page.oldestCursor.createdAt !== previousCursor.createdAt
        );
      olderPagesLoadedRef.current = true;
      historyCursorRef.current = page.oldestCursor ?? historyCursorRef.current;
      setHasOlder(
        page.hasOlder &&
          page.messages.length > 0 &&
          cursorMoved
      );
      const next = mergeConnectServerMessages(
        page.messages,
        messagesRef.current,
        'retain-older'
      );
      messagesRef.current = next;
      messagesLengthRef.current = next.length;
      setMessages(next);
    } catch (error: any) {
      console.warn(
        'Connect older history:',
        error?.message ?? error
      );
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [
    effectiveContainerId,
    hasOlder,
    mode,
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

      followOwnSendRef.current = true;
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({
          animated: false,
        });
      });
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
      void playBuklodCue('message_sent');
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
      void playBuklodCue('error');
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

      followOwnSendRef.current = true;
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({
          animated: false,
        });
      });

      void (async () => {
        try {
          const uploaded: Array<{
            path: string;
            name: string;
            mimeType: string;
            size: number;
          }> = [];

          const writeAlbum = (
            nextAlbum: ComposerPhoto[]
          ) => {
            setMessages(current =>
              current.map(item =>
                item.id === localId
                  ? {
                      ...item,
                      pending_album: nextAlbum,
                    }
                  : item
              )
            );
          };

          for (
            let index = 0;
            index < snapshot.length;
            index += 1
          ) {
            const photo = snapshot[index];

            if (photo.storageMeta?.path) {
              uploaded.push(photo.storageMeta);
              continue;
            }

            snapshot[index] = {
              ...photo,
              uploadState: 'uploading',
            };
            writeAlbum([...snapshot]);

            try {
              const row = await uploadConnectFile({
                mode,
                containerId: effectiveContainerId,
                file: photo,
                uniqueKey: `${Date.now()}-${index}-${Math.random()
                  .toString(36)
                  .slice(2, 8)}`,
              });

              snapshot[index] = {
                ...photo,
                storagePath: row.path,
                storageMeta: row,
                uploadState: 'uploaded',
              };
              uploaded.push(row);
              writeAlbum([...snapshot]);
              setAttachmentUrls(current => ({
                ...current,
                [row.path]: photo.uri,
              }));
            } catch (uploadError) {
              snapshot[index] = {
                ...photo,
                uploadState: 'failed',
              };
              writeAlbum([...snapshot]);
              throw uploadError;
            }
          }

          if (uploaded.length !== snapshot.length) {
            throw new Error('Photo upload did not finish.');
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
          void playBuklodCue('message_sent');
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

        followOwnSendRef.current = true;
        requestAnimationFrame(() => {
          listRef.current?.scrollToEnd({
            animated: false,
          });
        });

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
            void playBuklodCue('message_sent');
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
        // Composer docks itself via composerDockBottom; avoid double-counting
        // phone-nav padding under an absolutely positioned write row.
        paddingBottom: 0,
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
        onBack={leaveThread}
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
        style={{ flex: 1, opacity: listAnchored ? 1 : 0 }}
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
              composerDockBottom +
              18,
          },
        ]}
        ListHeaderComponent={
          hasOlder || loadingOlder ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Load earlier messages"
              disabled={loadingOlder}
              onPress={() => {
                void loadOlder();
              }}
              style={{
                minHeight: 44,
                paddingVertical: 12,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {loadingOlder ? (
                <ActivityIndicator color={theme.accent} />
              ) : (
                <Text
                  style={{
                    color: theme.accent,
                    fontSize: 13,
                    fontWeight: '800',
                  }}
                >
                  Load earlier messages
                </Text>
              )}
            </Pressable>
          ) : null
        }
        onContentSizeChange={(_width, height) => {
          const previous = contentHeightRef.current;
          const delta = previous > 0 ? height - previous : 0;
          contentHeightRef.current = height;

          if (suppressStickRef.current) {
            suppressStickRef.current = false;
            return;
          }

          if (
            pinLatestOnOpenRef.current &&
            initialLoadSettledRef.current &&
            messagesLengthRef.current > 0
          ) {
            listRef.current?.scrollToEnd({
              animated: false,
            });
            return;
          }

          if (
            pinLatestOnOpenRef.current &&
            initialLoadSettledRef.current &&
            messagesLengthRef.current < 1
          ) {
            pinLatestOnOpenRef.current = false;
            listAnchoredRef.current = true;
            setListAnchored(true);
            return;
          }

          if (followOwnSendRef.current) {
            followOwnSendRef.current = false;
            listRef.current?.scrollToEnd({
              animated: false,
            });
            nearBottomRef.current = true;
            setAwayFromLatest(false);
            setNewWhileAway(0);
            if (listAnchoredRef.current) {
              pendingVisibleReadRef.current = 'own-send';
              setTimeout(() => {
                markVisibleRoomRead('own-send');
              }, 32);
            }
            return;
          }

          const action = connectScrollAction({
            intent: 'content',
            nearBottom: nearBottomRef.current,
            initialSettled: initialLoadSettledRef.current,
          });

          if (action === 'stick-end' && delta > 1) {
            listRef.current?.scrollToEnd({
              animated: false,
            });
            const pending = pendingVisibleReadRef.current;
            if (pending && listAnchoredRef.current) {
              setTimeout(() => {
                if (nearBottomRef.current) {
                  markVisibleRoomRead(pending);
                }
              }, 32);
            }
          }
        }}
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
            ) : historyLoadError ? (
              <>
                <Text style={styles.emptyTitle}>{historyLoadError}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading messages"
                  onPress={() => void load()}
                  style={styles.restoreButton}
                >
                  <Text style={styles.restoreButtonText}>Retry messages</Text>
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

          const nearBottom =
            distanceFromBottom <= CONNECT_NEAR_BOTTOM_PX;
          const wasNearLatest = nearBottomRef.current;
          nearBottomRef.current = nearBottom;

          if (
            nearBottom &&
            !wasNearLatest &&
            listAnchoredRef.current
          ) {
            markVisibleRoomRead('returned-to-latest');
          }

          if (nearBottom) {
            if (awayFromLatest || newWhileAway > 0) {
              setAwayFromLatest(false);
              setNewWhileAway(0);
            }
          } else if (!awayFromLatest && listAnchored) {
            setAwayFromLatest(true);
          }

          if (
            contentOffset.y <= CONNECT_LOAD_OLDER_PX &&
            hasOlder &&
            !loadingOlderRef.current
          ) {
            void loadOlder();
          }
        }}
        scrollEventThrottle={16}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
        }}
        renderItem={({
          item,
          index,
        }) => {
          const own =
            item.sender_id ===
            profileId;

          const previous = visibleMessages[index - 1];
          const next = visibleMessages[index + 1];
          const dayHeading =
            hiblaCalendarDay(item.created_at) !==
            (previous ? hiblaCalendarDay(previous.created_at) : null)
              ? hiblaDayHeading(item.created_at)
              : null;
          const grouping = connectBubbleGrouping({
            senderId: item.sender_id,
            createdAt: item.created_at,
            previous: previous
              ? {
                  senderId: previous.sender_id,
                  createdAt: previous.created_at,
                }
              : null,
            next: next
              ? {
                  senderId: next.sender_id,
                  createdAt: next.created_at,
                }
              : null,
          });
          const seenReaders =
            mode === 'scope' && own
              ? readersForMessageWindow({
                  messageCreatedAt: item.created_at,
                  nextMessageCreatedAt: next?.created_at ?? null,
                  readers: scopeReaders,
                  selfUserId: profileId,
                })
              : [];

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

          const photoSlots =
            item.pending_album?.length
              ? item.pending_album.map(photo => ({
                  key: photo.id,
                  uri: photo.uri,
                  failed: photo.uploadState === 'failed',
                }))
              : connectPhotoSlots({
                  paths: getConnectMessageImagePaths(item),
                  urls: attachmentUrls,
                  failed: failedAttachmentPaths,
                });
          const photoUrls = photoSlots
            .map(slot => slot.uri)
            .filter((uri): uri is string => !!uri);

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
          const uploadedAlbumCount =
            item.pending_album?.filter(
              photo => photo.uploadState === 'uploaded'
            ).length ?? 0;
          const deliveryLabel =
            own && item.delivery_state === 'not_sent'
              ? '\u2022 Not sent'
              : own && item.delivery_state === 'pending'
                ? item.pending_album && item.pending_album.length > 1
                  ? `\u2022 Sending ${uploadedAlbumCount}/${item.pending_album.length}`
                  : '\u2022 Sending'
                : own && mode === 'direct' && grouping.endsGroup
                  ? (
                      directPeerReadAt &&
                      new Date(directPeerReadAt).getTime() >=
                        new Date(item.created_at).getTime()
                    )
                    ? '\u2022 Seen'
                    : '\u2022 Sent'
                  : null;

          void hasMine;

          return (
            <View>
            {!!dayHeading && (
              <View style={styles.hiblaDayRow} accessibilityRole="header">
                <View style={styles.hiblaDayRule} />
                <View style={styles.hiblaDayPill}>
                  <Text style={styles.hiblaDayText}>{dayHeading}</Text>
                </View>
                <View style={styles.hiblaDayRule} />
              </View>
            )}
            <ConnectMessageBubble
              own={own}
              deleted={messageDeleted}
              replyQuote={replyQuote}
              showSenderAvatar={mode === 'direct' && !own && grouping.startsGroup}
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
                mode === 'scope' &&
                !own &&
                grouping.startsGroup &&
                item.sender_name
                  ? repairBuklodMessageText(item.sender_name)
                  : null
              }
              compact={!grouping.endsGroup}
              showTime={grouping.endsGroup || !!deliveryLabel}
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
              photoSlots={
                !messageDeleted && isPhoto ? photoSlots : undefined
              }
              onRetryPhoto={slotIndex => {
                const path = getConnectMessageImagePaths(item)[slotIndex];
                if (!path || !isConnectStoragePath(path)) {
                  return;
                }

                const retries = attachmentRetryRef.current[path] ?? 0;
                if (retries >= 4) {
                  setFailedAttachmentPaths(current => ({
                    ...current,
                    [path]: true,
                  }));
                  return;
                }

                attachmentRetryRef.current[path] = retries + 1;
                void signAttachmentPath(path, true);
              }}
              seenReaders={seenReaders}
              onPressSeenReaders={() => {
                if (seenReaders.length) {
                  setSeenDetail({
                    messageId: item.id,
                    readers: seenReaders,
                    available: scopeReadersAvailable,
                  });
                }
              }}
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
                const resolved = photoSlots
                  .map((slot, slotIndex) => ({
                    uri: slot.uri,
                    slotIndex,
                  }))
                  .filter(
                    (slot): slot is { uri: string; slotIndex: number } =>
                      !!slot.uri
                  );
                if (resolved.length) {
                  const match = resolved.findIndex(
                    slot => slot.slotIndex === (index ?? 0)
                  );
                  setPhotoViewer({
                    uris: resolved.map(slot => slot.uri),
                    index: Math.max(0, match),
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

      {!listAnchored && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View style={{ alignItems: 'center', gap: 10, paddingHorizontal: 24 }}>
            <ActivityIndicator color={theme.accent} />
            <Text style={{ color: theme.textMuted, fontSize: 13, textAlign: 'center' }}>
              Opening latest messages...
            </Text>
          </View>
        </View>
      )}

      {listAnchored && (awayFromLatest || newWhileAway > 0) && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            newWhileAway > 0
              ? 'New messages'
              : 'Latest messages'
          }
          onPress={() => {
            followOwnSendRef.current = false;
            listRef.current?.scrollToEnd({
              animated: false,
            });
            nearBottomRef.current = true;
            setAwayFromLatest(false);
            setNewWhileAway(0);
            pendingVisibleReadRef.current = 'returned-to-latest';
            setTimeout(() => {
              markVisibleRoomRead('returned-to-latest');
            }, 32);
          }}
          style={{
            position: 'absolute',
            right: 16,
            bottom:
              composerDockBottom +
              CONNECT_COMPOSER_RESERVED_HEIGHT +
              12,
            zIndex: 30,
            minHeight: 36,
            paddingHorizontal: 12,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.accent,
          }}
        >
          <Text
            style={{
              color: theme.white,
              fontSize: 13,
              fontWeight: '800',
            }}
          >
            {newWhileAway > 0
              ? newWhileAway > 1
                ? `↓ New messages (${newWhileAway})`
                : '↓ New messages'
              : '↓ Latest'}
          </Text>
        </Pressable>
      )}

      <Modal
        visible={seenDetail !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSeenDetail(null)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close seen list"
          onPress={() => setSeenDetail(null)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            onPress={() => undefined}
            style={{
              maxHeight: '60%',
              paddingTop: 16,
              paddingHorizontal: 16,
              paddingBottom: 28,
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              backgroundColor: theme.surface,
            }}
          >
            <Text
              style={{
                color: theme.textPrimary,
                fontSize: 16,
                fontWeight: '800',
                marginBottom: 10,
              }}
            >
              Seen by
            </Text>
            <Text
              style={{
                color: theme.textMuted,
                fontSize: 12,
                fontWeight: '600',
                marginBottom: 12,
              }}
            >
              When they last viewed the latest messages. This is not a separate receipt for every message.
            </Text>
            {!seenDetail?.available ? (
              <Text style={{ color: theme.textMuted, marginBottom: 16 }}>
                Seen report is temporarily unavailable. Try again after reconnecting.
              </Text>
            ) : seenDetail.readers.length === 0 ? (
              <Text style={{ color: theme.textMuted, marginBottom: 16 }}>
                Not seen by other members yet.
              </Text>
            ) : null}
            {(seenDetail?.readers ?? []).map(reader => (
              <View
                key={reader.userId}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  minHeight: 48,
                }}
              >
                <Text
                  style={{
                    flex: 1,
                    color: theme.textPrimary,
                    fontSize: 15,
                    fontWeight: '700',
                  }}
                >
                  {reader.name}
                </Text>
                <Text
                  style={{
                    color: theme.textMuted,
                    fontSize: 12,
                    fontWeight: '700',
                  }}
                >
                  {formatConnectTimestamp(reader.lastReadAt)}
                </Text>
              </View>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: composerDockBottom,
          zIndex: 20,
        }}
      >
      <ConnectComposer
        mode={mode}
        accountId={profileId ?? ''}
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
        onQuickReaction={emoji => {
          if (!online) {
            Alert.alert('Offline', 'Reconnect to send your quick reaction.');
            return;
          }
          if (!profileId || !effectiveContainerId) return;
          // Shared send path retains scope membership/RLS, optimistic UI and retry feedback.
          sendCapturedText(emoji);
        }}
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
        onSeenBy={
          mode === 'scope' &&
          actionTargetMessage?.sender_id === profileId
            ? () => {
                const selected = actionTargetMessage;
                if (!selected || !effectiveContainerId) return;
                const requestSession = threadSessionKeyValue;
                const seenFor = (readers: ConnectScopeReader[]) =>
                  readers.filter(reader =>
                    reader.userId !== profileId &&
                    roomCursorCoversMessage(selected.created_at, reader.lastReadAt)
                  );

                setSeenDetail({
                  messageId: selected.id,
                  readers: seenFor(scopeReaders),
                  available: scopeReadersAvailable,
                });
                // An explicit Info request refreshes readers once, but never
                // writes a cursor or refetches all chat history.
                void fetchScopeConnectReaders(effectiveContainerId)
                  .then(readers => {
                    if (
                      !readers ||
                      currentLoadSessionRef.current !== requestSession
                    ) return;
                    setScopeReaders(readers);
                    setScopeReadersAvailable(true);
                    setSeenDetail(current =>
                      current?.messageId === selected.id
                        ? { messageId: selected.id, readers: seenFor(readers), available: true }
                        : current
                    );
                  })
                  .catch(() => undefined);
              }
            : undefined
        }
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

    hiblaDayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      marginTop: 10,
      marginBottom: 25,
    },
    hiblaDayRule: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: HIBLA.gold,
      opacity: 0.7,
    },
    hiblaDayPill: {
      backgroundColor: '#FBE8BB',
      paddingHorizontal: 17,
      paddingVertical: 10,
      borderRadius: 22,
    },
    hiblaDayText: {
      fontSize: 12,
      color: '#714B12',
      fontWeight: '800',
      letterSpacing: 0.5,
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


