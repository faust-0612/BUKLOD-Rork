import BuklodReelsInlineAd from '@/components/BuklodReelsInlineAd';
import BuklodPressable from '@/components/BuklodPressable';
import {
  buildReelsFeedWithInlineAds,
  isReelsFeedInlineAdRow,
} from '@/lib/buklodAdPlacements';
import BuklodPublicLocationChips from '@/components/BuklodPublicLocationChips';
import { repairMojibakeText } from '@/lib/repairMojibakeText';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sharing from 'expo-sharing';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useBuklodDrawerBottomInset } from '@/lib/buklodSafeArea';

import {
  BuklodTappableAvatar,
} from '@/components/BuklodTappableAvatar';
import {
  useBuklodContentReport,
} from '@/components/BuklodContentReportSheet';
import BuklodMentionText from '@/components/BuklodMentionText';

import {
  BuklodCommunityCommentPreview,
} from '@/components/BuklodCommunityCommentPreview';

import {
  BuklodReactionAction,
  BUKLOD_COMMUNITY_REACTION_OPTIONS,
} from '@/components/BuklodReactionAction';

import {
  type BuklodCommunityReactionKey,
} from '@/lib/buklodCommunityReactions';

import {
  fetchBuklodPostCommentPreviews,
  type BuklodPostCommentPreview,
} from '@/lib/buklodPostCommentPreviews';

import {
  formatSpecificDateTime,
} from '@/lib/dateTime';

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
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  router,
} from 'expo-router';

import * as ImagePicker
  from 'expo-image-picker';

import * as FileSystem
  from 'expo-file-system/legacy';

import {
  VideoView,
  useVideoPlayer,
} from 'expo-video';

import {
  supabase,
} from '@/lib/supabase';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';

import {
  useAuth,
} from '@/providers/AuthProvider';

import {
  colors,
} from '@/lib/theme';



import {
  uploadCommunityVideoFile,
} from '@/lib/uploadCommunityVideoFile';
import {
  BUKLOD_REEL_MAX_DURATION_SECONDS,
  formatVideoBytes,
  readVideoSizeBytes,
} from '@/lib/buklodCommunityWallMedia';
type Audience =
  | 'group'
  | 'local'
  | 'public';


type ReelDraft = {
  uri: string;
  durationSeconds: number;
  sizeBytes: number;
  mimeType: string;
  fileName: string;
};


type ReelRow = {
  id: string;
  user_id: string;
  author_name: string;

  audience: string;
  category: string;
  body: string;
  created_at: string;

  media_path: string;
  media_mime_type: string;
  media_size_bytes: number;
  media_duration_seconds: number;

  reaction_counts: Record<
    string,
    number
  >;

  reaction_count: number;
  comment_count: number;
  my_reaction: string | null;

  media_url?: string | null;
  comment_preview?: BuklodPostCommentPreview | null;
};


const MAX_REEL_DURATION_SECONDS =
  BUKLOD_REEL_MAX_DURATION_SECONDS;


function ReelVideo({
  uri,
  active,
  autoplay,
  onDoubleLove,
}: {
  uri: string;
  active: boolean;
  autoplay: boolean;
  onDoubleLove: () => void;
}) {

  const [
    manualPlaying,
    setManualPlaying,
  ] =
    useState(false);


  const lastTapRef =
    useRef(0);


  const tapTimerRef =
    useRef<
      ReturnType<typeof setTimeout>
      | null
    >(null);


  const player =
    useVideoPlayer(
      uri,
      (instance) => {
        instance.loop =
          true;
      }
    );


  useEffect(
    () => {

      if (!active) {

        try {
          player.pause();
        }
        catch {}

        setManualPlaying(
          false
        );

        return;
      }


      if (
        autoplay ||
        manualPlaying
      ) {

        try {
          player.play();
        }
        catch {}

      }
      else {

        try {
          player.pause();
        }
        catch {}

      }

    },
    [
      active,
      autoplay,
      manualPlaying,
      player,
    ]
  );


  useEffect(
    () => {

      return () => {

        if (
          tapTimerRef.current
        ) {
          clearTimeout(
            tapTimerRef.current
          );
        }


        try {
          player.pause();
        }
        catch {}

      };

    },
    [player]
  );


  const handleTap =
    () => {

      const now =
        Date.now();


      if (
        now -
          lastTapRef.current <
        280
      ) {

        if (
          tapTimerRef.current
        ) {
          clearTimeout(
            tapTimerRef.current
          );

          tapTimerRef.current =
            null;
        }


        lastTapRef.current =
          0;


        onDoubleLove();

        return;
      }


      lastTapRef.current =
        now;


      tapTimerRef.current =
        setTimeout(
          () => {

            tapTimerRef.current =
              null;


            /*
             * When Autoplay is OFF,
             * one tap plays/pauses.
             *
             * When Autoplay is ON,
             * one tap does nothing so
             * accidental taps don't stop
             * the Reel.
             */
            if (!autoplay) {

              setManualPlaying(
                current =>
                  !current
              );

            }

          },
          290
        );

    };


  return (
    <Pressable
      style={
        styles.videoWrap
      }
      onPress={
        handleTap
      }
    >

      <VideoView
        player={
          player
        }
        style={
          styles.video
        }
        nativeControls={
          false
        }
        contentFit="cover"
      />


      {active &&
        !autoplay &&
        !manualPlaying && (

        <View
          pointerEvents="none"
          style={
            styles.manualPlay
          }
        >
          <MaterialCommunityIcons
            name="play"
            size={38}
            color="#FFFFFF"
          />
        </View>

      )}

    </Pressable>
  );
}


function inferMime(
  asset: any
): string {
  const direct =
    String(
      asset?.mimeType ??
      ''
    ).toLowerCase();

  if (
    direct === 'video/mp4' ||
    direct === 'video/quicktime' ||
    direct === 'video/webm'
  ) {
    return direct;
  }

  const name =
    String(
      asset?.fileName ??
      asset?.uri ??
      ''
    ).toLowerCase();

  if (name.endsWith('.mov')) {
    return 'video/quicktime';
  }

  if (name.endsWith('.webm')) {
    return 'video/webm';
  }

  return 'video/mp4';
}


function extensionForMime(
  mime: string
): string {
  if (mime === 'video/quicktime') {
    return 'mov';
  }

  if (mime === 'video/webm') {
    return 'webm';
  }

  return 'mp4';
}


/* PATCH_173H_R4_STRICT_PUBLIC_REELS */
export default function ReelsScreen() {
  const {
    user,
    profile,
  } = useAuth();
  const {
    openReport,
    reportSheet,
  } = useBuklodContentReport();

  const [
    rows,
    setRows,
  ] = useState<ReelRow[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    videoUploadPercent,
    setVideoUploadPercent,
  ] = useState<number | null>(null);

  const [
    caption,
    setCaption,
  ] = useState('');

  const [
    draft,
    setDraft,
  ] = useState<ReelDraft | null>(
    null
  );

  const [
    audience,
    setAudience,
  ] = useState<Audience>('group');

  const [
    groupId,
    setGroupId,
  ] = useState<string | null>(
    null
  );


  /* PATCH_173H_R4_PUBLIC_LOCATION_STATE */
  const [
    publicLocationScopeId,
    setPublicLocationScopeId,
  ] = useState<string | null>(null);

  const load = useCallback(
    async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);

      const {
        data: membership,
      } = await supabase
        .from('group_members')
        .select('group_id')
        .eq(
          'user_id',
          user.id
        )
        .eq(
          'is_active',
          true
        )
        .limit(1)
        .maybeSingle();

      const activeGroup =
        membership?.group_id ??
        null;

      setGroupId(
        activeGroup
      );

      if (!activeGroup) {
        setAudience(
          profile?.church_id
            ? 'local'
            : 'public'
        );
      }


      /* PATCH_173H_R4_STRICT_PUBLIC_REEL_IDS */
      const {
        data: allowedReelData,
        error: allowedReelError,
      } = await (
        supabase as any
      ).rpc(
        'buklod_public_reel_allowed_ids_v1',
        {
          p_location_scope_id:
            publicLocationScopeId,
          p_limit: 200,
        },
      );

      if (allowedReelError) {
        Alert.alert(
          'BUKLOD Reels',
          allowedReelError.message,
        );
        setRows([]);
        setLoading(false);
        return;
      }

      const allowedReelIds =
        new Set(
          ((allowedReelData ?? []) as any[])
            .map(row =>
              String(
                row?.post_id ??
                  row?.id ??
                  '',
              ),
            )
            .filter(Boolean),
        );

      const {
        data,
        error,
      } = await (
        supabase as any
      ).rpc(
        'get_buklod_reels_v1',
        {
          p_limit: 100,
        }
      );

      if (error) {
        Alert.alert(
          'BUKLOD Reels',
          error.message
        );

        setRows([]);
        setLoading(false);
        return;
      }

      const signed =
        await Promise.all(
          (
            (data ?? []) as ReelRow[]
          ).map(
            async (row) => {
              if (!row.media_path) {
                return {
                  ...row,
                  media_url: null,
                };
              }

              const {
                data: mediaData,
              } = await supabase.storage
                .from(
                  'community-media'
                )
                .createSignedUrl(
                  row.media_path,
                  3600
                );

              return {
                ...row,
                media_url:
                  mediaData?.signedUrl ??
                  null,
              };
            }
          )
        );

      const filteredSigned =
        signed.filter(row =>
          allowedReelIds.has(
            String(row?.id ?? ''),
          ),
        );

      const previewMap =
        await fetchBuklodPostCommentPreviews(
          filteredSigned.map(row => row.id)
        );

      setRows(
        filteredSigned.map(row => ({
          ...row,
          comment_preview:
            previewMap[row.id] ??
            null,
        }))
      );
      setLoading(false);
    },
    [user?.id,
      profile?.church_id, publicLocationScopeId]
  );


  useEffect(() => {
    void load();
  }, [load]);


  const acceptVideo = async (
    asset: any
  ) => {
    const durationMs =
      Number(
        asset?.duration ??
        0
      );

    const durationSeconds =
      Math.ceil(
        durationMs / 1000
      );

    if (
      !durationSeconds ||
      durationSeconds < 1
    ) {
      return Alert.alert(
        'BUKLOD Reel',
        'Could not determine the video duration. Please choose another video.'
      );
    }

    if (durationSeconds > MAX_REEL_DURATION_SECONDS) {
      return Alert.alert(
        'Maximum 60 Seconds',
        `This video is ${durationSeconds} seconds. BUKLOD Reels may be up to 60 seconds only.`
      );
    }

    const sizeBytes =
      await readVideoSizeBytes(
        asset,
        async (uri, options) =>
          FileSystem.getInfoAsync(
            uri,
            options as any
          )
      );

    const mimeType =
      inferMime(asset);

    setDraft({
      uri:
        asset.uri,

      durationSeconds,

      sizeBytes,

      mimeType,

      fileName:
        String(
          asset.fileName ??
          `reel.${extensionForMime(
            mimeType
          )}`
        ),
    });
  };


  const pickFromGallery =
    async () => {
      const result =
        await ImagePicker
          .launchImageLibraryAsync({
            mediaTypes: [
              'videos',
            ],

            allowsEditing:
              false,

            quality:
              1,
          });

      if (
        result.canceled ||
        !result.assets?.length
      ) {
        return;
      }

      await acceptVideo(
        result.assets[0]
      );
    };


  const recordVideo =
    async () => {
      const permission =
        await ImagePicker
          .requestCameraPermissionsAsync();

      if (!permission.granted) {
        return Alert.alert(
          'Camera Permission',
          'Camera access is required to record a BUKLOD Reel.'
        );
      }

      const result =
        await ImagePicker
          .launchCameraAsync({
            mediaTypes: [
              'videos',
            ],

            videoMaxDuration:
              60,

            allowsEditing:
              false,

            quality:
              1,
          });

      if (
        result.canceled ||
        !result.assets?.length
      ) {
        return;
      }

      await acceptVideo(
        result.assets[0]
      );
    };


  const publish = async () => {
    if (
      !user?.id ||
      !draft
    ) {
      return Alert.alert(
        'BUKLOD Reel',
        'Choose or record a video first.'
      );
    }

    if (
      audience === 'group' &&
      !groupId
    ) {
      return Alert.alert(
        'BUKLOD Reel',
        'You do not have an active BUKLOD Cluster. Choose LOCAL or PUBLIC.'
      );
    }

    if (
      (
        audience === 'local' ||
        audience === 'public'
      ) &&
      !profile?.church_id
    ) {
      return Alert.alert(
        'BUKLOD Reel',
        'A Local Church assignment is required.'
      );
    }

    setBusy(true);

    let uploadedPath:
      string | null = null;

    try {
      const extension =
        extensionForMime(
          draft.mimeType
        );

      uploadedPath =
        `${user.id}/reel-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.${extension}`;
      /*
       * PATCH_173F_R3_MEMORY_SAFE_PUBLIC_REEL
       * Native file upload; no base64 video allocation.
       */
      setVideoUploadPercent(0);

      await uploadCommunityVideoFile({
        path:
          uploadedPath,
        uri:
          draft.uri,
        contentType:
          draft.mimeType,
        onProgress: (progress) => {
          setVideoUploadPercent(
            progress.ratio
          );
        },
      });


      const {
        error: createError,
      } = await (
        supabase as any
      ).rpc(
        'create_buklod_reel_v1',
        {
          p_audience:
            audience,

          p_group_id:
            audience === 'group'
              ? groupId
              : null,

          p_body:
            caption.trim(),

          p_media_path:
            uploadedPath,

          p_media_mime_type:
            draft.mimeType,

          p_media_size_bytes:
            draft.sizeBytes,

          p_duration_seconds:
            draft.durationSeconds,
        }
      );

      if (createError) {
        throw createError;
      }

      setDraft(null);
      setCaption('');

      Alert.alert(
        'Reel Published',
        'Your BUKLOD Reel is now available to the selected audience.'
      );

      await load();

    } catch (error: any) {
      if (uploadedPath) {
        await supabase.storage
          .from(
            'community-media'
          )
          .remove([
            uploadedPath,
          ]);
      }

      Alert.alert(
        'Could Not Publish Reel',
        error?.message ??
          'Please try again.'
      );

    } finally {
      setBusy(false);
      setVideoUploadPercent(null);
    }
  };


  /* ==========================================================
     PATCH 161B
     FULL-SCREEN REELS
     ========================================================== */

  type ReelComment = {
    id: string;
    user_id: string;
    commenter_name: string;
    body: string;
    created_at: string;
    parent_id: string | null;
    parent_commenter_name:
      string | null;
  };


  const insets =
    useSafeAreaInsets();
  const drawerBottomInset =
    useBuklodDrawerBottomInset();


  const pageWidth =
    Dimensions
      .get('window')
      .width;


  const pageHeight =
    Dimensions
      .get('window')
      .height;


  const [
    activeIndex,
    setActiveIndex,
  ] =
    useState(0);


  const [
    autoplay,
    setAutoplay,
  ] =
    useState(true);


  const [
    createOpen,
    setCreateOpen,
  ] =
    useState(false);


  const [
    commentsOpen,
    setCommentsOpen,
  ] =
    useState(false);


  const [
    selectedReel,
    setSelectedReel,
  ] =
    useState<ReelRow | null>(
      null
    );


  const [
    comments,
    setComments,
  ] =
    useState<ReelComment[]>(
      []
    );


  const [
    commentsLoading,
    setCommentsLoading,
  ] =
    useState(false);


  const [
    commentBusy,
    setCommentBusy,
  ] =
    useState(false);


  const [
    commentBody,
    setCommentBody,
  ] =
    useState('');


  const [
    replyTo,
    setReplyTo,
  ] =
    useState<ReelComment | null>(
      null
    );


  const autoplayKey =
    'buklod.reels.autoplay.v1';


  useEffect(
    () => {

      let mounted =
        true;


      void AsyncStorage
        .getItem(
          autoplayKey
        )
        .then(
          value => {

            if (!mounted) {
              return;
            }


            if (
              value === '0'
            ) {
              setAutoplay(
                false
              );
            }

          }
        )
        .catch(
          () => {}
        );


      return () => {
        mounted =
          false;
      };

    },
    []
  );


  const feedRows =
    useMemo(
      () =>
        buildReelsFeedWithInlineAds(
          rows,
        ),
      [
        rows,
      ],
    );


  useEffect(
    () => {

      if (
        activeIndex >=
        feedRows.length
      ) {
        setActiveIndex(
          0
        );
      }

    },
    [
      activeIndex,
      feedRows.length,
    ]
  );


  const toggleAutoplay =
    async () => {

      const next =
        !autoplay;


      setAutoplay(
        next
      );


      try {

        await AsyncStorage
          .setItem(
            autoplayKey,
            next
              ? '1'
              : '0'
          );

      }
      catch {}

    };


  const react =
    async (
      postId: string,
      reaction: BuklodCommunityReactionKey
    ) => {

      const target =
        rows.find(
          item =>
            item.id ===
            postId
        );


      if (!target) {
        return;
      }


      const previous =
        target.my_reaction;


      const nextReaction =
        previous === reaction
          ? null
          : reaction;


      /*
       * Optimistic local update.
       * No full Reel reload just to
       * display a reaction.
       */
      setRows(
        current =>
          current.map(
            item => {

              if (
                item.id !==
                postId
              ) {
                return item;
              }


              const counts = {
                ...(
                  item
                    .reaction_counts
                  ?? {}
                ),
              };


              if (previous) {

                counts[
                  previous
                ] =
                  Math.max(
                    0,
                    Number(
                      counts[
                        previous
                      ] ?? 0
                    ) - 1
                  );

              }


              if (
                nextReaction
              ) {

                counts[
                  nextReaction
                ] =
                  Number(
                    counts[
                      nextReaction
                    ] ?? 0
                  ) + 1;

              }


              return {
                ...item,

                my_reaction:
                  nextReaction,

                reaction_counts:
                  counts,

                reaction_count:
                  Math.max(
                    0,
                    Number(
                      item
                        .reaction_count
                      ?? 0
                    )
                    -
                    (
                      previous
                        ? 1
                        : 0
                    )
                    +
                    (
                      nextReaction
                        ? 1
                        : 0
                    )
                  ),
              };

            }
          )
      );


      const {
        data,
        error,
      } =
        await (
          supabase as any
        ).rpc(
          'set_buklod_post_reaction_v4',
          {
            p_post_id:
              postId,

            p_reaction:
              reaction,
          }
        );


      if (error) {

        /*
         * Compatibility fallback
         * until migration reaches
         * staging.
         */
        const fallback =
          await (
            supabase as any
          ).rpc(
            'set_buklod_post_reaction_v3',
            {
              p_post_id:
                postId,

              p_reaction:
                reaction,
            }
          );


        if (
          fallback.error
        ) {

          await load();

          Alert.alert(
            'Reaction',
            fallback
              .error
              .message
          );

          return;
        }


        return;
      }


      const serverReaction =
        typeof data ===
          'string'
          ? data
          : null;


      if (
        serverReaction !==
        nextReaction
      ) {
        await load();
      }

    };


  const loadComments =
    async (
      postId: string
    ) => {

      setCommentsLoading(
        true
      );


      try {

        const result =
          await (
            supabase as any
          ).rpc(
            'get_buklod_post_comments_v4',
            {
              p_post_id:
                postId,
            }
          );


        if (
          !result.error
        ) {

          setComments(
            (
              result.data ??
              []
            ) as ReelComment[]
          );

          return;
        }


        /*
         * Read-only fallback for
         * staging before V4 migration.
         */
        const fallback =
          await (
            supabase as any
          ).rpc(
            'get_buklod_post_comments_v3',
            {
              p_post_id:
                postId,
            }
          );


        if (
          fallback.error
        ) {
          throw fallback
            .error;
        }


        setComments(
          (
            fallback.data ??
            []
          ).map(
            (item: any) => ({
              ...item,

              parent_id:
                null,

              parent_commenter_name:
                null,
            })
          )
        );

      }
      catch (
        error: any
      ) {

        Alert.alert(
          'Comments',
          error?.message ??
            'Could not load comments.'
        );

      }
      finally {

        setCommentsLoading(
          false
        );

      }

    };


  const openComments =
    async (
      reel: ReelRow
    ) => {

      setSelectedReel(
        reel
      );

      setReplyTo(
        null
      );

      setCommentBody(
        ''
      );

      setCommentsOpen(
        true
      );


      await loadComments(
        reel.id
      );

    };


  const startReply =
    (
      comment:
        ReelComment
    ) => {

      setReplyTo(
        comment
      );


      setCommentBody(
        '@' +
        comment.commenter_name +
        ' '
      );

    };


  const submitComment =
    async () => {

      const reel =
        selectedReel;


      if (
        !reel ||
        !commentBody.trim() ||
        commentBusy
      ) {
        return;
      }


      let body =
        commentBody.trim();


      if (replyTo) {

        const mention =
          '@' +
          replyTo
            .commenter_name;


        if (
          !body
            .toLowerCase()
            .startsWith(
              mention
                .toLowerCase()
            )
        ) {

          body =
            mention +
            ' ' +
            body;

        }

      }


      setCommentBusy(
        true
      );


      try {

        const {
          error,
        } =
          await (
            supabase as any
          ).rpc(
            'add_buklod_post_comment_v4',
            {
              p_post_id:
                reel.id,

              p_body:
                body,

              p_parent_id:
                replyTo?.id ??
                null,
            }
          );


        if (error) {
          throw error;
        }


        setCommentBody(
          ''
        );

        setReplyTo(
          null
        );


        setRows(
          current =>
            current.map(
              item =>
                item.id ===
                  reel.id
                  ? {
                      ...item,

                      comment_count:
                        Number(
                          item
                            .comment_count
                          ?? 0
                        ) + 1,

                      comment_preview: {
                        post_id: reel.id,
                        comment_id: 'pending',
                        user_id:
                          user?.id ??
                          item.user_id,
                        author_name:
                          resolvePersonDisplayName(
                            profile?.full_name,
                            user?.id ?? item.user_id,
                          ),
                        body,
                        created_at:
                          new Date().toISOString(),
                      },
                    }
                  : item
            )
        );


        await loadComments(
          reel.id
        );

      }
      catch (
        error: any
      ) {

        Alert.alert(
          'Comment',
          error?.message ??
            'Could not post comment.'
        );

      }
      finally {

        setCommentBusy(
          false
        );

      }

    };


  const shareReel =
    async (
      reel: ReelRow
    ) => {

      try {

        const message =
          reel.author_name +
          '\n\n' +
          (
            reel.body ||
            'BUKLOD Reel'
          ) +
          '\n\nShared from BUKLOD';

        const {
          data,
          error,
        } =
          await (
            supabase as any
          ).rpc(
            'request_external_post_share_v2',
            {
              p_post_id:
                reel.id,
            }
          );

        const decision =
          Array.isArray(
            data
          )
            ? data[0]
            : data;

        const shareAllowed =
          !error &&
          Boolean(
            decision?.share_allowed
          );

        const shareAvailable =
          await Sharing
            .isAvailableAsync();

        if (
          shareAllowed &&
          shareAvailable &&
          reel.media_url &&
          FileSystem
            .cacheDirectory
        ) {

          const extension =
            extensionForMime(
              reel
                .media_mime_type
              ||
              'video/mp4'
            );

          const localUri =
            FileSystem
              .cacheDirectory +
            'buklod-reel-' +
            reel.id +
            '.' +
            extension;

          await FileSystem
            .downloadAsync(
              reel.media_url,
              localUri
            );

          await Sharing
            .shareAsync(
              localUri,
              {
                mimeType:
                  reel
                    .media_mime_type
                  ||
                  'video/mp4',

                dialogTitle:
                  'Share BUKLOD Reel',
              }
            );

          return;
        }

        await Share.share({
          message,
        });

      }
      catch (
        error: any
      ) {

        Alert.alert(
          'Share Reel',
          error?.message ??
            'Could not share this Reel.'
        );

      }

    };


  return (
    <View
      style={
        styles.screen
      }
    >

      <FlatList
        data={
          feedRows
        }
        pagingEnabled
        showsVerticalScrollIndicator={
          false
        }
        bounces={
          false
        }
        decelerationRate="fast"
        removeClippedSubviews={
          Platform.OS === 'android'
        }

        keyExtractor={
          item =>
            item.id
        }
        extraData={
          activeIndex
        }
        directionalLockEnabled
        disableIntervalMomentum

        initialNumToRender={
          2
        }

        maxToRenderPerBatch={
          2
        }

        updateCellsBatchingPeriod={
          80
        }

        windowSize={
          3
        }

        getItemLayout={(
          _,
          index
        ) => ({
          length:
            pageHeight,

          offset:
            pageHeight *
            index,

          index,
        })}

        onMomentumScrollEnd={
          event => {

            const nextIndex =
              Math.round(
                event
                  .nativeEvent
                  .contentOffset
                  .y /
                pageHeight
              );


            setActiveIndex(
              Math.max(
                0,
                Math.min(
                  nextIndex,
                  feedRows.length - 1
                )
              )
            );

          }
        }

        renderItem={({
          item,
          index,
        }) => {

          if (
            isReelsFeedInlineAdRow(
              item,
            )
          ) {
            return (
              <View
                style={[
                  styles.reelPage,
                  {
                    width:
                      pageWidth,

                    height:
                      pageHeight,
                  },
                ]}
              >
                <BuklodReelsInlineAd
                  slotId={
                    item.id
                  }
                  active={
                    index ===
                    activeIndex
                  }
                />
              </View>
            );
          }

          const active =
            index ===
            activeIndex;


          const preparePlayer =
            Math.abs(
              index -
              activeIndex
            ) <= 1;


          const counts =
            item
              .reaction_counts
            ?? {};


          return (
            <View
              style={[
                styles.reelPage,
                {
                  width:
                    pageWidth,

                  height:
                    pageHeight,

                  paddingTop:
                    insets.top +
                    52,

                  paddingBottom:
                    Math.max(
                      insets.bottom,
                      10
                    ),
                },
              ]}
            >

              <View
                style={
                  styles.videoStage
                }
              >

                {!!item.media_url &&
                  preparePlayer ? (

                  <ReelVideo
                    uri={
                      item.media_url
                    }
                    active={
                      active
                    }
                    autoplay={
                      autoplay
                    }
                    onDoubleLove={() => {

                      if (
                        item
                          .my_reaction !==
                        'love'
                      ) {

                        void react(
                          item.id,
                          'love'
                        );

                      }

                    }}
                  />

                ) : (

                  <View
                    style={
                      styles.videoPlaceholder
                    }
                  >
                    <ActivityIndicator
                      color="#FFFFFF"
                    />
                  </View>

                )}


                <View
                  style={
                    styles.bottomInfo
                  }
                >

                  <View
                    style={
                      styles.authorRow
                    }
                  >

                    <BuklodTappableAvatar
                      userId={
                        item.user_id
                      }
                      name={resolvePersonDisplayName(
                        item.author_name,
                        item.user_id,
                      )}
                      size={38}
                    />


                    <View
                      style={{
                        flex: 1,
                      }}
                    >

                      <Text
                        style={
                          styles.authorName
                        }
                        numberOfLines={
                          1
                        }
                      >
                        {
                          resolvePersonDisplayName(
                            item.author_name,
                            item.user_id,
                          )
                        }
                      </Text>


                      <Text
                        style={
                          styles.reelMeta
                        }
                      >
                        {
                          String(
                            item.audience ||
                            'public'
                          )
                            .toUpperCase()
                        }
                        {'  •  '}
                        {
                          formatSpecificDateTime(
                            item.created_at
                          )
                        }
                      </Text>

                    </View>

                  </View>


                  {!!item.body && (

                    <Text
                      style={
                        styles.captionText
                      }
                      numberOfLines={
                        4
                      }
                    >
                      {repairMojibakeText(item.body)}
                    </Text>

                  )}


                  <Text
                    style={
                      styles.doubleTapHint
                    }
                  >
                    Double-tap video to Love
                  </Text>

                  {!!item.comment_preview && (
                    <BuklodCommunityCommentPreview
                      variant="reel"
                      preview={{
                        user_id:
                          item.comment_preview.user_id,
                        author_name:
                          item.comment_preview.author_name,
                        body:
                          item.comment_preview.body,
                        created_at:
                          item.comment_preview.created_at,
                      }}
                      onPress={() =>
                        void openComments(
                          item
                        )
                      }
                    />
                  )}

                </View>


                <View
                  style={
                    styles.actionRail
                  }
                >

                  <View
                    style={
                      styles.actionButton
                    }
                  >
                    <BuklodReactionAction
                      options={
                        BUKLOD_COMMUNITY_REACTION_OPTIONS
                      }
                      counts={counts}
                      mine={
                        item.my_reaction
                      }
                      overlay
                      compact
                      showSummary={false}
                      onSelect={key =>
                        void react(
                          item.id,
                          key as BuklodCommunityReactionKey
                        )
                      }
                    />

                    <Text
                      style={
                        styles.actionCount
                      }
                    >
                      {Number(
                        item.reaction_count ??
                          0
                      )}
                    </Text>
                  </View>


                  <BuklodPressable
                    nested
                    compact
                    onPress={() =>
                      void openComments(
                        item
                      )
                    }
                    style={
                      styles.actionButton
                    }
                  >

                    <View
                      style={
                        styles.actionCircle
                      }
                    >
                      <MaterialCommunityIcons
                        name="comment-outline"
                        size={25}
                        color="#FFFFFF"
                      />
                    </View>

                    <Text
                      style={
                        styles.actionCount
                      }
                    >
                      {
                        Number(
                          item
                            .comment_count
                          ?? 0
                        )
                      }
                    </Text>

                  </BuklodPressable>


                  <BuklodPressable
                    nested
                    compact
                    onPress={() =>
                      void shareReel(
                        item
                      )
                    }
                    style={
                      styles.actionButton
                    }
                  >

                    <View
                      style={
                        styles.actionCircle
                      }
                    >
                      <MaterialCommunityIcons
                        name="share-variant-outline"
                        size={25}
                        color="#FFFFFF"
                      />
                    </View>

                    <Text
                      style={
                        styles.actionCount
                      }
                    >
                      Share
                    </Text>

                  </BuklodPressable>

                  {user?.id &&
                  user.id !== item.user_id ? (
                    <BuklodPressable
                      nested
                      compact
                      onPress={() =>
                        openReport(
                          'post',
                          String(item.id)
                        )
                      }
                      style={
                        styles.actionButton
                      }
                    >
                      <View
                        style={
                          styles.actionCircle
                        }
                      >
                        <MaterialCommunityIcons
                          name="flag-outline"
                          size={25}
                          color="#FFFFFF"
                        />
                      </View>
                      <Text
                        style={
                          styles.actionCount
                        }
                      >
                        Report
                      </Text>
                    </BuklodPressable>
                  ) : null}

                </View>

              </View>

            </View>
          );

        }}
      />


      <View
        style={[
          styles.topBar,
          {
            paddingTop:
              insets.top +
              5,
          },
        ]}
      >

        <Pressable
          onPress={() =>
            router.back()
          }
          style={
            styles.topIconButton
          }
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={23}
            color="#FFFFFF"
          />
        </Pressable>


        <View
          style={
            styles.topTitleWrap
          }
        >
          <Text
            style={
              styles.topTitle
            }
          >
            BUKLOD REELS
          </Text>

          <Text
            style={
              styles.topSub
            }
          >
            Swipe left / right
          </Text>
        </View>


        <Pressable
          onPress={() =>
            void toggleAutoplay()
          }
          style={
            styles.topControl
          }
        >
          <MaterialCommunityIcons
            name={
              autoplay
                ? 'play-circle-outline'
                : 'pause-circle-outline'
            }
            size={20}
            color="#FFFFFF"
          />

          <Text
            style={
              styles.topControlText
            }
          >
            {
              autoplay
                ? 'AUTO'
                : 'MANUAL'
            }
          </Text>
        </Pressable>


        <Pressable
          onPress={() =>
            setCreateOpen(
              true
            )
          }
          style={
            styles.topIconButton
          }
        >
          <MaterialCommunityIcons
            name="plus"
            size={25}
            color="#FFFFFF"
          />
        </Pressable>

      </View>


      {loading && (

        <View
          pointerEvents="none"
          style={
            styles.loadingOverlay
          }
        >
          <ActivityIndicator
            size="large"
            color="#FFFFFF"
          />

          <Text
            style={
              styles.loadingText
            }
          >
            Loading Reels...
          </Text>
        </View>

      )}


      {!loading &&
        rows.length === 0 && (

        <View
          style={
            styles.empty
          }
        >
          <MaterialCommunityIcons
            name="movie-open-outline"
            size={46}
            color="#FFFFFF"
          />

          <Text
            style={
              styles.emptyTitle
            }
          >
            No BUKLOD Reels yet.
          </Text>

          <Pressable
            onPress={() =>
              setCreateOpen(
                true
              )
            }
            style={
              styles.emptyButton
            }
          >
            <Text
              style={
                styles.emptyButtonText
              }
            >
              CREATE FIRST REEL
            </Text>
          </Pressable>
        </View>

      )}


      {/* ====================================================
          CREATE REEL
          Existing upload functions are retained.
          ==================================================== */}

      <Modal
        visible={
          createOpen
        }
        transparent
        animationType="slide"
        onRequestClose={() =>
          setCreateOpen(
            false
          )
        }
      >

        <View
          style={
            styles.modalBackdrop
          }
        >

          <View
            style={[
              styles.createSheet,
              {
                paddingBottom:
                  drawerBottomInset,
              },
            ]}
          >

            <View
              style={
                styles.sheetHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.sheetTitle
                  }
                >
                  CREATE REEL
                </Text>

                <Text
                  style={
                    styles.sheetSub
                  }
                >
                  Maximum 60 seconds
                </Text>
              </View>


              <Pressable
                onPress={() =>
                  setCreateOpen(
                    false
                  )
                }
                style={
                  styles.sheetClose
                }
              >
                <MaterialCommunityIcons
                  name="close"
                  size={23}
                  color={colors.text}
                />
              </Pressable>

            </View>


            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={
                styles.createContent
              }
            >

              <View
                style={
                  styles.pickRow
                }
              >

                <Pressable
                  onPress={
                    recordVideo
                  }
                  disabled={
                    busy
                  }
                  style={
                    styles.pickButton
                  }
                >
                  <MaterialCommunityIcons
                    name="camera-outline"
                    size={27}
                    color={
                      colors.greenDark
                    }
                  />

                  <Text
                    style={
                      styles.pickText
                    }
                  >
                    CAMERA
                  </Text>
                </Pressable>


                <Pressable
                  onPress={
                    pickFromGallery
                  }
                  disabled={
                    busy
                  }
                  style={
                    styles.pickButton
                  }
                >
                  <MaterialCommunityIcons
                    name="file-video-outline"
                    size={27}
                    color={
                      colors.greenDark
                    }
                  />

                  <Text
                    style={
                      styles.pickText
                    }
                  >
                    GALLERY
                  </Text>
                </Pressable>

              </View>


              {!!draft && (

                <View
                  style={
                    styles.selected
                  }
                >

                  <View
                    style={{
                      flex: 1,
                    }}
                  >
                    <Text
                      style={
                        styles.selectedTitle
                      }
                    >
                      VIDEO READY
                    </Text>

                    <Text
                      style={
                        styles.selectedText
                      }
                    >
                      {
                        draft
                          .durationSeconds
                      }s
                      {' • '}
                      {formatVideoBytes(
                        draft.sizeBytes
                      )}
                    </Text>
                  </View>


                  <Pressable
                    onPress={() =>
                      setDraft(
                        null
                      )
                    }
                  >
                    <Text
                      style={
                        styles.removeText
                      }
                    >
                      REMOVE
                    </Text>
                  </Pressable>

                </View>

              )}


              <Text
                style={
                  styles.label
                }
              >
                CAPTION
              </Text>


              <TextInput
                multiline
                value={
                  caption
                }
                onChangeText={
                  setCaption
                }
                placeholder="Say something about your Reel..."
                placeholderTextColor={
                  colors.muted
                }
                style={
                  styles.captionInput
                }
                maxLength={
                  2000
                }
              />


              <Text
                style={
                  styles.label
                }
              >
                AUDIENCE
              </Text>


              <View
                style={
                  styles.audienceRow
                }
              >

                {(
                  [
                    'group',
                    'local',
                    'public',
                  ] as Audience[]
                ).map(
                  item => {

                    const disabled =
                      item ===
                        'group' &&
                      !groupId;


                    return (
                      <Pressable
                        key={
                          item
                        }
                        disabled={
                          disabled
                        }
                        onPress={() =>
                          setAudience(
                            item
                          )
                        }
                        style={[
                          styles.audienceButton,

                          audience ===
                            item &&
                            styles.audienceButtonOn,

                          disabled &&
                            styles.audienceButtonDisabled,
                        ]}
                      >

                              {/* PATCH_173H_R4_REELS_LOCATION_CHIPS_MOUNT */}
      <BuklodPublicLocationChips
        selectedScopeId={
          publicLocationScopeId
        }
        onChange={
          setPublicLocationScopeId
        }
      />
<Text
                          style={[
                            styles.audienceText,

                            audience ===
                              item &&
                              styles.audienceTextOn,
                          ]}
                        >
                          {
                            item ===
                              'group'
                              ? 'CLUSTER'
                              : item
                                  .toUpperCase()
                          }
                        </Text>

                      </Pressable>
                    );

                  }
                )}

              </View>


              <Pressable
                disabled={
                  busy ||
                  !draft
                }
                onPress={
                  publish
                }
                style={[
                  styles.publishButton,

                  (
                    busy ||
                    !draft
                  ) &&
                    styles.publishButtonDisabled,
                ]}
              >

                {busy ? (

                  videoUploadPercent != null ? (
                    <Text
                      style={
                        styles.publishText
                      }
                    >
                      {`Uploading video… ${Math.round(
                        videoUploadPercent * 100
                      )}%`}
                    </Text>
                  ) : (
                    <ActivityIndicator
                      color="#FFFFFF"
                    />
                  )

                ) : (

                  <Text
                    style={
                      styles.publishText
                    }
                  >
                    PUBLISH REEL
                  </Text>

                )}

              </Pressable>

            </ScrollView>

          </View>

        </View>

      </Modal>


      {/* ====================================================
          COMMENTS + REPLIES
          ==================================================== */}

      <Modal
        visible={
          commentsOpen
        }
        transparent
        animationType="slide"
        onRequestClose={() =>
          setCommentsOpen(
            false
          )
        }
      >

        <KeyboardAvoidingView
          style={{
            flex: 1,
          }}
          behavior={
            Platform.OS === 'ios'
              ? 'padding'
              : 'height'
          }
          keyboardVerticalOffset={
            Platform.OS === 'ios'
              ? 0
              : 0
          }
        >

          <View
            style={
              styles.modalBackdrop
            }
          >

            <Pressable
              style={{
                flex: 1,
              }}
              onPress={() =>
                setCommentsOpen(
                  false
                )
              }
            />

            <View
              style={[
                styles.commentsSheet,
                {
                  paddingBottom:
                    drawerBottomInset,
                },
              ]}
            >

            <View
              style={
                styles.sheetHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.sheetTitle
                  }
                >
                  COMMENTS
                </Text>

                <Text
                  style={
                    styles.sheetSub
                  }
                >
                  {
                    selectedReel
                      ?.author_name
                    ??
                    'BUKLOD Reel'
                  }
                </Text>
              </View>


              <Pressable
                onPress={() =>
                  setCommentsOpen(
                    false
                  )
                }
                style={
                  styles.sheetClose
                }
              >
                <MaterialCommunityIcons
                  name="close"
                  size={23}
                  color={colors.text}
                />
              </Pressable>

            </View>


            {commentsLoading ? (

              <View
                style={
                  styles.commentsLoading
                }
              >
                <ActivityIndicator
                  color={
                    colors.green
                  }
                />
              </View>

            ) : (

              <FlatList
                data={
                  comments
                }
                keyExtractor={
                  item =>
                    item.id
                }
                keyboardShouldPersistTaps="handled"
                initialNumToRender={
                  10
                }
                maxToRenderPerBatch={
                  8
                }
                windowSize={
                  7
                }
                contentContainerStyle={
                  styles.commentsList
                }

                ListEmptyComponent={
                  <Text
                    style={
                      styles.noComments
                    }
                  >
                    No comments yet. Be the first to comment.
                  </Text>
                }

                renderItem={({
                  item,
                }) => (

                  <View
                    style={[
                      styles.commentCard,

                      item.parent_id &&
                        styles.commentReply,
                    ]}
                  >

                    <View
                      style={
                        styles.commentHeader
                      }
                    >

                      <BuklodTappableAvatar
                        userId={
                          item.user_id
                        }
                        name={
                          item
                            .commenter_name
                        }
                        size={32}
                      />


                      <View
                        style={{
                          flex: 1,
                        }}
                      >

                        <Text
                          style={
                            styles.commentName
                          }
                        >
                          {
                            item
                              .commenter_name
                          }
                        </Text>


                        <Text
                          style={
                            styles.commentMeta
                          }
                        >
                          {
                            formatSpecificDateTime(
                              item
                                .created_at
                            )
                          }
                        </Text>

                      </View>

                    </View>


                    <BuklodMentionText
                      text={repairMojibakeText(item.body)}
                      style={
                        styles.commentBody
                      }
                      mentionStyle={{
                        fontWeight: '800',
                        color: colors.greenDark,
                      }}
                    />


                    <View
                      style={[
                        styles.replyButton,
                        {
                          alignSelf: 'flex-end',
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                        },
                      ]}
                    >
                      {user?.id &&
                      user.id !== item.user_id ? (
                        <Pressable
                          onPress={() =>
                            openReport(
                              'comment',
                              String(item.id)
                            )
                          }
                        >
                          <Text
                            style={
                              styles.replyText
                            }
                          >
                            Report
                          </Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        onPress={() =>
                          startReply(
                            item
                          )
                        }
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <MaterialCommunityIcons
                          name="reply-outline"
                          size={15}
                          color={
                            colors.greenDark
                          }
                        />
                        <Text
                          style={
                            styles.replyText
                          }
                        >
                          Reply
                        </Text>
                      </Pressable>
                    </View>

                  </View>

                )}
              />

            )}


            {!!replyTo && (

              <View
                style={
                  styles.replyBanner
                }
              >
                <BuklodMentionText
                  text={`@${replyTo.commenter_name}`}
                  numberOfLines={1}
                  style={
                    styles.replyBannerText
                  }
                  mentionStyle={
                    styles.replyBannerText
                  }
                />

                <Pressable
                  onPress={() => {
                    setReplyTo(
                      null
                    );

                    setCommentBody(
                      ''
                    );
                  }}
                >
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={19}
                    color={
                      colors.muted
                    }
                  />
                </Pressable>
              </View>

            )}


            <View
              style={
                styles.commentComposer
              }
            >

              <TextInput
                value={
                  commentBody
                }
                onChangeText={
                  setCommentBody
                }
                placeholder={
                  replyTo
                    ? 'Write a reply...'
                    : 'Write a comment...'
                }
                placeholderTextColor={
                  colors.muted
                }
                multiline
                maxLength={
                  2000
                }
                style={
                  styles.commentInput
                }
              />


              <Pressable
                disabled={
                  commentBusy ||
                  !commentBody
                    .trim()
                }
                onPress={() =>
                  void submitComment()
                }
                style={[
                  styles.sendButton,

                  (
                    commentBusy ||
                    !commentBody
                      .trim()
                  ) &&
                    styles.sendButtonDisabled,
                ]}
              >
                {commentBusy ? (

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

          </View>

          </View>

        </KeyboardAvoidingView>

      </Modal>
      {reportSheet}
    </View>
  );
}


const styles =
  StyleSheet.create({

    screen: {
      flex: 1,
      backgroundColor:
        '#000000',
    },


    reelPage: {
      backgroundColor:
        '#000000',
    },


    videoStage: {
      flex: 1,
      overflow:
        'hidden',
      backgroundColor:
        '#000000',
    },


    videoWrap: {
      ...StyleSheet.absoluteFill,
      backgroundColor:
        '#000000',
    },


    video: {
      width:
        '100%',
      height:
        '100%',
    },


    videoPlaceholder: {
      ...StyleSheet.absoluteFill,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#111111',
    },


    manualPlay: {
      position:
        'absolute',
      alignSelf:
        'center',
      top:
        '44%',
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        'rgba(0,0,0,0.48)',
    },


    topBar: {
      position:
        'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      elevation: 50,
      minHeight: 54,
      paddingHorizontal: 8,
      paddingBottom: 7,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 7,
      backgroundColor:
        'rgba(0,0,0,0.42)',
    },


    topIconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        'rgba(0,0,0,0.36)',
    },


    topTitleWrap: {
      flex: 1,
    },


    topTitle: {
      color:
        '#FFFFFF',
      fontSize: 15,
      fontWeight:
        '900',
      letterSpacing:
        0.3,
    },


    topSub: {
      marginTop: 1,
      color:
        '#D9E1DC',
      fontSize: 9,
    },


    topControl: {
      minHeight: 38,
      paddingHorizontal: 8,
      borderRadius: 18,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 4,
      backgroundColor:
        'rgba(0,0,0,0.36)',
    },


    topControlText: {
      color:
        '#FFFFFF',
      fontSize: 8.5,
      fontWeight:
        '900',
    },


    bottomInfo: {
      position:
        'absolute',
      left: 12,
      right: 78,
      bottom: 15,
      padding: 10,
      borderRadius: 14,
      backgroundColor:
        'rgba(0,0,0,0.46)',
    },


    authorRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 8,
    },


    authorName: {
      color:
        '#FFFFFF',
      fontSize: 14,
      fontWeight:
        '900',
    },


    reelMeta: {
      marginTop: 2,
      color:
        '#D7E0DA',
      fontSize: 9,
    },


    captionText: {
      marginTop: 9,
      color:
        '#FFFFFF',
      fontSize: 13,
      lineHeight: 18,
      fontWeight:
        '600',
    },


    doubleTapHint: {
      marginTop: 7,
      color:
        '#D8DFDB',
      fontSize: 8.5,
    },


    actionRail: {
      position:
        'absolute',
      right: 8,
      bottom: 18,
      width: 62,
      alignItems:
        'center',
      gap: 12,
    },


    actionButton: {
      width: 58,
      alignItems:
        'center',
    },


    actionCircle: {
      width: 45,
      height: 45,
      borderRadius: 23,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        'rgba(0,0,0,0.52)',
      borderWidth: 1,
      borderColor:
        'rgba(255,255,255,0.22)',
    },


    actionCircleOn: {
      backgroundColor:
        '#287D54',
      borderColor:
        '#FFFFFF',
    },


    actionCount: {
      marginTop: 3,
      color:
        '#FFFFFF',
      fontSize: 8.5,
      fontWeight:
        '900',
      textAlign:
        'center',
    },


    loadingOverlay: {
      ...StyleSheet.absoluteFill,
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 10,
      backgroundColor:
        'rgba(0,0,0,0.68)',
      zIndex: 40,
    },


    loadingText: {
      color:
        '#FFFFFF',
      fontSize: 11,
      fontWeight:
        '800',
    },


    empty: {
      ...StyleSheet.absoluteFill,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal: 30,
      backgroundColor:
        '#08110C',
    },


    emptyTitle: {
      marginTop: 10,
      color:
        '#FFFFFF',
      fontSize: 16,
      fontWeight:
        '900',
    },


    emptyButton: {
      marginTop: 18,
      paddingVertical: 11,
      paddingHorizontal: 18,
      borderRadius: 20,
      backgroundColor:
        '#287D54',
    },


    emptyButtonText: {
      color:
        '#FFFFFF',
      fontSize: 10,
      fontWeight:
        '900',
    },


    modalBackdrop: {
      flex: 1,
      justifyContent:
        'flex-end',
      backgroundColor:
        'rgba(0,0,0,0.55)',
    },


    createSheet: {
      maxHeight:
        '90%',
      backgroundColor:
        '#FFFFFF',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      overflow:
        'hidden',
    },


    commentsSheet: {
      maxHeight:
        '83%',
      flexShrink: 1,
      backgroundColor:
        '#FFFFFF',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      overflow:
        'hidden',
    },


    sheetHeader: {
      minHeight: 65,
      paddingHorizontal: 16,
      paddingVertical: 11,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        colors.line,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
    },


    sheetTitle: {
      color:
        colors.text,
      fontSize: 15,
      fontWeight:
        '900',
    },


    sheetSub: {
      marginTop: 2,
      color:
        colors.muted,
      fontSize: 9.5,
    },


    sheetClose: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#F1F4F2',
    },


    createContent: {
      padding: 16,
      gap: 10,
    },


    pickRow: {
      flexDirection:
        'row',
      gap: 9,
    },


    pickButton: {
      flex: 1,
      minHeight: 76,
      borderRadius: 15,
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 6,
      borderWidth: 1,
      borderColor:
        colors.line,
      backgroundColor:
        '#F6FAF7',
    },


    pickText: {
      color:
        colors.greenDark,
      fontSize: 10,
      fontWeight:
        '900',
    },


    selected: {
      minHeight: 58,
      padding: 11,
      borderRadius: 13,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 10,
      backgroundColor:
        '#EAF5ED',
      borderWidth: 1,
      borderColor:
        '#CFE4D5',
    },


    selectedTitle: {
      color:
        colors.greenDark,
      fontSize: 10,
      fontWeight:
        '900',
    },


    selectedText: {
      marginTop: 3,
      color:
        colors.muted,
      fontSize: 9.5,
    },


    removeText: {
      color:
        '#A33B35',
      fontSize: 9,
      fontWeight:
        '900',
    },


    label: {
      marginTop: 4,
      color:
        colors.muted,
      fontSize: 9.5,
      fontWeight:
        '900',
      letterSpacing:
        0.4,
    },


    captionInput: {
      minHeight: 92,
      padding: 12,
      borderRadius: 13,
      borderWidth: 1,
      borderColor:
        colors.line,
      color:
        colors.text,
      backgroundColor:
        '#FFFFFF',
      textAlignVertical:
        'top',
    },


    audienceRow: {
      flexDirection:
        'row',
      gap: 7,
    },


    audienceButton: {
      flex: 1,
      minHeight: 42,
      borderRadius: 12,
      alignItems:
        'center',
      justifyContent:
        'center',
      borderWidth: 1,
      borderColor:
        colors.line,
      backgroundColor:
        '#FFFFFF',
    },


    audienceButtonOn: {
      backgroundColor:
        colors.greenDark,
      borderColor:
        colors.greenDark,
    },


    audienceButtonDisabled: {
      opacity: 0.35,
    },


    audienceText: {
      color:
        colors.text,
      fontSize: 9.5,
      fontWeight:
        '900',
    },


    audienceTextOn: {
      color:
        '#FFFFFF',
    },


    publishButton: {
      marginTop: 8,
      minHeight: 48,
      borderRadius: 14,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.greenDark,
    },


    publishButtonDisabled: {
      opacity: 0.45,
    },


    publishText: {
      color:
        '#FFFFFF',
      fontSize: 11,
      fontWeight:
        '900',
    },


    commentsLoading: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
    },


    commentsList: {
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 14,
    },


    noComments: {
      paddingVertical: 30,
      textAlign:
        'center',
      color:
        colors.muted,
      fontSize: 11,
    },


    commentCard: {
      marginBottom: 8,
      padding: 10,
      borderRadius: 13,
      backgroundColor:
        '#F5F7F5',
    },


    commentReply: {
      marginLeft: 28,
      backgroundColor:
        '#EDF4EF',
    },


    commentHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 8,
    },


    commentName: {
      color:
        colors.text,
      fontSize: 11.5,
      fontWeight:
        '900',
    },


    commentMeta: {
      marginTop: 1,
      color:
        colors.muted,
      fontSize: 8.5,
    },


    replyingTo: {
      marginTop: 7,
      color:
        colors.greenDark,
      fontSize: 9,
      fontWeight:
        '800',
    },


    commentBody: {
      marginTop: 7,
      color:
        colors.text,
      fontSize: 12,
      lineHeight: 18,
    },


    replyButton: {
      marginTop: 7,
      alignSelf:
        'flex-start',
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 4,
    },


    replyText: {
      color:
        colors.greenDark,
      fontSize: 9,
      fontWeight:
        '900',
    },


    replyBanner: {
      minHeight: 36,
      paddingHorizontal: 12,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderTopColor:
        colors.line,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 8,
      backgroundColor:
        '#F1F6F2',
    },


    replyBannerText: {
      flex: 1,
      color:
        colors.greenDark,
      fontSize: 9.5,
      fontWeight:
        '800',
    },


    commentComposer: {
      minHeight: 62,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderTopColor:
        colors.line,
      flexDirection:
        'row',
      alignItems:
        'flex-end',
      gap: 8,
      backgroundColor:
        '#FFFFFF',
    },


    commentInput: {
      flex: 1,
      minHeight: 44,
      maxHeight: 110,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 18,
      borderWidth: 1,
      borderColor:
        colors.line,
      color:
        colors.text,
      backgroundColor:
        '#F7F9F7',
      textAlignVertical:
        'top',
    },


    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.greenDark,
    },


    sendButtonDisabled: {
      opacity: 0.4,
    },

  });


