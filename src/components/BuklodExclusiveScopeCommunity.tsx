import { Dimensions as CommunityEdgeDimensionsR5 } from 'react-native';
import {
  BUKLOD_REEL_MAX_DURATION_SECONDS,
  BUKLOD_REEL_TOO_LONG_MESSAGE,
  BUKLOD_WALL_VIDEO_MAX_DURATION_SECONDS,
  BUKLOD_WALL_VIDEO_TOO_LONG_MESSAGE,
  formatVideoBytes,
  isReelMediaPath,
  readVideoDurationSeconds,
  readVideoSizeBytes,
  validateCommunityVideoUpload,
} from '@/lib/buklodCommunityWallMedia';
import { assertCommunityVideoQuotaAvailable } from '@/lib/buklodCommunityContributionEconomy';
import {
  setCommunityPostAuthorOnly,
  saveCommunityPostEdit,
  communityPostEditPhotos,
  communityPostIsVideo,
} from '@/lib/buklodCommunityPostOwnerActions';
import {
  BuklodContentOverflowMenu,
} from '@/components/BuklodContentOverflowMenu';
import {
  useBuklodContentReport,
} from '@/components/BuklodContentReportSheet';
import BuklodMentionText from '@/components/BuklodMentionText';
import {
  ConnectPhotoViewer,
} from '@/components/connect/ConnectPhotoViewer';
import { repairMojibakeText } from '@/lib/repairMojibakeText';
import { FLATLIST_TUNING } from '@/lib/performanceInstrumentation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { router } from 'expo-router';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import * as ImagePicker
  from 'expo-image-picker';

import * as FileSystem
  from 'expo-file-system/legacy';

import {
  supabase,
} from '@/lib/supabase';
import { acquireSharedRealtimeSubscription } from '@/lib/performance';
import { getOfflineCache, setOfflineCache } from '@/lib/offlineCache';
import { keepStableCommunityMedia } from '@/lib/buklodOfflineSync';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import {
  BuklodCommunityPhotoCollage,
  communityPhotoCollageItems,
} from '@/components/BuklodCommunityPhotoCollage';
import { peekCommunityMediaUrl } from '@/lib/buklodMediaUrl';
import { useNetwork } from '@/providers/NetworkProvider';

import {
  colors,
} from '@/lib/theme';
import {
  BUKLOD_HIT_SLOP,
} from '@/lib/buklodTouch';

import {
  useAuth,
} from '@/providers/AuthProvider';

import {
  CommunityVideo,
} from '@/components/CommunityVideo';
import {
  BuklodTappableAvatar,
} from '@/components/BuklodTappableAvatar';
import BuklodPressable from '@/components/BuklodPressable';
import {
  BUKLOD_SCOPE_COMMUNITY_REACTIONS,
} from '@/components/BuklodReactionAction';
import {
  BuklodCommunityPostEngagement,
} from '@/components/BuklodCommunityPostEngagement';
import {
  BuklodCommunityReactionDetailsSheet,
} from '@/components/BuklodCommunityReactionDetailsSheet';
import { ensureImagePickerLibraryAccess } from '@/lib/buklodImagePickerAccess';
import {
  fetchBuklodPostCommentPreviews,
  type BuklodPostCommentPreview,
} from '@/lib/buklodPostCommentPreviews';
import {
  hydratePersonNamesOnRows,
  resolvePersonDisplayName,
} from '@/lib/buklodPersonDisplay';
import {
  BuklodCommunityCommentBubble,
} from '@/components/BuklodCommunityCommentBubble';
import {
  type BuklodCommunityReactionKey,
  type CommunityReactionDetailsTarget,
  sumCommunityReactionCounts,
} from '@/lib/buklodCommunityReactions';

import type {
  BuklodScope,
} from '@/lib/buklodScope';

import BuklodCommunityInlineAd from '@/components/BuklodCommunityInlineAd';
import BuklodFirstViewAd from '@/components/BuklodFirstViewAd';
import BuklodVideoCompanionAd from '@/components/BuklodVideoCompanionAd';
import {
  buildCommunityFeedWithInlineAds,
  isCommunityFeedInlineAdRow,
} from '@/lib/buklodAdPlacements';
import { useBuklodCommunityAdViewability } from '@/hooks/useBuklodCommunityAdViewability';
import {
  useBuklodScrollBottomInset,
  useBuklodDrawerBottomInset,
} from '@/lib/buklodSafeArea';
import BuklodPostInternalShare
  from '@/components/BuklodPostInternalShare';
import {
  BuklodCommunityGifPicker,
  BuklodCommunityGifPreview,
  type BuklodCommunityGifFile,
} from '@/components/BuklodCommunityGifPicker';

import {
  VideoView,
  useVideoPlayer,
} from 'expo-video';

import {
  uploadCommunityVideoFile,
  uploadCommunityPhotoFile,
  uploadCommunityGifFile,
  mapWithConcurrency,
} from '@/lib/uploadCommunityVideoFile';
import { COMMUNITY_MAX_PHOTOS } from '@/lib/buklodCommunityMediaLimits';
import { pickCommunityPhotos } from '@/lib/buklodPickCommunityPhotos';
import {
  attachCommunityPostMedia,
  discardIncompleteCommunityPost,
  extractCreatedRecordId,
  loadCommunityPostMediaByPostIds,
} from '@/lib/buklodCommunityPostMedia';
import { enqueueCommunityPublish } from '@/lib/buklodCommunityPublishQueue';
import { BuklodPhotoEditor } from '@/components/BuklodPhotoEditor';
/* PATCH_186B_PHOTO_EDITOR_IMPORT */
type Props = {
  scope: BuklodScope;
};

type Reaction = BuklodCommunityReactionKey;

type ViewMode =
  | 'wall'
  | 'reels';

type SelectedPhoto = {
  id?: string;
  uri: string;
  base64?: string;
  sizeBytes: number;
};

type SelectedVideo = {
  uri: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number;
};

type SocialPost = {
  id: string;
  scope_id: string;
  user_id: string;
  category: string | null;
  body: string;
  created_at: string;
  author_name: string | null;
  media_path: string | null;
  media_mime_type: string | null;
  media_size_bytes: number | null;
  media_duration_seconds: number | null;
  is_reel?: boolean;
  reaction_counts: Record<string, number> | null;
  my_reaction: string | null;
  comment_count: number;
  is_owner: boolean;
  can_manage: boolean;
  author_only?: boolean;
  media_url?: string | null;
  media_items?: Array<{
    post_id?: string;
    media_position?: number;
    media_path?: string | null;
    media_mime_type?: string | null;
    media_size_bytes?: number | null;
    media_url?: string | null;
  }>;
  comment_preview?: BuklodPostCommentPreview | null;
};

function isScopedReelPost(post: SocialPost) {
  if (post.is_reel) {
    return true;
  }

  const mime =
    String(
      post.media_mime_type ??
        ''
    )
      .toLowerCase();

  if (!mime.startsWith('video/')) {
    return false;
  }

  return isReelMediaPath(
    post.media_path
  );
}

type ScopeComment = {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  parent_id: string | null;
  created_at: string;
  commenter_name: string | null;
  is_owner: boolean;
  can_manage: boolean;
  reaction_counts?: Record<string, number> | null;
  my_reaction?: string | null;
};

const RX = BUKLOD_SCOPE_COMMUNITY_REACTIONS;

/* PATCH_173F_R2_PUBLIC_REELS_PARITY
 *
 * Exact-scope Reels now use the same playback behavior
 * as Public BUKLOD Reels:
 * - expo-video
 * - loop=true
 * - native controls
 * - cover content fit
 *
 * Feed ownership remains exact scope.
 */
function ScopePublicReelVideo({
  uri,
}: {
  uri: string;
}) {
  const player =
    useVideoPlayer(
      uri,
      instance => {
        instance.loop =
          true;
      },
    );

  return (
    <View
      style={
        styles.publicReelVideoFrame
      }
    >
      <VideoView
        player={
          player
        }
        style={
          styles.publicReelVideo
        }
        nativeControls
        contentFit="cover"
      />
    </View>
  );
}

function inferVideoMime(
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

  if (
    name.endsWith('.mov')
  ) {
    return 'video/quicktime';
  }

  if (
    name.endsWith('.webm')
  ) {
    return 'video/webm';
  }

  return 'video/mp4';
}

function videoExtension(
  mime: string
): string {
  if (
    mime === 'video/quicktime'
  ) {
    return 'mov';
  }

  if (
    mime === 'video/webm'
  ) {
    return 'webm';
  }

  return 'mp4';
}

function formatTime(
  value: string
): string {
  try {
    return new Date(
      value
    ).toLocaleString();
  }
  catch {
    return value;
  }
}

function reactionTotal(
  post: SocialPost
): number {
  return Object
    .values(
      post.reaction_counts ??
      {}
    )
    .reduce(
      (
        total,
        value
      ) =>
        total +
        Number(
          value ??
          0
        ),
      0
    );
}

function scopeLabel(
  scope: BuklodScope
): string {
if (
    scope.scope_type ===
      'CLUSTER'
  ) {
    return 'Cluster';
  }

  return 'Organization';
}

export default function BuklodExclusiveScopeCommunity({
  scope,
}: Props) {
  const {
    user,
  } = useAuth();
  const {
    isConnected,
    isInternetReachable,
  } = useNetwork();
  const scopedOnline =
    isConnected &&
    isInternetReachable !== false;
  const scopedOnlineRef = useRef(scopedOnline);
  scopedOnlineRef.current = scopedOnline;
  const {
    openReport,
    reportSheet,
  } = useBuklodContentReport();

  const postReactBusyRef =
    useRef(false);
  const commentReactBusyRef =
    useRef(false);

  const [
    mode,
    setMode,
  ] =
    useState<ViewMode>(
      'wall'
    );
  /* PATCH_173F_R11_AUTOPLAY_REEL_PREVIEW_OPTION */
  const [
    autoPlayPreview,
    setAutoPlayPreview,
  ] =
    useState(false);

  const [
    posts,
    setPosts,
  ] =
    useState<SocialPost[]>(
      []
    );
  const postsRef = useRef(posts);
  postsRef.current = posts;

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    publishNotice,
    setPublishNotice,
  ] =
    useState<string | null>(
      null
    );

  const [
    body,
    setBody,
  ] =
    useState('');

  const [
    photos,
    setPhotos,
  ] =
    useState<SelectedPhoto[]>(
      []
    );
  const photo =
    photos[0] ??
    null;

  const [
    communityGif,
    setCommunityGif,
  ] = useState<BuklodCommunityGifFile | null>(null);

  const [
    communityGifPickerOpen,
    setCommunityGifPickerOpen,
  ] = useState(false);

  /* PATCH_186B_PHOTO_EDITOR_SCOPE_STATE */
  const [
    scopePhotoEditorUri,
    setScopePhotoEditorUri,
  ] = useState<string | null>(null);

  const [
    reel,
    setReel,
  ] =
    useState<SelectedVideo | null>(
      null
    );

  const [
    wallVideo,
    setWallVideo,
  ] =
    useState<SelectedVideo | null>(
      null
    );

  const [
    wallVideoBusy,
    setWallVideoBusy,
  ] =
    useState(false);

  const [
    videoUploadPercent,
    setVideoUploadPercent,
  ] =
    useState<number | null>(
      null
    );

  const [
    commentOpen,
    setCommentOpen,
  ] =
    useState(false);

  const [
    commentPost,
    setCommentPost,
  ] =
    useState<SocialPost | null>(
      null
    );

  const [
    comments,
    setComments,
  ] =
    useState<ScopeComment[]>(
      []
    );

  const [
    photoViewer,
    setPhotoViewer,
  ] =
    useState<{
      uris: string[];
      paths?: string[];
      index: number;
    } | null>(null);

  const [
    commentText,
    setCommentText,
  ] =
    useState('');

  const [
    commentBusy,
    setCommentBusy,
  ] =
    useState(false);

  const [
    replyTo,
    setReplyTo,
  ] =
    useState<ScopeComment | null>(
      null
    );

  const [
    reactionDetailsPost,
    setReactionDetailsPost,
  ] =
    useState<
      | SocialPost
      | CommunityReactionDetailsTarget
      | null
    >(null);

  const [
    reactionDetailsFilter,
    setReactionDetailsFilter,
  ] = useState<string | null>(null);

  const openReactionDetails = (
    target:
      | SocialPost
      | CommunityReactionDetailsTarget,
    filter?: string | null,
  ) => {
    setReactionDetailsFilter(filter ?? null);
    setReactionDetailsPost(target);
  };

  const openCommentReactionDetails = (
    comment: ScopeComment,
    filter?: string | null,
  ) => {
    const knownNames: Record<string, string> =
      {};

    for (const row of comments) {
      const userId = String(
        row?.user_id ?? ''
      ).trim();
      const name = String(
        row?.commenter_name ?? ''
      ).trim();

      if (userId && name) {
        knownNames[userId] = name;
      }
    }

    openReactionDetails(
      {
        comment_id: comment.id,
        reaction_counts:
          comment.reaction_counts ?? {},
        total_reactions:
          sumCommunityReactionCounts(
            comment.reaction_counts
          ),
        known_display_names:
          knownNames,
      },
      filter
    );
  };

  const exactAudience =
    `${scope.name} members only`;

  /* BUKLOD_OFFLINE_R2_SCOPED_COMMUNITY */
  const scopedCommunityOfflineCacheKey =
    `scope-community:${scope.scope_type}:${scope.scope_id}`;

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let active = true;

    void getOfflineCache<SocialPost[]>(
      scopedCommunityOfflineCacheKey,
      {
        userId: user.id,
        allowStale: true,
      }
    )
      .then(cached => {
        if (
          active &&
          cached?.data?.length
        ) {
          setPosts(current =>
            current.length
              ? current
              : cached.data
          );
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [
    scopedCommunityOfflineCacheKey,
    user?.id,
  ]);

  useEffect(() => {
    if (
      !user?.id ||
      posts.length === 0
    ) {
      return;
    }

    const timer =
      setTimeout(() => {
        void setOfflineCache(
          scopedCommunityOfflineCacheKey,
          posts.slice(0, 80),
          {
            userId: user.id,
            ttlMs: 30 * 60 * 1000,
          }
        ).catch(
          () => undefined
        );
      }, 220);

    return () =>
      clearTimeout(timer);
  }, [
    posts,
    scopedCommunityOfflineCacheKey,
    user?.id,
  ]);
  const load =
    useCallback(
      async () => {
        if (!postsRef.current.length) {
          setLoading(true);
        }

        try {
          if (!scopedOnlineRef.current) {
            const cached =
              user?.id
                ? await getOfflineCache<SocialPost[]>(
                    scopedCommunityOfflineCacheKey,
                    {
                      userId: user.id,
                      allowStale: true,
                    }
                  )
                : null;

            if (cached?.data?.length) {
              setPosts(cached.data);
            }

            return;
          }

          const {
            data,
            error,
          } =
            await withBuklodTimeout<any>(
              (supabase as any).rpc(
                'buklod_scope_social_feed_v1',
                {
                  p_scope_id:
                    scope.scope_id,
                  p_limit:
                    120,
                }
              ),
              8000,
              'Scoped community'
            );

          if (
            error
          ) {
            throw error;
          }

          let rows =
            (
              data ??
              []
            ) as SocialPost[];

          rows =
            await withBuklodTimeout(
              hydratePersonNamesOnRows(
                rows,
                'user_id',
                'author_name',
              ),
              4000,
              'Scoped names'
            ).catch(() => rows);

          const mediaMap =
            await withBuklodTimeout(
              loadCommunityPostMediaByPostIds(
                rows.map(row => row.id)
              ),
              5000,
              'Scoped photos'
            ).catch(() => ({} as Record<string, any[]>));

          rows = rows.map(row => {
            const loaded = mediaMap[row.id] ?? [];
            const mediaItems = loaded.length
              ? loaded
                  .slice()
                  .sort(
                    (a: any, b: any) =>
                      Number(a.media_position ?? 0) -
                      Number(b.media_position ?? 0)
                  )
                  .map((item: any) => ({
                    ...item,
                    media_url:
                      peekCommunityMediaUrl(
                        item.media_path,
                        item.media_url
                      ) ?? item.media_url,
                  }))
              : row.media_path || row.media_url
                ? [
                    {
                      post_id: row.id,
                      media_position: 0,
                      media_path: row.media_path,
                      media_mime_type: row.media_mime_type,
                      media_size_bytes: row.media_size_bytes,
                      media_url: row.media_url,
                    },
                  ]
                : [];

            return {
              ...row,
              media_items: mediaItems,
            };
          });

          const previewMap =
            await withBuklodTimeout(
              fetchBuklodPostCommentPreviews(
                rows.map(row => row.id)
              ),
              4000,
              'Scoped comments'
            ).catch(() => ({} as Record<string, SocialPost['comment_preview']>));

          setPosts(previous =>
            keepStableCommunityMedia(
              previous,
              rows.map(row => ({
                ...row,
                comment_preview:
                  previewMap[row.id] ??
                  null,
              })),
            )
          );
        }
        catch (
          error: any
        ) {
          const cached =
            user?.id
              ? await getOfflineCache<SocialPost[]>(
                  scopedCommunityOfflineCacheKey,
                  {
                    userId: user.id,
                    allowStale: true,
                  }
                )
              : null;

          if (
            cached?.data?.length
          ) {
            setPosts(
              cached.data
            );
          }
          else {
            setPosts(
              []
            );

            Alert.alert(
              'Community',
              error?.message ??
                'Could not load this community.'
            );
          }
        }
        finally {
          setLoading(
            false
          );
        }
      },
      [
        scope.scope_id,
        scopedCommunityOfflineCacheKey,
        user?.id,
      ]
    );

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(
    () => {
      void loadRef.current();
    },
    [
      scope.scope_id,
      user?.id,
    ]
  );

  useEffect(
    () => {
      let reloadTimer:
        ReturnType<typeof setTimeout> | null = null;

      const requestReload = () => {
        if (reloadTimer) {
          clearTimeout(reloadTimer);
        }

        reloadTimer = setTimeout(() => {
          reloadTimer = null;
          void loadRef.current();
        }, 900);
      };

      const channel =
        supabase
          .channel(
            `exclusive-scope-community:${scope.scope_id}`
          )
          .on(
            'postgres_changes',
            {
              event:
                '*',
              schema:
                'public',
              table:
                'community_posts',
              filter:
                `scope_id=eq.${scope.scope_id}`,
            },
            requestReload
          )
          .subscribe();

      return () => {
        if (reloadTimer) {
          clearTimeout(reloadTimer);
        }

        void supabase
          .removeChannel(
            channel
          );
      };
    },
    [
      scope.scope_id,
    ]
  );

  /* PATCH_186O_EXACT_SCOPE_WALL_VIDEO */
  const reelPosts =
    useMemo(
      () =>
        posts.filter(
          isScopedReelPost
        ),
      [
        posts,
      ]
    );

  const wallPosts =
    useMemo(
      () =>
        posts.filter(
          post =>
            !isScopedReelPost(
              post
            )
        ),
      [
        posts,
      ]
    );

  const visiblePosts =
    mode ===
      'reels'
      ? reelPosts
      : wallPosts;

  const wallFeedRows =
    useMemo(
      () =>
        buildCommunityFeedWithInlineAds(
          wallPosts,
        ),
      [
        wallPosts,
      ],
    );

  const {
    onViewableItemsChanged: onCommunityAdViewableItemsChanged,
    viewabilityConfig: communityAdViewabilityConfig,
    extraData: communityAdExtraData,
    isAdActive,
  } = useBuklodCommunityAdViewability();

  const listData =
    mode ===
      'reels'
      ? visiblePosts
      : wallFeedRows;

  const scrollBottomInset =
    useBuklodScrollBottomInset({
      extra: 12,
    });
  const drawerBottomInset =
    useBuklodDrawerBottomInset();
  /* PATCH_186B_PHOTO_EDITOR_SCOPE_FLOW */
  const choosePhoto =
    async () => {
      try {
        const picked =
          await pickCommunityPhotos({
            remaining:
              COMMUNITY_MAX_PHOTOS -
              photos.length,
            maxPhotos:
              COMMUNITY_MAX_PHOTOS,
          });

        if (!picked.length) {
          return;
        }

        setCommunityGif(null);
        setPhotos(current =>
          [
            ...current,
            ...picked.map(item => ({
              id: item.id,
              uri: item.uri,
              sizeBytes: 0,
            })),
          ].slice(0, COMMUNITY_MAX_PHOTOS)
        );
        setReel(null);
        setWallVideo(null);
      }
      catch (e: any) {
        Alert.alert(
          'Photo',
          e?.message ||
            'Could not select photos.'
        );
      }
    };

  const acceptVideo =
    async (
      asset: any
    ) => {
      const durationSeconds =
        readVideoDurationSeconds(
          asset
        );

      if (
        durationSeconds >
        BUKLOD_REEL_MAX_DURATION_SECONDS
      ) {
        Alert.alert(
          'Reel Too Long',
          BUKLOD_REEL_TOO_LONG_MESSAGE
        );

        return;
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

      const validationError =
        validateCommunityVideoUpload({
          durationSeconds,
          sizeBytes,
          isReel: true,
        });

      if (validationError) {
        Alert.alert(
          'Reel',
          validationError
        );
        return;
      }

      setReel(
        {
          uri:
            asset.uri,
          mimeType:
            inferVideoMime(
              asset
            ),
          sizeBytes,
          durationSeconds,
        }
      );

      setCommunityGif(null);

      setPhotos(
        []
      );

      setWallVideo(
        null
      );
};

  const acceptWallVideo =
    async (
      asset: any
    ) => {
      const durationSeconds =
        readVideoDurationSeconds(
          asset
        );

      if (
        durationSeconds >
        BUKLOD_WALL_VIDEO_MAX_DURATION_SECONDS
      ) {
        Alert.alert(
          'Video Too Long',
          BUKLOD_WALL_VIDEO_TOO_LONG_MESSAGE
        );

        return;
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

      const validationError =
        validateCommunityVideoUpload({
          durationSeconds,
          sizeBytes,
          isReel: false,
        });

      if (validationError) {
        Alert.alert(
          'Video',
          validationError
        );

        return;
      }

      if (sizeBytes) {
        const quota = await assertCommunityVideoQuotaAvailable(sizeBytes);
        if (quota.allowed === false) {
          Alert.alert('Monthly Video Allowance','This video would exceed your current monthly Community Wall video allowance.');
          return;
        }
      }

      setWallVideo(
        {
          uri:
            asset.uri,
          mimeType:
            inferVideoMime(
              asset
            ),
          sizeBytes,
          durationSeconds,
        }
      );

      setCommunityGif(null);

      setPhotos(
        []
      );

      setReel(
        null
      );
    };

  const pickWallVideo =
    async () => {
      if (
        busy ||
        wallVideoBusy
      ) {
        return;
      }

      try {
        setWallVideoBusy(
          true
        );

        const permissionGranted =
          await ensureImagePickerLibraryAccess(
            ImagePicker.requestMediaLibraryPermissionsAsync
          );

        if (
          !permissionGranted
        ) {
          Alert.alert(
            'Video Permission',
            'Please allow BUKLOD to access your videos.'
          );

          return;
        }

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
          !result.assets?.[0]
        ) {
          return;
        }

        await acceptWallVideo(
          result.assets[0]
        );
      }
      catch (e: any) {
        Alert.alert(
          'Video',
          e?.message ||
            'Could not select this video.'
        );
      }
      finally {
        setWallVideoBusy(
          false
        );
      }
    };

  const chooseReel =
    async () => {
      if (
        busy
      ) {
        return;
      }

      const permissionGranted =
        await ensureImagePickerLibraryAccess(
          ImagePicker.requestMediaLibraryPermissionsAsync
        );

      if (
        !permissionGranted
      ) {
        Alert.alert(
          'Video Permission',
          'Please allow BUKLOD to access your videos.'
        );

        return;
      }

      const result =
        await ImagePicker
          .launchImageLibraryAsync(
            {
              mediaTypes:
                [
                  'videos',
                ],
              allowsEditing:
                false,
              quality:
                1,
            }
          );

      if (
        result.canceled ||
        !result.assets
          ?.length
      ) {
        return;
      }

      await acceptVideo(
        result.assets[0]
      );
    };

  const recordReel =
    async () => {
      if (
        busy
      ) {
        return;
      }

      const permission =
        await ImagePicker
          .requestCameraPermissionsAsync();

      if (
        !permission.granted
      ) {
        Alert.alert(
          'Camera Permission',
          'Camera access is required to record a Reel.'
        );

        return;
      }

      const result =
        await ImagePicker
          .launchCameraAsync(
            {
              mediaTypes:
                [
                  'videos',
                ],
              videoMaxDuration:
                BUKLOD_REEL_MAX_DURATION_SECONDS,
              quality:
                1,
            }
          );

      if (
        result.canceled ||
        !result.assets
          ?.length
      ) {
        return;
      }

      await acceptVideo(
        result.assets[0]
      );
    };

  const clearMedia =
    () => {
      setPhotos(
        []
      );

      setReel(
        null
      );

      setWallVideo(
        null
      );

      setCommunityGif(null);
    };

  const publish =
    async () => {
      if (
        !user?.id
      ) {
        return;
      }

      if (
        mode === 'reels' ||
        !!reel ||
        !!wallVideo ||
        !!communityGif
      ) {
        Alert.alert(
          'Community',
          'Community accepts text and photos only. Video posting is disabled in this BUKLOD Main release.'
        );
        return;
      }

      const cleanBody =
        body.trim();

      const publishingReel = false;

      if (
        publishingReel &&
        !reel
      ) {
        Alert.alert(
          'Nothing to Post',
          'Select a Reel video first.'
        );

        return;
      }

      if (
        !publishingReel &&
        !cleanBody &&
        !photos.length &&
        !wallVideo &&
        !communityGif
      ) {
        Alert.alert(
          'Nothing to Post',
          'Write a message or add photos or a video first.'
        );

        return;
      }

      if (
        !publishingReel &&
        (
          (photos.length && wallVideo) ||
          (communityGif && (photos.length || wallVideo))
        )
      ) {
        Alert.alert(
          'BUKLOD',
          'Choose one media type: GIF, photos, or one video.'
        );

        return;
      }

      const snapshot = {
        photos: [...photos],
        wallVideo:
          wallVideo as SelectedVideo | null,
        reel:
          reel as SelectedVideo | null,
        communityGif:
          communityGif as BuklodCommunityGifFile | null,
        cleanBody,
        publishingReel:
          publishingReel as boolean,
        userId: user.id,
        scopeId: scope.scope_id,
      };

      setBody('');
      clearMedia();
      setBusy(false);
      setPublishNotice(
        snapshot.communityGif
          ? 'Uploading GIF in the background…'
          : snapshot.publishingReel || snapshot.wallVideo
          ? 'Uploading video in the background…'
          : snapshot.photos.length
            ? 'Uploading photos in the background…'
            : 'Posting in the background…'
      );

      void (async () => {
      let uploadedPath:
        string |
        null =
          null;
      let createdPostId:
        string |
        null =
          null;
      let extraMedia:
        Array<{
          media_path: string;
          media_mime_type: string;
          media_size_bytes: number;
        }> =
          [];

      try {
        let mediaMime:
          string |
          null =
            null;

        let mediaSize:
          number |
          null =
            null;

        let duration:
          number |
          null =
            null;

        let isReel =
          false;

        if (
          snapshot.communityGif &&
          !snapshot.publishingReel
        ) {
          uploadedPath =
            `scope/${snapshot.scopeId}/${snapshot.userId}/post-gif-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2)}.gif`;

          setPublishNotice(
            'Uploading GIF in the background…'
          );

          const uploadedGif =
            await uploadCommunityGifFile({
              path: uploadedPath,
              uri: snapshot.communityGif.uri,
              sizeBytes: snapshot.communityGif.size,
            });

          mediaMime = 'image/gif';
          mediaSize = uploadedGif.sizeBytes;
          extraMedia = [
            {
              media_path: uploadedPath,
              media_mime_type: 'image/gif',
              media_size_bytes: uploadedGif.sizeBytes,
            },
          ];
        }

        if (
          snapshot.photos.length &&
          !snapshot.publishingReel
        ) {
          const photoUploads =
            await mapWithConcurrency(
              snapshot.photos,
              3,
              async (item, index) => {
                const path =
                  `scope/${snapshot.scopeId}/${snapshot.userId}/post-${Date.now()}-${index}-${Math.random()
                    .toString(36)
                    .slice(2)}.jpg`;

                const uploadedPhoto =
                  await uploadCommunityPhotoFile({
                    path,
                    uri: item.uri,
                  });

                return {
                  media_path: path,
                  media_mime_type: 'image/jpeg',
                  media_size_bytes:
                    uploadedPhoto.sizeBytes ||
                    item.sizeBytes ||
                    0,
                };
              }
            );

          uploadedPath =
            photoUploads[0]?.media_path ??
            null;

          mediaMime =
            photoUploads[0]?.media_mime_type ??
            null;

          mediaSize =
            photoUploads[0]?.media_size_bytes ??
            null;

          extraMedia = photoUploads;
        }

        if (
          snapshot.wallVideo &&
          !snapshot.publishingReel
        ) {
          const extension =
            videoExtension(
              snapshot.wallVideo.mimeType
            );

          uploadedPath =
            `scope/${snapshot.scopeId}/${snapshot.userId}/post-video-${Date.now()}-${Math.random()
              .toString(
                36
              )
              .slice(
                2
              )}.${extension}`;

          setVideoUploadPercent(0);

          await uploadCommunityVideoFile({
            path:
              uploadedPath,
            uri:
              snapshot.wallVideo.uri,
            contentType:
              snapshot.wallVideo.mimeType,
            onProgress: (progress) => {
              setVideoUploadPercent(
                progress.ratio
              );
              setPublishNotice(
                `Uploading video in the background… ${Math.round(progress.ratio * 100)}%`
              );
            },
          });

          mediaMime =
            snapshot.wallVideo.mimeType;

          mediaSize =
            snapshot.wallVideo.sizeBytes ||
            null;

          duration =
            snapshot.wallVideo.durationSeconds;

          isReel =
            false;

          extraMedia = [
            {
              media_path: uploadedPath,
              media_mime_type: snapshot.wallVideo.mimeType,
              media_size_bytes: snapshot.wallVideo.sizeBytes || 0,
            },
          ];
        }

        if (
          snapshot.reel &&
          snapshot.publishingReel
        ) {
          const extension =
            videoExtension(
              snapshot.reel.mimeType
            );

          uploadedPath =
            `scope/${snapshot.scopeId}/${snapshot.userId}/reel-${Date.now()}-${Math.random()
              .toString(
                36
              )
              .slice(
                2
              )}.${extension}`;
          setVideoUploadPercent(0);

          await uploadCommunityVideoFile({
            path:
              uploadedPath,
            uri:
              snapshot.reel.uri,
            contentType:
              snapshot.reel.mimeType,
            onProgress: (progress) => {
              setVideoUploadPercent(
                progress.ratio
              );
              setPublishNotice(
                `Uploading video in the background… ${Math.round(progress.ratio * 100)}%`
              );
            },
          });

          mediaMime =
            snapshot.reel.mimeType;

          mediaSize =
            snapshot.reel.sizeBytes ||
            null;

          duration =
            snapshot.reel
              .durationSeconds;

          isReel =
            true;
        }

        const fallbackBody =
          isReel
            ? 'Shared a Reel.'
            : snapshot.wallVideo
            ? 'Shared a video.'
            : snapshot.communityGif
            ? 'Shared a GIF.'
            : snapshot.photos.length
            ? 'Shared photos.'
            : snapshot.cleanBody;

        const {
          data: created,
          error:
            createError,
        } =
          await (
            supabase as any
          ).rpc(
            'buklod_scope_social_create_post_v1',
            {
              p_scope_id:
                snapshot.scopeId,
              p_body:
                snapshot.cleanBody ||
                fallbackBody,
              p_category:
                'discussion',
              p_media_path:
                snapshot.wallVideo &&
                !snapshot.publishingReel
                  ? null
                  : uploadedPath,
              p_media_mime_type:
                snapshot.wallVideo &&
                !snapshot.publishingReel
                  ? null
                  : mediaMime,
              p_media_size_bytes:
                snapshot.wallVideo &&
                !snapshot.publishingReel
                  ? null
                  : mediaSize,
              p_duration_seconds:
                snapshot.wallVideo &&
                !snapshot.publishingReel
                  ? null
                  : duration,
              p_is_reel:
                isReel,
            }
          );

        if (
          createError
        ) {
          throw createError;
        }

        const createdId =
          extractCreatedRecordId(created);

        createdPostId = createdId;

        if (
          createdId &&
          extraMedia.length
        ) {
          await attachCommunityPostMedia(
            createdId,
            extraMedia
          );
        }

        await load();
      }
      catch (
        error: any
      ) {
        if (
          uploadedPath ||
          extraMedia.length ||
          createdPostId
        ) {
          await discardIncompleteCommunityPost({
            postId: createdPostId,
            scopeId: snapshot.scopeId,
            mediaPaths: [
              ...(uploadedPath ? [uploadedPath] : []),
              ...extraMedia.map(item => item.media_path),
            ],
          });
        }

        setBody(snapshot.cleanBody);
        setPhotos(snapshot.photos);
        setWallVideo(snapshot.wallVideo);
        setReel(snapshot.reel);
        setCommunityGif(snapshot.communityGif);

        Alert.alert(
          'Could Not Post',
          error?.message ??
            'Posting failed.'
        );
      }
      finally {
        setBusy(
          false
        );
        setVideoUploadPercent(null);
        setPublishNotice(null);
      }
      })();
    };

  const react =
    async (
      post:
        SocialPost,
      reaction:
        Reaction
    ) => {
      if (postReactBusyRef.current) {
        return;
      }

      postReactBusyRef.current = true;

      /*
       * PATCH_173E_SCOPE_OPTIMISTIC_REACTION
       *
       * Commit visual state before network I/O.
       * No post-RPC feed reload.
       */
      const before =
        post;

      const previous =
        post.my_reaction;

      const next =
        previous ===
          reaction
          ? null
          : reaction;

      const counts = {
        ...(
          post.reaction_counts ??
          {}
        ),
      };

      if (previous) {
        counts[previous] =
          Math.max(
            0,
            Number(
              counts[
                previous
              ] ??
              0
            ) - 1
          );
      }

      if (next) {
        counts[next] =
          Number(
            counts[next] ??
            0
          ) + 1;
      }

      setPosts(
        current =>
          current.map(
            item =>
              item.id ===
              post.id
                ? {
                    ...item,
                    my_reaction:
                      next,
                    reaction_counts:
                      counts,
                  }
                : item
          )
      );

      try {
        const {
          error,
        } =
          await (
            supabase as any
          ).rpc(
            'buklod_scope_social_set_reaction_v1',
            {
              p_scope_id:
                scope.scope_id,
              p_post_id:
                post.id,
              p_reaction:
                reaction,
            }
          );

        if (error) {
          throw error;
        }
      }
      catch (
        error: any
      ) {
        setPosts(
          current =>
            current.map(
              item =>
                item.id ===
                before.id
                  ? before
                  : item
            )
        );

        Alert.alert(
          'Reaction',
          error?.message ??
            'Could not save reaction.'
        );
      }

      postReactBusyRef.current = false;
    };
  const loadComments =
    useCallback(
      async (
        postId:
          string
      ) => {
        const [
          commentsResult,
          reactionsResult,
        ] =
          await Promise.all([
            (
              supabase as any
            ).rpc(
              'buklod_scope_social_comments_v1',
              {
                p_scope_id:
                  scope.scope_id,
                p_post_id:
                  postId,
              }
            ),
            (
              supabase as any
            ).rpc(
              'get_buklod_comment_reactions_v1',
              {
                p_post_id:
                  postId,
              }
            ),
          ]);

        if (
          commentsResult.error
        ) {
          Alert.alert(
            'Comments',
            commentsResult.error.message
          );

          return;
        }

        const reactionMap =
          new Map<string, any>();

        for (
          const row of (
            reactionsResult.data ??
            []
          )
        ) {
          reactionMap.set(
            String(
              row.comment_id
            ),
            row
          );
        }

        const rows =
          (
            commentsResult.data ??
            []
          ) as ScopeComment[];

        const hydratedRows =
          await hydratePersonNamesOnRows(
            rows,
            'user_id',
            'commenter_name',
          );

        setComments(
          hydratedRows.map(
            row => {
              const reaction =
                reactionMap.get(
                  String(
                    row.id
                  )
                );

              return {
                ...row,
                reaction_counts:
                  reaction?.reaction_counts ??
                  {},
                my_reaction:
                  reaction?.my_reaction ??
                  null,
              };
            }
          )
        );
      },
      [
        scope.scope_id,
      ]
    );

  const openComments =
    async (
      post:
        SocialPost
    ) => {
      setCommentPost(
        post
      );

      setComments(
        []
      );

      setCommentText(
        ''
      );

      setReplyTo(
        null
      );

      setCommentOpen(
        true
      );

      await loadComments(
        post.id
      );
    };

  useEffect(
  () => {
    if (
      !commentOpen ||
      !commentPost?.id
    ) {
      return;
    }

    const postId =
      commentPost.id;

    return acquireSharedRealtimeSubscription(
      `exclusive-scope-comments:${postId}`,
      () => {
        void loadComments(postId);
      },
      emit => {
        const channel = supabase
          .channel(`exclusive-scope-comments:${postId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'comments',
              filter: `post_id=eq.${postId}`,
            },
            () => emit(undefined)
          )
          .subscribe();

        return () => {
          void supabase.removeChannel(channel);
        };
      }
    );
  },
  [commentOpen, commentPost?.id, loadComments]
);

  const addComment =
    async () => {
      if (
        !commentPost?.id ||
        !commentText
          .trim() ||
        commentBusy
      ) {
        return;
      }

      setCommentBusy(
        true
      );

      try {
        let finalBody =
          commentText
            .trim();

        if (
          replyTo
        ) {
          const mention =
            '@' +
            String(
              resolvePersonDisplayName(
                replyTo.commenter_name,
                replyTo.user_id,
              )
            );

          if (
            !finalBody
              .toLowerCase()
              .startsWith(
                mention
                  .toLowerCase()
              )
          ) {
            finalBody =
              `${mention} ${finalBody}`;
          }
        }

        const {
          error,
        } =
          await (
            supabase as any
          ).rpc(
            'buklod_scope_social_add_comment_v1',
            {
              p_scope_id:
                scope.scope_id,
              p_post_id:
                commentPost.id,
              p_body:
                finalBody,
              p_parent_id:
                replyTo?.id ??
                null,
            }
          );

        if (
          error
        ) {
          throw error;
        }

        setCommentText(
          ''
        );

        setReplyTo(
          null
        );

        await Promise.all(
          [
            loadComments(
              commentPost.id
            ),
            load(),
          ]
        );
      }
      catch (
        error: any
      ) {
        Alert.alert(
          'Comment',
          error?.message ??
            'Could not add comment.'
        );
      }
      finally {
        setCommentBusy(
          false
        );
      }
    };

  const openOwnPostActions =
    (
      post:
        SocialPost
    ) => {
      if (
        !post.is_owner &&
        !post.can_manage
      ) {
        return;
      }

      Alert.alert(
        'Your post',
        undefined,
        [
          {
            text:
              post.author_only
                ? 'Show to everyone'
                : 'Ako lang (only me)',
            onPress:
              () => {
                void (
                  async () => {
                    try {
                      await setCommunityPostAuthorOnly(
                        post.id,
                        !post.author_only
                      );

                      setPosts(
                        current =>
                          current.map(
                            item =>
                              item.id ===
                              post.id
                                ? {
                                    ...item,
                                    author_only:
                                      !post.author_only,
                                  }
                                : item
                          )
                      );
                    } catch (
                      error: any
                    ) {
                      Alert.alert(
                        'Post',
                        error?.message ||
                          'Could not update visibility.'
                      );
                    }
                  }
                )();
              },
          },
          {
            text:
              'Delete',
            style:
              'destructive',
            onPress:
              () => {
                void (
                  async () => {
                    try {
                      const {
                        error,
                      } =
                        await (
                          supabase as any
                        ).rpc(
                          'buklod_scope_social_delete_post_v1',
                          {
                            p_scope_id:
                              scope.scope_id,
                            p_post_id:
                              post.id,
                          }
                        );

                      if (
                        error
                      ) {
                        throw error;
                      }

                      await load();
                    } catch (
                      error: any
                    ) {
                      Alert.alert(
                        'Delete Post',
                        error?.message ||
                          'Could not delete this post.'
                      );
                    }
                  }
                )();
              },
          },
          {
            text:
              'Cancel',
            style:
              'cancel',
          },
        ]
      );
    };

  const openPostMenu =
    (
      post:
        SocialPost
    ) => {
      if (
        post.is_owner ||
        post.can_manage
      ) {
        openOwnPostActions(post);
        return;
      }

      Alert.alert(
        'Report this post?',
        'Choose a reason on the next screen. Moderators will review it.',
        [
          {
            text: 'Report',
            style: 'destructive',
            onPress: () => {
              openReport('post', post.id);
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
    };

  const deletePost = openPostMenu;

  const renderPostOverflow = (
    item: SocialPost
  ) => {
    const canManage =
      item.is_owner ||
      item.can_manage;

    return (
      <BuklodContentOverflowMenu
        title={
          canManage
            ? 'Your post'
            : 'Post'
        }
        body={repairMojibakeText(item.body)}
        authorOnly={!!item.author_only}
        iconColor={colors.muted}
        iconSize={18}
        style={styles.deleteButton}
        allowPhotoEdit={
          item.is_owner &&
          !isScopedReelPost(item) &&
          !communityPostIsVideo(item)
        }
        maxPhotos={COMMUNITY_MAX_PHOTOS}
        photos={communityPostEditPhotos(item)}
        onEdit={
          item.is_owner
            ? async (nextBody, nextPhotos) => {
                const saved =
                  await saveCommunityPostEdit({
                    postId: item.id,
                    userId: String(user?.id ?? ''),
                    body: nextBody,
                    photos: nextPhotos ?? [],
                  });
                setPosts(current =>
                  current.map(post =>
                    post.id === item.id
                      ? {
                          ...post,
                          ...saved,
                        }
                      : post
                  )
                );
              }
            : undefined
        }
        onDelete={
          canManage
            ? async () => {
                const { error } =
                  await (supabase as any).rpc(
                    'buklod_scope_social_delete_post_v1',
                    {
                      p_scope_id:
                        scope.scope_id,
                      p_post_id: item.id,
                    }
                  );

                if (error) {
                  throw error;
                }

                await load();
              }
            : undefined
        }
        onToggleAuthorOnly={
          canManage
            ? async () => {
                await setCommunityPostAuthorOnly(
                  item.id,
                  !item.author_only
                );
                setPosts(current =>
                  current.map(post =>
                    post.id === item.id
                      ? {
                          ...post,
                          author_only:
                            !item.author_only,
                        }
                      : post
                  )
                );
              }
            : undefined
        }
        onReport={
          canManage
            ? undefined
            : () => {
                openReport('post', item.id);
              }
        }
      />
    );
  };

  const removeScopedComment =
    async (
      comment:
        ScopeComment
    ) => {
      const {
        error,
      } =
        await (
          supabase as any
        ).rpc(
          'buklod_scope_social_delete_comment_v1',
          {
            p_scope_id:
              scope.scope_id,
            p_comment_id:
              comment.id,
          }
        );

      if (
        error
      ) {
        throw error;
      }

      if (
        commentPost?.id
      ) {
        await Promise.all(
          [
            loadComments(
              commentPost.id
            ),
            load(),
          ]
        );
      }
    };

  const reactToComment =
    async (
      target:
        ScopeComment,
      reaction:
        Reaction
    ) => {
      if (
        commentReactBusyRef.current
      ) {
        return;
      }

      commentReactBusyRef.current =
        true;

      const targetId =
        String(
          target.id
        );

      const previous =
        (
          target.my_reaction ??
          null
        ) as Reaction | null;

      const nextReaction =
        previous ===
          reaction
          ? null
          : reaction;

      setComments(
        current =>
          current.map(
            item => {
              if (
                String(
                  item.id
                ) !==
                targetId
              ) {
                return item;
              }

              const counts = {
                ...(
                  item.reaction_counts ??
                  {}
                ),
              };

              if (
                previous
              ) {
                counts[previous] =
                  Math.max(
                    0,
                    Number(
                      counts[
                        previous
                      ] ??
                      0
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
                    ] ??
                    0
                  ) + 1;
              }

              return {
                ...item,
                my_reaction:
                  nextReaction,
                reaction_counts:
                  counts,
              };
            }
          )
      );

      const {
        error,
      } =
        await (
          supabase as any
        ).rpc(
          'set_buklod_comment_reaction_v1',
          {
            p_comment_id:
              targetId,
            p_reaction:
              reaction,
          }
        );

      if (
        error
      ) {
        Alert.alert(
          'Reaction',
          error.message
        );

        if (
          commentPost?.id
        ) {
          await loadComments(
            commentPost.id
          );
        }
      }

      commentReactBusyRef.current =
        false;
    };

  const updateScopedComment =
    async (
      commentId:
        string,
      body:
        string
    ) => {
      const {
        error,
      } =
        await (
          supabase as any
        ).rpc(
          'buklod_scope_social_update_comment_v1',
          {
            p_scope_id:
              scope.scope_id,
            p_comment_id:
              commentId,
            p_body:
              body,
          }
        );

      if (
        error
      ) {
        throw error;
      }

      if (
        commentPost?.id
      ) {
        await loadComments(
          commentPost.id
        );
      }
    };

  const renderScopeCommentBubble =
    (
      comment:
        ScopeComment,
      options?: {
        isReply?: boolean;
        replyingToLabel?: string | null;
        replyMentionPrefix?: string | null;
        onReply?: () => void;
      }
    ) => (
      <BuklodCommunityCommentBubble
        comment={{
          ...comment,
          body: repairMojibakeText(
            comment.body
          ),
        }}
        currentUserId={
          user?.id
        }
        reactionOptions={
          BUKLOD_SCOPE_COMMUNITY_REACTIONS
        }
        isReply={
          options?.isReply
        }
        replyingToLabel={
          options?.replyingToLabel
        }
        bubbleStyle={
          options?.isReply
            ? styles.replyBubble
            : undefined
        }
        timeLabel={
          formatTime(
            comment.created_at
          )
        }
        onReply={() => {
          if (
            options?.onReply
          ) {
            options.onReply();

            return;
          }

          setReplyTo(
            comment
          );

          setCommentText(
            options?.replyMentionPrefix ??
              `@${resolvePersonDisplayName(
                comment.commenter_name,
                comment.user_id,
              )} `
          );
        }}
        onReact={key =>
          void reactToComment(
            comment,
            key as Reaction
          )
        }
        onReactionSummaryPress={key =>
          openCommentReactionDetails(
            comment,
            key
          )
        }
        onEdit={body =>
          updateScopedComment(
            comment.id,
            body
          )
        }
        onDelete={() =>
          removeScopedComment(
            comment
          )
        }
        onReport={() =>
          openReport(
            'comment',
            comment.id
          )
        }
      />
    );

  const roots =
    comments.filter(
      comment =>
        !comment.parent_id
    );

  const repliesFor =
    (
      parentId:
        string
    ) =>
      comments.filter(
        comment =>
          comment.parent_id ===
          parentId
      );

  const renderPost =
    ({
      item,
    }: {
      item:
        SocialPost;
    }) => {
      const total =
        reactionTotal(
          item
        );

      const selected =
        RX.find(
          rx =>
            rx.key ===
            item.my_reaction
        );

      const isVideo =
        String(
          item
            .media_mime_type ??
            ''
        )
          .toLowerCase()
          .startsWith(
            'video/'
          );

            /*
       * PATCH_173F_R2_REEL_CARD
       *
       * Reels get a dedicated card instead of the generic
       * Wall post/video card. Wall posts continue below unchanged.
       */
      if (
        mode === 'reels' &&
        isVideo
      ) {
        return (
          <View
            style={
              styles.publicReelCard
            }
          >
            <View
              style={
                styles.publicReelHeader
              }
            >
              <BuklodTappableAvatar
                userId={item.user_id}
                name={resolvePersonDisplayName(
                  item.author_name,
                  item.user_id,
                )}
                size={39}
              />

              <View
                style={{
                  flex: 1,
                }}
              >
                <Text
                  style={
                    styles.publicReelAuthor
                  }
                  numberOfLines={1}
                >
                  {resolvePersonDisplayName(
                    item.author_name,
                    item.user_id,
                  )}
                </Text>

                <Text
                  style={
                    styles.publicReelMeta
                  }
                  numberOfLines={1}
                >
                  {scope.name}
                  {'  '}·{'  '}
                  {formatTime(
                    item.created_at
                  )}
                </Text>
              </View>

              {!!item
                .media_duration_seconds && (
                <View
                  style={
                    styles.publicReelDuration
                  }
                >
                  <MaterialCommunityIcons
                    name="movie-play-outline"
                    size={13}
                    color={
                      colors.greenDark
                    }
                  />

                  <Text
                    style={
                      styles.publicReelDurationText
                    }
                  >
                    {Math.round(
                      Number(
                        item
                          .media_duration_seconds
                      )
                    )}s
                  </Text>
                </View>
              )}

              {renderPostOverflow(item)}
            </View>

            {!!item.media_url ? (
              <ScopePublicReelVideo
                uri={
                  item.media_url
                }
              />
            ) : (
              <View
                style={
                  styles.publicReelUnavailable
                }
              >
                <MaterialCommunityIcons
                  name="movie-open-outline"
                  size={28}
                  color={
                    colors.muted
                  }
                />

                <Text
                  style={
                    styles.publicReelUnavailableText
                  }
                >
                  Reel video is unavailable.
                </Text>
              </View>
            )}

            {!!item.body &&
              item.body !==
                'Shared a Reel.' && (
                <Text
                  style={
                    styles.publicReelCaption
                  }
                >
                  {item.body}
                </Text>
              )}

            <View
              style={
                styles.publicReelStats
              }
            >
              <View
                style={
                  styles.publicReelStat
                }
              >
                <MaterialCommunityIcons
                  name="heart-outline"
                  size={16}
                  color={
                    colors.greenDark
                  }
                />

                <Text
                  style={
                    styles.publicReelStatText
                  }
                >
                  {total}{' '}
                  {total === 1
                    ? 'reaction'
                    : 'reactions'}
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
                  styles.publicReelStat
                }
              >
                <MaterialCommunityIcons
                  name="comment-outline"
                  size={16}
                  color={
                    colors.greenDark
                  }
                />

                <Text
                  style={
                    styles.publicReelStatText
                  }
                >
                  {Number(
                    item.comment_count ??
                      0
                  )}{' '}
                  {Number(
                    item.comment_count ??
                      0
                  ) === 1
                    ? 'comment'
                    : 'comments'}
                </Text>
              </BuklodPressable>
            </View>

            <BuklodCommunityPostEngagement
              reactionOptions={
                BUKLOD_SCOPE_COMMUNITY_REACTIONS
              }
              reactionCounts={
                item.reaction_counts
              }
              myReaction={
                item.my_reaction
              }
              commentCount={
                item.comment_count
              }
              commentPreview={
                item.comment_preview
                  ? {
                      comment_id:
                        item.comment_preview.comment_id,
                      user_id:
                        item.comment_preview.user_id,
                      author_name:
                        item.comment_preview.author_name,
                      body:
                        item.comment_preview.body,
                      created_at:
                        item.comment_preview.created_at,
                    }
                  : null
              }
              onReactionSummaryPress={key =>
                openReactionDetails(
                  item,
                  key
                )
              }
              onReact={key =>
                void react(
                  item,
                  key as Reaction
                )
              }
              onOpenComments={() =>
                void openComments(item)
              }
              onReport={
                user?.id &&
                item.user_id !== user.id
                  ? () =>
                      openReport(
                        'post',
                        item.id
                      )
                  : undefined
              }
            />

            {!!selected && (
              <Text
                style={
                  styles.publicReelMyReaction
                }
              >
                Your reaction:{' '}
                {selected.emoji}{' '}
                {selected.label}
              </Text>
            )}

            <View
              style={
                styles.publicReelBottomActions
              }
            >
              <BuklodPressable
                nested
                compact
                onPress={() =>
                  void openComments(
                    item
                  )
                }
                style={
                  styles.publicReelCommentButton
                }
              >
                <MaterialCommunityIcons
                  name="comment-outline"
                  size={18}
                  color={
                    colors.greenDark
                  }
                />

                <Text
                  style={
                    styles.publicReelCommentText
                  }
                >
                  Comment / Reply
                </Text>
              </BuklodPressable>

              <BuklodPostInternalShare
                postId={
                  item.id
                }
                compact
              />
            </View>
          </View>
        );
      }

return (
        <View
          style={
            styles.postCard
          }
        >
          <View
            style={
              styles.postHeader
            }
          >
            <BuklodTappableAvatar
              userId={item.user_id}
              name={resolvePersonDisplayName(
                item.author_name,
                item.user_id,
              )}
              size={39}
            />

            <View
              style={
                styles.postIdentity
              }
            >
              <Text
                style={
                  styles.author
                }
                numberOfLines={
                  1
                }
              >
                {resolvePersonDisplayName(
                  item.author_name,
                  item.user_id,
                )}
              </Text>

              <Text
                style={
                  styles.meta
                }
              >
                {formatTime(
                  item.created_at
                )}
                {item.author_only
                  ? '  ·  Ako lang'
                  : ''}
                {'  '}·{'  '}
                🔒 {scope.name}
              </Text>
            </View>

            {renderPostOverflow(item)}
          </View>

          {!!item.body && (
            <Text
              style={
                styles.body
              }
            >
              {repairMojibakeText(item.body)}
            </Text>
          )}

          {!isVideo &&
            communityPhotoCollageItems(
              item.media_items,
              {
                media_path: item.media_path,
                media_url: item.media_url,
                media_mime_type: item.media_mime_type,
              }
            ).length > 0 && (
              <BuklodCommunityPhotoCollage
                items={communityPhotoCollageItems(
                  item.media_items,
                  {
                    media_path: item.media_path,
                    media_url: item.media_url,
                    media_mime_type: item.media_mime_type,
                  }
                )}
                width={
                  CommunityEdgeDimensionsR5.get('window').width
                }
                height={330}
                onPressPhoto={(index, photos) =>
                  setPhotoViewer({
                    uris: photos.map(photo =>
                      String(photo.media_url ?? '')
                    ),
                    paths: photos.map(photo =>
                      String(photo.media_path ?? '')
                    ),
                    index,
                  })
                }
              />
            )}

          {!!item.media_url &&
            isVideo && (
              <>
                <View
                  style={
                    styles.videoWrap
                  }
                >
                  <CommunityVideo
                    uri={
                      item.media_url
                    }
                    height={
                      470
                    }
                  />

                  <View
                    style={
                      styles.reelBadge
                    }
                  >
                    <MaterialCommunityIcons
                      name="movie-play-outline"
                      size={14}
                      color={
                        colors.white
                      }
                    />

                    <Text
                      style={
                        styles.reelBadgeText
                      }
                    >
                      {isScopedReelPost(
                        item
                      )
                        ? 'REEL'
                        : 'VIDEO'}
                      {item.media_duration_seconds
                        ? ` · ${Math.round(
                            Number(
                              item.media_duration_seconds
                            )
                          )}s`
                        : ''}
                    </Text>
                  </View>
                </View>
                {mode === 'wall' ? (
                  <BuklodVideoCompanionAd
                    contentId={String(item.id)}
                    expectedDurationSeconds={item.media_duration_seconds}
                  />
                ) : null}
              </>
            )}

          <View
            style={
              styles.summaryRow
            }
          >
            <Text
              style={
                styles.summaryText
              }
            >
              {total
                ? `${total} reaction${
                    total === 1
                      ? ''
                      : 's'
                  }`
                : 'Be first to react'}
            </Text>

            <BuklodPressable
              nested
              compact
              onPress={() =>
                void openComments(
                  item
                )
              }
            >
              <Text
                style={
                  styles.summaryText
                }
              >
                {Number(
                  item.comment_count ??
                    0
                )}{' '}
                comment
                {Number(
                  item.comment_count ??
                    0
                ) === 1
                  ? ''
                  : 's'}
              </Text>
            </BuklodPressable>
          </View>

          <BuklodCommunityPostEngagement
            reactionOptions={
              BUKLOD_SCOPE_COMMUNITY_REACTIONS
            }
            reactionCounts={
              item.reaction_counts
            }
            myReaction={
              item.my_reaction
            }
            commentCount={
              item.comment_count
            }
            commentPreview={
              item.comment_preview
                ? {
                    comment_id:
                      item.comment_preview.comment_id,
                    user_id:
                      item.comment_preview.user_id,
                    author_name:
                      item.comment_preview.author_name,
                    body:
                      item.comment_preview.body,
                    created_at:
                      item.comment_preview.created_at,
                  }
                : null
            }
            onReactionSummaryPress={key =>
              openReactionDetails(
                item,
                key
              )
            }
            onReact={key =>
              void react(
                item,
                key as Reaction
              )
            }
            onOpenComments={() =>
              void openComments(item)
            }
            onReport={
              user?.id &&
              item.user_id !== user.id
                ? () =>
                    openReport(
                      'post',
                      item.id
                    )
                : undefined
            }
          />

          {!!selected && (
            <Text
              style={
                styles.myReaction
              }
            >
              Your reaction:{' '}
              {selected.emoji}{' '}
              {selected.label}
            </Text>
          )}

          <BuklodPressable
            nested
            compact
            onPress={() =>
              void openComments(
                item
              )
            }
            style={
              styles.commentButton
            }
          >
            <MaterialCommunityIcons
              name="comment-outline"
              size={18}
              color={
                colors.greenDark
              }
            />

            <Text
              style={
                styles.commentButtonText
              }
            >
              Comment or Reply
            </Text>
          </BuklodPressable>
          <BuklodPostInternalShare
            postId={
              item.id
            }
          />
        </View>
      );
    };

  const Header =
    (
      <View>
        {/* BUKLOD_DZAS_SCOPED_WALL_SHORTCUT_R1 */}
        {mode === 'wall' ? (
          <View
            style={{
              alignItems: 'flex-end',
              marginBottom: 8,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open 702 DZAS Radio"
              onPress={() =>
                router.push(
                  '/personal-home/radio' as any
                )
              }
              style={({ pressed }) => ({
                minWidth: 68,
                height: 34,
                paddingHorizontal: 10,
                borderRadius: 11,
                borderWidth: 1,
                borderColor: colors.line,
                backgroundColor: colors.white,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                opacity: pressed ? 0.72 : 1,
              })}
            >
              <MaterialCommunityIcons
                name="radio"
                size={15}
                color={colors.greenDark}
              />
              <Text
                style={{
                  fontSize: 9,
                  fontWeight: '900',
                  color: colors.greenDark,
                }}
              >
                DZAS
              </Text>
            </Pressable>
          </View>
        ) : null}

        {mode === 'wall' ? (
          <BuklodFirstViewAd
            placement={
              scope.scope_type === 'CLUSTER'
                ? 'cluster'
                : scope.scope_type === 'ORGANIZATION'
                  ? 'org'
                  : 'content'
            }
            placementId={
              scope.scope_type === 'CLUSTER'
                ? 'cluster_wall_entry'
                : scope.scope_type === 'ORGANIZATION'
                  ? 'org_wall_entry'
                  : 'scope_wall_entry'
            }
          />
        ) : null}

        {/* PATCH_172F_HIDE_ORG_EXCLUSIVE_CARD */}
        {scope.scope_type !== 'ORGANIZATION' && (
          <View
                    style={[styles.scopeNotice, scope.scope_type === 'CLUSTER' && { display: 'none' }]}
                  >
                    <MaterialCommunityIcons
                      name="lock-outline"
                      size={19}
                      color={
                        colors.greenDark
                      }
                    />
          
                    <View
                      style={
                        styles.scopeNoticeCopy
                      }
                    >
                      <Text
                        style={
                          styles.scopeNoticeTitle
                        }
                      >
                        Exclusive{' '}
                        {scopeLabel(
                          scope
                        )}{' '}
                        Community
                      </Text>
          
                      <Text
                        style={
                          styles.scopeNoticeText
                        }
                      >
                        Posts, photos, reactions,
                        comments and replies stay
                        inside this exact community.
                        Nothing here is mixed with
                        Public or another scope.
                      </Text>
                    </View>
                  </View>
        )}
<View
          style={
            styles.modeRow
          }
        >

        </View>

        <View
          style={
            styles.composerCard
          }
        >
          <View
            style={
              styles.audienceLine
            }
          >
            <MaterialCommunityIcons
              name="lock"
              size={14}
              color={
                colors.greenDark
              }
            />

            <Text
              style={
                styles.audienceText
              }
              numberOfLines={
                1
              }
            >
              Visible to {exactAudience}
            </Text>
          </View>

          <TextInput
            value={
              body
            }
            onChangeText={
              setBody
            }
            placeholder={
              mode === 'reels'
                ? 'Add a Reel caption...'
                : 'Share something with this community...'
            }
            placeholderTextColor={
              colors.muted
            }
            multiline
            maxLength={
              5000
            }
            style={
              styles.composer
            }
          />

          {photos.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.preview}
              contentContainerStyle={{
                gap: 8,
                paddingRight: 8,
              }}
            >
              {photos.map((item, index) => (
                <View key={item.id ?? item.uri}>
                  <Image
                    source={{
                      uri: item.uri,
                    }}
                    style={
                      styles.previewImage
                    }
                  />
                  <Pressable
                    onPress={() =>
                      setPhotos(current =>
                        current.filter((_, i) => i !== index)
                      )
                    }
                    style={
                      styles.previewClose
                    }
                  >
                    <MaterialCommunityIcons
                      name="close"
                      size={18}
                      color={
                        colors.white
                      }
                    />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}

          {mode === 'wall' && communityGif && (
            <BuklodCommunityGifPreview
              file={communityGif}
              onRemove={() => setCommunityGif(null)}
            />
          )}

          {mode === 'reels' && (
            <View
              style={{
                minHeight: 44,
                marginBottom: 8,
                paddingHorizontal: 11,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderRadius: 13,
                borderWidth: 1,
                borderColor: colors.line,
                backgroundColor: colors.background,
              }}
            >
              <View
                style={{
                  flex: 1,
                  paddingRight: 10,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '900',
                    color: colors.greenDark,
                  }}
                >
                  AUTO PLAY PREVIEW
                </Text>

                <Text
                  style={{
                    marginTop: 1,
                    fontSize: 8,
                    color: colors.muted,
                  }}
                >
                  Play selected Reel automatically before publishing.
                </Text>
              </View>

              <Pressable
                onPress={() =>
                  setAutoPlayPreview(
                    current =>
                      !current
                  )
                }
                accessibilityRole="button"
                accessibilityLabel="Toggle auto play Reel preview"
                style={{
                  minWidth: 58,
                  minHeight: 30,
                  paddingHorizontal: 10,
                  borderRadius: 99,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor:
                    autoPlayPreview
                      ? colors.greenDark
                      : colors.line,
                }}
              >
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: '900',
                    color:
                      autoPlayPreview
                        ? colors.white
                        : colors.muted,
                  }}
                >
                  {autoPlayPreview
                    ? 'ON'
                    : 'OFF'}
                </Text>
              </Pressable>
            </View>
          )}
          {mode === 'reels' && !!reel && (
            <View
              style={{
                marginBottom: 10,
              }}
            >
              {/*
               * PATCH_173F_R6_REEL_PREVIEW_BEFORE_PUBLISH
               * Preview the actual local video immediately after
               * Choose Video / Record, before any upload occurs.
               */}
              <View
                style={{
                  position: 'relative',
                }}
              >
                <CommunityVideo
                  uri={
                    reel.uri
                  }
                  height={320}
                  autoPlay={autoPlayPreview}
                />

                <Pressable
                  onPress={
                    clearMedia
                  }
                  hitSlop={BUKLOD_HIT_SLOP}
                  accessibilityRole="button"
                  accessibilityLabel="Remove selected Reel"
                  style={{
                    position: 'absolute',
                    top: 20,
                    right: 8,
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor:
                      'rgba(0,0,0,0.68)',
                  }}
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={20}
                    color={
                      colors.white
                    }
                  />
                </Pressable>
              </View>

              <View
                style={[
                  styles.reelDraft,
                  {
                    marginTop: 8,
                    marginBottom: 0,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="movie-play-outline"
                  size={24}
                  color={
                    colors.greenDark
                  }
                />

                <View
                  style={
                    styles.reelDraftCopy
                  }
                >
                  <Text
                    style={
                      styles.reelDraftTitle
                    }
                  >
                    Reel ready to publish
                  </Text>

                  <Text
                    style={
                      styles.reelDraftText
                    }
                  >
                    {
                      reel.durationSeconds
                    }
                    s ·{' '}
                    {reel.sizeBytes
                      ? formatVideoBytes(
                          reel.sizeBytes
                        )
                      : 'size unavailable'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {mode === 'wall' && !!wallVideo && (
            <View
              style={{
                marginBottom: 10,
              }}
            >
              <View
                style={{
                  position: 'relative',
                }}
              >
                <CommunityVideo
                  uri={
                    wallVideo.uri
                  }
                  height={320}
                />

                <Pressable
                  onPress={
                    clearMedia
                  }
                  hitSlop={BUKLOD_HIT_SLOP}
                  accessibilityRole="button"
                  accessibilityLabel="Remove selected video"
                  style={{
                    position: 'absolute',
                    top: 20,
                    right: 8,
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor:
                      'rgba(0,0,0,0.68)',
                  }}
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={20}
                    color={
                      colors.white
                    }
                  />
                </Pressable>
              </View>

              <View
                style={[
                  styles.reelDraft,
                  {
                    marginTop: 8,
                    marginBottom: 0,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="video-outline"
                  size={24}
                  color={
                    colors.greenDark
                  }
                />

                <View
                  style={
                    styles.reelDraftCopy
                  }
                >
                  <Text
                    style={
                      styles.reelDraftTitle
                    }
                  >
                    Video ready to publish
                  </Text>

                  <Text
                    style={
                      styles.reelDraftText
                    }
                  >
                    {
                      wallVideo.durationSeconds
                    }
                    s ·{' '}
                    {wallVideo.sizeBytes
                      ? formatVideoBytes(
                          wallVideo.sizeBytes
                        )
                      : 'size unavailable'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          <View
            style={
              styles.composerActions
            }
          >
            {mode === 'wall' ? (
              <>
                <Pressable
                  disabled={busy || wallVideoBusy}
                  onPress={() => void pickWallVideo()}
                  style={styles.mediaButton}
                >
                  <MaterialCommunityIcons
                    name="video-plus-outline"
                    size={19}
                    color={colors.greenDark}
                  />
                  <Text style={styles.mediaButtonText}>
                    {wallVideoBusy
                      ? 'Preparing...'
                      : wallVideo
                        ? 'Change Video'
                        : 'Add Video'}
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  disabled={
                    busy
                  }
                  onPress={() =>
                    void chooseReel()
                  }
                  style={
                    styles.mediaButton
                  }
                >
                  <MaterialCommunityIcons
                    name="movie-open-outline"
                    size={19}
                    color={
                      colors.greenDark
                    }
                  />
                  <Text
                    style={
                      styles.mediaButtonText
                    }
                  >
                    Choose Video
                  </Text>
                </Pressable>

                <Pressable
                  disabled={
                    busy
                  }
                  onPress={() =>
                    void recordReel()
                  }
                  style={
                    styles.mediaButton
                  }
                >
                  <MaterialCommunityIcons
                    name="camera-outline"
                    size={19}
                    color={
                      colors.greenDark
                    }
                  />
                  <Text
                    style={
                      styles.mediaButtonText
                    }
                  >
                    Record
                  </Text>
                </Pressable>
              </>
            )}
          </View>

          <BuklodCommunityGifPicker
            visible={communityGifPickerOpen}
            onClose={() => setCommunityGifPickerOpen(false)}
            onPick={file => {
              clearMedia();
              setCommunityGif(file);
              setCommunityGifPickerOpen(false);
            }}
          />

          <Pressable
            disabled={
              busy ||
              (
                mode === 'reels'
                  ? !reel
                  : (
                      !body.trim() &&
                      !photo &&
                      !wallVideo &&
                      !communityGif
                    )
              )
            }
            onPress={() =>
              void publish()
            }
            style={[
              styles.publish,
              (
                busy ||
                (
                  mode === 'reels'
                  ? !reel
                  : (
                      !body.trim() &&
                      !photo &&
                      !wallVideo &&
                      !communityGif
                    )
                )
              ) &&
                styles.publishDisabled,
            ]}
          >
            {publishNotice ? (
              <Text
                style={
                  styles.publishText
                }
              >
                {publishNotice}
              </Text>
            ) : busy ? (
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
                  color={
                    colors.white
                  }
                />
              )
            ) : (
              <>
                <MaterialCommunityIcons
                  name={
                    mode === 'reels'
                      ? 'movie-play'
                      : 'send'
                  }
                  size={18}
                  color={
                    colors.white
                  }
                />

                <Text
                  style={
                    styles.publishText
                  }
                >
                  {mode === 'reels'
                    ? 'PUBLISH REEL'
                    : 'POST TO THIS COMMUNITY'}
                </Text>
              </>
            )}
          </Pressable>
        </View>

        <View
          style={[
              styles.feedHeading,
              mode === 'reels' && { display: 'none' },
            ]}
        >
          <Text
            style={
              styles.feedTitle
            }
          >
            {mode ===
              'reels'
              ? `${scope.name} Reels`
              : `${scope.name} Wall`}
          </Text>

          <Text
            style={
              styles.feedCount
            }
          >
            {
              visiblePosts.length
            }
          </Text>
        </View>
      </View>
    );

  return (
    <>
      <FlatList
        data={
          listData
        }
        keyExtractor={
          item =>
            item.id
        }
        extraData={
          communityAdExtraData
        }
        onViewableItemsChanged={
          onCommunityAdViewableItemsChanged
        }
        viewabilityConfig={
          communityAdViewabilityConfig
        }
        renderItem={
          ({ item }) => {
            if (
              isCommunityFeedInlineAdRow(
                item,
              )
            ) {
              return (
                <BuklodCommunityInlineAd
                  slotId={item.id}
                  active={isAdActive(item.id)}
                />
              );
            }

            return renderPost({
              item:
                item as SocialPost,
            });
          }
        }
        initialNumToRender={
          FLATLIST_TUNING.scopedCommunity.initialNumToRender
        }
        maxToRenderPerBatch={
          FLATLIST_TUNING.scopedCommunity.maxToRenderPerBatch
        }
        updateCellsBatchingPeriod={
          FLATLIST_TUNING.scopedCommunity.updateCellsBatchingPeriod
        }
        windowSize={
          FLATLIST_TUNING.scopedCommunity.windowSize
        }
        removeClippedSubviews={
          Platform.OS === 'android'
        }
        ListHeaderComponent={
          Header
        }
        ListEmptyComponent={
          loading ? (
            <View
              style={
                styles.empty
              }
            >
              <ActivityIndicator
                color={
                  colors.greenDark
                }
              />

              <Text
                style={
                  styles.emptyText
                }
              >
                Loading community...
              </Text>
            </View>
          ) : (
            <View
              style={
                styles.empty
              }
            >
              <MaterialCommunityIcons
                name={
                  mode ===
                    'reels'
                    ? 'movie-open-outline'
                    : 'post-outline'
                }
                size={38}
                color={
                  colors.muted
                }
              />

              <Text
                style={
                  styles.emptyTitle
                }
              >
                {mode ===
                  'reels'
                  ? 'No Reels yet'
                  : 'No posts yet'}
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                Be the first member to
                share inside this exact
                community.
              </Text>
            </View>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={
              loading
            }
            onRefresh={
              load
            }
          />
        }
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom:
              scrollBottomInset,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      />

      <Modal
        visible={
          commentOpen
        }
        animationType="slide"
        transparent
        onRequestClose={() =>
          setCommentOpen(
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
            style={
              styles.commentSheet
            }
          >
            <View
              style={
                styles.commentSheetHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.commentSheetTitle
                  }
                >
                  Comments
                </Text>

                <Text
                  style={
                    styles.commentSheetSub
                  }
                >
                  🔒 {scope.name} only
                </Text>
              </View>

              <Pressable
                onPress={() =>
                  setCommentOpen(
                    false
                  )
                }
                hitSlop={BUKLOD_HIT_SLOP}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={25}
                  color={
                    colors.text
                  }
                />
              </Pressable>
            </View>

            <ScrollView
              style={
                styles.commentsScroll
              }
              contentContainerStyle={
                styles.commentsContent
              }
              keyboardShouldPersistTaps="handled"
            >
              {!comments
                .length && (
                <View
                  style={
                    styles.emptyComments
                  }
                >
                  <Text
                    style={
                      styles.emptyText
                    }
                  >
                    No comments yet.
                  </Text>
                </View>
              )}

              {roots.map(
                root => (
                  <View
                    key={
                      root.id
                    }
                    style={
                      styles.commentThread
                    }
                  >
                    {renderScopeCommentBubble(
                      root
                    )}

                    {repliesFor(
                      root.id
                    ).map(
                      reply => (
                        <View
                          key={
                            reply.id
                          }
                          style={
                            styles.replyWrap
                          }
                        >
                          <View
                            style={
                              styles.replyLine
                            }
                          />

                          {renderScopeCommentBubble(
                            reply,
                            {
                              isReply: true,
                              onReply: () => {
                                setReplyTo(
                                  root
                                );

                                setCommentText(
                                  `@${resolvePersonDisplayName(
                                    reply.commenter_name,
                                    reply.user_id,
                                  )} `
                                );
                              },
                            }
                          )}
                        </View>
                      )
                    )}
                  </View>
                )
              )}
            </ScrollView>

            {!!replyTo && (
              <View
                style={
                  styles.replyingTo
                }
              >
                <BuklodMentionText
                  text={`@${resolvePersonDisplayName(
                    replyTo.commenter_name,
                    replyTo.user_id,
                  )}`}
                  style={
                    styles.replyingText
                  }
                  mentionStyle={
                    styles.replyingText
                  }
                />

                <Pressable
                  onPress={() =>
                    setReplyTo(
                      null
                    )
                  }
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={17}
                    color={
                      colors.muted
                    }
                  />
                </Pressable>
              </View>
            )}

            <View
              style={[
                styles.commentComposer,
                {
                  paddingBottom:
                    drawerBottomInset,
                },
              ]}
            >
              <TextInput
                value={
                  commentText
                }
                onChangeText={
                  setCommentText
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
                  !commentText
                    .trim()
                }
                onPress={() =>
                  void addComment()
                }
                style={[
                  styles.commentSend,
                  (
                    commentBusy ||
                    !commentText
                      .trim()
                  ) &&
                    styles.commentSendDisabled,
                ]}
              >
                {commentBusy ? (
                  <ActivityIndicator
                    size="small"
                    color={
                      colors.white
                    }
                  />
                ) : (
                  <MaterialCommunityIcons
                    name="send"
                    size={18}
                    color={
                      colors.white
                    }
                  />
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    
      {/* PATCH_186B_PHOTO_EDITOR_SCOPE_MODAL */}
      {/* PATCH_186B_R3_MAIN_ROOT_INSERTION */}
      <BuklodPhotoEditor
        visible={!!scopePhotoEditorUri}
        sourceUri={scopePhotoEditorUri}
        onCancel={() =>
          setScopePhotoEditorUri(null)
        }
        onDone={edited => {
          if (
            edited.sizeBytes >
            10 * 1024 * 1024
          ) {
            Alert.alert(
              'Photo Too Large',
              'Please use a smaller edited photo.'
            );

            return;
          }

          setPhotos(current =>
            [
              ...current,
              {
                uri: edited.uri,
                base64: edited.base64,
                sizeBytes: edited.sizeBytes,
              },
            ].slice(0, COMMUNITY_MAX_PHOTOS)
          );

          setReel(null);
          setWallVideo(null);
          setScopePhotoEditorUri(null);
        }}
      />

      <ConnectPhotoViewer
        visible={!!photoViewer}
        uris={photoViewer?.uris ?? []}
        mediaPaths={photoViewer?.paths}
        initialIndex={photoViewer?.index ?? 0}
        onClose={() => setPhotoViewer(null)}
      />

      <BuklodCommunityReactionDetailsSheet
        visible={!!reactionDetailsPost}
        target={reactionDetailsPost}
        initialFilter={reactionDetailsFilter}
        onClose={() => {
          setReactionDetailsPost(null);
          setReactionDetailsFilter(null);
        }}
      />
      {reportSheet}
</>
  );
}


const styles =
  StyleSheet.create(
    {
      content: {
        padding:
          12,
        paddingBottom:
          120,
        gap:
          10,
      },

      scopeNotice: {
        flexDirection:
          'row',
        alignItems:
          'flex-start',
        gap:
          10,
        padding:
          12,
        borderRadius:
          16,
        borderWidth:
          1,
        borderColor:
          colors.line,
        backgroundColor:
          colors.greenSoft,
        marginBottom:
          10,
      },

      scopeNoticeCopy: {
        flex:
          1,
      },

      scopeNoticeTitle: {
        color:
          colors.greenDark,
        fontSize:
          13,
        fontWeight:
          '900',
      },

      scopeNoticeText: {
        color:
          colors.muted,
        marginTop:
          3,
        fontSize:
          10,
        lineHeight:
          15,
        fontWeight:
          '700',
      },

      modeRow: {
        flexDirection:
          'row',
        gap:
          8,
        marginBottom:
          10,
      },

      modeButton: {
        flex:
          1,
        minHeight:
          44,
        borderRadius:
          13,
        borderWidth:
          1,
        borderColor:
          colors.line,
        backgroundColor:
          colors.white,
        flexDirection:
          'row',
        alignItems:
          'center',
        justifyContent:
          'center',
        gap:
          7,
      },

      modeButtonOn: {
        backgroundColor:
          colors.greenDark,
        borderColor:
          colors.greenDark,
      },

      modeText: {
        color:
          colors.greenDark,
        fontSize:
          11,
        fontWeight:
          '900',
      },

      modeTextOn: {
        color:
          colors.white,
      },

      composerCard: {
        borderRadius:
          17,
        backgroundColor:
          colors.white,
        borderWidth:
          1,
        borderColor:
          colors.line,
        padding:
          12,
        marginBottom:
          12,
      },

      audienceLine: {
        flexDirection:
          'row',
        alignItems:
          'center',
        gap:
          5,
        paddingBottom:
          9,
        borderBottomWidth:
          1,
        borderBottomColor:
          colors.line,
      },

      audienceText: {
        flex:
          1,
        color:
          colors.greenDark,
        fontSize:
          9.5,
        fontWeight:
          '900',
      },

      composer: {
        minHeight:
          76,
        maxHeight:
          180,
        color:
          colors.text,
        fontSize:
          14,
        lineHeight:
          20,
        textAlignVertical:
          'top',
        paddingTop:
          12,
        paddingBottom:
          10,
      },

      preview: {
        position:
          'relative',
        borderRadius:
          14,
        overflow:
          'hidden',
        backgroundColor:
          '#111',
        marginBottom:
          10,
      },

      previewImage: {
        width:
          '100%',
        height:
          260,
      },

      previewClose: {
        position:
          'absolute',
        top:
          9,
        right:
          9,
        width:
          32,
        height:
          32,
        borderRadius:
          16,
        backgroundColor:
          'rgba(0,0,0,0.68)',
        alignItems:
          'center',
        justifyContent:
          'center',
      },

      reelDraft: {
        flexDirection:
          'row',
        alignItems:
          'center',
        gap:
          10,
        borderRadius:
          13,
        borderWidth:
          1,
        borderColor:
          colors.line,
        backgroundColor:
          colors.greenSoft,
        padding:
          11,
        marginBottom:
          10,
      },

      reelDraftCopy: {
        flex:
          1,
      },

      reelDraftTitle: {
        color:
          colors.greenDark,
        fontWeight:
          '900',
        fontSize:
          12,
      },

      reelDraftText: {
        color:
          colors.muted,
        marginTop:
          2,
        fontWeight:
          '700',
        fontSize:
          9.5,
      },

      composerActions: {
        flexDirection:
          'row',
        flexWrap:
          'wrap',
        gap:
          7,
        marginBottom:
          10,
      },

      mediaButton: {
        flexGrow:
          1,
        minWidth:
          92,
        minHeight:
          40,
        paddingHorizontal:
          10,
        borderRadius:
          12,
        borderWidth:
          1,
        borderColor:
          colors.line,
        backgroundColor:
          colors.background,
        flexDirection:
          'row',
        alignItems:
          'center',
        justifyContent:
          'center',
        gap:
          6,
      },

      mediaButtonText: {
        color:
          colors.greenDark,
        fontSize:
          10,
        fontWeight:
          '900',
      },

      publish: {
        minHeight:
          46,
        borderRadius:
          13,
        backgroundColor:
          colors.greenDark,
        flexDirection:
          'row',
        alignItems:
          'center',
        justifyContent:
          'center',
        gap:
          8,
      },

      publishDisabled: {
        opacity:
          0.42,
      },

      publishText: {
        color:
          colors.white,
        fontSize:
          10.5,
        fontWeight:
          '900',
        letterSpacing:
          0.35,
      },

      feedHeading: {
        flexDirection:
          'row',
        alignItems:
          'center',
        marginBottom:
          8,
      },

      feedTitle: {
        flex:
          1,
        color:
          colors.text,
        fontSize:
          15,
        fontWeight:
          '900',
      },

      feedCount: {
        minWidth:
          28,
        textAlign:
          'center',
        paddingVertical:
          4,
        paddingHorizontal:
          7,
        borderRadius:
          99,
        overflow:
          'hidden',
        color:
          colors.greenDark,
        backgroundColor:
          colors.greenSoft,
        fontSize:
          10,
        fontWeight:
          '900',
      },

      postCard: {
        borderRadius:
          17,
        backgroundColor:
          colors.white,
        borderWidth:
          1,
        borderColor:
          colors.line,
        padding:
          12,
        marginBottom:
          10,
      },

      postHeader: {
        flexDirection:
          'row',
        alignItems:
          'center',
        gap:
          9,
      },

      avatar: {
        width:
          39,
        height:
          39,
        borderRadius:
          20,
        backgroundColor:
          colors.greenDark,
        alignItems:
          'center',
        justifyContent:
          'center',
      },

      postIdentity: {
        flex:
          1,
      },

      author: {
        color:
          colors.text,
        fontSize:
          12.5,
        fontWeight:
          '900',
      },

      meta: {
        marginTop:
          2,
        color:
          colors.muted,
        fontSize:
          8.5,
        fontWeight:
          '700',
      },

      deleteButton: {
        width:
          34,
        height:
          34,
        borderRadius:
          17,
        alignItems:
          'center',
        justifyContent:
          'center',
      },

      body: {
        marginTop:
          11,
        color:
          colors.text,
        fontSize:
          14,
        lineHeight:
          21,
        fontWeight:
          '500',
      },

      photo: {
        /* PATCH_COMMUNITY_TRUE_EDGE_R5 */
        width:
          CommunityEdgeDimensionsR5
            .get('window')
            .width,

        alignSelf:
          'center',

        borderRadius:
          0,

        
        height:
          330,
        
        marginTop:
          12,
        backgroundColor:
          colors.background,
      },

      videoWrap: {
        position:
          'relative',
        marginTop:
          2,
      },

      reelBadge: {
        position:
          'absolute',
        top:
          23,
        left:
          10,
        flexDirection:
          'row',
        alignItems:
          'center',
        gap:
          5,
        paddingVertical:
          6,
        paddingHorizontal:
          9,
        borderRadius:
          99,
        backgroundColor:
          'rgba(0,0,0,0.68)',
      },

      reelBadgeText: {
        color:
          colors.white,
        fontSize:
          9,
        fontWeight:
          '900',
      },

      summaryRow: {
        flexDirection:
          'row',
        justifyContent:
          'space-between',
        alignItems:
          'center',
        minHeight:
          34,
        marginTop:
          6,
        borderBottomWidth:
          1,
        borderBottomColor:
          colors.line,
      },

      summaryText: {
        color:
          colors.muted,
        fontSize:
          9,
        fontWeight:
          '800',
      },

      actionRow: {
        flexDirection:
          'row',
        gap:
          5,
        paddingTop:
          8,
      },

      reactionButton: {
        flex:
          1,
        minHeight:
          39,
        borderRadius:
          11,
        borderWidth:
          1,
        borderColor:
          colors.line,
        backgroundColor:
          colors.background,
        alignItems:
          'center',
        justifyContent:
          'center',
        paddingHorizontal:
          2,
      },

      reactionButtonOn: {
        borderColor:
          colors.greenDark,
        backgroundColor:
          colors.greenSoft,
      },

      reactionEmoji: {
        fontSize:
          17,
      },

      reactionLabel: {
        color:
          colors.muted,
        fontSize:
          7.5,
        fontWeight:
          '900',
        marginTop:
          1,
      },

      reactionLabelOn: {
        color:
          colors.greenDark,
      },

      myReaction: {
        color:
          colors.greenDark,
        marginTop:
          7,
        textAlign:
          'center',
        fontSize:
          8.5,
        fontWeight:
          '900',
      },

      commentButton: {
        minHeight:
          42,
        marginTop:
          8,
        borderRadius:
          11,
        backgroundColor:
          colors.greenSoft,
        flexDirection:
          'row',
        alignItems:
          'center',
        justifyContent:
          'center',
        gap:
          7,
      },

      commentButtonText: {
        color:
          colors.greenDark,
        fontSize:
          9.5,
        fontWeight:
          '900',
      },

      empty: {
        paddingVertical:
          42,
        alignItems:
          'center',
        justifyContent:
          'center',
        gap:
          7,
      },

      emptyTitle: {
        color:
          colors.text,
        fontSize:
          14,
        fontWeight:
          '900',
      },

      emptyText: {
        maxWidth:
          280,
        color:
          colors.muted,
        textAlign:
          'center',
        fontSize:
          10,
        lineHeight:
          15,
        fontWeight:
          '700',
      },

      modalBackdrop: {
        flex:
          1,
        justifyContent:
          'flex-end',
        backgroundColor:
          'rgba(0,0,0,0.45)',
      },

      commentSheet: {
        height:
          '84%',
        borderTopLeftRadius:
          22,
        borderTopRightRadius:
          22,
        backgroundColor:
          colors.white,
        overflow:
          'hidden',
      },

      commentSheetHeader: {
        minHeight:
          65,
        paddingHorizontal:
          15,
        borderBottomWidth:
          1,
        borderBottomColor:
          colors.line,
        flexDirection:
          'row',
        alignItems:
          'center',
        justifyContent:
          'space-between',
      },

      commentSheetTitle: {
        color:
          colors.text,
        fontSize:
          15,
        fontWeight:
          '900',
      },

      commentSheetSub: {
        color:
          colors.greenDark,
        marginTop:
          2,
        fontSize:
          8.5,
        fontWeight:
          '800',
      },

      commentsScroll: {
        flex:
          1,
      },

      commentsContent: {
        padding:
          12,
        paddingBottom:
          24,
      },

      emptyComments: {
        paddingVertical:
          35,
        alignItems:
          'center',
      },

      commentThread: {
        marginBottom:
          10,
      },

      commentBubble: {
        borderRadius:
          14,
        backgroundColor:
          colors.background,
        padding:
          10,
      },

      replyWrap: {
        flexDirection:
          'row',
        marginLeft:
          22,
        marginTop:
          7,
      },

      replyLine: {
        width:
          2,
        marginRight:
          8,
        borderRadius:
          2,
        backgroundColor:
          colors.line,
      },

      replyBubble: {
        flex:
          1,
      },

      commentTop: {
        flexDirection:
          'row',
        alignItems:
          'center',
        justifyContent:
          'space-between',
        gap:
          8,
      },

      commentAuthor: {
        flex:
          1,
        color:
          colors.text,
        fontSize:
          10.5,
        fontWeight:
          '900',
      },

      commentBody: {
        marginTop:
          5,
        color:
          colors.text,
        fontSize:
          11.5,
        lineHeight:
          17,
      },

      commentFooter: {
        flexDirection:
          'row',
        alignItems:
          'center',
        gap:
          12,
        marginTop:
          6,
      },

      commentTime: {
        color:
          colors.muted,
        fontSize:
          7.5,
        fontWeight:
          '700',
      },

      replyLink: {
        color:
          colors.greenDark,
        fontSize:
          8.5,
        fontWeight:
          '900',
      },

      replyingTo: {
        minHeight:
          35,
        paddingHorizontal:
          12,
        borderTopWidth:
          1,
        borderTopColor:
          colors.line,
        backgroundColor:
          colors.greenSoft,
        flexDirection:
          'row',
        alignItems:
          'center',
        gap:
          8,
      },

      replyingText: {
        flex:
          1,
        color:
          colors.greenDark,
        fontSize:
          9,
        fontWeight:
          '900',
      },

      commentComposer: {
        padding:
          10,
        paddingBottom:
          14,
        borderTopWidth:
          1,
        borderTopColor:
          colors.line,
        backgroundColor:
          colors.white,
        flexDirection:
          'row',
        alignItems:
          'flex-end',
        gap:
          8,
      },

      commentInput: {
        flex:
          1,
        minHeight:
          42,
        maxHeight:
          110,
        borderRadius:
          13,
        borderWidth:
          1,
        borderColor:
          colors.line,
        backgroundColor:
          colors.background,
        color:
          colors.text,
        paddingHorizontal:
          11,
        paddingVertical:
          9,
        fontSize:
          11.5,
        textAlignVertical:
          'top',
      },

      commentSend: {
        width:
          43,
        height:
          43,
        borderRadius:
          22,
        backgroundColor:
          colors.greenDark,
        alignItems:
          'center',
        justifyContent:
          'center',
      },

            publicReelsHeading: {
        marginBottom: 12,
        paddingHorizontal: 2,
      },

      publicReelsEyebrow: {
        fontSize: 9,
        lineHeight: 12,
        fontWeight: '900',
        letterSpacing: 0.8,
        color: colors.greenDark,
      },

      publicReelsTitle: {
        marginTop: 2,
        fontSize: 24,
        lineHeight: 29,
        fontWeight: '900',
        color: colors.text,
      },

      publicReelsSubtitle: {
        marginTop: 2,
        fontSize: 10,
        lineHeight: 14,
        color: colors.muted,
      },

      publicReelsPrivacy: {
        marginTop: 5,
        fontSize: 8.5,
        lineHeight: 12,
        fontWeight: '800',
        color: colors.greenDark,
      },

      publicReelCard: {
        overflow: 'hidden',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.white,
        marginBottom: 12,
      },

      publicReelHeader: {
        minHeight: 60,
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
      },

      publicReelAuthor: {
        fontSize: 12.5,
        lineHeight: 16,
        fontWeight: '900',
        color: colors.text,
      },

      publicReelMeta: {
        marginTop: 2,
        fontSize: 8.5,
        lineHeight: 11,
        fontWeight: '700',
        color: colors.muted,
      },

      publicReelDuration: {
        minHeight: 28,
        paddingHorizontal: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderRadius: 99,
        backgroundColor: colors.greenSoft,
      },

      publicReelDurationText: {
        fontSize: 8.5,
        fontWeight: '900',
        color: colors.greenDark,
      },

      publicReelVideoFrame: {
        width: '100%',
        aspectRatio: 9 / 14,
        overflow: 'hidden',
        backgroundColor: '#111111',
      },

      publicReelVideo: {
        width: '100%',
        height: '100%',
      },

      publicReelUnavailable: {
        width: '100%',
        minHeight: 320,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        backgroundColor: '#111111',
      },

      publicReelUnavailableText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#FFFFFF',
      },

      publicReelCaption: {
        paddingHorizontal: 12,
        paddingTop: 11,
        fontSize: 13,
        lineHeight: 19,
        fontWeight: '600',
        color: colors.text,
      },

      publicReelStats: {
        minHeight: 39,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.line,
      },

      publicReelStat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
      },

      publicReelStatText: {
        fontSize: 8.5,
        lineHeight: 11,
        fontWeight: '800',
        color: colors.muted,
      },

      publicReelReactionRow: {
        paddingHorizontal: 8,
        paddingTop: 9,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 5,
      },

      publicReelReaction: {
        minHeight: 34,
        paddingHorizontal: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        borderRadius: 99,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: '#FFFFFF',
      },

      publicReelReactionOn: {
        borderColor: colors.greenDark,
        backgroundColor: colors.greenSoft,
      },

      publicReelReactionEmoji: {
        fontSize: 15,
      },

      publicReelReactionText: {
        fontSize: 7.8,
        fontWeight: '900',
        color: colors.muted,
      },

      publicReelReactionTextOn: {
        color: colors.greenDark,
      },

      publicReelMyReaction: {
        paddingHorizontal: 12,
        paddingTop: 6,
        fontSize: 8,
        fontWeight: '800',
        color: colors.greenDark,
      },

      publicReelBottomActions: {
        padding: 9,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
      },

      publicReelCommentButton: {
        flex: 1,
        minHeight: 38,
        paddingHorizontal: 9,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: 13,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: '#FFFFFF',
      },

      publicReelCommentText: {
        fontSize: 9,
        fontWeight: '900',
        color: colors.greenDark,
      },
commentSendDisabled: {
        opacity:
          0.4,
      },
    }
  );