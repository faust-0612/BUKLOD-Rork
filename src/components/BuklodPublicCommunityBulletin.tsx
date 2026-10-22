import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import SquareMediaCard, {
  SquareMediaFrame,
} from '@/components/SquareMediaCard';

type PublicCommunityPhoto = {
  id: string;
  media_path: string | null;
  media_mime_type: string | null;
};

type RandomPhoto = {
  id: string;
  mediaUrl: string;
};

function shuffle<T>(
  source: T[],
): T[] {
  const copy = [...source];

  for (
    let index =
      copy.length - 1;
    index > 0;
    index -= 1
  ) {
    const swapWith =
      Math.floor(
        Math.random() *
          (index + 1),
      );

    [
      copy[index],
      copy[swapWith],
    ] = [
      copy[swapWith],
      copy[index],
    ];
  }

  return copy;
}

function isPhotoPost(
  post: PublicCommunityPhoto,
): boolean {
  const mediaPath =
    String(
      post.media_path ?? '',
    )
      .trim()
      .toLowerCase();

  const mime =
    String(
      post.media_mime_type ?? '',
    )
      .trim()
      .toLowerCase();

  if (!mediaPath) {
    return false;
  }

  if (
    mime.startsWith(
      'image/',
    )
  ) {
    return true;
  }

  /*
   * PATCH_178D_PREMIUM_COMMUNITY_SPOTLIGHT
   * Legacy Community media may not carry MIME metadata.
   * Explicitly keep animated GIF/APNG and modern image extensions.
   */
  return /\.(?:jpe?g|png|webp|gif|apng|avif|heic|heif)(?:\?.*)?$/.test(
    mediaPath,
  );
}

/* PATCH_170J_R3_HOME_RANDOM_COMMUNITY_PHOTO_ONLY */
export default function
BuklodPublicCommunityBulletin() {
  const {
    colors,
  } = useBuklodPresentation();
  const styles = useMemo(
    () => createStyles(colors),
    [colors]
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
        setLoading(true);
        setFailed(false);

        try {
          /*
           * Same mature Public Community feed currently used
           * by the Public Community screen.
           */
          const {
            data,
            error,
          } =
            await (
              supabase as any
            ).rpc(
              'get_buklod_public_community_feed_v5',
              {
                p_location_scope_id:
                  null,
                p_mode:
                  'for_you',
                p_limit:
                  100,
              },
            );

          if (error) {
            throw error;
          }

          const photoPool =
            shuffle(
              (
                data ?? []
              ) as PublicCommunityPhoto[],
            ).filter(
              isPhotoPost,
            );

          let resolved:
            RandomPhoto | null =
            null;

          /*
           * Try random candidates until one has a working
           * signed Community image URL.
           */
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
            'Home Community photo:',
            error,
          );

          setPhoto(null);
          setFailed(true);
        }
        finally {
          setLoading(false);
        }
      },
      [],
    );

  useEffect(
    () => {
      void loadRandomPhoto();
    },
    [loadRandomPhoto],
  );

  const openPost =
    useCallback(
      () => {
        if (!photo) {
          return;
        }

        router.push(
          `/post/${photo.id}` as any,
        );
      },
      [photo],
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

          <Text
            style={
              styles.title
            }
          >
            COMMUNITY SPOTLIGHT</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show another Community photo"
          disabled={loading}
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
            loading && {
              opacity: 0.45,
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

      {loading ? (
        <SquareMediaFrame>
          <View style={styles.stateInner}>
            <ActivityIndicator
              color={
                colors.green
              }
            />
          </View>
        </SquareMediaFrame>
      ) : failed ? (
        <SquareMediaFrame>
          <View style={styles.stateInner}>
            <MaterialCommunityIcons
              name="image-off-outline"
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
              Community photo unavailable.
            </Text>
          </View>
        </SquareMediaFrame>
      ) : !photo ? (
        <SquareMediaFrame>
          <View style={styles.stateInner}>
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
              No Public Community photo post yet.
            </Text>
          </View>
        </SquareMediaFrame>
      ) : (
        <SquareMediaCard
          uri={photo.mediaUrl}
          kenBurns
          accessibilityLabel="Open Community post"
          onPress={openPost}
          overlay={
            <>
              {/*
               * HOME PREVIEW = PHOTO ONLY.
               *
               * Deliberately omitted:
               * - author
               * - date/meta
               * - caption/body
               * - reactions
               * - comments
               */}
              <View
                style={styles.scrimTop}
              />
              <View
                style={styles.scrimBottom}
              />
              <View
                style={styles.communityChip}
              >
                <MaterialCommunityIcons
                  name="image-multiple-outline"
                  size={14}
                  color={colors.white}
                />
                <Text
                  style={[
                    styles.communityChipText,
                    { color: colors.white },
                  ]}
                >
                  BUKLOD COMMUNITY
                </Text>
              </View>
              <View
                style={[
                  styles.openChip,
                  { backgroundColor: colors.white },
                ]}
              >
                <Text
                  style={[
                    styles.openChipText,
                    { color: colors.greenDark },
                  ]}
                >
                  OPEN POST
                </Text>
                <MaterialCommunityIcons
                  name="arrow-top-right"
                  size={14}
                  color={colors.greenDark}
                  style={{ marginLeft: 5 }}
                />
              </View>
            </>
          }
        />
      )}
    </View>
  );
}

function createStyles(
  colors: ReturnType<
    typeof useBuklodPresentation
  >['colors']
) {
  return StyleSheet.create({
    section: {
      marginTop: 12,
      marginBottom: 12,
      width: '100%',
      alignSelf: 'stretch',
      paddingHorizontal: 0,
      marginHorizontal: 0,
    },

    header: {
      minHeight: 44,
      marginBottom: 8,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    headerLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },

    title: {
      fontSize: 13,
      fontWeight: '900',
      color: colors.text,
      letterSpacing: 0.5,
    },

    shuffle: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.greenSoft,
    },

    stateInner: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 16,
    },

    scrimTop: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      height: 88,
      backgroundColor: 'rgba(4,20,12,0.14)',
    },

    scrimBottom: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 116,
      backgroundColor: 'rgba(4,20,12,0.28)',
    },

    communityChip: {
      position: 'absolute',
      left: 12,
      top: 12,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: 'rgba(9,36,22,0.68)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
    },

    communityChipText: {
      marginLeft: 6,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.55,
    },

    openChip: {
      position: 'absolute',
      right: 12,
      bottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 11,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.72)',
    },

    openChipText: {
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.45,
    },

    stateText: {
      fontSize: 11,
      color: colors.muted,
      textAlign: 'center',
    },
  });
}