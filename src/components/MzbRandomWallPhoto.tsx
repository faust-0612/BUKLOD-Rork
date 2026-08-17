import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  router,
} from 'expo-router';

import {
  supabase,
} from '@/lib/supabase';

import {
  colors,
} from '@/lib/theme';

import {
  useBuklodScope,
} from '@/providers/BuklodScopeProvider';

/*
 * PATCH_173C_R3_MZB_RANDOM_WALL_PHOTO
 *
 * HOME PREVIEW:
 * - exact MZB Organization scope only
 * - image posts only
 * - no Public feed
 * - no text-only posts
 * - no Reels/video
 * - no author/caption/reactions/comments
 */

type ScopePhotoPost = {
  id: string;
  media_path: string | null;
  media_mime_type: string | null;
};

type RandomPhoto = {
  id: string;
  mediaUrl: string;
};

function shuffle<T>(
  input: T[],
): T[] {
  const copy =
    [...input];

  for (
    let index =
      copy.length - 1;
    index > 0;
    index--
  ) {
    const swapIndex =
      Math.floor(
        Math.random() *
          (index + 1),
      );

    const hold =
      copy[index];

    copy[index] =
      copy[swapIndex];

    copy[swapIndex] =
      hold;
  }

  return copy;
}

function isImagePost(
  post: ScopePhotoPost,
): boolean {
  if (!post.media_path) {
    return false;
  }

  const mime =
    String(
      post.media_mime_type ??
        '',
    )
      .trim()
      .toLowerCase();

  if (
    mime.startsWith(
      'image/',
    )
  ) {
    return true;
  }

  if (
    mime.startsWith(
      'video/',
    )
  ) {
    return false;
  }

  return /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(
    post.media_path,
  );
}

export default function
MzbRandomWallPhoto() {
  const {
    scopes,
    loading: scopesLoading,
  } =
    useBuklodScope();

  const mzbScope =
    useMemo(
      () =>
        (
          scopes as any[]
        ).find(
          scope =>
            scope?.scope_type ===
              'ORGANIZATION' &&
            (
              String(
                scope?.name ??
                  '',
              )
                .toLowerCase()
                .includes(
                  'mzb ministry',
                ) ||
              String(
                scope?.metadata
                  ?.is_mzb ??
                  '',
              )
                .toLowerCase() ===
                'true'
            ) &&
            (
              !scope
                ?.membership_status ||
              scope
                ?.membership_status ===
                'ACTIVE'
            ),
        ) ?? null,
      [
        scopes,
      ],
    );

  const mzbScopeId =
    String(
      mzbScope?.scope_id ??
        '',
    );

  const [
    photo,
    setPhoto,
  ] =
    useState<
      RandomPhoto | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    failed,
    setFailed,
  ] =
    useState(false);

  const loadRandomPhoto =
    useCallback(
      async () => {
        if (!mzbScopeId) {
          setPhoto(null);
          setFailed(false);
          setLoading(
            scopesLoading,
          );

          return;
        }

        setLoading(true);
        setFailed(false);

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
                  mzbScopeId,
                p_limit:
                  120,
              },
            );

          if (error) {
            throw error;
          }

          const photoPool =
            shuffle(
              (
                data ?? []
              ) as ScopePhotoPost[],
            ).filter(
              isImagePost,
            );

          let resolved:
            RandomPhoto | null =
            null;

          for (
            const candidate
            of photoPool
          ) {
            if (
              !candidate.media_path
            ) {
              continue;
            }

            const {
              data: signed,
              error:
                signedError,
            } =
              await supabase
                .storage
                .from(
                  'community-media',
                )
                .createSignedUrl(
                  candidate
                    .media_path,
                  3600,
                );

            if (
              signedError ||
              !signed?.signedUrl
            ) {
              continue;
            }

            resolved = {
              id:
                candidate.id,
              mediaUrl:
                signed.signedUrl,
            };

            break;
          }

          setPhoto(
            resolved,
          );
        }
        catch (error) {
          console.warn(
            'MZB Home wall photo:',
            error,
          );

          setPhoto(null);
          setFailed(true);
        }
        finally {
          setLoading(false);
        }
      },
      [
        mzbScopeId,
        scopesLoading,
      ],
    );

  useEffect(
    () => {
      void loadRandomPhoto();
    },
    [
      loadRandomPhoto,
    ],
  );

  const openWall =
    useCallback(
      () => {
        router.push(
          '/mzb/community' as any,
        );
      },
      [],
    );

  return (
    <View
      style={
        styles.section
      }
    >
      <View
        style={
          styles.header
        }
      >
        <View
          style={
            styles.headerLabel
          }
        >
          <MaterialCommunityIcons
            name="image-multiple-outline"
            size={18}
            color={
              colors.greenDark
            }
          />

          <View>
            <Text
              style={
                styles.title
              }
            >
              MZB WALL
            </Text>

            <Text
              style={
                styles.subtitle
              }
            >
              Random photo from MZB Community
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show another MZB Community photo"
          disabled={
            loading ||
            !mzbScopeId
          }
          onPress={() =>
            void loadRandomPhoto()
          }
          style={({
            pressed,
          }) => [
            styles.shuffle,
            pressed && {
              opacity: 0.6,
            },
            (
              loading ||
              !mzbScopeId
            ) && {
              opacity: 0.42,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="shuffle-variant"
            size={19}
            color={
              colors.greenDark
            }
          />
        </Pressable>
      </View>

      {loading ||
      scopesLoading ? (
        <View
          style={
            styles.state
          }
        >
          <ActivityIndicator
            color={
              colors.greenDark
            }
          />
        </View>
      ) : !mzbScopeId ? (
        <View
          style={
            styles.state
          }
        >
          <MaterialCommunityIcons
            name="account-group-outline"
            size={25}
            color={
              colors.muted
            }
          />

          <Text
            style={
              styles.stateText
            }
          >
            MZB Community is unavailable.
          </Text>
        </View>
      ) : failed ? (
        <Pressable
          onPress={() =>
            void loadRandomPhoto()
          }
          style={
            styles.state
          }
        >
          <MaterialCommunityIcons
            name="refresh"
            size={25}
            color={
              colors.muted
            }
          />

          <Text
            style={
              styles.stateText
            }
          >
            Tap to retry MZB photo.
          </Text>
        </Pressable>
      ) : !photo ? (
        <Pressable
          onPress={
            openWall
          }
          style={
            styles.state
          }
        >
          <MaterialCommunityIcons
            name="image-outline"
            size={25}
            color={
              colors.muted
            }
          />

          <Text
            style={
              styles.stateText
            }
          >
            No MZB photo post yet.
          </Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open MZB Community Wall"
          onPress={
            openWall
          }
          style={({
            pressed,
          }) => [
            styles.photoCard,
            pressed && {
              opacity: 0.94,
            },
          ]}
        >
          {/*
           * PHOTO ONLY:
           * no author, caption,
           * body, reactions or comments.
           */}
          <Image
            source={{
              uri:
                photo.mediaUrl,
            }}
            style={
              styles.photo
            }
            resizeMode="cover"
          />
        </Pressable>
      )}
    </View>
  );
}

const styles =
  StyleSheet.create({
    section: {
      marginBottom: 19,
    },

    header: {
      minHeight: 38,
      marginBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      gap: 10,
    },

    headerLabel: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    title: {
      fontSize: 9.5,
      lineHeight: 12,
      fontWeight: '900',
      letterSpacing: 0.8,
      color:
        colors.greenDark,
    },

    subtitle: {
      marginTop: 1,
      fontSize: 7.8,
      lineHeight: 10,
      color:
        colors.muted,
    },

    shuffle: {
      width: 34,
      height: 34,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.greenSoft,
    },

    photoCard: {
      width: '100%',
      overflow: 'hidden',
      borderRadius: 18,
      borderWidth: 1,
      borderColor:
        colors.line,
      backgroundColor:
        '#EEF1EF',
    },

    photo: {
      width: '100%',
      aspectRatio: 4 / 3,
      backgroundColor:
        '#EEF1EF',
    },

    state: {
      minHeight: 126,
      borderRadius: 18,
      borderWidth: 1,
      borderColor:
        colors.line,
      backgroundColor:
        colors.white,
      alignItems: 'center',
      justifyContent:
        'center',
      gap: 7,
      padding: 16,
    },

    stateText: {
      textAlign: 'center',
      fontSize: 9,
      lineHeight: 13,
      color:
        colors.muted,
    },
  });