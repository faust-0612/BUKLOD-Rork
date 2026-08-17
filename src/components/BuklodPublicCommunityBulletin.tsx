import { Animated } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import React, {
  useCallback,
  useEffect,
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
import { colors } from '@/lib/theme';

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
  const [
    photo,
    setPhoto,
  ] =
    useState<
      RandomPhoto | null
    >(null);

  const [
    spotlightReveal,
  ] =
    useState(
      () =>
        new Animated.Value(0),
    );

  const [
    spotlightDrift,
  ] =
    useState(
      () =>
        new Animated.Value(0),
    );

  useEffect(
    () => {
      spotlightReveal.setValue(
        0,
      );

      spotlightDrift.setValue(
        0,
      );

      const reveal =
        Animated.timing(
          spotlightReveal,
          {
            toValue:
              1,

            duration:
              420,

            useNativeDriver:
              true,
          },
        );

      const drift =
        Animated.loop(
          Animated.sequence([
            Animated.timing(
              spotlightDrift,
              {
                toValue:
                  1,

                duration:
                  4200,

                useNativeDriver:
                  true,
              },
            ),

            Animated.timing(
              spotlightDrift,
              {
                toValue:
                  0,

                duration:
                  4200,

                useNativeDriver:
                  true,
              },
            ),
          ]),
        );

      reveal.start();

      if (photo) {
        drift.start();
      }

      return () => {
        reveal.stop();
        drift.stop();
      };
    },
    [
      photo?.id,
      spotlightDrift,
      spotlightReveal,
    ],
  );


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
        <View
          style={
            styles.state
          }
        >
          <ActivityIndicator
            color={
              colors.green
            }
          />
        </View>
      ) : failed ? (
        <View
          style={
            styles.state
          }
        >
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
      ) : !photo ? (
        <View
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
            No Public Community photo post yet.
          </Text>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Community post"
          onPress={
            openPost
          }
          style={({
            pressed,
          }) => [
            styles.photoCard,
            {
              borderRadius:
                24,

              backgroundColor:
                '#0E2D1D',

              borderWidth:
                1,

              borderColor:
                'rgba(18,61,38,0.12)',

              shadowColor:
                '#000000',

              shadowOffset: {
                width:
                  0,

                height:
                  8,
              },

              shadowOpacity:
                0.13,

              shadowRadius:
                18,

              elevation:
                6,
            },
            pressed && {
              opacity: 0.94,
            },
          ]}
        >
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
          <Animated.View
            style={{
              opacity:
                spotlightReveal,

              transform: [
                {
                  scale:
                    spotlightDrift.interpolate({
                      inputRange:
                        [0, 1],

                      outputRange:
                        [1, 1.035],
                    }),
                },
              ],
            }}
          >
            <ExpoImage
              source={{
                uri:
                  photo.mediaUrl,
              }}
              style={
                styles.photo
              }
              contentFit="cover"
              transition={320}
            />
          </Animated.View>

          <View
            pointerEvents="none"
            style={{
              position:
                'absolute',

              left:
                0,

              right:
                0,

              top:
                0,

              height:
                88,

              backgroundColor:
                'rgba(4,20,12,0.14)',
            }}
          />

          <View
            pointerEvents="none"
            style={{
              position:
                'absolute',

              left:
                0,

              right:
                0,

              bottom:
                0,

              height:
                116,

              backgroundColor:
                'rgba(4,20,12,0.28)',
            }}
          />

          <View
            pointerEvents="none"
            style={{
              position:
                'absolute',

              left:
                12,

              top:
                12,

              flexDirection:
                'row',

              alignItems:
                'center',

              paddingHorizontal:
                10,

              paddingVertical:
                7,

              borderRadius:
                999,

              backgroundColor:
                'rgba(9,36,22,0.68)',

              borderWidth:
                1,

              borderColor:
                'rgba(255,255,255,0.18)',
            }}
          >
            <MaterialCommunityIcons
              name="image-multiple-outline"
              size={14}
              color="#FFFFFF"
            />

            <Text
              style={{
                marginLeft:
                  6,

                color:
                  '#FFFFFF',

                fontSize:
                  9,

                fontWeight:
                  '900',

                letterSpacing:
                  0.55,
              }}
            >
              BUKLOD COMMUNITY
            </Text>
          </View>

          <View
            pointerEvents="none"
            style={{
              position:
                'absolute',

              right:
                12,

              bottom:
                12,

              flexDirection:
                'row',

              alignItems:
                'center',

              paddingHorizontal:
                11,

              paddingVertical:
                8,

              borderRadius:
                999,

              backgroundColor:
                'rgba(255,255,255,0.90)',

              borderWidth:
                1,

              borderColor:
                'rgba(255,255,255,0.72)',
            }}
          >
            <Text
              style={{
                color:
                  '#123D26',

                fontSize:
                  9,

                fontWeight:
                  '900',

                letterSpacing:
                  0.45,
              }}
            >
              OPEN POST
            </Text>

            <MaterialCommunityIcons
              name="arrow-top-right"
              size={14}
              color="#123D26"
              style={{
                marginLeft:
                  5,
              }}
            />
          </View>
        </Pressable>
      )}
    </View>
  );
}

const styles =
  StyleSheet.create({
    section: {
      marginTop: 12,
      marginBottom: 12,
    },

    header: {
      minHeight: 34,
      marginBottom: 8,
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
      borderRadius: 16,
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
      minHeight: 190,
      borderWidth:
        StyleSheet
          .hairlineWidth,
      borderColor:
        colors.line,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent:
        'center',
      gap: 8,
      padding: 16,
      backgroundColor:
        colors.white,
    },

    stateText: {
      fontSize: 11,
      color: colors.muted,
      textAlign: 'center',
    },
  });