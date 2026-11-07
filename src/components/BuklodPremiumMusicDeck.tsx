/*
 * PATCH_178C_R3_PREMIUM_BUKLOD_MUSIC_DECK
 * PATCH_178C_R4_PLAYBACK_FIX
 * PATCH_178C_R5_FULL_LIBRARY
 */

import {
  Animated,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  setAudioModeAsync,
  setIsAudioActiveAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';

import {
  supabase,
} from '@/lib/supabase';
import { requestBuklodAudioFocus, subscribeBuklodAudioFocus } from '@/lib/buklodAudioFocus';


type MusicTrack = {
  id: string;
  title: string;
  artist: string | null;
  audio_path: string;
  mime_type: string | null;
};


const SYNC_INTERVAL_MS =
  45 * 1000;


function cleanText(
  value: unknown
): string {
  return String(
    value ?? ''
  ).trim();
}


export default function BuklodPremiumMusicDeck() {
  const [
    tracks,
    setTracks,
  ] =
    useState<MusicTrack[]>([]);

  const [
    selected,
    setSelected,
  ] =
    useState<MusicTrack | null>(
      null
    );

  const [
    loadedTrackId,
    setLoadedTrackId,
  ] =
    useState('');

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    loadError,
    setLoadError,
  ] =
    useState('');

  const [
    playError,
    setPlayError,
  ] =
    useState('');

  const player =
    useAudioPlayer(
      null
    );

  const playerStatus =
    useAudioPlayerStatus(
      player
    );

  useEffect(() => subscribeBuklodAudioFocus(owner => {
    if (owner !== 'music-deck') player.pause();
  }), [player]);

  const isPlaying =
    Boolean(
      playerStatus?.playing
    );

  const audioIsLoaded =
    Boolean(
      playerStatus?.isLoaded
    );

  const runtimeAudioError =
    cleanText(
      playerStatus?.error
    );

  const equalizer =
    useRef(
      new Animated.Value(0)
    ).current;


  const loadTracks =
    useCallback(
      async (
        quiet:
          boolean = false
      ) => {
        if (!quiet) {
          setLoading(
            true
          );
        }

        try {
          setLoadError(
            ''
          );

          const query =
            (
              supabase as any
            )
              .from(
                'buklod_music_library'
              )
              .select(
                'id,title,artist,audio_path,mime_type'
              )
              .eq(
                'is_active',
                true
              )
              .order(
                'sort_order',
                {
                  ascending:
                    true,
                }
              )
              .order(
                'title',
                {
                  ascending:
                    true,
                }
              );

          let result =
            await query;

          if (
            result.error
          ) {
            result =
              await (
                supabase as any
              )
                .from(
                  'buklod_music_library'
                )
                .select(
                  'id,title,artist,audio_path,mime_type'
                )
                .eq(
                  'is_active',
                  true
                )
                .order(
                  'title',
                  {
                    ascending:
                      true,
                  }
                );
          }

          if (
            result.error
          ) {
            throw result.error;
          }

          const rows:
            any[] =
            Array.isArray(
              result.data
            )
              ? result.data
              : [];

          const nextTracks:
            MusicTrack[] =
            rows
              .map(
                (
                  row:
                    any
                ) => ({
                  id:
                    cleanText(
                      row?.id
                    ),

                  title:
                    cleanText(
                      row?.title
                    ) ||
                    'Untitled',

                  artist:
                    cleanText(
                      row?.artist
                    ) ||
                    null,

                  audio_path:
                    cleanText(
                      row?.audio_path
                    ),

                  mime_type:
                    cleanText(
                      row?.mime_type
                    ) ||
                    null,
                })
              )
              .filter(
                (
                  track:
                    MusicTrack
                ) =>
                  Boolean(
                    track.id &&
                    track.audio_path
                  )
              );

          setTracks(
            nextTracks
          );

          setSelected(
            current => {
              if (
                current &&
                nextTracks.some(
                  track =>
                    track.id ===
                    current.id
                )
              ) {
                return current;
              }

              return (
                nextTracks[0] ??
                null
              );
            }
          );
        }
        catch (
          error:
            any
        ) {
          setLoadError(
            error?.message ||
              'Music library is unavailable.'
          );
        }
        finally {
          if (!quiet) {
            setLoading(
              false
            );
          }
        }
      },
      []
    );


  useEffect(
    () => {
      void loadTracks();

      const timer =
        setInterval(
          () => {
            void loadTracks(
              true
            );
          },
          SYNC_INTERVAL_MS
        );

      return () => {
        clearInterval(
          timer
        );

        try {
          player.pause();
        }
        catch {
          // no-op
        }
      };
    },
    [
      loadTracks,
      player,
    ]
  );


  useEffect(
    () => {
      let loop:
        any =
        null;

      if (
        isPlaying
      ) {
        equalizer.setValue(
          0
        );

        loop =
          Animated.loop(
            Animated.sequence([
              Animated.timing(
                equalizer,
                {
                  toValue:
                    1,

                  duration:
                    460,

                  useNativeDriver:
                    true,
                }
              ),

              Animated.timing(
                equalizer,
                {
                  toValue:
                    0,

                  duration:
                    460,

                  useNativeDriver:
                    true,
                }
              ),
            ])
          );

        loop.start();
      }
      else {
        equalizer.stopAnimation();
        equalizer.setValue(
          0
        );
      }

      return () => {
        if (
          loop &&
          typeof loop.stop ===
            'function'
        ) {
          loop.stop();
        }
      };
    },
    [
      equalizer,
      isPlaying,
    ]
  );


  const selectTrack =
    (
      track:
        MusicTrack
    ) => {
      try {
        player.pause();
      }
      catch {
        // no-op
      }

      setPlayError(
        ''
      );

      setSelected(
        track
      );
    };


  const sleep =
    (
      milliseconds:
        number
    ) =>
      new Promise<void>(
        resolve => {
          setTimeout(
            resolve,
            milliseconds
          );
        }
      );


  const activateAudio =
    async () => {
      /*
       * A different BUKLOD audio surface may have disabled
       * the global audio subsystem. Re-enable it only after
       * the user explicitly taps Play.
       */
      await setIsAudioActiveAsync(
        true
      );

      await setAudioModeAsync({
        playsInSilentMode:
          true,

        shouldRouteThroughEarpiece:
          false,
      });

      player.volume =
        1;
    };


  const resolveTrackUrl =
    async (
      track:
        MusicTrack
    ): Promise<string> => {
      const rawPath =
        cleanText(
          track.audio_path
        );

      if (!rawPath) {
        throw new Error(
          'This music track has no audio path.'
        );
      }

      if (
        /^https?:\/\//i.test(
          rawPath
        )
      ) {
        return rawPath;
      }

      const noLeadingSlash =
        rawPath.replace(
          /^\/+/, 
          ''
        );

      const withoutBucket =
        noLeadingSlash.replace(
          /^buklod-music-library\//i,
          ''
        );

      const candidates =
        Array.from(
          new Set([
            noLeadingSlash,
            withoutBucket,
          ])
        ).filter(
          Boolean
        );

      let lastMessage =
        '';

      for (
        const candidate
        of candidates
      ) {
        const {
          data,
          error,
        } =
          await (
            supabase as any
          )
            .storage
            .from(
              'buklod-music-library'
            )
            .createSignedUrl(
              candidate,
              3600
            );

        const signedUrl =
          cleanText(
            data?.signedUrl
          );

        if (
          !error &&
          signedUrl
        ) {
          return signedUrl;
        }

        lastMessage =
          cleanText(
            error?.message
          ) ||
          lastMessage;
      }

      throw new Error(
        lastMessage ||
          'Could not create a secure music URL.'
      );
    };


  const waitForAudioReady =
    async () => {
      /*
       * player.replace() begins loading asynchronously.
       * Do not race play() against the new source.
       */
      await sleep(
        80
      );

      const startedAt =
        Date.now();

      while (
        !player.isLoaded &&
        Date.now() -
          startedAt <
          6000
      ) {
        await sleep(
          100
        );
      }

      if (
        !player.isLoaded
      ) {
        throw new Error(
          runtimeAudioError ||
            'Audio could not finish loading. Try another track.'
        );
      }
    };


  const toggleSelected =
    async () => {
      if (!selected) {
        return;
      }

      if (
        isPlaying &&
        loadedTrackId ===
          selected.id
      ) {
        player.pause();
        return;
      }

      try {
        setPlayError(
          ''
        );

        await activateAudio();

        if (
          loadedTrackId !==
          selected.id
        ) {
          player.pause();

          const signedUrl =
            await resolveTrackUrl(
              selected
            );

          /*
           * Expo Audio accepts a remote URL string
           * as an AudioSource. This also matches the
           * simple working player pattern elsewhere
           * in BUKLOD.
           */
          player.replace(
            signedUrl
          );

          setLoadedTrackId(
            selected.id
          );

          await waitForAudioReady();
        }
        else if (
          !player.isLoaded &&
          !audioIsLoaded
        ) {
          await waitForAudioReady();
        }

        if (
          playerStatus?.didJustFinish
        ) {
          await player.seekTo(
            0
          );
        }

        player.volume =
          1;

        /*
         * Manual user action only.
         * No effect in this component starts playback.
         */
        requestBuklodAudioFocus('music-deck');
        player.play();
      }
      catch (
        error:
          any
      ) {
        const message =
          cleanText(
            error?.message
          ) ||
          runtimeAudioError ||
          'Could not play this track.';

        console.warn(
          'BUKLOD Music playback:',
          message
        );

        setPlayError(
          message
        );
      }
    };


  const selectedPlaying =
    Boolean(
      selected &&
      isPlaying &&
      loadedTrackId ===
        selected.id
    );


  const barOne =
    equalizer.interpolate({
      inputRange:
        [0, 1],

      outputRange:
        [0.45, 1],
    });

  const barTwo =
    equalizer.interpolate({
      inputRange:
        [0, 1],

      outputRange:
        [1, 0.55],
    });

  const barThree =
    equalizer.interpolate({
      inputRange:
        [0, 1],

      outputRange:
        [0.60, 0.95],
    });


  return (
    <View
      style={{
        marginHorizontal:
          12,

        marginTop:
          3,

        marginBottom:
          12,

        borderRadius:
          28,

        backgroundColor:
          '#0E2D1D',

        overflow:
          'hidden',

        shadowColor:
          '#000000',

        shadowOffset: {
          width:
            0,

          height:
            7,
        },

        shadowOpacity:
          0.16,

        shadowRadius:
          18,

        elevation:
          6,
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position:
            'absolute',

          right:
            -54,

          top:
            -62,

          width:
            180,

          height:
            180,

          borderRadius:
            90,

          backgroundColor:
            '#2F8E58',

          opacity:
            0.22,
        }}
      />

      <View
        pointerEvents="none"
        style={{
          position:
            'absolute',

          left:
            -42,

          bottom:
            -72,

          width:
            160,

          height:
            160,

          borderRadius:
            80,

          backgroundColor:
            '#D6F0DF',

          opacity:
            0.08,
        }}
      />

      <View
        style={{
          paddingHorizontal:
            16,

          paddingTop:
            15,

          paddingBottom:
            12,

          flexDirection:
            'row',

          alignItems:
            'center',
        }}
      >
        <View
          style={{
            width:
              43,

            height:
              43,

            borderRadius:
              14,

            marginRight:
              11,

            alignItems:
              'center',

            justifyContent:
              'center',

            backgroundColor:
              'rgba(255,255,255,0.10)',

            borderWidth:
              1,

            borderColor:
              'rgba(255,255,255,0.12)',
          }}
        >
          <MaterialCommunityIcons
            name="music-note"
            size={23}
            color="#FFFFFF"
          />
        </View>

        <View
          style={{
            flex:
              1,
          }}
        >
          <Text
            style={{
              color:
                '#FFFFFF',

              fontSize:
                15,

              lineHeight:
                19,

              fontWeight:
                '900',

              letterSpacing:
                0.25,
            }}
          >
            BUKLOD Music
          </Text>

          <Text
            style={{
              marginTop:
                2,

              color:
                'rgba(255,255,255,0.64)',

              fontSize:
                10,

              lineHeight:
                14,

              fontWeight:
                '700',
            }}
          >
            Premium in-app library
          </Text>
        </View>

        <View
          style={{
            paddingHorizontal:
              9,

            paddingVertical:
              5,

            borderRadius:
              999,

            backgroundColor:
              'rgba(214,240,223,0.12)',

            borderWidth:
              1,

            borderColor:
              'rgba(214,240,223,0.16)',
          }}
        >
          <Text
            style={{
              color:
                '#D6F0DF',

              fontSize:
                8,

              fontWeight:
                '900',

              letterSpacing:
                0.65,
            }}
          >
            LIVE
          </Text>
        </View>
      </View>

      {loading ? (
        <View
          style={{
            minHeight:
              108,

            alignItems:
              'center',

            justifyContent:
              'center',
          }}
        >
          <Text
            style={{
              color:
                'rgba(255,255,255,0.70)',

              fontSize:
                11,

              fontWeight:
                '700',
            }}
          >
            Syncing music library…
          </Text>
        </View>
      ) : tracks.length === 0 ? (
        <View
          style={{
            paddingHorizontal:
              16,

            paddingBottom:
              17,
          }}
        >
          <View
            style={{
              padding:
                14,

              borderRadius:
                18,

              backgroundColor:
                'rgba(255,255,255,0.07)',

              borderWidth:
                1,

              borderColor:
                'rgba(255,255,255,0.08)',
            }}
          >
            <Text
              style={{
                color:
                  '#FFFFFF',

                fontSize:
                  12,

                fontWeight:
                  '900',
              }}
            >
              No approved tracks yet
            </Text>

            <Text
              style={{
                marginTop:
                  4,

                color:
                  'rgba(255,255,255,0.58)',

                fontSize:
                  10,

                lineHeight:
                  14,
              }}
            >
              Active BUKLOD library tracks will appear here automatically.
            </Text>

            {!!loadError && (
              <Text
                style={{
                  marginTop:
                    7,

                  color:
                    '#FFD3D3',

                  fontSize:
                    9,
                }}
              >
                {loadError}
              </Text>
            )}
          </View>
        </View>
      ) : (
        <>
          <View
            style={{
              paddingHorizontal:
                16,

              paddingBottom:
                12,
            }}
          >
            <View
              style={{
                flexDirection:
                  'row',

                alignItems:
                  'center',

                padding:
                  13,

                borderRadius:
                  20,

                backgroundColor:
                  'rgba(255,255,255,0.09)',

                borderWidth:
                  1,

                borderColor:
                  'rgba(255,255,255,0.11)',
              }}
            >
              <View
                style={{
                  width:
                    52,

                  height:
                    52,

                  borderRadius:
                    17,

                  marginRight:
                    12,

                  alignItems:
                    'center',

                  justifyContent:
                    'center',

                  backgroundColor:
                    '#D6F0DF',
                }}
              >
                <Text
                  numberOfLines={
                    1
                  }
                  style={{
                    maxWidth:
                      34,

                    color:
                      '#17452B',

                    fontSize:
                      22,

                    fontWeight:
                      '900',
                  }}
                >
                  {
                    (
                      selected?.title ??
                      'B'
                    )
                      .slice(
                        0,
                        1
                      )
                      .toUpperCase()
                  }
                </Text>
              </View>

              <View
                style={{
                  flex:
                    1,

                  minWidth:
                    0,
                }}
              >
                <Text
                  numberOfLines={
                    1
                  }
                  style={{
                    color:
                      '#FFFFFF',

                    fontSize:
                      13,

                    lineHeight:
                      17,

                    fontWeight:
                      '900',
                  }}
                >
                  {
                    selected?.title ??
                    'Select a track'
                  }
                </Text>

                <Text
                  numberOfLines={
                    1
                  }
                  style={{
                    marginTop:
                      3,

                    color:
                      'rgba(255,255,255,0.58)',

                    fontSize:
                      9.5,

                    lineHeight:
                      13,

                    fontWeight:
                      '700',
                  }}
                >
                  {
                    selected?.artist ||
                    'BUKLOD Music Library'
                  }
                </Text>
              </View>

              <View
                style={{
                  width:
                    31,

                  height:
                    24,

                  marginHorizontal:
                    8,

                  flexDirection:
                    'row',

                  alignItems:
                    'center',

                  justifyContent:
                    'space-between',
                }}
              >
                {[
                  barOne,
                  barTwo,
                  barThree,
                ].map(
                  (
                    scaleY,
                    index
                  ) => (
                    <Animated.View
                      key={
                        index
                      }
                      style={{
                        width:
                          3,

                        height:
                          17,

                        borderRadius:
                          3,

                        backgroundColor:
                          '#A9E7BE',

                        transform: [
                          {
                            scaleY:
                              scaleY as any,
                          },
                        ],

                        opacity:
                          selectedPlaying
                            ? 1
                            : 0.38,
                      }}
                    />
                  )
                )}
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  selectedPlaying
                    ? 'Pause music'
                    : 'Play music'
                }
                onPress={() => {
                  void toggleSelected();
                }}
                style={({
                  pressed,
                }) => ({
                  width:
                    43,

                  height:
                    43,

                  borderRadius:
                    22,

                  alignItems:
                    'center',

                  justifyContent:
                    'center',

                  backgroundColor:
                    '#FFFFFF',

                  opacity:
                    pressed
                      ? 0.78
                      : 1,
                })}
              >
                <MaterialCommunityIcons
                  name={
                    selectedPlaying
                      ? 'pause'
                      : 'play'
                  }
                  size={
                    22
                  }
                  color="#17452B"
                />
              </Pressable>
            </View>

            {!!(
              playError ||
              runtimeAudioError
            ) && (
              <Text
                style={{
                  marginTop:
                    7,

                  paddingHorizontal:
                    4,

                  color:
                    '#FFD3D3',

                  fontSize:
                    9,
                }}
              >
                {
                  playError ||
                  runtimeAudioError
                }
              </Text>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
            contentContainerStyle={{
              paddingLeft:
                16,

              paddingRight:
                16,

              paddingBottom:
                16,
            }}
          >
            {tracks.map(
              (
                track,
                index
              ) => {
                const active =
                  selected?.id ===
                  track.id;

                return (
                  <Pressable
                    key={
                      track.id
                    }
                    onPress={() => {
                      selectTrack(
                        track
                      );
                    }}
                    style={({
                      pressed,
                    }) => ({
                      width:
                        142,

                      padding:
                        11,

                      marginRight:
                        index ===
                        tracks.length - 1
                          ? 0
                          : 8,

                      borderRadius:
                        17,

                      backgroundColor:
                        active
                          ? 'rgba(214,240,223,0.16)'
                          : 'rgba(255,255,255,0.055)',

                      borderWidth:
                        1,

                      borderColor:
                        active
                          ? 'rgba(214,240,223,0.28)'
                          : 'rgba(255,255,255,0.07)',

                      opacity:
                        pressed
                          ? 0.72
                          : 1,
                    })}
                  >
                    <View
                      style={{
                        flexDirection:
                          'row',

                        alignItems:
                          'center',
                      }}
                    >
                      <View
                        style={{
                          width:
                            31,

                          height:
                            31,

                          borderRadius:
                            10,

                          marginRight:
                            8,

                          alignItems:
                            'center',

                          justifyContent:
                            'center',

                          backgroundColor:
                            active
                              ? '#D6F0DF'
                              : 'rgba(255,255,255,0.09)',
                        }}
                      >
                        <MaterialCommunityIcons
                          name="music-note"
                          size={
                            16
                          }
                          color={
                            active
                              ? '#17452B'
                              : '#D8E8DE'
                          }
                        />
                      </View>

                      <Text
                        numberOfLines={
                          2
                        }
                        style={{
                          flex:
                            1,

                          color:
                            '#FFFFFF',

                          fontSize:
                            10,

                          lineHeight:
                            13,

                          fontWeight:
                            '900',
                        }}
                      >
                        {track.title}
                      </Text>
                    </View>

                    <Text
                      numberOfLines={
                        1
                      }
                      style={{
                        marginTop:
                          8,

                        color:
                          'rgba(255,255,255,0.47)',

                        fontSize:
                          8.5,

                        fontWeight:
                          '700',
                      }}
                    >
                      {
                        track.artist ||
                        'BUKLOD Library'
                      }
                    </Text>
                  </Pressable>
                );
              }
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
}