/* PATCH_173G_R4_PROFILE_STATUS_BUBBLE */
import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  BUKLOD_HIT_SLOP,
  BUKLOD_HIT_SLOP_TIGHT,
} from '@/lib/buklodTouch';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  router,
  usePathname,
} from 'expo-router';

import {
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';

import {
  supabase,
} from '@/lib/supabase';

import {
  colors,
} from '@/lib/theme';

import {
  useAuth,
} from '@/providers/AuthProvider';

const BUCKET =
  'profile-status-media';

type ProfileStatus = {
  quick_note:
    | string
    | null;

  music_path:
    | string
    | null;

  music_title:
    | string
    | null;

  music_mime_type:
    | string
    | null;
};

export function BuklodProfileStatusBubble() {
  const {
    user,
  } = useAuth();

  const pathname =
    usePathname();

  const [profileStatus, setProfileStatus] =
    useState<ProfileStatus | null>(
      null
    );

  const [musicUrl, setMusicUrl] =
    useState('');

  // PATCH_174B_R4_RUNTIME_PROOF
  const [loadError, setLoadError] =
    useState('');

  const load =
    useCallback(
      async () => {
        if (!user?.id) {
          setProfileStatus(null);
          setMusicUrl('');
          setLoadError('');
          return;
        }

        setLoadError('');

        const {
          data,
          error,
        } =
          await (supabase as any)
            .from(
              'buklod_profile_status'
            )
            .select(
              'quick_note,music_path,music_title,music_mime_type'
            )
            .eq(
              'user_id',
              user.id
            )
            .maybeSingle();

        if (error) {
          console.warn(
            'Profile status:',
            error.message
          );
          setProfileStatus(null);
          setMusicUrl('');
          setLoadError(
            error.message ||
              'Could not load Note/Music.'
          );
          return;
        }

        const next =
          (data ?? null) as
            ProfileStatus | null;

        setProfileStatus(
          next
        );

        const path =
          String(
            next?.music_path ??
              ''
          ).trim();

        if (!path) {
          setMusicUrl('');
          return;
        }

        const {
          data: signed,
          error: signedError,
        } =
          await supabase.storage
            .from(BUCKET)
            .createSignedUrl(
              path,
              60 * 60
            );

        if (signedError) {
          console.warn(
            'Profile music URL:',
            signedError.message
          );
          setMusicUrl('');
          return;
        }

        setMusicUrl(
          signed?.signedUrl ??
            ''
        );
      },
      [
        user?.id,
      ]
    );

  useEffect(
    () => {
      void load();
    },
    [
      load,
      pathname,
    ]
  );

  const player =
    useAudioPlayer(
      musicUrl || null,
      {
        updateInterval:
          300,
      }
    );

  const audioStatus =
    useAudioPlayerStatus(
      player
    );

  const note =
    String(
      profileStatus
        ?.quick_note ??
        ''
    ).trim();

  const musicPath =
    String(
      profileStatus
        ?.music_path ??
        ''
    ).trim();

  const isEmpty =
    !note &&
    !musicPath;

  // R4 intentionally does NOT return null when empty/error.
  // This gives a visible runtime proof that the component is mounted.

  const toggleMusic =
    () => {
      if (!musicUrl) {
        return;
      }

      try {
        if (
          audioStatus.playing
        ) {
          player.pause();
        }
        else {
          player.play();
        }
      }
      catch (error) {
        console.warn(
          'Profile music:',
          error
        );
      }
    };

  return (
    <View
      style={
        styles.card
      }
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Edit Profile Note and Music"
        hitSlop={BUKLOD_HIT_SLOP}
        onPress={() =>
          router.push(
            '/profile/status' as any
          )
        }
        style={
          styles.edit
        }
      >
        <MaterialCommunityIcons
          name="pencil-outline"
          size={14}
          color={
            colors.greenDark
          }
        />
      </Pressable>

      {!!loadError && (
        <Text
          numberOfLines={2}
          style={
            styles.errorText
          }
        >
          Note/Music unavailable
        </Text>
      )}

      {!loadError && isEmpty && (
        <Text
          numberOfLines={2}
          style={
            styles.emptyText
          }
        >
          Add a profile note or music
        </Text>
      )}

      {!!note && (
        <Text
          numberOfLines={2}
          style={
            styles.note
          }
        >
          {note}
        </Text>
      )}

      {__DEV__ && (
        <Text
          pointerEvents="none"
          style={
            styles.devProof
          }
        >
          R4 LIVE
        </Text>
      )}

      {!!musicPath && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            audioStatus.playing
              ? 'Pause profile music'
              : 'Play profile music'
          }
          disabled={
            !musicUrl
          }
          onPress={
            toggleMusic
          }
          style={({ pressed }) => [
            styles.music,
            pressed && {
              opacity:
                0.72,
            },
            !musicUrl && {
              opacity:
                0.48,
            },
          ]}
        >
          <View
            style={
              styles.musicIcon
            }
          >
            <MaterialCommunityIcons
              name={
                audioStatus.playing
                  ? 'pause'
                  : 'music-note'
              }
              size={16}
              color="#FFFFFF"
            />
          </View>

          <Text
            numberOfLines={1}
            style={
              styles.musicTitle
            }
          >
            {
              profileStatus
                ?.music_title ||
              'Profile music'
            }
          </Text>

          <MaterialCommunityIcons
            name={
              audioStatus.playing
                ? 'pause-circle'
                : 'play-circle'
            }
            size={22}
            color={
              colors.greenDark
            }
          />
        </Pressable>
      )}

      <View
        pointerEvents="none"
        style={
          styles.tail
        }
      />
    </View>
  );
}

const styles =
  StyleSheet.create({
    card: {
      position:
        'absolute',
      right:
        0,
      bottom:
        108,
      width:
        218,
      minHeight:
        48,
      paddingHorizontal:
        12,
      paddingVertical:
        10,
      paddingRight:
        34,
      borderRadius:
        17,
      borderWidth:
        StyleSheet
          .hairlineWidth,
      borderColor:
        '#D8E7DE',
      backgroundColor:
        '#FFFFFF',
      shadowColor:
        '#0F2F22',
      shadowOpacity:
        0.16,
      shadowRadius:
        10,
      shadowOffset: {
        width:
          0,
        height:
          4,
      },
      elevation:
        12,
    },

    edit: {
      position:
        'absolute',
      top:
        8,
      right:
        8,
      width:
        25,
      height:
        25,
      borderRadius:
        13,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#EFF6F1',
    },

    note: {
      fontSize:
        13.5,
      lineHeight:
        17,
      fontWeight:
        '900',
      color:
        colors.text,
    },

    emptyText: {
      paddingRight:
        14,
      fontSize:
        11.5,
      lineHeight:
        15,
      fontWeight:
        '800',
      color:
        colors.greenDark,
    },

    errorText: {
      paddingRight:
        14,
      fontSize:
        11.5,
      lineHeight:
        15,
      fontWeight:
        '800',
      color:
        '#9B2C2C',
    },

    devProof: {
      position:
        'absolute',
      left:
        8,
      bottom:
        2,
      fontSize:
        7,
      fontWeight:
        '900',
      opacity:
        0.42,
      color:
        colors.greenDark,
    },

    music: {
      marginTop:
        7,
      minHeight:
        34,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        7,
      paddingVertical:
        4,
      paddingHorizontal:
        6,
      borderRadius:
        11,
      backgroundColor:
        '#F1F7F3',
    },

    musicIcon: {
      width:
        25,
      height:
        25,
      borderRadius:
        13,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.greenDark,
    },

    musicTitle: {
      flex:
        1,
      fontSize:
        10.5,
      fontWeight:
        '800',
      color:
        colors.greenDark,
    },

    tail: {
      position:
        'absolute',
      right:
        37,
      bottom:
        -7,
      width:
        14,
      height:
        14,
      backgroundColor:
        '#FFFFFF',
      borderRightWidth:
        StyleSheet
          .hairlineWidth,
      borderBottomWidth:
        StyleSheet
          .hairlineWidth,
      borderColor:
        '#D8E7DE',
      transform: [
        {
          rotate:
            '45deg',
        },
      ],
    },
  });