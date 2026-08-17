import { repairMojibakeText } from '@/lib/repairMojibakeText';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
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

import * as ImageManipulator
  from 'expo-image-manipulator';

import * as FileSystem
  from 'expo-file-system/legacy';

import {
  decode,
} from 'base64-arraybuffer';

import {
  supabase,
} from '@/lib/supabase';

import {
  colors,
} from '@/lib/theme';

import {
  useAuth,
} from '@/providers/AuthProvider';

import {
  CommunityVideo,
} from '@/components/CommunityVideo';

import type {
  BuklodScope,
} from '@/lib/buklodScope';



import BuklodPostInternalShare
  from '@/components/BuklodPostInternalShare';

import {
  VideoView,
  useVideoPlayer,
} from 'expo-video';

import {
  uploadCommunityVideoFile,
} from '@/lib/uploadCommunityVideoFile';
import { BuklodPhotoEditor } from '@/components/BuklodPhotoEditor';
/* PATCH_186B_PHOTO_EDITOR_IMPORT */
type Props = {
  scope: BuklodScope;
};

type Reaction =
  | 'love'
  | 'amen'
  | 'haha'
  | 'praying';

type ViewMode =
  | 'wall'
  | 'reels';

type SelectedPhoto = {
  uri: string;
  base64: string;
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
  reaction_counts: Record<string, number> | null;
  my_reaction: string | null;
  comment_count: number;
  is_owner: boolean;
  can_manage: boolean;
  media_url?: string | null;
};

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
};

const RX: Array<{
  key: Reaction;
  emoji: string;
  label: string;
}> = [
  {
    key: 'love',
    emoji: '❤️',
    label: 'Love',
  },
  {
    key: 'amen',
    emoji: '🙏',
    label: 'Amen',
  },
  {
    key: 'haha',
    emoji: '😂',
    label: 'Haha',
  },
  {
    key: 'praying',
    emoji: '🙌',
    label: 'Praying',
  },
];

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
    body,
    setBody,
  ] =
    useState('');

  const [
    photo,
    setPhoto,
  ] =
    useState<SelectedPhoto | null>(
      null
    );

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

  const exactAudience =
    `${scope.name} members only`;

  const load =
    useCallback(
      async () => {
        setLoading(true);

        try {
          const {
            data,
            error,
          } =
            await (
              supabase as any
            ).rpc(
              'buklod_scope_social_feed_v1',
              {
                p_scope_id:
                  scope.scope_id,
                p_limit:
                  120,
              }
            );

          if (
            error
          ) {
            throw error;
          }

          const rows =
            (
              data ??
              []
            ) as SocialPost[];

          const signed =
            await Promise.all(
              rows.map(
                async (
                  row
                ) => {
                  if (
                    !row.media_path
                  ) {
                    return {
                      ...row,
                      media_url:
                        null,
                    };
                  }

                  const {
                    data:
                      signedData,
                    error:
                      signedError,
                  } =
                    await supabase
                      .storage
                      .from(
                        'community-media'
                      )
                      .createSignedUrl(
                        row.media_path,
                        3600
                      );

                  if (
                    signedError
                  ) {
                    return {
                      ...row,
                      media_url:
                        null,
                    };
                  }

                  return {
                    ...row,
                    media_url:
                      signedData
                        ?.signedUrl ??
                      null,
                  };
                }
              )
            );

          setPosts(
            signed
          );
        }
        catch (
          error: any
        ) {
          setPosts(
            []
          );

          Alert.alert(
            'Community',
            error?.message ??
              'Could not load this community.'
          );
        }
        finally {
          setLoading(
            false
          );
        }
      },
      [
        scope.scope_id,
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

  useEffect(
    () => {
      const channel =
        supabase
          .channel(
            `exclusive-scope-community:${scope.scope_id}:${Date.now()}:${Math.random().toString(36).slice(2)}`
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
            () => {
              void load();
            }
          )
          .subscribe();

      return () => {
        void supabase
          .removeChannel(
            channel
          );
      };
    },
    [
      load,
      scope.scope_id,
    ]
  );

  /* PATCH_186O_EXACT_SCOPE_WALL_VIDEO */
  const wallPosts =
    posts;

  const reelPosts =
    useMemo(
      () =>
        posts.filter(
          post =>
            String(
              post
                .media_mime_type ??
                ''
            )
              .toLowerCase()
              .startsWith(
                'video/'
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
  /* PATCH_186B_PHOTO_EDITOR_SCOPE_FLOW */
  const choosePhoto =
    async () => {
      if (busy) {
        return;
      }

      try {
        const permission =
          await ImagePicker
            .requestMediaLibraryPermissionsAsync();

        if (
          !permission.granted
        ) {
          Alert.alert(
            'Photo Permission',
            'Please allow BUKLOD to access your photos.'
          );

          return;
        }

        const result =
          await ImagePicker
            .launchImageLibraryAsync({
              mediaTypes: [
                'images',
              ],
              allowsEditing:
                false,
              allowsMultipleSelection:
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

        setScopePhotoEditorUri(
          result.assets[0].uri
        );
      }
      catch (e: any) {
        Alert.alert(
          'Photo',
          e?.message ||
            'Could not select this photo.'
        );
      }
    };

  const acceptVideo =
    async (
      asset: any
    ) => {
      const durationMs =
        Number(
          asset?.duration ??
          0
        );

      const durationSeconds =
        Math.ceil(
          durationMs /
            1000
        );

      if (
        !durationSeconds ||
        durationSeconds <
          1
      ) {
        Alert.alert(
          'Reel',
          'Could not read this video duration.'
        );

        return;
      }

      if (
        durationSeconds >
        60
      ) {
        Alert.alert(
          'Reel Too Long',
          `This video is ${durationSeconds} seconds. Scope Reels may be up to 60 seconds only.`
        );

        return;
      }

      let sizeBytes =
        Number(
          asset?.fileSize ??
          0
        );

      if (
        !sizeBytes
      ) {
        try {
          const info =
            await FileSystem
              .getInfoAsync(
                asset.uri,
                {
                  size:
                    true,
                } as any
              );

          sizeBytes =
            Number(
              (info as any)
                ?.size ??
              0
            );
        }
        catch {
          sizeBytes =
            0;
        }
      }

      if (
        sizeBytes >
        50 *
          1024 *
          1024
      ) {
        Alert.alert(
          'Reel Too Large',
          'BUKLOD Reels must be 50 MB or smaller.'
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

      setPhoto(
        null
      );
};

  const chooseReel =
    async () => {
      if (
        busy
      ) {
        return;
      }

      const permission =
        await ImagePicker
          .requestMediaLibraryPermissionsAsync();

      if (
        !permission.granted
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
              videoMaxDuration:
                60,
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
                60,
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
      setPhoto(
        null
      );

      setReel(
        null
      );
    };

  const publish =
    async () => {
      if (
        !user?.id ||
        busy
      ) {
        return;
      }

      const cleanBody =
        body.trim();

      if (
        !cleanBody &&
        !photo &&
        !reel
      ) {
        Alert.alert(
          'Nothing to Post',
          'Write a message, add a photo, or select a Reel first.'
        );

        return;
      }

      setBusy(
        true
      );

      let uploadedPath:
        string |
        null =
          null;

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

        if (
          photo
        ) {
          uploadedPath =
            `scope/${scope.scope_id}/${user.id}/post-${Date.now()}-${Math.random()
              .toString(
                36
              )
              .slice(
                2
              )}.jpg`;

          const {
            error:
              uploadError,
          } =
            await supabase
              .storage
              .from(
                'community-media'
              )
              .upload(
                uploadedPath,
                decode(
                  photo.base64
                ),
                {
                  contentType:
                    'image/jpeg',
                  upsert:
                    false,
                }
              );

          if (
            uploadError
          ) {
            throw uploadError;
          }

          mediaMime =
            'image/jpeg';

          mediaSize =
            photo.sizeBytes;
        }

        if (
          reel
        ) {
          const extension =
            videoExtension(
              reel.mimeType
            );

          uploadedPath =
            `scope/${scope.scope_id}/${user.id}/reel-${Date.now()}-${Math.random()
              .toString(
                36
              )
              .slice(
                2
              )}.${extension}`;
          /*
           * PATCH_173F_R3_MEMORY_SAFE_SCOPE_REEL
           * Native file upload; no base64 video allocation.
           */
          await uploadCommunityVideoFile({
            path:
              uploadedPath,
            uri:
              reel.uri,
            contentType:
              reel.mimeType,
          });

          mediaMime =
            reel.mimeType;

          mediaSize =
            reel.sizeBytes ||
            null;

          duration =
            reel
              .durationSeconds;
        }

        const fallbackBody =
          reel
            ? 'Shared a Reel.'
            : photo
            ? 'Shared a photo.'
            : cleanBody;

        const {
          error:
            createError,
        } =
          await (
            supabase as any
          ).rpc(
            'buklod_scope_social_create_post_v1',
            {
              p_scope_id:
                scope.scope_id,
              p_body:
                cleanBody ||
                fallbackBody,
              p_category:
                'discussion',
              p_media_path:
                uploadedPath,
              p_media_mime_type:
                mediaMime,
              p_media_size_bytes:
                mediaSize,
              p_duration_seconds:
                duration,
            }
          );

        if (
          createError
        ) {
          throw createError;
        }

        setBody(
          ''
        );

        clearMedia();

        await load();
      }
      catch (
        error: any
      ) {
        if (
          uploadedPath
        ) {
          await supabase
            .storage
            .from(
              'community-media'
            )
            .remove(
              [
                uploadedPath,
              ]
            );
        }

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
      }
    };

  const react =
    async (
      post:
        SocialPost,
      reaction:
        Reaction
    ) => {
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
    };
  const loadComments =
    useCallback(
      async (
        postId:
          string
      ) => {
        const {
          data,
          error,
        } =
          await (
            supabase as any
          ).rpc(
            'buklod_scope_social_comments_v1',
            {
              p_scope_id:
                scope.scope_id,
              p_post_id:
                postId,
            }
          );

        if (
          error
        ) {
          Alert.alert(
            'Comments',
            error.message
          );

          return;
        }

        setComments(
          (
            data ??
            []
          ) as ScopeComment[]
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

      const channel =
        supabase
          .channel(
            `exclusive-scope-comments:${postId}:${Date.now()}:${Math.random().toString(36).slice(2)}`
          )
          .on(
            'postgres_changes',
            {
              event:
                '*',
              schema:
                'public',
              table:
                'comments',
              filter:
                `post_id=eq.${postId}`,
            },
            () => {
              void loadComments(
                postId
              );
            }
          )
          .subscribe();

      return () => {
        void supabase
          .removeChannel(
            channel
          );
      };
    },
    [
      commentOpen,
      commentPost?.id,
      loadComments,
    ]
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
              replyTo
                .commenter_name ??
                'BUKLOD Member'
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

  const deletePost =
    (
      post:
        SocialPost
    ) => {
      Alert.alert(
        'Delete Post',
        'Remove this post from this community?',
        [
          {
            text:
              'Cancel',
            style:
              'cancel',
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
                      Alert.alert(
                        'Delete Post',
                        error.message
                      );

                      return;
                    }

                    await load();
                  }
                )();
              },
          },
        ]
      );
    };

  const deleteComment =
    (
      comment:
        ScopeComment
    ) => {
      Alert.alert(
        'Delete Comment',
        'Remove this comment?',
        [
          {
            text:
              'Cancel',
            style:
              'cancel',
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
                      Alert.alert(
                        'Delete Comment',
                        error.message
                      );

                      return;
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
                  }
                )();
              },
          },
        ]
      );
    };

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
              <View
                style={
                  styles.avatar
                }
              >
                <MaterialCommunityIcons
                  name="account"
                  size={20}
                  color={
                    colors.white
                  }
                />
              </View>

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
                  {item.author_name ||
                    'BUKLOD Member'}
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

              {(
                item.is_owner ||
                item.can_manage
              ) && (
                <Pressable
                  onPress={() =>
                    deletePost(
                      item
                    )
                  }
                  hitSlop={8}
                  style={
                    styles.deleteButton
                  }
                >
                  <MaterialCommunityIcons
                    name="trash-can-outline"
                    size={18}
                    color={
                      colors.danger
                    }
                  />
                </Pressable>
              )}
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

              <Pressable
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
              </Pressable>
            </View>

            <View
              style={
                styles.publicReelReactionRow
              }
            >
              {RX.map(
                rx => {
                  const on =
                    item.my_reaction ===
                    rx.key;

                  return (
                    <Pressable
                      key={
                        rx.key
                      }
                      onPress={() =>
                        void react(
                          item,
                          rx.key
                        )
                      }
                      style={[
                        styles.publicReelReaction,
                        on &&
                          styles.publicReelReactionOn,
                      ]}
                    >
                      <Text
                        style={
                          styles.publicReelReactionEmoji
                        }
                      >
                        {rx.emoji}
                      </Text>

                      <Text
                        numberOfLines={1}
                        style={[
                          styles.publicReelReactionText,
                          on &&
                            styles.publicReelReactionTextOn,
                        ]}
                      >
                        {rx.label}
                      </Text>
                    </Pressable>
                  );
                }
              )}
            </View>

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
              <Pressable
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
              </Pressable>

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
            <View
              style={
                styles.avatar
              }
            >
              <MaterialCommunityIcons
                name="account"
                size={20}
                color={
                  colors.white
                }
              />
            </View>

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
                {item.author_name ||
                  'BUKLOD Member'}
              </Text>

              <Text
                style={
                  styles.meta
                }
              >
                {formatTime(
                  item.created_at
                )}
                {'  '}·{'  '}
                🔒 {scope.name}
              </Text>
            </View>

            {(
              item.is_owner ||
              item.can_manage
            ) && (
              <Pressable
                onPress={() =>
                  deletePost(
                    item
                  )
                }
                hitSlop={
                  8
                }
                style={
                  styles.deleteButton
                }
              >
                <MaterialCommunityIcons
                  name="trash-can-outline"
                  size={18}
                  color={
                    colors.danger
                  }
                />
              </Pressable>
            )}
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

          {!!item.media_url &&
            !isVideo && (
              <Image
                source={{
                  uri:
                    item.media_url,
                }}
                style={
                  styles.photo
                }
                resizeMode="cover"
              />
            )}

          {!!item.media_url &&
            isVideo && (
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
                    REEL
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

            <Pressable
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
            </Pressable>
          </View>

          <View
            style={
              styles.actionRow
            }
          >
            {RX.map(
              rx => {
                const on =
                  item.my_reaction ===
                  rx.key;

                return (
                  <Pressable
                    key={
                      rx.key
                    }
                    onPress={() =>
                      void react(
                        item,
                        rx.key
                      )
                    }
                    style={[
                      styles.reactionButton,
                      on &&
                        styles.reactionButtonOn,
                    ]}
                  >
                    <Text
                      style={
                        styles.reactionEmoji
                      }
                    >
                      {
                        rx.emoji
                      }
                    </Text>

                    <Text
                      style={[
                        styles.reactionLabel,
                        on &&
                          styles.reactionLabelOn,
                      ]}
                    >
                      {
                        rx.label
                      }
                    </Text>
                  </Pressable>
                );
              }
            )}
          </View>

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

          <Pressable
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
          </Pressable>
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
                        Posts, Reels, reactions,
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
          <Pressable
            onPress={() =>
              setMode(
                'wall'
              )
            }
            style={[
              styles.modeButton,
              mode ===
                'wall' &&
                styles.modeButtonOn,
            ]}
          >
            <MaterialCommunityIcons
              name="view-stream-outline"
              size={19}
              color={
                mode ===
                  'wall'
                  ? colors.white
                  : colors.greenDark
              }
            />

            <Text
              style={[
                styles.modeText,
                mode ===
                  'wall' &&
                  styles.modeTextOn,
              ]}
            >
              WALL
            </Text>
          </Pressable>

          <Pressable
            onPress={() =>
              setMode(
                'reels'
              )
            }
            style={[
              styles.modeButton,
              mode ===
                'reels' &&
                styles.modeButtonOn,
            ]}
          >
            <MaterialCommunityIcons
              name="movie-play-outline"
              size={19}
              color={
                mode ===
                  'reels'
                  ? colors.white
                  : colors.greenDark
              }
            />

            <Text
              style={[
                styles.modeText,
                mode ===
                  'reels' &&
                  styles.modeTextOn,
              ]}
            >
              REELS
            </Text>
          </Pressable>
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

          {!!photo && (
            <View
              style={
                styles.preview
              }
            >
              <Image
                source={{
                  uri:
                    photo.uri,
                }}
                style={
                  styles.previewImage
                }
              />

              <Pressable
                onPress={
                  clearMedia
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
{!!reel && (
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
                  hitSlop={8}
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
                      ? `${(
                          reel.sizeBytes /
                          1024 /
                          1024
                        ).toFixed(
                          1
                        )} MB`
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
                  disabled={
                    busy
                  }
                  onPress={() =>
                    void choosePhoto()
                  }
                  style={
                    styles.mediaButton
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
                      styles.mediaButtonText
                    }
                  >
                    Photo
                  </Text>
                </Pressable>

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
                    name="video-outline"
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
                    Video
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

          <Pressable
            disabled={
              busy ||
              (
                mode === 'reels'
                  ? !reel
                  : (
                      !body.trim() &&
                      !photo &&
                      !reel
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
                      !reel
                    )
                )
              ) &&
                styles.publishDisabled,
            ]}
          >
            {busy ? (
              <ActivityIndicator
                color={
                  colors.white
                }
              />
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
          visiblePosts
        }
        keyExtractor={
          item =>
            item.id
        }
        renderItem={
          renderPost
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
        contentContainerStyle={
          styles.content
        }
        keyboardShouldPersistTaps="handled"
        initialNumToRender={
          5
        }
        maxToRenderPerBatch={
          6
        }
        windowSize={
          7
        }
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
                hitSlop={
                  8
                }
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
                    <View
                      style={
                        styles.commentBubble
                      }
                    >
                      <View
                        style={
                          styles.commentTop
                        }
                      >
                        <Text
                          style={
                            styles.commentAuthor
                          }
                        >
                          {root.commenter_name ||
                            'BUKLOD Member'}
                        </Text>

                        {(
                          root.is_owner ||
                          root.can_manage
                        ) && (
                          <Pressable
                            onPress={() =>
                              deleteComment(
                                root
                              )
                            }
                            hitSlop={
                              8
                            }
                          >
                            <MaterialCommunityIcons
                              name="trash-can-outline"
                              size={15}
                              color={
                                colors.danger
                              }
                            />
                          </Pressable>
                        )}
                      </View>

                      <Text
                        style={
                          styles.commentBody
                        }
                      >
                        {root.body}
                      </Text>

                      <View
                        style={
                          styles.commentFooter
                        }
                      >
                        <Text
                          style={
                            styles.commentTime
                          }
                        >
                          {formatTime(
                            root.created_at
                          )}
                        </Text>

                        <Pressable
                          onPress={() => {
                            setReplyTo(
                              root
                            );

                            setCommentText(
                              ''
                            );
                          }}
                        >
                          <Text
                            style={
                              styles.replyLink
                            }
                          >
                            Reply
                          </Text>
                        </Pressable>
                      </View>
                    </View>

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

                          <View
                            style={[
                              styles.commentBubble,
                              styles.replyBubble,
                            ]}
                          >
                            <View
                              style={
                                styles.commentTop
                              }
                            >
                              <Text
                                style={
                                  styles.commentAuthor
                                }
                              >
                                {reply.commenter_name ||
                                  'BUKLOD Member'}
                              </Text>

                              {(
                                reply.is_owner ||
                                reply.can_manage
                              ) && (
                                <Pressable
                                  onPress={() =>
                                    deleteComment(
                                      reply
                                    )
                                  }
                                  hitSlop={
                                    8
                                  }
                                >
                                  <MaterialCommunityIcons
                                    name="trash-can-outline"
                                    size={15}
                                    color={
                                      colors.danger
                                    }
                                  />
                                </Pressable>
                              )}
                            </View>

                            <Text
                              style={
                                styles.commentBody
                              }
                            >
                              {repairMojibakeText(reply.body)}
                            </Text>

                            <View
                              style={
                                styles.commentFooter
                              }
                            >
                              <Text
                                style={
                                  styles.commentTime
                                }
                              >
                                {formatTime(
                                  reply.created_at
                                )}
                              </Text>

                              <Pressable
                                onPress={() => {
                                  setReplyTo(
                                    root
                                  );

                                  setCommentText(
                                    `@${reply.commenter_name || 'BUKLOD Member'} `
                                  );
                                }}
                              >
                                <Text
                                  style={
                                    styles.replyLink
                                  }
                                >
                                  Reply
                                </Text>
                              </Pressable>
                            </View>
                          </View>
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
                <Text
                  style={
                    styles.replyingText
                  }
                  numberOfLines={
                    1
                  }
                >
                  Replying to{' '}
                  {replyTo.commenter_name ||
                    'BUKLOD Member'}
                </Text>

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
              style={
                styles.commentComposer
              }
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

          setPhoto({
            uri: edited.uri,
            base64: edited.base64,
            sizeBytes: edited.sizeBytes,
          });

          setReel(null);
          setScopePhotoEditorUri(null);
        }}
      />
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
        width:
          '100%',
        height:
          330,
        borderRadius:
          14,
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